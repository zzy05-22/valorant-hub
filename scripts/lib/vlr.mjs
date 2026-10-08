// vlr.gg 抓取与解析（零依赖：fetch + 正则/字符串切割）
// 注：UA 保持纯 ASCII——HTTP header 无法携带非 latin1 字符（node fetch 会抛 ByteString 错误）
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) valorant-hub/1.0 (static info site project)' };

export async function fetchHtml(url) {
  // vlr.gg 存在标准 cookie 门：首次请求 302 + Set-Cookie abok=1，不带 cookie 会重定向循环。
  // 此处按 RFC 6265 语义维护 cookie 并自动重试（等价浏览器行为），非绕过反爬。
  let cookie = 'abok=1';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { ...UA, Cookie: cookie }, redirect: 'manual' });
    const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')].filter(Boolean);
    if (setCookies.length) {
      const jar = new Map(cookie.split('; ').filter(Boolean).map((c) => [c.split('=')[0], c]));
      for (const c of setCookies) {
        const [pair] = c.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (res.status >= 300 && res.status < 400) continue; // cookie 门重定向：带新 cookie 重试
    if (!res.ok) throw new Error(`VLR HTTP ${res.status} for ${url}`);
    return res.text();
  }
  throw new Error(`VLR redirect loop for ${url}`);
}

// 工具：去标签转文本
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

// 解析选手统计表（vlr.gg/stats：每行 <tr>，选手行 23 个 <td>，实测 100 行）
// 实测列号：[0]选手+战队缩写 [2]maps [3]rounds [4]rating [5]acs [6]kd [7]kast [8]adr
//           [18]kills [19]deaths [20]assists——与计划假设一致
export function parsePlayerStats(html) {
  const players = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? [];
    if (cells.length < 20) continue; // 选手统计行约 23 列
    const texts = cells.map(stripTags);
    const playerCell = texts[0];
    if (!playerCell) continue;
    // 实测选手单元格为 st-pl-name + st-pl-country 两个 div，strip 归一化后形如 "N4RRATE KC"
    const name = playerCell.replace(/\s+/g, ' ').trim();
    if (!/^[\w\s'-]+$/.test(name) || name.length < 3) continue;
    const num = (i) => Number(texts[i]?.replace(/[^\d.]/g, '')) || 0;
    players.push({
      name: name.split(' ')[0] || name,
      team: name.split(' ').slice(1).join(' '),
      maps: num(2), rounds: num(3),
      rating: num(4), acs: num(5), kd: num(6),
      kast: texts[7] ?? '', adr: num(8),
      kills: num(18), deaths: num(19), assists: num(20),
    });
  }
  return players;
}

// 解析战队排名（vlr.gg/rankings：wf-card 行，3 列）
// 实测结构：[0]rank-item-rank=排名序号 [1]rank-item-team=队名+rank-item-team-country(地区) [2]rank-item-rating=评分（非地区）
export function parseTeamRanking(html) {
  const teams = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  for (const row of rows) {
    const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) ?? [];
    if (cells.length < 3) continue;
    const texts = cells.map(stripTags);
    const rank = Number(texts[0]?.match(/^\d+$/)?.[0] ?? NaN);
    if (!Number.isFinite(rank)) continue;
    // 队名单元格内含独立地区 div：剔除后剩余文本即队名，地区从该 div 提取
    const teamCell = cells[1] ?? '';
    const countryDiv = teamCell.match(/rank-item-team-country[^>]*>([\s\S]*?)<\/div>/);
    const region = countryDiv ? stripTags(countryDiv[1]) : (texts[2] ?? '');
    const name = stripTags(countryDiv ? teamCell.replace(countryDiv[0], '') : teamCell).replace(/\s+/g, ' ').trim();
    if (!name || /^\d+$/.test(name)) continue;
    teams.push({ rank, name, region });
    if (teams.length >= 30) break;
  }
  return teams;
}

export function validateEsportsStats({ players, teams }) {
  if (!Array.isArray(players) || players.length < 50) return false;
  if (!Array.isArray(teams) || teams.length < 10) return false;
  if (!(players[0].rating > 1)) return false;
  return true;
}

// 文本清洗（matches 专用）：去标签 + 实体 + 空白归一（比 stripTags 多处理 &ndash;，不影响 stats/rankings 既有行为）
const cleanText = (s) => s
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&ndash;/g, '–')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

