# valorant-hub P10 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① 赛程赛果表（vlr.gg 爬取 + /esports/matches/ 页面 + 首页板块）；② 版本公告自动摘要（Riot 官方源爬取 + patch-notes 自动时间线）；③ 首页 hero 文案改版（"精准即是艺术" → 简短介绍网站）。

**Architecture:** 沿用 P5/P6 数据管道模式：解析纯函数（可测）+ 网络函数 + sync 独立容错块（try-catch warn-only，失败不破坏游戏数据）+ 数据 JSON 原子写 + 页面服务端渲染。版本摘要 = 官方公告章节标题的中文映射（事实性信息，无版权问题），每条附官方原文链接。

**Tech Stack:** 同 P0-P9（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-10-08）:** "加上赛程赛果表 > 版本公告自动摘要另外主页的瞄准即是艺术这些太难听了，可以简短介绍一下网站"

**数据源探测记录（2026-10-08 实测）:**
- vlr.gg/matches：直接 200（无 cookie gate），`match-item` 块结构：`<a class="wf-module-item match-item ..." href="/754730/...">`、`match-item-time`（"5:00 PM"）、`match-item-vs-team-name` 内 `text-of`（`<span class="flag mod-us"></span>` + 队名）、`match-item-vs-team-score mod-upcoming`（未开赛为 `&ndash;`）、`match-item-eta` > `ml-status`（Upcoming/Live/已结束比分）
- playvalorant.com/en-us/news/game-updates/：200；条目 `<a role="button" aria-label="VALORANT Patch Notes 13.06" href="/en-us/news/game-updates/valorant-patch-notes-13-06">`；详情页 `"datePublished":"2026-09-22T13:00:00.000Z"`（JSON-LD）+ 章节 `<h2>GENERAL UPDATES</h2>` 等 9 个固定标题
- E2E 红线：smoke.spec.ts:5 断言 h1 含"精准"——P10-3 必须同步改

**前置状态:** P0-P9 已上线；本地 75ed5ef 与远端同步；56 单测 + 15 E2E 全绿；77 页构建。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净；今天日期 **2026-10-08**

## 关键背景（给零上下文的执行者）

- **vlr 爬虫既有模式**（scripts/lib/vlr.mjs，P6 建立）：ASCII User-Agent、解析纯函数导出可测、失败 throw 由 sync 捕获 warn。新 parseMatches 沿用同模式；**不需要 cookie gate**（matches 页实测直接 200）
- **容错红线**：matches 与 patch-feed 各自独立 try-catch 块（一个挂不影响另一个与游戏数据同步），warn 不中断
- **版本摘要的版权边界**：只爬"版本号/日期/章节标题"事实数据映射中文，正文不爬不译；每条附官方原文链接
- **章节中文映射表**（固定 9 项）：GENERAL UPDATES→综合更新、CLIENT UPDATES→客户端更新、COMPETITIVE UPDATES→竞技更新、GAMEPLAY SYSTEMS UPDATES→玩法系统更新、MODES UPDATES→模式更新、PLAYER BEHAVIOR UPDATES→玩家行为更新、PROGRESSION UPDATES→进度更新、WEAPONS UPDATES→武器更新、BUG FIXES→错误修复（未映射章节原样保留）
- **测试教训（P9）**：`toEqual` 是全字段严格比较——期望对象必须与真实返回完全一致；解析函数返回结构先在用例里写清楚
- **vlr 日期分组**：页面有日期分隔条（执行时 grep `wf-label` 类再确认真实结构），解析时把日期归入每场比赛记录
- **计数核对**：单测 56 + 3（vlr matches）+ 3（riot patches）= **62**；页面 77 + 1 = **78**；E2E 15 + 1 = **16**；新数据文件 matches.json + patch-feed.json

## 文件结构总览（P10 变更）

```
scripts/lib/vlr.mjs                 # P10-1 加 parseMatches + fetchMatches
scripts/lib/riot-patches.mjs        # P10-2 新建（parsePatchList/parsePatchSections + 映射表）
scripts/sync-valorant.mjs           # P10-1/2 各加独立容错块
tests/vlr.test.ts                   # P10-1 +3 用例
tests/riot-patches.test.ts          # P10-2 新建 +3 用例
src/data/matches.json               # P10-1 新建（sync 产物快照）
src/data/patch-feed.json            # P10-2 新建（sync 产物快照）
src/pages/esports/matches.astro      # P10-1 新建（赛程赛果页）
src/pages/patch-notes/index.astro   # P10-2 加自动时间线 section
src/pages/index.astro               # P10-1 加赛程板块；P10-3 改 h1
src/pages/esports/index.astro       # P10-1 加赛程入口卡
tests/e2e/smoke.spec.ts            # P10-3 改 h1 断言；P10-4 加赛程用例
```

