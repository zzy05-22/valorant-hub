import { describe, expect, it } from 'vitest';
import { toCompareWeapons, pickCompareWeapons, type CompareWeapon } from '../../src/utils/compare';

const rawWeapons = [
  {
    id: 'vandal', zh: { name: '狂徒', category: '步枪' }, en: { name: 'Vandal', category: 'Rifle' },
    credits: 2900, stats: { fireRate: 9.75, magazineSize: 25, wallPenetration: 'Medium' },
    damageRanges: [
      { rangeStartMeters: 0, rangeEndMeters: 10, headDamage: 160, bodyDamage: 40, legDamage: 34 },
      { rangeStartMeters: 10, rangeEndMeters: 30, headDamage: 140, bodyDamage: 35, legDamage: 29 },
    ],
  },
  {
    id: 'classic', zh: { name: 'Classic', category: '佩枪' }, en: { name: 'Classic', category: 'Sidearm' },
    credits: 0, stats: { fireRate: 6.75, magazineSize: 12, wallPenetration: 'Low' },
    damageRanges: [],
  },
];

describe('toCompareWeapons', () => {
  it('瘦身为对比模型：中英名合并、射程段格式化', () => {
    const [vandal] = toCompareWeapons(rawWeapons as never);
    expect(vandal.id).toBe('vandal');
    expect(vandal.name).toBe('狂徒 Vandal');
    expect(vandal.zhName).toBe('狂徒');
    expect(vandal.credits).toBe(2900);
    expect(vandal.damageRanges[0].label).toBe('0–10m');
  });

  it('中英同名时只显示一个名字', () => {
    const [, classic] = toCompareWeapons(rawWeapons as never);
    expect(classic.name).toBe('Classic');
  });
});

describe('pickCompareWeapons', () => {
  const all = toCompareWeapons(rawWeapons as never);
  it('按所选 id 顺序返回并忽略未知 id', () => {
    const picked = pickCompareWeapons(all, ['classic', 'vandal', 'ghost']);
    expect(picked.map((w) => w.id)).toEqual(['classic', 'vandal']);
  });
});