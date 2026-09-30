# valorant-hub P5 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 页面逻辑与视觉体验打磨——四项逻辑修复（首页推荐多样化、资讯聚合层级、地图分类、Footer 去重）+ 中度视觉质感升级（卡片动效、导航高亮、区块节奏、VALORANT 品牌装饰）。

**Architecture:** 全部为既有文件的精准修改，无新路由无新数据层；地图分类复用 mapGuides 集合作"标准竞技图"名单（数据驱动，新图攻略上线即自动进第一组）；导航高亮用 `Astro.url.pathname` 前缀匹配。

**Tech Stack:** 同 P0-P4（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-09-30）:** 用户反馈"页面逻辑/跳转与样式美观不太好"；审查诊断出 5 项逻辑问题 + 视觉质感不足；用户确认 = 中度质感升级 + 四项逻辑修复全选。

**前置状态:** P0-P4 已上线（https://valoranthub.icu），48 单测 + 13 E2E 全绿，98 页构建。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净，remote 为 SSH；今天日期 2026-09-30

## 关键背景（给零上下文的执行者）

- **zh.role 实测值**为「决斗 / 先锋 / 控场 / 哨卫」（API 数据即真相，P2 lineup 与 P3 均已依赖此约定）
- **地图分类依据**：`mapGuides` 内容集合覆盖的 13 张图即"标准竞技地图"（有攻略的必是竞技图，新图攻略上线自动进组，无需维护名单）
- **E2E 断言联动（重要）**：P5-1 把 /esports/ 的 h1 从「电竞资讯」改为「资讯中心」，tests/e2e/smoke.spec.ts 中对应用例的 heading 断言必须同步改，否则全链验证必挂
- **h2 菱形装饰的选择器边界**：用 `main > h2, main section > h2` 限定（排除对比工具卡片 article 内的 h2，避免对比卡标题重复装饰）
- **计数不变**：单测 48、E2E 13（仅断言文案更新）、页面 98
- **产物是压缩 HTML**：验证一律用 `grep -o | wc -l`

## 文件结构总览（P5 变更）

```
src/pages/index.astro             # P5-1 修改（推荐逻辑 + 地图速览过滤）
src/pages/esports/index.astro     # P5-1 修改（资讯聚合：版本公告区块 + 标题改资讯中心）
src/pages/maps/index.astro        # P5-1 修改（竞技图/其他模式两组分类）
src/components/Footer.astro      # P5-1 修改（links 精简为 版本资讯 + 点位标注工具）
tests/e2e/smoke.spec.ts           # P5-1 修改（esports 用例 h1 断言改资讯中心）
src/styles/global.css             # P5-2 修改（菱形装饰/卡片动效/按钮反馈/交替底色）
src/components/NavBar.astro       # P5-2 修改（当前项高亮）
src/components/AgentCard.astro    # P5-2 修改（hover 动效）
src/components/WeaponCard.astro    # P5-2 修改（hover 动效）
src/components/MapCard.astro       # P5-2 修改（hover 动效）
src/pages/index.astro             # P5-2 修改（hero 质感装饰 + 区块交替底色）
```

---

### Task P5-1: 四项逻辑修复

**Files:**
- Modify: `src/pages/index.astro`、`src/pages/esports/index.astro`、`src/pages/maps/index.astro`、`src/components/Footer.astro`、`tests/e2e/smoke.spec.ts`

- [ ] **Step 1: index.astro 首页推荐逻辑（两处替换）**

frontmatter 中：

```
旧：const featuredAgents = agentsData.agents.slice(0, 6);
旧：const featuredMaps = mapsData.maps.slice(0, 4);
```

替换为：