// 解析赛程赛果（vlr.gg/matches；2026-10-08 实测该页直接 200，无 cookie gate）
// 实测结构：
// - 日期分隔条：<div class="wf-label mod-large">Fri, October 9, 2026</div>（按出现顺序归入后续比赛块，无分隔条时为空串）
// - 比赛块：<a href="..." class="wf-module-item match-item ...">…</a>
// - 队名：match-item-vs-team-name > text-of（内含 flag span + 队名）
// - 比分：match-item-vs-team-score；未开赛 class 含 mod-upcoming、值为 &ndash;；
//   已结束值为数字，results 页胜者队在 match-item-vs-team 的 class 含 mod-winner（实测），
//   亦兼容 score class 含 mod-win 的写法（计划探测结构），数字不等时再兜底取大者
// - 状态：ml-status（Upcoming/Live/Completed 等；非 Live 且双方比分均为数字 → completed）
// - 赛事：match-item-event 内含 match-item-event-series 子 div；实测 series 在前、赛事名在后，
//   与计划探测的"赛事名在前"顺序相反——两种顺序均按"剔除 series div 后剩余文本即赛事名"兼容处理
export function parseMatches(html) {
  const matches = [];
  const tokens = html.match(
    /<div class="wf-label mod-large">[\s\S]*?<\/div>|<a\b[^>]*\bclass="[^"]*\bmatch-item\b[^"]*"[^>]*>[\s\S]*?<\/a>/g,
  ) ?? [];
  let date = '';
  for (const tok of tokens) {
    if (tok.startsWith('<div class="wf-label')) {
      // 今天的分隔条内含 <span class="wf-tag">Today</span> 标记（results 页还有 Yesterday），剥掉后保留纯日期
      date = cleanText(tok.replace(/^<div class="wf-label[^>]*>/, '').replace(/<\/div>$/, '')).replace(/\s*(Today|Yesterday)$/, '');
      continue;
    }
    const href = tok.match(/<a\b[^>]*\shref="([^"]+)"/)?.[1] ?? '';
    const time = cleanText(tok.match(/match-item-time[^"]*">([\s\S]*?)<\/div>/)?.[1] ?? '');
    // 胜者队的 name div 内可能插有 <i class="sp-hide ..."> 图标（results 页实测），故用 [\s\S]*? 跳过
    const names = [...tok.matchAll(/match-item-vs-team-name">[\s\S]*?<div class="text-of">([\s\S]*?)<\/div>/g)]
      .map((m) => cleanText(m[1]));
    if (names.length < 2) continue; // 非比赛块（防御）
    const scoreParts = [...tok.matchAll(/match-item-vs-team-score([^"]*)">([\s\S]*?)<\/div>/g)]
      .map((m) => ({ cls: m[1], val: cleanText(m[2]) }));
    // team div 的 class（负向断言排除 -name/-score 前缀 div）：捕获 ' ' 或 ' mod-winner'
    const teamCls = [...tok.matchAll(/<div class="match-item-vs-team(?![-\w])([^"]*)"/g)].map((m) => m[1]);
    const parseScore = (part) => {
      if (!part || part.cls.includes('mod-upcoming')) return null;
      if (!/^\d+$/.test(part.val)) return null;
      return Number(part.val);
    };
    const scoreA = parseScore(scoreParts[0]);
    const scoreB = parseScore(scoreParts[1]);
    let winner = null;
    if (teamCls[0]?.includes('mod-winner') && !teamCls[1]?.includes('mod-winner')) winner = 'A';
    else if (teamCls[1]?.includes('mod-winner') && !teamCls[0]?.includes('mod-winner')) winner = 'B';
    else if (scoreParts[0]?.cls.includes('mod-win') && !scoreParts[1]?.cls.includes('mod-win')) winner = 'A';
    else if (scoreParts[1]?.cls.includes('mod-win') && !scoreParts[0]?.cls.includes('mod-win')) winner = 'B';
    else if (scoreA != null && scoreB != null && scoreA !== scoreB) winner = scoreA > scoreB ? 'A' : 'B';
    const rawStatus = cleanText(tok.match(/ml-status">([^<]*)</)?.[1] ?? '');
    const status = rawStatus === 'Live' ? 'live'
      : (scoreA != null && scoreB != null) ? 'completed' : 'upcoming';
    let event = '';
    let series = '';
    const evM = tok.match(/<div class="match-item-event[^"]*">([\s\S]*?)(?=<div class="match-item-icon"|\s*<\/a>)/);
    if (evM) {
      const seriesM = evM[1].match(/<div class="match-item-event-series[^"]*">[\s\S]*?<\/div>/);
      if (seriesM) {
        series = cleanText(seriesM[0].replace(/^<div class="match-item-event-series[^"]]*>/, '').replace(/<\/div>$/, ''));
        event = cleanText(evM[1].replace(seriesM[0], ''));
      } else {
        event = cleanText(evM[1]);
      }
    }
    matches.push({
      href,
      teamA: names[0],
      teamB: names[1],
      scoreA,
      scoreB,
      winner,
      status,
      time,
      event,
      series,
      date,
    });
  }
  return matches;
}

// matches 页实测无 cookie gate（与 stats/rankings 的 302 门不同）：直接 fetch，勿套 fetchHtml 模板
// 2026-10-08 补：/matches 只含未开赛场次，已结束比赛在 /matches/results（同构结构）——双源合并
export async function fetchMatches() {
  const [schedRes, resultsRes] = await Promise.all([
    fetch('https://www.vlr.gg/matches', { headers: UA }),
    fetch('https://www.vlr.gg/matches/results', { headers: UA }),
  ]);
  if (!schedRes.ok) throw new Error(`VLR HTTP ${schedRes.status} for https://www.vlr.gg/matches`);
  // results 失败软容错：赛程页是主数据源，赛果抓不到不阻断整体（sync 外层块仍有兜底）
  const resultsHtml = resultsRes.ok ? await resultsRes.text() : '';
  const scheduled = parseMatches(await schedRes.text());
  const completed = resultsHtml ? parseMatches(resultsHtml).slice(0, 30) : [];
  return [...scheduled, ...completed];
}

// —— 职业赛 meta（P11-1）——
// 解析赛事列表（vlr.gg/events）：页面第一个 /event/{id}/{slug} 链接即当前最重要赛事
// 2026-10-08 实测：首位为 href="/event/2766/valorant-champions-2026"
export function parseEventList(html) {
  const m = html.match(/href="\/event\/(\d+)\/([a-z0-9-]+)"/);
  if (!m) return null;
  const name = m[2].split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { id: Number(m[1]), name };
}

// 解析赛事 meta（vlr.gg/event/agents/{id} 主表）
// 2026-10-08 实测（559KB）：页面共 8 张表——主表 class="wf-table mod-pr-global"（含 pr-global-row 行），
// 其余 7 张为每图明细子表（其 th img 才带 title）。解析必须限定主表，否则子表会污染特工序列。
// - 主表表头：Map | # | ATK WIN | DEF WIN | 每特工一个 th；特工 img 实测无 title、仅 src 文件名，
//   故 title 优先、文件名兜底（jett.png → Jett）；两路对 29 特工实测产出完全一致的序列
// - 数据行：<tr class="pr-global-row ">（首行 mod-all 为全赛事汇总，首 td 无地图名，跳过）；每图一行：
//   首 td = map-pseudo-icon">S</span> + 地图名；3 个 mod-right = 场次/ATK%/DEF%；
//   mod-color-sq 格子按表头顺序对应特工 pick%（% 与数字在独立文本节点，正则容忍空白）
export function parseEventAgents(html) {
  const table = (html.match(/<table\b[\s\S]*?<\/table>/g) ?? []).find((t) => t.includes('pr-global-row')) ?? html;
  const agents = [];
  for (const th of table.match(/<th\b[\s\S]*?<\/th>/g) ?? []) {
    const img = th.match(/<img\b[^>]*>/)?.[0] ?? '';
    if (!/game\/agents\//.test(img)) continue; // Map/#/ATK/DEF 等非特工表头
    const title = img.match(/\stitle="([^"]+)"/)?.[1];
    if (title) { agents.push(title); continue; }
    const file = img.match(/game\/agents\/([a-z0-9-]+)\.png/)?.[1] ?? '';
    if (file) agents.push(file.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-'));
  }
  const num = (s) => Number(s.match(/\d+/)?.[0] ?? 0);
  const maps = [];
  for (const block of table.match(/<tr class="pr-global-row[^"]*">[\s\S]*?<\/tr>/g) ?? []) {
    const nameM = block.match(/map-pseudo-icon">[A-Za-z]<\/span>([^<]*)/);
    if (!nameM) continue; // 汇总行（mod-all）首 td 无地图名
    const right = [...block.matchAll(/<td class="mod-right[^"]*"[^>]*>([\s\S]*?)<\/td>/g)]
      .map((m) => num(stripTags(m[1])));
    maps.push({
      name: nameM[1].trim(),
      matches: right[0] ?? 0,
      atkWin: right[1] ?? 0,
      defWin: right[2] ?? 0,
      picks: [...block.matchAll(/<td class="mod-color-sq[^"]*"[^>]*>([\s\S]*?)<\/td>/g)]
        .slice(0, agents.length)
        .map((m, i) => ({ agent: agents[i], pct: num(stripTags(m[1])) })),
    });
  }
  return { maps };
}

// 抓取职业赛 meta：/events 定位当前赛事 → /event/agents/{id} 解析地图攻防与特工 pick 矩阵
// 2026-10-08 实测两页均直接 200（无 cookie gate，与 matches 同类；fetchHtml 对 200 页面直接透传）
export async function fetchEventMeta() {
  const event = parseEventList(await fetchHtml('https://www.vlr.gg/events'));
  if (!event) throw new Error('VLR events 页未解析到赛事链接');
  const { maps } = parseEventAgents(await fetchHtml(`https://www.vlr.gg/event/agents/${event.id}`));
  if (!maps.length) throw new Error(`VLR event/agents 无地图数据（event=${event.id}）`);
  return { event, maps, syncedAt: new Date().toISOString() };
}