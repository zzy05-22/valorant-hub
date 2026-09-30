// 武器对比纯函数：数据瘦身与选中过滤（页面 script 与单测共用）
export interface CompareWeapon {
  id: string;
  name: string;     // 中英合并显示名（同名只显示一个）
  zhName: string;
  category: string;
  credits: number;
  fireRate: number;
  magazineSize: number;
  wallPenetration: string;
  damageRanges: Array<{ label: string; headDamage: number; bodyDamage: number; legDamage: number }>;
}

// 从 src/data/weapons.json 的原始记录瘦身
export function toCompareWeapons(raw: Array<Record<string, never>>): CompareWeapon[] {
  return (raw as unknown[]).map((item) => {
    const w = item as {
      id: string;
      zh: { name: string; category: string };
      en: { name: string };
      credits: number;
      stats: { fireRate: number; magazineSize: number; wallPenetration: string };
      damageRanges: Array<{ rangeStartMeters: number; rangeEndMeters: number; headDamage: number; bodyDamage: number; legDamage: number }>;
    };
    const name = w.zh.name !== w.en.name ? `${w.zh.name} ${w.en.name}` : w.en.name;
    return {
      id: w.id,
      name,
      zhName: w.zh.name,
      category: w.zh.category || '其他',
      credits: w.credits,
      fireRate: w.stats.fireRate,
      magazineSize: w.stats.magazineSize,
      wallPenetration: w.stats.wallPenetration,
      damageRanges: w.damageRanges.map((r) => ({
        label: `${r.rangeStartMeters}–${r.rangeEndMeters}m`,
        headDamage: r.headDamage,
        bodyDamage: r.bodyDamage,
        legDamage: r.legDamage,
      })),
    };
  });
}

// 按所选 id 顺序过滤（忽略未知 id、自动去重）
export function pickCompareWeapons(all: CompareWeapon[], selectedIds: string[]): CompareWeapon[] {
  const seen = new Set<string>();
  const picked: CompareWeapon[] = [];
  for (const id of selectedIds) {
    if (seen.has(id)) continue;
    const w = all.find((x) => x.id === id);
    if (w) {
      seen.add(id);
      picked.push(w);
    }
  }
  return picked;
}