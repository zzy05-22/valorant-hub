import { describe, expect, it } from 'vitest';
import { slugify, transformAgents, transformWeapons } from '../scripts/lib/transform.mjs';
import agentsZh from './fixtures/agents.zh-CN.json';
import agentsEn from './fixtures/agents.en-US.json';
import weaponsZh from './fixtures/weapons.zh-CN.json';
import weaponsEn from './fixtures/weapons.en-US.json';

describe('slugify', () => {
  it('英文名转小写 slug', () => {
    expect(slugify('Jett')).toBe('jett');
    expect(slugify('Killjoy')).toBe('killjoy');
  });
});

describe('transformAgents', () => {
  const agents = transformAgents(agentsZh.data, agentsEn.data);

  it('至少合并出 1 个特工', () => {
    expect(agents.length).toBeGreaterThanOrEqual(1);
  });

  it('中英字段合并进同一条记录', () => {
    for (const a of agents) {
      expect(a.zh.name).toBeTruthy();
      expect(a.en.name).toBeTruthy();
      expect(a.zh.role).toBeTruthy();
      expect(a.en.role).toBeTruthy();
    }
  });

  it('id 是由英文名生成的 slug', () => {
    for (const a of agents) {
      expect(a.id).toMatch(/^[a-z0-9-]+$/);
      expect(a.id).toBe(slugify(a.en.name));
    }
  });

  it('技能槽位映射为游戏按键 C/Q/E/X', () => {
    for (const a of agents) {
      for (const ab of a.abilities) {
        expect(['C', 'Q', 'E', 'X']).toContain(ab.slot);
        expect(ab.zh.name).toBeTruthy();
        expect(ab.en.name).toBeTruthy();
      }
    }
  });
});

describe('transformWeapons', () => {
  const weapons = transformWeapons(weaponsZh.data, weaponsEn.data);

  it('至少合并出 1 件武器', () => {
    expect(weapons.length).toBeGreaterThanOrEqual(1);
  });

  it('存在带伤害分段的武器，字段齐全', () => {
    const withDamage = weapons.find((w) => w.damageRanges.length > 0);
    expect(withDamage).toBeDefined();
    for (const r of withDamage!.damageRanges) {
      expect(typeof r.rangeStartMeters).toBe('number');
      expect(typeof r.headDamage).toBe('number');
      expect(typeof r.bodyDamage).toBe('number');
      expect(typeof r.legDamage).toBe('number');
    }
  });

  it('stats 与 credits 数值类型正确', () => {
    for (const w of weapons) {
      expect(typeof w.credits).toBe('number');
      expect(w.credits).toBeGreaterThanOrEqual(0);
      expect(typeof w.stats.fireRate).toBe('number');
      expect(typeof w.stats.magazineSize).toBe('number');
      expect(typeof w.stats.wallPenetration).toBe('string');
    }
  });
});