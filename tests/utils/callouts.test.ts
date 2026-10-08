import { describe, expect, it } from 'vitest';
import { translateCallouts } from '../../src/utils/callouts';

describe('translateCallouts（报点中文对照）', () => {
  it('已知报点翻译为中文', () => {
    expect(translateCallouts([{ region: 'Main', zone: 'A' }, { region: 'Site', zone: 'B' }]))
      .toEqual([{ region: 'Main', zh: 'A 主道' }, { region: 'Site', zh: 'B 点' }]);
  });

  it('未收录词条保留英文原文（不硬编）', () => {
    expect(translateCallouts([{ region: 'Tree', zone: 'A' }])).toEqual([{ region: 'Tree', zh: 'Tree' }]);
  });
});