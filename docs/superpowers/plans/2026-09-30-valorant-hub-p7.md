# valorant-hub P7 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 导航与全站模块页重整——①导航加"首页"项、去"搜索"项、内嵌搜索框（零 JS 表单跳转）；②六个列表页应用 PageHero 组件（首页 hero 同款光斑动画质感）；③搜索页支持 URL `?q=` 参数自动搜索。

**Architecture:** PageHero 为通用头区组件（复用 global.css 的 P6 动画系统：drift1/drift2/noise-layer）；导航搜索为零 JS 的 GET 表单（提交到 /search/ 带 q 参数）；search 页脚本读取 URLSearchParams 自动填充并渲染（P2 岛屿既有 render() 复用）。

**Tech Stack:** 同 P0-P6（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-09-30）:** 用户实测新版首页后反馈三点——回首页只能点 logo 不合适、六个模块页面没按示例重整、搜索没必要独占一个导航项。

**前置状态:** P0-P6 已上线（https://valoranthub.icu），54 单测 + 15 E2E 全绿，99 页构建。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净；今天日期 2026-09-30

## 关键背景（给零上下文的执行者）

- **global.css P6 工具类直接复用**：drift1/drift2 keyframes、.noise-layer、.label-cut 均已全局定义，PageHero 组件直接引用
- **首页 active 特判（关键）**：导航新加"首页"项（href='/'），isActive 必须特判——`href === '/' ? path === '/' : (path === href || path.startsWith(href))`，否则任何页面都会高亮首页
- **搜索框零 JS**：导航内嵌 `<form action="/search/" method="get">` + `<input name="q">`——回车原生跳转 /search/?q=关键词；search 页 script 读参数自动渲染
- **E2E 兼容红线**：六个列表页的 h1 文本（特工图鉴/武器库/地图库/新手教学/资讯中心）必须原样保留（现有用例断言）；首页 hero 不动
- **单测 54 不变**；**E2E 15 + 1 = 16**（导航搜索框跳转用例）；**页面数 99 不变**（/search/ 保留）
- **产物验证注意**：scoped 样式内联在 HTML，全局样式在 dist/_astro/*.css（P6-1 评审确认过的打包行为）

## 文件结构总览（P7 变更）

```
src/components/NavBar.astro      # P7-1 修改（首页项 + 搜索框 + active 特判）
src/components/PageHero.astro    # P7-1 新建
src/pages/search.astro           # P7-1 修改（URL ?q= 自动搜索）
src/pages/agents/index.astro    # P7-2 应用 PageHero
src/pages/weapons/index.astro    # P7-2
src/pages/maps/index.astro      # P7-2
src/pages/guides/index.astro     # P7-2
src/pages/esports/index.astro   # P7-2
tests/e2e/smoke.spec.ts          # P7-3 追加 1 条
```

---

### Task P7-1: 导航重构 + PageHero 组件 + 搜索页参数支持

**Files:**
- Modify: `src/components/NavBar.astro`、`src/pages/search.astro`
- Create: `src/components/PageHero.astro`

- [ ] **Step 1: 重构 NavBar.astro**

frontmatter 整体替换：

```astro
---
const items = [
  { href: '/', label: '首页' },
  { href: '/agents/', label: '特工' },
  { href: '/weapons/', label: '武器' },
  { href: '/maps/', label: '地图' },
  { href: '/guides/', label: '教学' },
  { href: '/esports/', label: '资讯' },
];
const path = Astro.url.pathname;
// 首页项特判：根路径才高亮（避免所有页都命中 startsWith）
const isActive = (href: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(href);
---
```

模板（nav__links 之后追加搜索表单）：

```astro
    <form class="nav__search" action="/search/" method="get">
      <input type="search" name="q" placeholder="搜索…" aria-label="站内搜索" />
    </form>
```

scoped 样式追加：

```css
  .nav__search input {
    background: rgba(236, 232, 225, 0.07);
    box-shadow: inset 0 0 0 1px var(--val-line);
    color: var(--val-cream);
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.32rem 0.7rem;
    border-radius: 16px;
    border: none;
    outline: none;
    width: 120px;
    transition: width 0.25s ease, box-shadow 0.25s ease;
  }
  .nav__search input:focus { width: 160px; box-shadow: inset 0 0 0 1px var(--val-red); }
  @media (max-width: 768px) {
    .nav__links { gap: 0.6rem; font-size: 0.78rem; letter-spacing: 0.05em; }
    .nav__search input { width: 84px; }
    .nav__search input:focus { width: 100px; }
  }
```

- [ ] **Step 2: 新建 src/components/PageHero.astro**

```astro
---
// 模块页通用 hero 头区（复用 global.css P6 动画系统）
interface Props {
  label: string;
  title: string;
  subtitle: string;
}
const { label, title, subtitle } = Astro.props;
---
<section class="phero">
  <div class="noise-layer"></div>
  <div class="phero__glow1"></div>
  <div class="phero__glow2"></div>
  <div class="phero__slant"></div>
  <div class="phero__inner">
    <div class="label-cut">{label}</div>
    <h1>{title}</h1>
    <p class="phero__sub">{subtitle}</p>
  </div>
</section>

<style>
  .phero { position: relative; padding: 3rem 1.5rem 1.8rem; overflow: hidden; }
  .phero__glow1 {
    position: absolute; width: 280px; height: 280px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 70, 85, .24), transparent 70%);
    top: -90px; left: -70px; filter: blur(42px);
    animation: drift1 7s ease-in-out infinite;
  }
  .phero__glow2 {
    position: absolute; width: 240px; height: 240px; border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 229, 176, .14), transparent 70%);
    bottom: -80px; right: 8%; filter: blur(40px);
    animation: drift2 9s ease-in-out infinite;
  }
  .phero__slant {
    position: absolute; top: 0; bottom: 0; right: 16%; width: 2px;
    background: linear-gradient(rgba(255,70,85,0), rgba(255,70,85,.35), rgba(255,70,85,0));
    transform: skewX(-14deg);
  }
  .phero__inner { position: relative; z-index: 2; max-width: 1080px; margin: 0 auto; }
  .phero h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 900; }
  .phero__sub { color: var(--val-gray); font-size: 0.88rem; margin-top: 0.4rem; letter-spacing: 1px; }
</style>
```

- [ ] **Step 3: search.astro 支持 URL ?q= 自动搜索**

打包 script 末尾（`input.addEventListener('input', render);` 之后）追加：

```ts
    // 支持 /search/?q=参数 直达搜索（导航内嵌搜索框的跳转目标）
    const initialQ = new URLSearchParams(window.location.search).get('q');
    if (initialQ) {
      input.value = initialQ;
      render();
    }
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build && grep -o 'nav__search\|首页' dist/index.html | sort | uniq -c`
Expected: nav__search ≥ 2（CSS+表单）、首页 ≥ 1（导航项）；`grep -o 'href="/search/"' dist/index.html | wc -l` ≥ 1（搜索表单 action）；导航不再有独立"搜索"链接——`grep -o '>搜索<' dist/index.html | wc -l` 应为 0（导航项已删；placeholder 是"搜索…"不含 `>搜索<` 结构）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(p7): 导航重构（首页项+内嵌搜索框+active 特判）与 PageHero 组件、搜索页参数直达"
```

---

### Task P7-2: 六个列表页应用 PageHero

**Files:**
- Modify: `src/pages/agents/index.astro`、`src/pages/weapons/index.astro`、`src/pages/maps/index.astro`、`src/pages/guides/index.astro`、`src/pages/esports/index.astro`、`src/pages/search.astro`

- [ ] **Step 1: 六个页面统一改造模式**

每页两处变更（以 agents 为例）：

1）frontmatter 加 import：

```astro
import PageHero from '../../components/PageHero.astro';
```

2）main 开头的头部三行（`<div class="label-cut">…</div><h1>…</h1><p class="page-sub">…</p>`）替换为 PageHero（PageHero 放在 `<main>` **之前**，main 保留内容区）：

```astro
<PageHero label="Agents" title="特工图鉴" subtitle={`${agents.length} 位特工 · 数据版本 ${agentsData.version}`} />
<main class="container section">
```

六页参数表（h1 文本**不得改动**——E2E 断言依赖）：

| 页面 | label | title（原 h1） | subtitle（原 page-sub） |
|------|-------|---------------|------------------------|
| agents | Agents | 特工图鉴 | {agents.length} 位特工 · 数据版本 {agentsData.version} |
| weapons | Weapons | 武器库 | {weapons.length} 件武器 · 伤害分段与价格数据 |
| maps | Maps | 地图库 | {maps.length} 张地图 · 标准竞技图 {standardMaps.length} 张 |
| guides | Guides | 新手教学 | 入门 · 机制 · 经济 · 术语 |
| esports | News | 资讯中心 | 版本公告 · 赛事科普 · 观赛指南 · 赛程资讯 |
| search | Search | 全站搜索 | {entities.length} 个条目 · 支持中文名与英文名 |

（esports 页现有的两组 section 结构保留——PageHero 只替换头部三行；search 页只替换头部三行，input 保留在 main 内）

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o 'phero__glow1' dist/agents/index.html | wc -l` ≥ 1
Run: 六页循环验证——`for p in agents weapons maps guides esports search; do printf "%s: " $p; grep -o 'phero__inner' dist/$p/index.html | wc -l; done`
Expected: 六页各 ≥ 1

- [ ] **Step 3: 全量测试**

Run: `pnpm test`
Expected: 54 passed 无回归

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(p7): 六个模块列表页应用 PageHero 头区（光斑动画质感全站统一）"
```

---

### Task P7-3: E2E 扩展与最终全量验证

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`（15 → 16 条）

- [ ] **Step 1: 末尾追加导航搜索用例**

```ts
test('导航内嵌搜索框跳转并出结果', async ({ page }) => {
  await page.goto('/');
  await page.locator('.nav__search input').fill('捷风');
  await page.locator('.nav__search input').press('Enter');
  await expect(page).toHaveURL(/\/search\/\?q=/);
  await expect(page.locator('.search-result__title').first()).toContainText('捷风');
});
```

- [ ] **Step 2: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、54 单测全绿、99 页构建、**16 条 E2E 全过**（旧用例兼容：六页 h1 未改、首页未动、/search/ 直达用例的 placeholder 与过滤逻辑未动）

- [ ] **Step 3: 提交并推送**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(p7): E2E 扩展至 16 条（导航搜索框跳转冒烟）"
git push
```

推送触发 GitHub Actions verify 与 Vercel 自动部署；线上抽查：导航（首页项+搜索框+无独立搜索项）、六页 hero 光斑、导航搜索跳转。

---

## Self-Review 记录

1. **范围覆盖**：用户三点反馈全部落地——导航首页项与搜索框内嵌（P7-1）、六模块页 hero 化（P7-2）、搜索页参数直达（P7-1 Step 3）。
2. **Placeholder 扫描**：无占位；六页参数表完整、PageHero 代码完整。
3. **一致性**：PageHero 复用 P6 全局工具类（drift1/drift2/noise-layer）；首页 active 特判防 startsWith 全命中；六页 h1 原样保留（E2E 红线）。
4. **计数核对**：单测 54 不变、E2E 15+1=16、页面 99 不变。