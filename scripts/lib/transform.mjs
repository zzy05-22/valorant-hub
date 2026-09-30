// 原始 API 响应 → 站点数据模型（中英合并 + 瘦身）
// 数据形状（存入 src/data/*.json）：
//   agent:  { id, uuid, zh{name,description,role}, en{...}, roleIcon, displayIcon, fullPortrait, background, abilities[{slot,key,zh,en,icon}] }
//   weapon: { id, uuid, zh{name,category}, en{...}, category, credits, displayIcon, stats{fireRate,magazineSize,wallPenetration}, damageRanges[...] }

const SLOT_KEY = { Ability1: 'Q', Ability2: 'E', Grenade: 'C', Ultimate: 'X' };

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function transformAgents(zhList, enList) {
  const enByUuid = new Map(enList.map((a) => [a.uuid, a]));
  return zhList
    .filter((zh) => enByUuid.has(zh.uuid))
    .map((zh) => {
      const en = enByUuid.get(zh.uuid);
      return {
        id: slugify(en.displayName),
        uuid: zh.uuid,
        zh: {
          name: zh.displayName ?? '',
          description: zh.description ?? '',
          role: zh.role?.displayName ?? '',
        },
        en: {
          name: en.displayName ?? '',
          description: en.description ?? '',
          role: en.role?.displayName ?? '',
        },
        roleIcon: zh.role?.displayIcon ?? '',
        displayIcon: zh.displayIcon ?? '',
        fullPortrait: zh.fullPortrait ?? '',
        background: zh.background ?? '',
        abilities: (zh.abilities ?? []).map((ab, i) => ({
          slot: SLOT_KEY[ab.slot] ?? ab.slot,
          key: ab.slot,
          zh: { name: ab.displayName ?? '', description: ab.description ?? '' },
          en: {
            name: en.abilities[i]?.displayName ?? '',
            description: en.abilities[i]?.description ?? '',
          },
          icon: ab.displayIcon ?? '',
        })),
      };
    });
}

export function transformWeapons(zhList, enList) {
  const enByUuid = new Map(enList.map((w) => [w.uuid, w]));
  return zhList
    .filter((zh) => enByUuid.has(zh.uuid))
    .map((zh) => {
      const en = enByUuid.get(zh.uuid);
      const s = zh.weaponStats ?? {};
      return {
        id: slugify(en.displayName),
        uuid: zh.uuid,
        zh: { name: zh.displayName ?? '', category: zh.shopData?.categoryText ?? '' },
        en: { name: en.displayName ?? '', category: en.shopData?.categoryText ?? '' },
        category: zh.shopData?.category ?? '',
        credits: zh.shopData?.cost ?? 0,
        displayIcon: zh.displayIcon ?? '',
        stats: {
          fireRate: s.fireRate ?? 0,
          magazineSize: s.magazineSize ?? 0,
          wallPenetration: s.wallPenetration?.replace('EWallPenetrationType::', '') ?? '',
        },
        damageRanges: (s.damageRanges ?? []).map((r) => ({
          rangeStartMeters: r.rangeStartMeters,
          rangeEndMeters: r.rangeEndMeters,
          headDamage: r.headDamage,
          bodyDamage: r.bodyDamage,
          legDamage: r.legDamage,
        })),
      };
    });
}