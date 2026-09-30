// 道具点位纯函数：分组与双键过滤（LineupPanel script 与单测共用）
export interface LineupSpot {
  mapId: string;
  agentId: string;
  ability: string;   // C / Q / E / X / 被动
  label: string;
  x: number;         // 战术图百分比 0-100
  y: number;
  side: string;      // 进攻 / 防守
  note: string;
}

export function groupSpotsByAgent(spots: LineupSpot[]): Map<string, LineupSpot[]> {
  const g = new Map<string, LineupSpot[]>();
  for (const s of spots) {
    if (!g.has(s.agentId)) g.set(s.agentId, []);
    g.get(s.agentId)!.push(s);
  }
  return g;
}

export function groupSpotsByMap(spots: LineupSpot[]): Map<string, LineupSpot[]> {
  const g = new Map<string, LineupSpot[]>();
  for (const s of spots) {
    if (!g.has(s.mapId)) g.set(s.mapId, []);
    g.get(s.mapId)!.push(s);
  }
  return g;
}

export function filterSpots(spots: LineupSpot[], mapId: string, agentId: string): LineupSpot[] {
  return spots.filter((s) => s.mapId === mapId && s.agentId === agentId);
}