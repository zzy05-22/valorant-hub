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