```ts
// 角色多样化推荐：决斗 2 + 先锋 2 + 控场 1 + 哨卫 1（zh.role 实测值）
const rolePool = new Map<string, typeof agentsData.agents>();
for (const a of agentsData.agents) {
  if (!rolePool.has(a.zh.role)) rolePool.set(a.zh.role, []);
  rolePool.get(a.zh.role)!.push(a);
}
const QUOTA: Record<string, number> = { 决斗: 2, 先锋: 2, 控场: 1, 哨卫: 1 };
const featuredAgents = Object.entries(QUOTA).flatMap(([role, n]) => (rolePool.get(role) ?? []).slice(0, n));
// 地图速览：只展示有战术图的已上线地图（前 4 张均为标准竞技图）
const featuredMaps = mapsData.maps.filter((m) => m.displayIcon).slice(0, 4);
```

- [ ] **Step 2: esports/index.astro 资讯聚合**

1）frontmatter 的 `const posts = ...` 之前追加：

```ts
const patchNotes = (await getCollection('patchNotes', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
  .slice(0, 2);
```

2）main 区头部（label-cut / h1 / page-sub 三行）替换为：

```astro
    <div class="label-cut">News</div>
    <h1>资讯中心</h1>
    <p class="page-sub">版本公告 · 赛事科普 · 观赛指南 · 赛程资讯</p>
```

BaseLayout 的 title 与 description 同步改为 `资讯中心｜无畏契约资料站` / `版本公告与赛事资讯：跟随版本更新，覆盖 VCT 赛程`。

3）page-sub 之后、原 `<ul class="note-list">` 之前插入版本公告区块：

```astro
    <section class="role-group">
      <h2>最新版本公告</h2>
      <ul class="note-list">
        {patchNotes.map((n) => (
          <li class="card-cut note-item">
            <a class="note-item__title" href={`/patch-notes/${n.id}/`}>{n.data.title}</a>
            <p class="note-item__meta">版本 {n.data.patchVersion}</p>
            <p class="note-item__excerpt">{n.data.excerpt}</p>
          </li>
        ))}
      </ul>
      <p class="more"><a href="/patch-notes/">全部版本资讯 →</a></p>
    </section>
    <section class="role-group">
      <h2>电竞资讯</h2>
```

（原电竞 `<ul class="note-list">` 保留，末尾补 `</section>` 闭合——即把原列表包进"电竞资讯"section；`more` 类无样式则无需处理，首页同名类在 scoped 样式中——esports 页 scoped 样式已有 `.note-item__title:hover` 等，`more` 段落使用行内语义即可）

- [ ] **Step 3: maps/index.astro 分类分组**

frontmatter 替换（`import { getCollection } from 'astro:content';` 追加在现有 import 后）：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import MapCard from '../../components/MapCard.astro';
import mapsData from '../../data/maps.json';
import { getCollection } from 'astro:content';

const maps = mapsData.maps;

// 标准竞技图 = 有攻略内容的地图（mapGuides 覆盖），其余归其他模式
const guideMapIds = new Set(
  (await getCollection('mapGuides', ({ data }) => !data.draft)).map((g) => g.data.mapId),
);
const standardMaps = maps.filter((m) => guideMapIds.has(m.id));
const otherMaps = maps.filter((m) => !guideMapIds.has(m.id));
---
```

main 区（原 role-nav 锚点 + 单一 grid）整体替换为：

```astro
  <main class="container section">
    <div class="label-cut">Maps</div>
    <h1>地图库</h1>
    <p class="page-sub">{maps.length} 张地图 · 标准竞技图 {standardMaps.length} 张 · 数据版本 {mapsData.version}</p>
    <section class="role-group">
      <h2>标准竞技地图</h2>
      <div class="grid">
        {standardMaps.map((m) => <MapCard map={m} />)}
      </div>
    </section>
    {otherMaps.length > 0 && (
      <section class="role-group">
        <h2>其他模式地图</h2>
        <p class="page-sub">TDM / 斗牛 / 训练场，供模式练习参考</p>
        <div class="grid">
          {otherMaps.map((m) => <MapCard map={m} />)}
        </div>
      </section>
    )}
  </main>
