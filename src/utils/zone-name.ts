// 社区区域名（Zone Stats）→ 中文标注映射
// 词干贪心匹配：先整名，再复合词干（两词），再单词干与前缀，未收录词保留英文原文
// 译名取中文社区通行叫法，宁直白勿生造

const FULL: Record<string, string> = {
  'Attacker Side Spawn': '攻方出生点',
  'Attacker Spawn': '攻方出生点',
  'Defender Side Spawn': '守方出生点',
  'Defender Spawn': '守方出生点',
  'Attacker Side Bridge': '攻方桥头',
  'Attacker Snake': '攻方蛇道',
  'Defender Hall': '守方廊道',
  'Defender Link': '守方连接道',
  'Defender Side Arches': '守方拱门',
};

const STEMS = new Map<string, string>([
  // 复合词干优先匹配
  ['Back Site', '点后'],
  ['Front Site', '点前'],
  ['Snow Pile', '雪堆'],
  ['Second Floor', '二楼'],
  ['U Hall', 'U 廊'],
  ['Outside Showers', '外场浴场'],
  // 单词干
  ['Backsite', '点后'],
  ['Frontsite', '点前'],
  ['FrontSite', '点前'],
  ['Site', '点'],
  ['Main', '主路'],
  ['MainLane', '主路'],
  ['DropLane', '落点通道'],
  ['Drop', '落点'],
  ['Lobby', '大厅'],
  ['Link', '连接道'],
  ['Back', '后区'],
  ['Front', '前区'],
  ['Heaven', '高台'],
  ['Hell', '地狱位'],
  ['Window', '窗口'],
  ['Long', '长道'],
  ['Short', '短道'],
  ['Tower', '塔楼'],
  ['Garage', '车库'],
  ['Alley', '小巷'],
  ['Entrance', '入口'],
  ['Stairs', '楼梯'],
  ['Garden', '花园'],
  ['Market', '市场'],
  ['Plaza', '广场'],
  ['Doors', '门'],
  ['Door', '门'],
  ['Top', '高台'],
  ['Bottom', '低处'],
  ['Catwalk', '猫道'],
  ['Courtyard', '庭院'],
  ['CourtyardTop', '庭院高台'],
  ['Vent', '通风口'],
  ['Mail', '邮局'],
  ['Pizza', '披萨店'],
  ['Switch', '开关房'],
  ['Logs', '木堆'],
  ['Platform', '平台'],
  ['Outside', '外场'],
  ['Lane', '通道'],
  ['Screens', '屏风'],
  ['Screen', '屏风'],
  ['Sewers', '下水道'],
  ['Rafters', '房梁'],
  ['Ramps', '坡道'],
  ['Ramp', '坡道'],
  ['Elbow', '肘位'],
  ['ElbowRat', '肘位房'],
  ['ElbowBot', '肘位下'],
  ['ElbowTop', '肘位上'],
  ['Art', '艺术区'],
  ['Bridge', '桥'],
  ['Dish', '天线锅'],
  ['Cave', '洞穴'],
  ['Cubby', '凹位'],
  ['Belt', '传送带'],
  ['Boost', '增高箱'],
  ['Nest', '巢位'],
  ['Orb', '灵珠'],
  ['Generator', '发电机'],
  ['Pillar', '柱子'],
  ['Pillars', '柱子'],
  ['Pipes', '管道'],
  ['Pool', '泳池'],
  ['Root', '树根'],
  ['Ropes', '绳索'],
  ['Rubble', '瓦砾'],
  ['Safe', '保险箱'],
  ['Secret', '密道'],
  ['Shop', '商店'],
  ['Shops', '商店'],
  ['Showers', '浴场'],
  ['Tree', '大树'],
  ['Hall', '廊道'],
  ['Arcade', '拱廊'],
  ['Bench', '长椅'],
  ['Boba', '奶茶店'],
  ['Canteen', '食堂'],
  ['Club', '俱乐部'],
  ['Records', '唱片店'],
  ['Restaurant', '餐厅'],
  ['Kitchen', '厨房'],
  ['Hookah', '水烟房'],
  ['Snowman', '雪人'],
  ['TripBox', '绊线箱'],
  ['Tube', '管道'],
  ['Tunnel', '隧道'],
  ['Upper', '高层'],
  ['Water', '水域'],
  ['Waterfall', '瀑布'],
  ['Boxes', '箱区'],
  ['Drain', '排水沟'],
  ['Mound', '土丘'],
  ['Bend', '弯道'],
  ['Gravel', '碎石'],
  ['GravelTwo', '碎石二'],
  ['Cannon', '加农炮'],
  ['Connector', '连接道'],
  ['TilesBot', '瓷砖下'],
  ['TilesTop', '瓷砖上'],
  ['Flowers', '花圃'],
  ['Gate', '闸门'],
  ['Dugout', '壕坑'],
  ['Default', '默认点位'],
  ['Pyramids', '金字塔'],
  ['Orange', '橙区'],
  ['Yellow', '黄区'],
  ['Side', '侧翼'],
]);

const PREFIX: Record<string, string> = { A: 'A', B: 'B', C: 'C', Middle: '中', Mid: '中' };

/** 社区区域名 → 中文（未收录词干保留英文原文，保证不产生假译名） */
export function zoneToZh(name: string): string {
  const trimmed = name.trim();
  if (FULL[trimmed]) return FULL[trimmed];
  const tokens = trimmed.split(/\s+/);
  const parts: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const two = i + 1 < tokens.length ? `${tokens[i]} ${tokens[i + 1]}` : '';
    if (two && STEMS.has(two)) {
      parts.push(STEMS.get(two)!);
      i += 2;
      continue;
    }
    if (STEMS.has(tokens[i])) {
      parts.push(STEMS.get(tokens[i])!);
      i += 1;
      continue;
    }
    if (PREFIX[tokens[i]]) {
      parts.push(PREFIX[tokens[i]]);
      i += 1;
      continue;
    }
    parts.push(tokens[i]);
    i += 1;
  }
  return parts.join(' ');
}

export type ZoneCategory = 'a' | 'b' | 'c' | 'mid' | 'spawn' | 'other';

/** 区域归类（A/B/C/中/出生点/其他），用于标注配色 */
export function zoneCategory(name: string): ZoneCategory {
  const n = name.trim();
  if (/Spawn|Attacker|Defender/.test(n)) return 'spawn';
  if (/^A(\s|$)/.test(n)) return 'a';
  if (/^B(\s|$)/.test(n)) return 'b';
  if (/^C(\s|$)/.test(n)) return 'c';
  if (/^(Middle|Mid)(\s|$)/.test(n)) return 'mid';
  return 'other';
}