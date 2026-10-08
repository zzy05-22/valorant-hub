// Riot 官方版本公告抓取与解析（零依赖：fetch + 正则）
// 版权边界：只提取"版本号/日期/章节标题"事实数据并映射中文，正文不爬不译；每条附官方原文链接
// 注：UA 保持纯 ASCII——HTTP header 无法携带非 latin1 字符（node fetch 会抛 ByteString 错误）
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) valorant-hub/1.0 (static info site project)' };

// 章节标题中文映射（Riot 官方公告固定 9 个 h2 标题；未映射章节原样保留）
export const SECTION_ZH = {
  'GENERAL UPDATES': '综合更新',
  'CLIENT UPDATES': '客户端更新',
  'COMPETITIVE UPDATES': '竞技更新',
  'GAMEPLAY SYSTEMS UPDATES': '玩法系统更新',
  'MODES UPDATES': '模式更新',
  'PLAYER BEHAVIOR UPDATES': '玩家行为更新',
  'PROGRESSION UPDATES': '进度更新',
  'WEAPONS UPDATES': '武器更新',
  'BUG FIXES': '错误修复',
};

// 解析公告列表页（playvalorant.com/en-us/news/game-updates/）
// 实测条目：<a role="button" aria-label="VALORANT Patch Notes 13.06" href="/en-us/news/game-updates/valorant-patch-notes-13-06">
// 返回：[{ version, title, url }]，按版本号去重、最多 8 条
export function parsePatchList(html) {
  const byVersion = new Map();
  const re = /aria-label="(VALORANT Patch Notes ([0-9.]+))"\s+href="(\/en-us\/news\/game-updates\/[^"]+)"/g;
  for (const m of html.matchAll(re)) {
    const version = m[2];
    if (!byVersion.has(version)) {
      byVersion.set(version, {
        version,
        title: m[1],
        url: `https://playvalorant.com${m[3]}`,
      });
    }
    if (byVersion.size >= 8) break;
  }
  return [...byVersion.values()];
}

// 解析公告详情页
// 实测：JSON-LD 内 "datePublished":"2026-09-22T13:00:00.000Z"；章节为 <h2>GENERAL UPDATES</h2> 等固定标题
// 返回：{ date: 'YYYY-MM-DD'（缺失为空串）, sections: [中文章节名，未映射原样保留] }
export function parsePatchSections(html) {
  const date = html.match(/"datePublished":"(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  const seen = new Set();
  const sections = [];
  for (const m of html.matchAll(/<h2>([^<]{3,80})<\/h2>/g)) {
    const raw = m[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (!raw || seen.has(raw)) continue; // 去重保序
    seen.add(raw);
    sections.push(SECTION_ZH[raw] ?? raw);
  }
  return { date, sections };
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Riot HTTP ${res.status} for ${url}`);
  return res.text();
}

// 抓取版本公告摘要流：列表前 3 个版本逐个抓详情页
// 返回：[{ version, date, url, sections }]
export async function fetchPatchFeed() {
  const listHtml = await fetchText('https://playvalorant.com/en-us/news/game-updates/');
  const list = parsePatchList(listHtml);
  const patches = [];
  for (const p of list.slice(0, 3)) {
    const detail = parsePatchSections(await fetchText(p.url));
    patches.push({ version: p.version, date: detail.date, url: p.url, sections: detail.sections });
  }
  return patches;
}