```

- [ ] **Step 4: Footer.astro 精简**

```
旧：
    <nav class="footer__links">
      <a href="/patch-notes/">版本资讯</a>
      <a href="/esports/">电竞资讯</a>
      <a href="/maps/">地图库</a>
    </nav>
新：
    <nav class="footer__links">
      <a href="/patch-notes/">版本资讯</a>
      <a href="/lineup-tool/">点位标注工具</a>
    </nav>
```

（去掉与导航重复的电竞资讯/地图库，补上深藏的标注工具入口）

- [ ] **Step 5: E2E 断言联动更新（tests/e2e/smoke.spec.ts）**

「电竞资讯列表可访问」用例：

```
旧：await expect(page.getByRole('heading', { name: '电竞资讯' })).toBeVisible();
新：await expect(page.getByRole('heading', { name: '资讯中心' })).toBeVisible();
```

（该用例点击 `.note-item__title` 的逻辑保留——聚合页顶部版本公告条目也是 note-item__title，点击后详情页 h1 可见，断言兼容）

- [ ] **Step 6: 构建验证**

Run: `pnpm build`
Run: `grep -o '决斗\|哨卫' dist/index.html | sort | uniq -c`
Expected: 首页热门特工区块出现决斗与哨卫角色名（角色多样化生效）
Run: `grep -o 'Gauntlet' dist/index.html | wc -l`
Expected: 0（首页地图速览不再出现未上线图）
Run: `grep -o '资讯中心\|最新版本公告' dist/esports/index.html | sort | uniq -c`
Expected: 均 ≥ 1
Run: `grep -o '标准竞技地图\|其他模式地图' dist/maps/index.html | sort | uniq -c`
Expected: 均 ≥ 1；Run: `grep -o '点位标注工具' dist/404.html | wc -l` ≥ 1（Footer 新入口全站生效）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix(p5): 页面逻辑修复（首页推荐多样化/资讯聚合/地图分类/Footer 精简）"
```

---

### Task P5-2: 视觉质感升级

**Files:**
- Modify: `src/styles/global.css`、`src/components/NavBar.astro`、`src/components/AgentCard.astro`、`src/components/WeaponCard.astro`、`src/components/MapCard.astro`、`src/pages/index.astro`

- [ ] **Step 1: global.css 末尾追加质感系统**

```css
/* ===== P5 视觉质感系统 ===== */
/* 区块标题装饰：红色菱形（排除 article 内标题避免对比卡重复装饰） */
main > h2::before, main section > h2::before {
  content: '';
  display: inline-block;
  width: 8px; height: 8px;
  background: var(--val-red);
  transform: rotate(45deg);
  margin-right: 0.55rem;
  vertical-align: 1px;
}
/* 卡片动效基础（配合各卡片 hover 描边升级） */
.card-cut { transition: transform 0.2s ease, box-shadow 0.2s ease; }
/* 按钮反馈 */
.btn { transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease; }
.btn:hover { transform: translateY(-1px); }
/* 区块交替底色（首页隔行区块使用） */
.section-alt {
  background: rgba(236, 232, 225, 0.02);
  box-shadow: inset 0 1px 0 var(--val-line), inset 0 -1px 0 var(--val-line);
}
```

- [ ] **Step 2: NavBar.astro 当前项高亮**

frontmatter items 数组后追加：

```astro
const path = Astro.url.pathname;
const isActive = (href: string) => path === href || path.startsWith(href);
```

导航链接模板改为：

```astro
      {items.map((i) => (
        <a href={i.href} class:list={[{ 'nav__link--active': isActive(i.href) }]}>{i.label}</a>
      ))}
```

scoped 样式追加：

```css
  .nav__links a.nav__link--active { color: var(--val-cream); box-shadow: inset 0 -2px 0 var(--val-red); }
```

