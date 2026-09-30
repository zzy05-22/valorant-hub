import { describe, expect, it } from 'vitest';
import { buildLineup, type LineupAgent } from '../../src/utils/lineup';

const mk = (id: string, role: string): LineupAgent => ({
  id, zhName: `特工${id}`, enName: id.toUpperCase(), role, displayIcon: '',
});
// 4 角色各 2 人，决斗 3 人
const pool = [
  mk('d1', '决斗'), mk('d2', '决斗'), mk('d3', '决斗'),
  mk('i1', '先锋'), mk('i2', '先锋'),
  mk('c1', '控场'), mk('c2', '控场'),
  mk('s1', '哨卫'), mk('s2', '哨卫'),
];

describe('buildLineup', () => {
  it('固定 rng 下结果确定：各角色 1 名 + 第 5 席为决斗', () => {
    const lineup = buildLineup(pool, () => 0);
    expect(lineup).toHaveLength(5);
    const roles = lineup.map((a) => a.role);
    for (const r of ['决斗', '先锋', '控场', '哨卫']) expect(roles).toContain(r);
    // 第 5 席来自决斗池
    expect(roles.filter((r) => r === '决斗')).toHaveLength(2);
  });

  it('第 5 席随机时两次调用覆盖不同组合（概率性冒烟）', () => {
    const a = buildLineup(pool);
    const b = buildLineup(pool);
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(5);
  });

  it('决斗池不足时从其他池补足且不重复选人', () => {
    const smallPool = [mk('d1', '决斗'), mk('i1', '先锋'), mk('c1', '控场'), mk('s1', '哨卫'), mk('i2', '先锋')];
    const lineup = buildLineup(smallPool, () => 0);
    expect(lineup).toHaveLength(5);
    expect(new Set(lineup.map((a) => a.id)).size).toBe(5);
  });
});