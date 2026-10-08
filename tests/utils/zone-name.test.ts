import { describe, expect, it } from 'vitest';
import { zoneToZh, zoneCategory } from '../../src/utils/zone-name';
import { MAP_ZONES } from '../../src/data/map-zones';

const avgY = (z: { pts: [number, number][] }) => z.pts.reduce((s, p) => s + p[1], 0) / z.pts.length;

describe('zoneToZh 词干映射', () => {
  it('整名直译：出生点等', () => {
    expect(zoneToZh('Attacker Spawn')).toBe('攻方出生点');
    expect(zoneToZh('Defender Side Spawn')).toBe('守方出生点');
    expect(zoneToZh('Attacker Side Bridge')).toBe('攻方桥头');
  });

  it('前缀 + 复合词干', () => {
    expect(zoneToZh('A Back Site')).toBe('A 点后');
    expect(zoneToZh('B Front Site')).toBe('B 点前');
    expect(zoneToZh('A Second Floor')).toBe('A 二楼');
  });

  it('前缀 + 单词干', () => {
    expect(zoneToZh('A Site')).toBe('A 点');
    expect(zoneToZh('Middle Pizza')).toBe('中 披萨店');
    expect(zoneToZh('B Boba')).toBe('B 奶茶店');
    expect(zoneToZh('Mid Connector')).toBe('中 连接道');
    expect(zoneToZh('B Snow Pile')).toBe('B 雪堆');
  });

  it('数字后缀保留', () => {
    expect(zoneToZh('A Back Site 2')).toBe('A 点后 2');
  });

  it('未收录词保留英文原文（不产生假译名）', () => {
    expect(zoneToZh('Mystery Spot')).toBe('Mystery Spot');
  });

  it('前导空格容错（上游数据存在带前导空格的名称）', () => {
    expect(zoneToZh(' A ElbowRat')).toBe('A 肘位房');
  });
});

describe('zoneCategory 区域归类', () => {
  it('A/B/C/中/出生点/其他', () => {
    expect(zoneCategory('A Site')).toBe('a');
    expect(zoneCategory('B Main')).toBe('b');
    expect(zoneCategory('C Long')).toBe('c');
    expect(zoneCategory('Middle Top')).toBe('mid');
    expect(zoneCategory('Attacker Spawn')).toBe('spawn');
    expect(zoneCategory('Gravel')).toBe('other');
  });
});

describe('MAP_ZONES 数据集成', () => {
  it('覆盖 10 张竞技图（缺 abyss/corrode/summit，页面回退纯文本）', () => {
    expect(Object.keys(MAP_ZONES).sort()).toEqual([
      'ascent', 'bind', 'breeze', 'fracture', 'haven', 'icebox', 'lotus', 'pearl', 'split', 'sunset',
    ]);
  });

  it('每图 zone 数与上游源数据一致（防止生成脚本静默丢失）', () => {
    const expected: Record<string, number> = {
      ascent: 28, split: 29, fracture: 20, bind: 28, breeze: 27,
      lotus: 42, sunset: 29, pearl: 29, icebox: 29, haven: 24,
    };
    for (const [id, n] of Object.entries(expected)) {
      expect(MAP_ZONES[id], id).toHaveLength(n);
    }
    expect(Object.values(MAP_ZONES).reduce((s, z) => s + z.length, 0)).toBe(285);
  });

  it('所有 zone 均可正常映射且多边形合法', () => {
    for (const zones of Object.values(MAP_ZONES)) {
      for (const z of zones) {
        const zh = zoneToZh(z.name);
        expect(typeof zh).toBe('string');
        expect(zh.length).toBeGreaterThan(0);
        expect(z.pts.length).toBeGreaterThanOrEqual(3);
        for (const [x, y] of z.pts) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('split（霓虹町）方向与游戏一致：B 区在上半、A 区在下半', () => {
    const bSite = MAP_ZONES.split.find((z) => z.name === 'B Back Site');
    const aSite = MAP_ZONES.split.find((z) => z.name === 'A Site');
    expect(bSite).toBeTruthy();
    expect(aSite).toBeTruthy();
    expect(avgY(bSite!)).toBeLessThan(avgY(aSite!));
  });
});