- [ ] **Step 3: 三卡片 hover 动效（各组件 scoped 样式升级）**

AgentCard.astro：

```css
  .agent-card:hover { box-shadow: inset 0 0 0 1px var(--val-red); transform: translateY(-3px); }
  .agent-card img { width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: 0.5rem; transition: transform 0.25s ease; }
  .agent-card:hover img { transform: scale(1.05); }
```

（把原 `.agent-card:hover` 规则合并升级、原 img 规则加 transition；WeaponCard 与 MapCard 同模式）

WeaponCard.astro 同步升级（原 hover 规则加 `transform: translateY(-3px)`，img 加 transition + `:hover img { transform: scale(1.05); }`）。

MapCard.astro 同步升级（同上模式）。

- [ ] **Step 4: index.astro hero 质感与区块节奏**

「最新教学」section 标签改为 `class="container section-block section-alt"`；「最新资讯」section 标签同样加 `section-alt`（热门特工/地图速览保持原样，形成交替节奏）。

hero 的 scoped 样式 `.hero { padding: 5rem 1.5rem 3.5rem; max-width: 1080px; }` 升级为：

```css
  .hero { padding: 5rem 1.5rem 3.5rem; max-width: 1080px; position: relative; overflow: hidden; }
  .hero::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; right: -10%;
    width: 34%;
    background:
      linear-gradient(115deg, transparent 0%, rgba(255, 70, 85, 0.07) 45%, rgba(255, 70, 85, 0.07) 55%, transparent 100%),
      repeating-linear-gradient(0deg, transparent 0 22px, rgba(236, 232, 225, 0.025) 22px 23px);
    transform: skewX(-8deg);
    pointer-events: none;
  }
```

- [ ] **Step 5: 构建验证**

Run: `pnpm build && grep -o 'nav__link--active' dist/agents/index.html | wc -l`
Expected: ≥ 2（CSS 规则 + class 输出；特工页"特工"导航项应带 active 类）
Run: `grep -o 'rotate(45deg)' dist/index.html | wc -l`
Expected: ≥ 1（菱形装饰 CSS 上线）
Run: `grep -o 'section-alt' dist/index.html | wc -l`
Expected: ≥ 2（两个交替区块 + CSS 规则）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(p5): 视觉质感升级（菱形标题装饰/卡片动效/导航高亮/hero 质感/区块节奏）"
```

---

### Task P5-3: 全链路验证与推送

- [ ] **Step 1: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、48 单测全绿、98 页构建、13 条 E2E 全过（含断言更新后的资讯中心用例；地图列表用例第一张卡为竞技图兼容分组结构）

- [ ] **Step 2: 推送**

```bash
git push
```

推送触发 GitHub Actions verify 与 Vercel 自动部署。

- [ ] **Step 3: 视觉复查（浏览器）**

本地 preview 启动后浏览器导航验证：首页（推荐多样化：决斗/哨卫出现、地图速览首卡为亚海悬城）、导航当前项红色指示条、h2 菱形装饰、卡片 hover 位移与图片缩放、地图库两组分类。发现问题回到对应任务修复后重跑 Step 1。

---

## Self-Review 记录

1. **范围覆盖**：用户确认的四项逻辑修复全部落地（P5-1 Steps 1-4），中度视觉升级四要素全部落地（动效/高亮/节奏/品牌装饰，P5-2）。
2. **Placeholder 扫描**：无占位；全部修改为既有文件的精确 old→new。
3. **一致性**：地图分类名单 = mapGuides 集合（13 张，新图攻略上线自动入组）；导航高亮的前缀匹配覆盖详情页与工具页路径；E2E 断言联动（电竞资讯→资讯中心）已在 P5-1 Step 5 显式声明，避免全链验证时误判为缺陷。
4. **计数核对**：单测 48 不变、E2E 13 不变（仅 1 处断言文案更新）、页面 98 不变。