---

### Task P10-1: 赛程赛果爬取与展示

**Files:**
- Modify: `scripts/lib/vlr.mjs`、`scripts/sync-valorant.mjs`、`tests/vlr.test.ts`、`src/pages/index.astro`、`src/pages/esports/index.astro`
- Create: `src/pages/esports/matches.astro`、`src/data/matches.json`

- [ ] **Step 1: 先重新 curl 一次 vlr.gg/matches 确认结构未变，并确认日期分隔条真实类名**

Run: `curl -sL -A "Mozilla/5.0" https://www.vlr.gg/matches -o /tmp/vlr-m.html && grep -oE 'class="[^"]*wf-label[^"]*"' /tmp/vlr-m.html | head -3`（用实测结果修准解析正则）

- [ ] **Step 2: tests/vlr.test.ts 追加 3 个失败用例**（fixture 基于探测真实结构，内联字符串）

```ts
import { parseMatches } from '../../scripts/lib/vlr';  // 追加到现有 import 或独立 import 行

describe('parseMatches（赛程赛果）', () => {
  const fixture = `<a href="/754730/a-vs-b" class="wf-module-item match-item mod-color mod-first">
  <div class="match-item-time">5:00 PM</div>
  <div class="match-item-vs">
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-us"></span>
        100 Thieves</div></div>
      <div class="match-item-vs-team-score mod-upcoming">&ndash;</div>
    </div>
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-us"></span>
        G2 Esports</div></div>
      <div class="match-item-vs-team-score mod-upcoming">&ndash;</div>
    </div>
  </div>
  <div class="match-item-eta"><div class="ml"><div class="ml-status">Upcoming</div><div class="ml-eta">6h 56m</div></div></div>
  <div class="match-item-event text-of">VCT Champions 2026<div class="match-item-event-series text-of">Upper Bracket Quarterfinals</div></div>
  </a>
  <a href="/754731/c-vs-d" class="wf-module-item match-item mod-color">
  <div class="match-item-time">2:00 PM</div>
  <div class="match-item-vs">
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-br"></span>
        LOUD</div></div>
      <div class="match-item-vs-team-score mod-win mod-count">2</div>
    </div>
    <div class="match-item-vs-team ">
      <div class="match-item-vs-team-name"><div class="text-of"><span class="flag mod-kr"></span>
        DRX</div></div>
      <div class="match-item-vs-team-score mod-loss mod-count">0</div>
    </div>
  </div>
  <div class="match-item-eta"><div class="ml"><div class="ml-status">Final</div><div class="ml-eta">18h ago</div></div></div>
  <div class="match-item-event text-of">VCT Champions 2026<div class="match-item-event-series text-of">Grand Final</div></div>
  </a>`;

  it('解析进行中/即将比赛：两队与状态', () => {
    const ms = parseMatches(fixture);
    expect(ms).toHaveLength(2);
    expect(ms[0]).toMatchObject({ href: '/754730/a-vs-b', teamA: '100 Thieves', teamB: 'G2 Esports', status: 'upcoming' });
  });

  it('解析已结束比赛：比分与胜者', () => {
    const ms = parseMatches(fixture);
    expect(ms[1]).toMatchObject({ teamA: 'LOUD', teamB: 'DRX', scoreA: 2, scoreB: 0, winner: 'A', status: 'completed' });
  });

  it('解析赛事名与时间', () => {
    const ms = parseMatches(fixture);
    expect(ms[1].event).toContain('VCT Champions 2026');
    expect(ms[1].series).toBe('Grand Final');
    expect(ms[0].time).toBe('5:00 PM');
  });
});
```

