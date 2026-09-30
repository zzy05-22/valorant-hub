import { describe, expect, it } from 'vitest';
import { validateAgents, validateWeapons, ValidationError } from '../scripts/lib/validate.mjs';

const mkAgent = (over: Record<string, unknown> = {}) => ({
  id: 'jett',
  uuid: 'u',
  zh: { name: '捷风', description: '', role: '决斗者' },
  en: { name: 'Jett', description: '', role: 'Duelist' },
  roleIcon: '', displayIcon: '', fullPortrait: '', background: '',
  abilities: [{
    slot: 'Q', key: 'Ability1',
    zh: { name: '云', description: '' },
    en: { name: 'Cloudburst', description: '' },
    icon: '',
  }],
  ...over,
});

describe('validateAgents', () => {
  it('数量达标且字段完整时通过', () => {
    const agents = Array.from({ length: 20 }, (_, i) => mkAgent({ id: `agent-${i}` }));
    expect(validateAgents(agents)).toBe(true);
  });

  it('数量不足 20 抛 ValidationError', () => {
    expect(() => validateAgents(Array.from({ length: 19 }, () => mkAgent()))).toThrow(ValidationError);
  });

  it('关键字段缺失抛 ValidationError', () => {
    const agents = Array.from({ length: 20 }, (_, i) =>
      i === 0 ? mkAgent({ id: '' }) : mkAgent({ id: `agent-${i}` }),
    );
    expect(() => validateAgents(agents)).toThrow(ValidationError);
  });

  it('技能数组为空抛 ValidationError', () => {
    const agents = Array.from({ length: 20 }, (_, i) =>
      i === 0 ? mkAgent({ abilities: [] }) : mkAgent({ id: `agent-${i}` }),
    );
    expect(() => validateAgents(agents)).toThrow(ValidationError);
  });
});

const mkWeapon = (over: Record<string, unknown> = {}) => ({
  id: 'vandal', uuid: 'u',
  zh: { name: '暴徒', category: '步枪' },
  en: { name: 'Vandal', category: 'Rifle' },
  category: 'EEquippableCategory::Rifle',
  credits: 2900, displayIcon: '',
  stats: { fireRate: 9.75, magazineSize: 25, wallPenetration: 'Medium' },
  damageRanges: [],
  ...over,
});

describe('validateWeapons', () => {
  it('数量达标且字段完整时通过', () => {
    const weapons = Array.from({ length: 15 }, (_, i) => mkWeapon({ id: `w-${i}` }));
    expect(validateWeapons(weapons)).toBe(true);
  });

  it('数量不足 15 抛 ValidationError', () => {
    expect(() => validateWeapons(Array.from({ length: 14 }, (_, i) => mkWeapon({ id: `w-${i}` })))).toThrow(ValidationError);
  });

  it('价格非负数抛 ValidationError', () => {
    const weapons = Array.from({ length: 15 }, (_, i) =>
      i === 0 ? mkWeapon({ credits: -100 }) : mkWeapon({ id: `w-${i}` }),
    );
    expect(() => validateWeapons(weapons)).toThrow(ValidationError);
  });
});