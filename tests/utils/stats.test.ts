import { describe, expect, it } from 'vitest';
import { rankWeaponDamage, roleDistribution, lineupContributors } from '../../src/utils/stats';

const weapons = [
  { id: 'operator', zh: { name: '冥驹' }, en: { name: 'Operator' }, damageRanges: [{ rangeStartMeters: 0, rangeEndMeters: 70, headDamage: 255, bodyDamage: 150, legDamage: 120 }] },
  { id: 'warden', zh: { name: '悍狼' }, en: { name: 'Warden' }, damageRanges: [{ rangeStartMeters: 0, rangeEndMeters: 50, headDamage: 200, bodyDamage: 50, legDamage: 42 }] },
  { id: 'vandal', zh: { name: '狂徒' }, en: { name: 'Vandal' }, damageRanges: [{ rangeStartMeters: 0, rangeEndMeters: 10, headDamage: 160, bodyDamage: 40, legDamage: 34 }] },
  { id: 'melee', zh: { name: '近战武器' }, en: { name: 'Melee' }, damageRanges: [] },
] as never[];

const agents = [
  { id: 'jett', zh: { name: '捷风', role: '决斗' }, en: { name: 'Jett' } },
  { id: 'raze', zh: { name: '雷兹', role: '决斗' }, en: { name: 'Raze' } },
  { id: 'sage', zh: { name: '贤者', role: '哨卫' }, en: { name: 'Sage' } },
] as never[];

const spots = [
  { mapId: 'ascent', agentId: 'jett', ability: 'C', label: 'A', x: 1, y: 1, side: '进攻', note: '' },
  { mapId: 'split', agentId: 'jett', ability: 'C', label: 'B', x: 1, y: 1, side: '进攻', note: '' },
  { mapId: 'ascent', agentId: 'sage', ability: 'Q', label: 'C', x: 1, y: 1, side: '防守', note: '' },
] as never[];

describe('rankWeaponDamage', () => {
  it('按近距爆头伤害降序，无分段武器排除，warden 标记新', () => {
    const r = rankWeaponDamage(weapons);
    expect(r.map((w) => w.id)).toEqual(['operator', 'warden', 'vandal']);
    expect(r[1].isNew).toBe(true);
    expect(r[0].headDamage).toBe(255);
  });
});

describe('roleDistribution', () => {
  it('按角色计数并计算百分比（和为 100）', () => {
    const d = roleDistribution(agents);
    expect(d.find((x) => x.role === '决斗')!.count).toBe(2);
    expect(Math.round(d.reduce((s, x) => s + x.pct, 0))).toBe(100);
  });
});

describe('lineupContributors', () => {
  it('按收录点位数降序并统计覆盖地图数', () => {
    const c = lineupContributors(spots);
    expect(c[0]).toMatchObject({ agentId: 'jett', count: 2, maps: 2 });
    expect(c[1]).toMatchObject({ agentId: 'sage', count: 1, maps: 1 });
  });
});