（返回结构约定：`{ href, teamA, teamB, scoreA, scoreB, winner: 'A'|'B'|null, status: 'upcoming'|'live'|'completed', time, event, series, date }`；date 从日期分隔条归入，无分隔条时为空串——执行时以 Step 1 实测为准）

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm vitest run tests/vlr.test.ts`
Expected: 新 3 FAIL（parseMatches 不存在），旧 3 PASS

- [ ] **Step 4: vlr.mjs 实现 parseMatches + fetchMatches**

- parseMatches(html)：按 `<a ...match-item...>...</a>` 分块正则；每块内提取上述字段：队名（`match-item-vs-team-name` 后 `text-of` 内文本，去掉 flag span 残留与空白）、比分（`mod-upcoming` 为未开赛 score=null；`mod-count` 数字 + `mod-win`/`mod-loss` 判 winner；score 类含 `mod-win` 记 winner）；状态（`ml-status` 为 Upcoming→upcoming、Live→live、其余有比分→completed）；event/series/time 同结构提取
- fetchMatches()：`fetch('https://www.vlr.gg/matches', { headers: { 'user-agent': 'Mozilla/5.0' } })` → text() → parseMatches；HTTP 非 200 throw（沿用 fetchRankings 的网络模式）

- [ ] **Step 5: 跑测试确认 6 passed**

Run: `pnpm vitest run tests/vlr.test.ts`
Expected: 6 passed

- [ ] **Step 6: sync-valorant.mjs 加独立容错块**（在 esports-stats 块之后）

```js
// —— 赛程赛果同步（vlr.gg/matches，独立容错：失败只 warn）——
try {
  const matches = await fetchMatches();
  await atomicWrite(
    new URL('../src/data/matches.json', import.meta.url),
    `${JSON.stringify({ matches, syncedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log(`matches synced: ${matches.length} 场`);
} catch (err) {
  console.warn(`warn: matches sync failed: ${err?.message ?? err}`);
}
```

- [ ] **Step 7: 跑一次 sync 生成 matches.json 快照**

Run: `node scripts/sync-valorant.mjs`
Expected: 输出 `matches synced: N 场`（N 可能几十场）；src/data/matches.json 生成且非空；游戏数据正常

- [ ] **Step 8: 新建 src/pages/esports/matches.astro**（赛程赛果页）

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PageHero from '../../components/PageHero.astro';
import matchesData from '../../data/matches.json';

interface Match { href: string; teamA: string; teamB: string; scoreA: number | null; scoreB: number | null; winner: 'A' | 'B' | null; status: string; time: string; event: string; series: string; date: string; }
const all = (matchesData as { matches: Match[] }).matches;
const live = all.filter((m) => m.status === 'live');
const upcoming = all.filter((m) => m.status === 'upcoming');
const completed = all.filter((m) => m.status === 'completed');
---
<BaseLayout title="赛程赛果｜无畏契约资料站" description="VCT 赛程与赛果实时看板：进行中、即将开赛与最近战报">
  <PageHero label="Matches" title="赛程赛果" subtitle={`${all.length} 场比赛 · 数据源 vlr.gg · 每日自动同步`} />
  <main class="container section">
    {live.length > 0 && (
      <section class="role-group">
        <h2>正在直播</h2>
        <div class="mx-grid">{live.map((m) => <Fragment /></div>
      </section>
    )}
    <section class="role-group">
      <h2>即将开赛</h2>
      {upcoming.length === 0 ? <p class="page-sub">暂无排期，等待赛程公布</p> : (
      <div class="mx-grid">
        {upcoming.slice(0, 20).map((m) => (
          <div class="card-cut mx-card">
            <div class="mx-card__event">{m.event}{m.series ? ` · ${m.series}` : ''}</div>
            <div class="mx-card__vs"><b>{m.teamA}</b><span class="mx-card__time">{m.time}</span><b>{m.teamB}</b></div>
            <div class="mx-card__note">约 {m.time} 开赛（vlr.gg 时区）</div>
          </div>
        ))}
      </div>)}
    </section>
    <section class="role-group">
      <h2>最近赛果</h2>
      {completed.length === 0 ? <p class="page-sub">暂无已结束比赛记录</p> : (
      <div class="mx-grid">
        {completed.slice(0, 20).map((m) => (
          <div class="card-cut mx-card">
            <div class="mx-card__event">{m.event}{m.series ? ` · ${m.series}` : ''}</div>
            <div class="mx-card__vs">
              <b class={m.winner === 'A' ? 'mx-win' : ''}>{m.teamA}</b>
              <span class="mx-card__score">{m.scoreA} : {m.scoreB}</span>
              <b class={m.winner === 'B' ? 'mx-win' : ''}>{m.teamB}</b>
            </div>
          </div>
        ))}
      </div>)}
    </section>
    <p class="data-meta">赛程数据来自 vlr.gg，每日自动同步；比分以官方为准。</p>
  </main>
</BaseLayout>
```

**注意**：`<Fragment />` 是笔误占位——实际写卡片结构（复制 upcoming 的 mx-card 结构即可）；live 区块与 upcoming 卡片同构但 event 前加红色 `● LIVE` 徽章。scoped 样式：mx-grid 双列网格（移动端单列）、mx-card 内排版、mx-win 红色高亮胜者、mx-card__event 灰色小字、mx-card__time/score 等比字号。

- [ ] **Step 9: 首页加"赛程速览"板块**（插在热门准星板块之后，block6 风格）

frontmatter：`import matchesData from '../data/matches.json';` + `const upcomingMatches = (matchesData as { matches: { teamA: string; teamB: string; time: string; event: string; status: string }[] }).matches.filter((m) => m.status === 'upcoming').slice(0, 4);`

板块结构（沿用 block6 头 + card-cut 卡）：h2 "赛程速览" + en "MATCHES" + `<a class="block6__more" href="/esports/matches/">全部赛程 →</a>`；卡内 `{m.teamA} vs {m.teamB}` + `{m.time}` + `{m.event}` 小字。若 upcomingMatches 为空，板块整体不渲染（`{upcomingMatches.length > 0 && ...}`）。

- [ ] **Step 10: 资讯列表页（src/pages/esports/index.astro）顶部加赛程入口卡**

列表 section 前加：`<a class="card-cut card-lift" href="/esports/matches/" style="...">` 内 `📅 赛程赛果 —— VCT 全部比赛一览（每日同步）→`（无 emoji，用文字："赛程赛果 · VCT 全部比赛一览（每日同步）→"）

- [ ] **Step 11: 构建验证**

Run: `pnpm build`
Expected: **78 页**；`ls dist/esports/matches/index.html` 存在；`grep -o '赛程速览' dist/index.html | wc -l` ≥ 1（若当日有 upcoming）；`grep -o '赛程赛果' dist/esports/matches/index.html | wc -l` ≥ 1

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(p10): 赛程赛果表（vlr.gg 每日同步 + 赛程页 + 首页速览板块）"
```

---

### Task P10-2: 版本公告自动摘要

**Files:**
- Create: `scripts/lib/riot-patches.mjs`、`tests/riot-patches.test.ts`、`src/data/patch-feed.json`
- Modify: `scripts/sync-valorant.mjs`、`src/pages/patch-notes/index.astro`

- [ ] **Step 1: tests/riot-patches.test.ts 写 3 个失败用例**

```ts
import { describe, expect, it } from 'vitest';
import { parsePatchList, parsePatchSections, SECTION_ZH } from '../../scripts/lib/riot-patches';

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
```

- [ ] **Step 2: 确认失败 → 实现 scripts/lib/riot-patches.mjs**

- SECTION_ZH：9 项固定映射（见关键背景）
- parsePatchList(html)：正则 `aria-label="VALORANT Patch Notes ([0-9.]+)" href="(/en-us/news/game-updates/[^"]+)"` → 去重（版本号唯一）→ `{ version, title, url: 'https://playvalorant.com' + href }`，最多 8 条
- parsePatchSections(html)：`"datePublished":"(YYYY-MM-DD)` 取日期；`<h2>([^<]{3,80})</h2>` 去重取章节 → SECTION_ZH 映射（含 `&nbsp;` 清理）
- fetchPatchFeed()：抓列表页 → 取前 3 个版本逐个抓详情页 → `[{ version, date, url, sections }]`

- [ ] **Step 3: 测试通过（3 passed）**

Run: `pnpm vitest run tests/riot-patches.test.ts`

- [ ] **Step 4: sync-valorant.mjs 加第二个独立容错块**（matches 块之后）

```js
// —— 版本公告同步（playvalorant.com，独立容错：失败只 warn）——
try {
  const patches = await fetchPatchFeed();
  await atomicWrite(
    new URL('../src/data/patch-feed.json', import.meta.url),
    `${JSON.stringify({ patches, syncedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log(`patch-feed synced: ${patches.length} 个版本`);
} catch (err) {
  console.warn(`warn: patch-feed sync failed: ${err?.message ?? err}`);
}
```

- [ ] **Step 5: 跑 sync 生成 patch-feed.json 快照**

Run: `node scripts/sync-valorant.mjs`
Expected: `patch-feed synced: 3 个版本`（列表前 3）；13.06 的 sections 应有中文映射

- [ ] **Step 6: patch-notes/index.astro 顶部加"版本时间线（自动同步）"**

frontmatter：`import patchFeed from '../../data/patch-feed.json';` + 取 `{ patches }`。列表 section 之前插入：

```astro
<section class="role-group">
  <h2>版本时间线（自动同步）</h2>
  <p class="page-sub">数据来自 Riot 官方版本公告（每日同步），摘要为公告章节结构，正文见官方原文。</p>
  <div class="pf-grid">
    {patches.map((p) => (
      <div class="card-cut pf-card">
        <div class="pf-card__ver">版本 {p.version}</div>
        <div class="pf-card__date">{p.date}</div>
        <div class="pf-card__sections">{p.sections.map((s) => <span>{s}</span>)}</div>
        <a class="pf-card__link" href={p.url} target="_blank" rel="noopener noreferrer">官方公告原文 →</a>
      </div>
    ))}
  </div>
</section>
```

scoped 样式：pf-grid 双列、pf-card__ver 大号红字、sections 标签样式（同准星卡 tags 风格）、外部链接安全（rel noopener）。

- [ ] **Step 7: 构建验证**

Run: `pnpm build`
Expected: 78 页；`grep -o '版本时间线' dist/patch-notes/index.html | wc -l` ≥ 1；`grep -o '13.06' dist/patch-notes/index.html | wc -l` ≥ 1

- [ ] **Step 8: 全量测试 + Commit**

Run: `pnpm test`
Expected: **62 passed**（56 + vlr 3 + riot 3）

```bash
git add -A
git commit -m "feat(p10): 版本公告自动摘要（Riot 官方源每日同步 + 时间线板块）"
```

---

### Task P10-3: 首页 hero 文案改版

**Files:**
- Modify: `src/pages/index.astro`、`tests/e2e/smoke.spec.ts`

- [ ] **Step 1: index.astro h1 改版**

```
旧：<h1>在这里，<br /><span class="text-shimmer">精准即是艺术</span></h1>
新：<h1>无畏契约<br /><span class="text-shimmer">中文资料站</span></h1>
```

（hero6__sub 副标题保留不动："特工图鉴 · 准星代码 · 道具点位 · 版本资讯 —— 中文玩家的一站式数据库"）

- [ ] **Step 2: E2E 断言同步**（smoke.spec.ts:5）

```
旧：await expect(page.getByRole('heading', { level: 1 })).toContainText('精准');
新：await expect(page.getByRole('heading', { level: 1 })).toContainText('无畏契约');
```

- [ ] **Step 3: 检查其他引用**

Run: `grep -rn '精准即是艺术' src/ tests/`（预期 0 处残留，水印 PRECISION 是英文装饰不属于文案）

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro tests/e2e/smoke.spec.ts
git commit -m "feat(p10): 首页 hero 文案改为站点直陈（无畏契约中文资料站）"
```

---

### Task P10-4: E2E 扩展与全链（主工程师执行）

- [ ] **Step 1: smoke.spec.ts 追加赛程用例**（16 条）

```ts
test('赛程赛果页可访问', async ({ page }) => {
  await page.goto('/esports/matches/');
  await expect(page.getByRole('heading', { name: '赛程赛果' })).toBeVisible();
  await expect(page.locator('.mx-card, .page-sub').first()).toBeVisible();
});
```

- [ ] **Step 2: 全链**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0/0、**62 单测**、**78 页**、**16 E2E**（首页超时重跑一次的已知环境问题照旧）

- [ ] **Step 3: push + 线上验证**（赛程页/时间线/新 hero/首页速览板块）

---

## Self-Review 记录

1. **范围覆盖**：三项需求全落地——赛程赛果（爬取/页面/首页板块/入口）、版本摘要（爬取/映射/时间线）、hero 文案（h1 + E2E 同步）。
2. **数据真实性**：解析正则基于 2026-10-08 实测 HTML（match-item 块与 Riot aria-label/datePublished/h2 结构），非凭记忆；执行时 Step 1 再确认日期分隔条。
3. **容错**：两个新爬取块各自独立 try-catch warn-only；vlr matches 实测无 cookie gate（与 rankings 不同，写进背景防执行者套错模板）。
4. **计数核对**：单测 62、页面 78、E2E 16（h1 断言改 1 处 + 新增 1 条）。
5. **P9 教训**：toEqual 期望全字段一致；fixture 用例先写清返回结构约定。