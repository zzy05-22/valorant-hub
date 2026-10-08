import { describe, expect, it } from 'vitest';
import { parsePatchList, parsePatchSections, SECTION_ZH } from '../scripts/lib/riot-patches.mjs';

const listFixture = `<a role="button" aria-label="VALORANT Patch Notes 13.06" href="/en-us/news/game-updates/valorant-patch-notes-13-06" data-testid="articlefeaturedcard-component"></a>
<a role="button" aria-label="VALORANT Patch Notes 13.05" href="/en-us/news/game-updates/valorant-patch-notes-13-05"></a>`;

describe('Riot 版本公告解析', () => {
  it('解析列表：版本号/标题/链接', () => {
    const list = parsePatchList(listFixture);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ version: '13.06', title: 'VALORANT Patch Notes 13.06', url: 'https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-06' });
  });

  it('解析详情：发布日期与中文章节映射', () => {
    const detail = `<script>"datePublished":"2026-09-22T13:00:00.000Z"</script><h2>GENERAL UPDATES</h2><h2>WEAPONS UPDATES</h2><h2>BUG FIXES</h2>`;
    const r = parsePatchSections(detail);
    expect(r.date).toBe('2026-09-22');
    expect(r.sections).toEqual(['综合更新', '武器更新', '错误修复']);
  });

  it('SECTION_ZH 全量映射与未知章节兜底', () => {
    expect(SECTION_ZH['WEAPONS UPDATES']).toBe('武器更新');
    expect(parsePatchSections('<h2>SOMETHING NEW</h2>').sections).toEqual(['SOMETHING NEW']);
  });
});