// 站内数据榜纯函数：武器威力 / 特工定位分布 / 点位贡献（页面与单测共用）
export interface RankedWeapon {
  id: string; name: string; zhName: string; headDamage: number; isNew?: boolean;
}

export function rankWeaponDamage(raw: Array<Record<string, never>>): RankedWeapon[] {
  const list = (raw as unknown[]).flatMap((item) => {
    const w = item as {
      id: string; zh: { name: string }; en: { name: string };
      damageRanges: Array<{ headDamage: number }>;
    };
    const first = w.damageRanges?.[0];
    if (!first) return [];
    return [{
      id: w.id,
      name: w.zh.name !== w.en.name ? `${w.zh.name} ${w.en.name}` : w.en.name,
      zhName: w.zh.name,
      headDamage: first.headDamage,
      isNew: w.id === 'warden',
    }];
  });
  return list.sort((a, b) => b.headDamage - a.headDamage);
}

export interface RoleDist { role: string; count: number; pct: number; }

export function roleDistribution(raw: Array<Record<string, never>>): RoleDist[] {
  const counts = new Map<string, number>();
  const total = (raw as unknown[]).length;
  for (const item of raw as unknown[] as Array<{ zh: { role: string } }>) {
    counts.set(item.zh.role, (counts.get(item.zh.role) ?? 0) + 1);
  }
  return [...counts.entries()].map(([role, count]) => ({
    role, count,
    pct: Math.round((count / total) * 1000) / 10,
  }));
}

export interface LineupContributor {
  agentId: string; count: number; maps: number;
}

export function lineupContributors(spots: Array<{ mapId: string; agentId: string }>): LineupContributor[] {
  const byAgent = new Map<string, { count: number; maps: Set<string> }>();
  for (const s of spots) {
    if (!byAgent.has(s.agentId)) byAgent.set(s.agentId, { count: 0, maps: new Set() });
    const e = byAgent.get(s.agentId)!;
    e.count += 1;
    e.maps.add(s.mapId);
  }
  return [...byAgent.entries()]
    .map(([agentId, e]) => ({ agentId, count: e.count, maps: e.maps.size }))
    .sort((a, b) => b.count - a.count);
}