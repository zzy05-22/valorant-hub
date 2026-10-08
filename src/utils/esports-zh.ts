// 电竞数据中文化映射（赛程赛果页渲染层使用）
// 原则：通行简称/译名收录，拿不准的保留原文——宁缺毋假
// 数据源 vlr.gg，整理于 2026-10-08；队名与赛事名会随版本滚动，映射缺失时回退原文

// 队名 → 通行中文简称（VCT 社区叫法）
export const TEAM_ZH: Record<string, string> = {
  '100 Thieves': '100T',
  'EDward Gaming': 'EDG',
  'FUT Esports': 'FUT',
  'G2 Esports': 'G2',
  'Karmine Corp': 'KC',
  LOUD: 'LOUD',
  NRG: 'NRG',
  'Nongshim RedForce': 'NS',
  'Paper Rex': 'PRX',
  T1: 'T1',
  'Team Liquid': 'TL',
  'Team Vitality': 'VIT',
  TYLOO: '天禄',
  'JD Gaming': 'JDG',
  TBD: '待定',
};

// 赛事名 → 官方中文表述（参照 VCT CN 官方赛事名）
export const EVENT_ZH: Record<string, string> = {
  'Valorant Champions 2026': 'VCT 2026 上海全球冠军赛',
  'Game Changers 2026: China': 'VCT 改变者赛 2026 中国赛区',
  'Game Changers 2026: Pacific': 'VCT 改变者赛 2026 太平洋赛区',
  'Game Changers 2026: Americas Last Chance Qualifier': 'VCT 改变者赛 2026 美洲区最后机会赛',
};

// 赛段阶段词（series 左段）
const STAGE_ZH: Record<string, string> = {
  Playoffs: '淘汰赛',
  'Main Event': '正赛',
  'Group Stage': '小组赛',
};

// 赛段轮次词（series 右段）
const ROUND_ZH: Record<string, string> = {
  'Upper Quarterfinals': '胜者组八强',
  'Upper Semifinals': '胜者组半决赛',
  'Upper Final': '胜者组决赛',
  'Lower Round 1': '败者组第 1 轮',
  'Lower Round 2': '败者组第 2 轮',
  'Lower Round 3': '败者组第 3 轮',
  'Lower Final': '败者组决赛',
  'Grand Final': '总决赛',
  "Winner's (A)": '胜者战 A 组',
  "Winner's (B)": '胜者战 B 组',
  "Winner's (C)": '胜者战 C 组',
  "Winner's (D)": '胜者战 D 组',
  'Elimination (A)': '淘汰战 A 组',
  'Elimination (B)': '淘汰战 B 组',
  'Elimination (C)': '淘汰战 C 组',
  'Elimination (D)': '淘汰战 D 组',
  'Decider (A)': '决胜战 A 组',
  'Decider (B)': '决胜战 B 组',
  'Decider (C)': '决胜战 C 组',
  'Decider (D)': '决胜战 D 组',
  'Opening (A)': '揭幕战 A 组',
  'Opening (B)': '揭幕战 B 组',
  'Opening (C)': '揭幕战 C 组',
  'Opening (D)': '揭幕战 D 组',
};

// 赛段翻译：'Playoffs–Upper Quarterfinals' → '淘汰赛 · 胜者组八强'；未收录片段保留原文
export function seriesZh(series: string): string {
  if (!series) return '';
  const parts = series.split('–');
  const stage = STAGE_ZH[parts[0]] ?? parts[0];
  if (parts.length < 2) return stage;
  const round = ROUND_ZH[parts[1]] ?? parts[1];
  return `${stage} · ${round}`;
}

const MONTHS: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];

// vlr 日期（'Thu, October 8, 2026'）→ 中文标签 + 是否今天（以构建机本地日期判断，每日同步刷新）
export function dateZh(raw: string): { label: string; isToday: boolean } {
  const m = raw.match(/^\w{3}, (\w+) (\d+), (\d+)$/);
  if (!m) return { label: raw, isToday: false };
  const month = MONTHS[m[1]];
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!month) return { label: raw, isToday: false };
  const now = new Date();
  const isToday = now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
  // 星期推算：Unix epoch 日 1970-01-01 是星期四（索引 4），故偏移 +4
  const epochDays = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const week = WEEK_ZH[(epochDays + 4) % 7];
  return { label: `${month}月${day}日 星期${week}`, isToday };
}

// 队名（渲染兜底：映射缺失回退原名）
export const teamZh = (name: string): string => TEAM_ZH[name] ?? name;
// 赛事名（渲染兜底）
export const eventZh = (name: string): string => EVENT_ZH[name] ?? name;