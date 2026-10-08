// 报点中文对照：官方 callouts 英文原文 → 社区确定通行的中文叫法
// 翻译红线：CALLOUT_ZH 只收录确定通行译名，未命中保留英文原文展示（不硬编）；
// 词表依据 maps.json 实际 callouts 词表筛选，并与 zh-CN 官方 API 译名交叉验证（官方跨图统一的才收）
export interface Callout {
  region: string;
  zone: string;
  x?: number;
  y?: number;
}

export interface TranslatedCallout {
  region: string;
  zh: string;
}

// 首批词条（计划指定）+ 对照实际词表的确定通行增补（Sewer/Snow Pile 为实际词形；
// Tower/Top/Hall/Catwalk/Nest 等官方译名跨图不一致，拿不准一律不收）
export const CALLOUT_ZH: Record<string, string> = {
  Site: '点',
  Main: '主道',
  Lobby: '大厅',
  Market: '市场',
  Heaven: '高台',
  Hell: '地狱',
  CT: '守方家',
  'T Spawn': '攻方出生点',
  Spawn: '出生点',
  Mid: '中路',
  Link: '连接口',
  Pad: '跳板',
  'U Hall': 'U 道',
  Sewers: '下水道',
  Sewer: '下水道',
  Garage: '车库',
  Vent: '通风口',
  Tiles: '瓷砖房',
  Aisle: '走廊',
  Dungeon: '地窖',
  Boxes: '箱区',
  Cubby: '卡位',
  Wooden: '木门',
  Belt: '传送带',
  'Snow Pile': '雪堆',
  Kitchen: '厨房',
  Generator: '发电机',
  'Ice Cream': '冰淇淋车',
  Window: '窗口',
  Garden: '花园',
  Courtyard: '庭院',
  'Boat House': '船屋',
  Pizza: '比萨',
  Wine: '酒庄',
  Fountain: '喷泉',
  Stairs: '台阶',
  Ramp: '坡道',
  Bottom: '坡底',
  Long: '长道',
  Short: '短道',
  Bridge: '桥',
};

const ZONE_PREFIXED = new Set(['A', 'B', 'C']);

// 输出 {region, zh}：命中词表时 zh = A/B/C 区前缀 + 译名；未命中保留英文原文（无前缀）
export function translateCallouts(callouts: Callout[] | null | undefined): TranslatedCallout[] {
  if (!Array.isArray(callouts)) return [];
  return callouts.map((c) => {
    const region = c?.region ?? '';
    const zone = c?.zone ?? '';
    const hit = CALLOUT_ZH[region];
    return {
      region,
      zh: hit ? (ZONE_PREFIXED.has(zone) ? `${zone} ${hit}` : hit) : region,
    };
  });
}