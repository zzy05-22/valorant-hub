import { describe, expect, it } from 'vitest';
import { searchEntities, type SearchEntity } from '../../src/utils/search';

const index: SearchEntity[] = [
  { type: '特工', title: '捷风', sub: 'Jett', url: '/agents/jett/' },
  { type: '武器', title: '狂徒 Vandal', sub: '步枪', url: '/weapons/vandal/' },
  { type: '地图', title: '亚海悬城', sub: 'Ascent', url: '/maps/ascent/' },
  { type: '教学', title: '常用术语黑话表', sub: '术语', url: '/guides/terms-glossary/' },
];

describe('searchEntities', () => {
  it('空查询返回空数组', () => {
    expect(searchEntities(index, '')).toEqual([]);
    expect(searchEntities(index, '   ')).toEqual([]);
  });

  it('中文标题匹配', () => {
    const r = searchEntities(index, '捷风');
    expect(r).toHaveLength(1);
    expect(r[0].url).toBe('/agents/jett/');
  });

  it('英文副标题匹配且大小写不敏感', () => {
    expect(searchEntities(index, 'jet').map((e) => e.title)).toEqual(['捷风']);
    expect(searchEntities(index, 'ASCENT').map((e) => e.title)).toEqual(['亚海悬城']);
  });
});