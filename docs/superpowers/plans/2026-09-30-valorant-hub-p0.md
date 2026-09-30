# valorant-hub P0 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建无畏契约中文信息站 P0 版本：特工图鉴 + 武器库 + 新手教学 + 首页，数据从 valorant-api.com 自动同步，静态部署到 Vercel。

**Architecture:** Astro 5 SSG 全静态站。`scripts/sync-valorant.mjs` 拉取 valorant-api.com 数据（zh-CN + en-US 双语合并、校验、原子写入）生成 `src/data/*.json`；Astro 构建时读取 JSON 渲染全部页面；教学文章走内容集合（Markdown + zod schema）。同步与构建解耦：构建不触网。

**Tech Stack:** Astro 5、TypeScript（strict）、vitest、Playwright、GitHub Actions、Vercel

**Spec:** `docs/superpowers/specs/2026-09-30-valorant-hub-design.md`（本计划的唯一需求来源）

**范围边界：** P1（地图 / 版本资讯 / 电竞资讯）与 P2（对比工具 / 搜索）不在本计划内。

---

## 环境前提（执行前确认）

- Node ≥ 20.3（当前机器 v20.20.2 ✅）、pnpm ≥ 9（当前 v10.34.5 ✅）
- 可访问 `valorant-api.com`（数据源）与 npm registry
- 工作目录：`/Users/shuojian/Alive/valorant-hub/`（git 仓库已初始化，已有 spec 与本计划）
- 今天日期：2026-09-30

## 背景速览（给零上下文的执行者）

- **做什么**：给无畏契约（VALORANT，Riot 的 5v5 战术射击游戏）中文玩家做资料站。核心页面：特工（agent）图鉴、武器库、新手教学。玩家术语：国服译名为主（捷风 Jett）、附英文对照。
- **数据源**：valorant-api.com（社区维护的 Riot 官方数据镜像，免费、无需鉴权）。关键端点：
  - `GET /v1/agents?isPlayableCharacter=true&language=zh-CN`（language 也可 `en-US`）→ `data[]`：`uuid`、`displayName`、`description`、`role.displayName`、`abilities[]`（`slot` 为 `Ability1`/`Ability2`/`Grenade`/`Ultimate`，对应游戏键位 Q/E/C/X）、`displayIcon`、`fullPortrait`、`background`
  - `GET /v1/weapons?language={lang}` → `data[]`：`uuid`、`displayName`、`shopData`（`cost`、`category` 如 `EEquippableCategory::Rifle`、`categoryText` 中文类别名）、`weaponStats`（`fireRate`、`magazineSize`、`wallPenetration` 如 `EWallPenetrationType::Medium`）、`damageRanges[]`（分段射程伤害：`rangeStartMeters`/`rangeEndMeters`/`headDamage`/`bodyDamage`/`legDamage`）
  - `GET /v1/version` → `versionNumber` 等
  - 响应包裹：`{ status: 200, data: [...] }`
- **视觉**：VALORANT 官方还原风（深蓝黑 `#0F1923` + 战术红 `#FF4655` + 米白 `#ECE8E1`，切角几何）。风格 mockup：`docs/superpowers/mockups/visual-style.html`
- **武器 zh-CN 名称注意**：部分武器 API 的 zh-CN `displayName` 与 en-US 相同（玩家惯用英文名），组件需做同名合并显示（见 Task 11）
- **scripts 为 .mjs 无类型注解**：刻意选择——`astro check` 只检查 `src/`；scripts 逻辑全部由 vitest 覆盖（Task 4-6）

## 文件结构总览

```
valorant-hub/
├── package.json                    # Task 1
├── astro.config.mjs                # Task 1（site + sitemap）
├── tsconfig.json                   # Task 1
├── vitest.config.ts                # Task 3
├── playwright.config.ts            # Task 18
├── .github/workflows/ci.yml        # Task 19
├── public/favicon.svg              # Task 1
├── scripts/
│   ├── sync-valorant.mjs           # Task 7（CLI 入口）
│   └── lib/
│       ├── api.mjs                 # Task 4（fetch + 重试）
│       ├── transform.mjs           # Task 5（双语合并 + 瘦身）
│       └── validate.mjs            # Task 6（落盘前校验）
├── src/
│   ├── data/                       # Task 7 生成，禁止手工编辑
│   │   ├── agents.json
│   │   ├── weapons.json
│   │   └── version.json
│   ├── styles/
│   │   ├── tokens.css              # Task 1（设计 token）
│   │   └── global.css              # Task 1（公共样式）
│   ├── layouts/BaseLayout.astro    # Task 2
│   ├── components/
│   │   ├── NavBar.astro            # Task 2
│   │   ├── Footer.astro            # Task 2（Task 7 增强）
│   │   ├── AgentCard.astro         # Task 8
│   │   ├── SkillPanel.astro        # Task 8
│   │   └── WeaponCard.astro        # Task 11
│   ├── content/
│   │   ├── config.ts               # Task 14（guides 集合 zod schema）
│   │   └── guides/                 # Task 14（3 篇种子文章）
│   └── pages/
│       ├── index.astro             # Task 16（首页）
│       ├── 404.astro                # Task 2
│       ├── agents/index.astro      # Task 9（列表，按角色分组）
│       ├── agents/[id].astro       # Task 10（详情）
│       ├── weapons/index.astro     # Task 12（列表，按类别分组）
│       ├── weapons/[id].astro      # Task 13（详情）
│       ├── guides/index.astro      # Task 15
│       └── guides/[slug].astro     # Task 15
├── tests/
│   ├── fixtures/                   # Task 3（真实 API 响应样本）
│   ├── api.test.ts                 # Task 4
│   ├── transform.test.ts           # Task 5
│   ├── validate.test.ts            # Task 6
│   ├── components/
│   │   ├── AgentCard.test.ts       # Task 8
│   │   └── WeaponCard.test.ts      # Task 11
│   └── e2e/smoke.spec.ts           # Task 18
└── docs/superpowers/…              # 已有 spec / plans / mockups
```

---

### Task 1: 项目脚手架与设计 token

**Files:**
- Create: `package.json`、`astro.config.mjs`、`tsconfig.json`、`public/favicon.svg`、`src/styles/tokens.css`、`src/styles/global.css`
- Create: `.gitignore` 已存在（检查即可）

- [ ] **Step 1: 确认 pnpm 可用**

Run: `pnpm --version`
Expected: `10.34.5`（或更高）

- [ ] **Step 2: 写 package.json**

```json
{
  "name": "valorant-hub",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.34.5",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "sync": "node scripts/sync-valorant.mjs",
    "lint": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/sitemap": "^3.2.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "@playwright/test": "^1.49.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: 安装依赖**

Run: `pnpm install`
Expected: 生成 `pnpm-lock.yaml`，无 peer 依赖报错

- [ ] **Step 4: 写 astro.config.mjs**

site 先用预期域名占位；Task 20 部署后若实际域名不同则修正。

```js
// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://valorant-hub.vercel.app',
  integrations: [sitemap()],
});
```

- [ ] **Step 5: 写 tsconfig.json**

`include` 仅 `src/`：scripts 是无类型 .mjs（vitest 覆盖），tests 由 vitest transpile，均不进 `astro check`。

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*"],
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 6: 写 src/styles/tokens.css**

```css
:root {
  --val-bg: #0F1923;
  --val-red: #FF4655;
  --val-red-dark: #BD3944;
  --val-cream: #ECE8E1;
  --val-gray: rgba(236, 232, 225, 0.55);
  --val-line: rgba(236, 232, 225, 0.12);
  --val-font: -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
}
```

- [ ] **Step 7: 写 src/styles/global.css**

```css
@import './tokens.css';

* { margin: 0; padding: 0; box-sizing: border-box; }
html { color-scheme: dark; }
body {
  background: var(--val-bg);
  color: var(--val-cream);
  font-family: var(--val-font);
  line-height: 1.6;
}
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); }
h2 { font-size: 1.3rem; margin-bottom: 0.75rem; }

.container { max-width: 1080px; margin: 0 auto; padding: 0 1.5rem; }
.section { padding-top: 2rem; padding-bottom: 3rem; min-height: 60vh; }

.label-cut {
  color: var(--val-red);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.page-sub, .subtitle { color: var(--val-gray); font-size: 0.9rem; }

.btn {
  display: inline-block;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.65rem 1.5rem;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.btn-primary { background: var(--val-red); color: #fff; }
.btn-primary:hover { background: var(--val-red-dark); }
.btn-ghost { box-shadow: inset 0 0 0 1px rgba(236, 232, 225, 0.5); }
.btn-ghost:hover { box-shadow: inset 0 0 0 1px var(--val-cream); }

.card-cut {
  background: rgba(236, 232, 225, 0.05);
  box-shadow: inset 0 0 0 1px var(--val-line);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.9rem;
}

.role-nav { display: flex; flex-wrap: wrap; gap: 0.9rem; margin: 1.2rem 0 1.6rem; font-weight: 700; font-size: 0.85rem; }
.role-nav a { color: var(--val-gray); letter-spacing: 0.1em; }
.role-nav a:hover { color: var(--val-red); }
.role-group { margin-bottom: 2rem; scroll-margin-top: 5rem; }

.back { display: inline-block; color: var(--val-gray); font-size: 0.85rem; margin-bottom: 1.2rem; }
.back:hover { color: var(--val-red); }

.data-meta { color: var(--val-gray); font-size: 0.75rem; margin-top: 2rem; }

table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 0.5rem; }
th, td { text-align: left; padding: 0.55rem 0.75rem; box-shadow: inset 0 -1px 0 var(--val-line); }
th { color: var(--val-gray); font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; }
```

- [ ] **Step 8: 写 public/favicon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0F1923"/>
  <path d="M18 14 L32 50 L46 14 L40 14 L32 36 L24 14 Z" fill="#FF4655"/>
</svg>
```

- [ ] **Step 9: 构建验证**

Run: `pnpm build`
Expected: 成功，`dist/` 生成（暂无页面，只有 sitemap 空壳，无报错）

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Astro 5 脚手架与设计 token（VALORANT 官方还原风）"
```

---

### Task 2: 布局组件（BaseLayout / NavBar / Footer / 404）

**Files:**
- Create: `src/layouts/BaseLayout.astro`、`src/components/NavBar.astro`、`src/components/Footer.astro`、`src/pages/404.astro`

- [ ] **Step 1: 写 src/layouts/BaseLayout.astro**

页面传入完整标题（如 `特工图鉴｜无畏契约资料站`），布局不做拼接——显式无魔法。

```astro
---
import NavBar from '../components/NavBar.astro';
import Footer from '../components/Footer.astro';
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}
const { title, description = '无畏契约中文资料站：特工图鉴、武器数据、新手教学' } = Astro.props;
const site = Astro.site ?? new URL('https://valorant-hub.vercel.app');
const canonical = new URL(Astro.url.pathname, site).href;
---
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <NavBar />
    <slot />
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: 写 src/components/NavBar.astro**

P0 只有三个板块；地图 / 版本资讯 / 电竞属 P1，届时再加导航项。

```astro
---
const items = [
  { href: '/agents/', label: '特工' },
  { href: '/weapons/', label: '武器' },
  { href: '/guides/', label: '教学' },
];
---
<header class="nav">
  <div class="container nav__inner">
    <a class="nav__logo" href="/">VALORANT <span>资料站</span></a>
    <nav class="nav__links">
      {items.map((i) => <a href={i.href}>{i.label}</a>)}
    </nav>
  </div>
</header>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(15, 25, 35, 0.9);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--val-line);
  }
  .nav__inner { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1.5rem; }
  .nav__logo { font-weight: 900; letter-spacing: 0.05em; color: var(--val-red); }
  .nav__logo span { color: var(--val-cream); font-weight: 700; font-size: 0.85rem; margin-left: 0.2rem; }
  .nav__links { display: flex; gap: 1.25rem; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.15em; }
  .nav__links a:hover { color: var(--val-red); }
</style>
```

- [ ] **Step 3: 写 src/components/Footer.astro（v1，静态文案）**

数据版本行在 Task 7（首次同步后）加上——此时 `src/data/` 还没有 JSON，先不 import。

```astro
---
---
<footer class="footer">
  <div class="container">
    <p>数据来源：<a href="https://valorant-api.com" target="_blank" rel="noopener noreferrer">valorant-api.com</a>（Riot 官方数据镜像）</p>
    <p id="data-meta"></p>
    <p>本站与 Riot Games 无关，仅供学习交流。VALORANT © Riot Games, Inc.</p>
  </div>
</footer>

<style>
  .footer { border-top: 1px solid var(--val-line); padding: 1.5rem 0 2rem; color: var(--val-gray); font-size: 0.75rem; }
  .footer p { margin-top: 0.3rem; }
  .footer a:hover { color: var(--val-red); }
</style>
```

- [ ] **Step 4: 写 src/pages/404.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="404｜无畏契约资料站" description="页面不存在">
  <main class="container section" style="text-align:center">
    <div class="label-cut">Error 404</div>
    <h1>目标已阵亡</h1>
    <p class="subtitle" style="margin:0.5rem 0 1.5rem">这个页面不存在或已被移除。</p>
    <a class="btn btn-primary" href="/">返回首页</a>
  </main>
</BaseLayout>
```

- [ ] **Step 5: 构建与预览验证**

Run: `pnpm build && pnpm preview &`（打开 `http://localhost:4321/404.html` 或直接看 dist）
验证 404 页含"目标已阵亡"；导航含"特工 / 武器 / 教学"。
Run: `grep -c "目标已阵亡" dist/404.html`
Expected: `1` 或以上

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 布局骨架（BaseLayout/NavBar/Footer/404）"
```

---

### Task 3: vitest 配置与 API fixtures

**Files:**
- Create: `vitest.config.ts`、`tests/fixtures/agents.zh-CN.json`、`tests/fixtures/agents.en-US.json`、`tests/fixtures/weapons.zh-CN.json`、`tests/fixtures/weapons.en-US.json`

- [ ] **Step 1: 写 vitest.config.ts**

`getViteConfig` 是 Astro 官方提供的 vitest 桥接（让 .astro 文件可在测试中 import）。

```ts
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: 生成 agents fixtures（zh-CN / en-US 各一份，取真实响应前 3 条）**

```bash
mkdir -p tests/fixtures
curl -sf 'https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=zh-CN' -o /tmp/agents-zh.json
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/tmp/agents-zh.json','utf8'));j.data=j.data.filter(a=>a.role).slice(0,3);fs.writeFileSync('tests/fixtures/agents.zh-CN.json',JSON.stringify(j));"
curl -sf 'https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=en-US' -o /tmp/agents-en.json
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/tmp/agents-en.json','utf8'));j.data=j.data.filter(a=>a.role).slice(0,3);fs.writeFileSync('tests/fixtures/agents.en-US.json',JSON.stringify(j));"
```

Expected: 两个文件生成，`node -e "console.log(JSON.parse(require('fs').readFileSync('tests/fixtures/agents.zh-CN.json')).data.length)"` 输出 `3`

- [ ] **Step 3: 生成 weapons fixtures（前 5 条，覆盖手枪组，含 damageRanges）**

```bash
curl -sf 'https://valorant-api.com/v1/weapons?language=zh-CN' -o /tmp/weapons-zh.json
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/tmp/weapons-zh.json','utf8'));j.data=j.data.filter(w=>w.shopData).slice(0,5);fs.writeFileSync('tests/fixtures/weapons.zh-CN.json',JSON.stringify(j));"
curl -sf 'https://valorant-api.com/v1/weapons?language=en-US' -o /tmp/weapons-en.json
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/tmp/weapons-en.json','utf8'));j.data=j.data.filter(w=>w.shopData).slice(0,5);fs.writeFileSync('tests/fixtures/weapons.en-US.json',JSON.stringify(j));"
```

Expected: 文件生成，`data.length` 为 `5`

- [ ] **Step 4: 空跑验证 vitest 可用**

Run: `pnpm test`
Expected: `No test files found`，退出码 0（vitest 对空目录容忍）或提示无测试——只要不报配置错误即可

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: vitest 配置与 valorant-api 响应 fixtures"
```

---

### Task 4: API 模块（fetchJson + 指数退避重试）

**Files:**
- Create: `scripts/lib/api.mjs`
- Test: `tests/api.test.ts`

- [ ] **Step 1: 写失败测试 tests/api.test.ts**

用 `vi.stubGlobal` mock fetch：前 2 次失败、第 3 次成功，断言重试后拿到 data。

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchAgents, fetchWeapons, fetchVersion } from '../scripts/lib/api.mjs';

const okBody = (data: unknown) => ({ status: 200, data });

function mockFetchSequence(responses: Array<Response | Error>) {
  let i = 0;
  const fn = vi.fn(async () => {
    const r = responses[i++];
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('成功时返回 data 字段', async () => {
    mockFetchSequence([jsonResponse(okBody([{ hello: 1 }]))]);
    const data = await fetchJson('/demo');
    expect(data).toEqual([{ hello: 1 }]);
  });

  it('前两次失败后重试成功（指数退避）', async () => {
    const fn = mockFetchSequence([
      new Error('network down'),
      new Error('network down again'),
      jsonResponse(okBody(['ok'])),
    ]);
    const data = await fetchJson('/demo', { retries: 3, backoffMs: 1 });
    expect(data).toEqual(['ok']);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('超过重试上限后抛错', async () => {
    // retries: 2 意味着共发起 3 次 fetch，mock 需提供 3 个失败响应（避免 mock 耗尽返回 undefined）
    mockFetchSequence([new Error('always down'), new Error('always down'), new Error('always down')]);
    await expect(
      fetchJson('/demo', { retries: 2, backoffMs: 1 }),
    ).rejects.toThrow('always down');
  });

  it('HTTP 非 200 直接抛错', async () => {
    mockFetchSequence([jsonResponse({ error: 'nope' }, 500)]);
    await expect(fetchJson('/demo', { retries: 0 })).rejects.toThrow('HTTP 500');
  });
});

describe('端点封装', () => {
  it('fetchAgents 带 isPlayableCharacter 与语言参数', async () => {
    const fn = mockFetchSequence([jsonResponse(okBody([]))]);
    await fetchAgents('zh-CN');
    const url = fn.mock.calls[0][0] as string;
    expect(url).toContain('isPlayableCharacter=true');
    expect(url).toContain('language=zh-CN');
  });

  it('fetchWeapons 带语言参数', async () => {
    const fn = mockFetchSequence([jsonResponse(okBody([]))]);
    await fetchWeapons('en-US');
    expect((fn.mock.calls[0][0] as string)).toContain('language=en-US');
  });

  it('fetchVersion 不带语言', async () => {
    const fn = mockFetchSequence([jsonResponse(okBody({}))]);
    await fetchVersion();
    expect((fn.mock.calls[0][0] as string)).toMatch(/\/version$/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/api.test.ts`
Expected: FAIL —— `Cannot find module '../scripts/lib/api.mjs'`

- [ ] **Step 3: 写 scripts/lib/api.mjs**

```js
// valorant-api.com 请求封装：超时 + 指数退避重试
const BASE = 'https://valorant-api.com/v1';
const TIMEOUT_MS = 15000;

export class ApiError extends Error {}

export async function fetchJson(path, { retries = 3, backoffMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${path}`);
      const body = await res.json();
      if (body.status !== 200) throw new ApiError(`API status ${body.status} for ${path}`);
      return body.data;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export const fetchAgents = (lang) =>
  fetchJson(`/agents?isPlayableCharacter=true&language=${lang}`);
export const fetchWeapons = (lang) => fetchJson(`/weapons?language=${lang}`);
export const fetchVersion = () => fetchJson('/version');
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/api.test.ts`
Expected: PASS（7 个用例全绿）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/api.mjs tests/api.test.ts
git commit -m "feat: valorant-api 请求封装（超时/指数退避重试）"
```

---

### Task 5: transform 模块（双语合并 + 字段瘦身）

**Files:**
- Create: `scripts/lib/transform.mjs`
- Test: `tests/transform.test.ts`

- [ ] **Step 1: 写失败测试 tests/transform.test.ts**

```ts
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
        expect(['C', 'Q', 'E', 'X', '被动']).toContain(ab.slot);
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/transform.test.ts`
Expected: FAIL —— `Cannot find module '../scripts/lib/transform.mjs'`

- [ ] **Step 3: 写 scripts/lib/transform.mjs**

```js
// 原始 API 响应 → 站点数据模型（中英合并 + 瘦身）
// 数据形状（存入 src/data/*.json）：
//   agent:  { id, uuid, zh{name,description,role}, en{...}, roleIcon, displayIcon, fullPortrait, background, abilities[{slot,key,zh,en,icon}] }
//   weapon: { id, uuid, zh{name,category}, en{...}, category, credits, displayIcon, stats{fireRate,magazineSize,wallPenetration}, damageRanges[...] }

const SLOT_KEY = { Ability1: 'Q', Ability2: 'E', Grenade: 'C', Ultimate: 'X', Passive: '被动' };

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function transformAgents(zhList, enList) {
  const enByUuid = new Map(enList.map((a) => [a.uuid, a]));
  return zhList
    .filter((zh) => enByUuid.has(zh.uuid))
    .map((zh) => {
      const en = enByUuid.get(zh.uuid);
      return {
        id: slugify(en.displayName),
        uuid: zh.uuid,
        zh: {
          name: zh.displayName ?? '',
          description: zh.description ?? '',
          role: zh.role?.displayName ?? '',
        },
        en: {
          name: en.displayName ?? '',
          description: en.description ?? '',
          role: en.role?.displayName ?? '',
        },
        roleIcon: zh.role?.displayIcon ?? '',
        displayIcon: zh.displayIcon ?? '',
        fullPortrait: zh.fullPortrait ?? '',
        background: zh.background ?? '',
        abilities: (zh.abilities ?? []).map((ab, i) => ({
          slot: SLOT_KEY[ab.slot] ?? ab.slot,
          key: ab.slot,
          zh: { name: ab.displayName ?? '', description: ab.description ?? '' },
          en: {
            name: en.abilities[i]?.displayName ?? '',
            description: en.abilities[i]?.description ?? '',
          },
          icon: ab.displayIcon ?? '',
        })),
      };
    });
}

export function transformWeapons(zhList, enList) {
  const enByUuid = new Map(enList.map((w) => [w.uuid, w]));
  return zhList
    .filter((zh) => enByUuid.has(zh.uuid))
    .map((zh) => {
      const en = enByUuid.get(zh.uuid);
      const s = zh.weaponStats ?? {};
      return {
        id: slugify(en.displayName),
        uuid: zh.uuid,
        zh: { name: zh.displayName ?? '', category: zh.shopData?.categoryText ?? '' },
        en: { name: en.displayName ?? '', category: en.shopData?.categoryText ?? '' },
        category: zh.shopData?.category ?? '',
        credits: zh.shopData?.cost ?? 0,
        displayIcon: zh.displayIcon ?? '',
        stats: {
          fireRate: s.fireRate ?? 0,
          magazineSize: s.magazineSize ?? 0,
          wallPenetration: s.wallPenetration?.replace('EWallPenetrationType::', '') ?? '',
        },
        damageRanges: (s.damageRanges ?? []).map((r) => ({
          rangeStartMeters: r.rangeStartMeters,
          rangeEndMeters: r.rangeEndMeters,
          headDamage: r.headDamage,
          bodyDamage: r.bodyDamage,
          legDamage: r.legDamage,
        })),
      };
    });
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/transform.test.ts`
Expected: PASS（8 个用例全绿：slugify 1 + transformAgents 4 + transformWeapons 3）

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs tests/transform.test.ts
git commit -m "feat: 数据转换模块（中英双语合并与瘦身）"
```

---

### Task 6: validate 模块（落盘前校验）

**Files:**
- Create: `scripts/lib/validate.mjs`
- Test: `tests/validate.test.ts`

- [ ] **Step 1: 写失败测试 tests/validate.test.ts**

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/validate.test.ts`
Expected: FAIL —— `Cannot find module '../scripts/lib/validate.mjs'`

- [ ] **Step 3: 写 scripts/lib/validate.mjs**

```js
// 数据落盘前校验：任何一项不通过即抛 ValidationError，调用方放弃写入（保留旧数据）

export class ValidationError extends Error {}

export function validateAgents(agents) {
  if (!Array.isArray(agents) || agents.length < 20) {
    throw new ValidationError(`agents 数量异常：${agents?.length ?? 0}（预期 ≥ 20）`);
  }
  for (const a of agents) {
    if (!a.id || !a.zh?.name || !a.en?.name) {
      throw new ValidationError(`agent 关键字段缺失：${JSON.stringify(a).slice(0, 200)}`);
    }
    if (!Array.isArray(a.abilities) || a.abilities.length === 0) {
      throw new ValidationError(`agent ${a.id} 技能数据为空`);
    }
  }
  return true;
}

export function validateWeapons(weapons) {
  if (!Array.isArray(weapons) || weapons.length < 15) {
    throw new ValidationError(`weapons 数量异常：${weapons?.length ?? 0}（预期 ≥ 15）`);
  }
  for (const w of weapons) {
    if (!w.id || !w.en?.name) {
      throw new ValidationError(`weapon 关键字段缺失：${JSON.stringify(w).slice(0, 200)}`);
    }
    if (typeof w.credits !== 'number' || w.credits < 0) {
      throw new ValidationError(`weapon ${w.id} 价格异常：${w.credits}`);
    }
  }
  return true;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/validate.test.ts`
Expected: PASS（7 个用例全绿）

- [ ] **Step 5: 跑全量测试确认无回归**

Run: `pnpm test`
Expected: 22 个用例全绿（api 7 + transform 8 + validate 7）

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/validate.mjs tests/validate.test.ts
git commit -m "feat: 数据校验模块（数量下限/关键字段/原子落盘前置条件）"
```

---

### Task 7: sync CLI + 首次数据同步 + Footer 数据版本行

**Files:**
- Create: `scripts/sync-valorant.mjs`
- Create: `src/data/agents.json`、`src/data/weapons.json`、`src/data/version.json`（脚本生成）
- Modify: `src/components/Footer.astro`

- [ ] **Step 1: 写 scripts/sync-valorant.mjs**

```js
// 数据同步 CLI：valorant-api.com → src/data/*.json
// 手动运行：pnpm sync；CI 每日 cron 也会运行（见 .github/workflows/ci.yml）
// 失败策略：校验不通过或网络失败 → 保留旧数据，退出码 1
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fetchAgents, fetchWeapons, fetchVersion } from './lib/api.mjs';
import { transformAgents, transformWeapons } from './lib/transform.mjs';
import { validateAgents, validateWeapons } from './lib/validate.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

// 原子写入：先写临时文件再 rename，中断不会产生半截 JSON
async function atomicWrite(file, data) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await rename(tmp, file);
}

async function main() {
  console.log('[sync] 拉取 valorant-api.com …');
  const [agentsZh, agentsEn, weaponsZh, weaponsEn, versionRaw] = await Promise.all([
    fetchAgents('zh-CN'),
    fetchAgents('en-US'),
    fetchWeapons('zh-CN'),
    fetchWeapons('en-US'),
    fetchVersion(),
  ]);

  const agents = transformAgents(agentsZh, agentsEn);
  const weapons = transformWeapons(weaponsZh, weaponsEn);
  validateAgents(agents);
  validateWeapons(weapons);

  const syncedAt = new Date().toISOString();
  const version = {
    syncedAt,
    // 实测：valorant-api.com /v1/version 的版本号字段名为 version（versionNumber 为兼容保留）
    versionNumber: versionRaw?.versionNumber ?? versionRaw?.version ?? '',
    buildVersion: versionRaw?.buildVersion ?? '',
  };

  await mkdir(DATA_DIR, { recursive: true });
  await atomicWrite(path.join(DATA_DIR, 'agents.json'), { syncedAt, version: version.versionNumber, agents });
  await atomicWrite(path.join(DATA_DIR, 'weapons.json'), { syncedAt, version: version.versionNumber, weapons });
  await atomicWrite(path.join(DATA_DIR, 'version.json'), version);

  console.log(`[sync] 完成：agents=${agents.length} weapons=${weapons.length} version=${version.versionNumber}`);
}

main().catch((err) => {
  console.error('[sync] 失败：', err.message);
  console.error('[sync] 已保留旧数据，未写入任何文件。');
  process.exit(1);
});
```

- [ ] **Step 2: 运行首次同步**

Run: `pnpm sync`
Expected: `[sync] 完成：agents=20+ weapons=15+ version=…`；`src/data/` 出现 3 个 JSON 文件

- [ ] **Step 3: 快速抽查数据形状**

Run: `node -e "const a=require('./src/data/agents.json');console.log(a.agents.length, a.agents[0].zh.name, a.agents[0].en.name, a.agents[0].abilities.length)"`
Expected: 例如 `20+ 捷风 Jett 4`（名称随 API 顺序可能不同，但 zh.name 为中文、abilities 为 4）

- [ ] **Step 4: Footer 增加数据版本行（Modify src/components/Footer.astro）**

frontmatter 改为：

```astro
---
import versionData from '../data/version.json';
---
```

`<p id="data-meta"></p>` 替换为：

```astro
    <p>游戏数据版本：{versionData.versionNumber} · 同步于 {versionData.syncedAt.slice(0, 10)}</p>
```

- [ ] **Step 5: 构建验证**

Run: `pnpm build`
Expected: 构建成功；`grep -o "游戏数据版本" dist/404.html`（或任一已生成页面）能找到 Footer 版本文本
（404 页构建产物为 `dist/404.html`）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: 数据同步 CLI + 首次全量同步 + Footer 数据版本行"
```

---

### Task 8: AgentCard 与 SkillPanel 组件

**Files:**
- Create: `src/components/AgentCard.astro`、`src/components/SkillPanel.astro`
- Test: `tests/components/AgentCard.test.ts`

- [ ] **Step 1: 写失败测试 tests/components/AgentCard.test.ts**

Astro 容器渲染 API（`astro/container`）可在 vitest 中渲染 .astro 组件。

```ts
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as Container } from 'astro/container';
import AgentCard from '../../src/components/AgentCard.astro';

const sampleAgent = {
  id: 'jett',
  uuid: 'u',
  zh: { name: '捷风', description: '', role: '决斗者' },
  en: { name: 'Jett', description: '', role: 'Duelist' },
  roleIcon: '', displayIcon: 'https://example.com/jett.png',
  fullPortrait: '', background: '',
  abilities: [],
};

describe('AgentCard', () => {
  it('渲染中文名、英文名与角色，链接指向详情页', async () => {
    const container = await Container.create();
    const html = await container.renderToString(AgentCard, { props: { agent: sampleAgent } });
    expect(html).toContain('捷风');
    expect(html).toContain('Jett');
    expect(html).toContain('决斗者');
    expect(html).toContain('href="/agents/jett/"');
  });

  it('图片带懒加载与 onerror 降级', async () => {
    const container = await Container.create();
    const html = await container.renderToString(AgentCard, { props: { agent: sampleAgent } });
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('onerror');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/components/AgentCard.test.ts`
Expected: FAIL —— 找不到 `src/components/AgentCard.astro`

- [ ] **Step 3: 写 src/components/AgentCard.astro**

```astro
---
// 特工卡片：列表页与首页复用
interface Props {
  agent: {
    id: string;
    zh: { name: string; role: string };
    en: { name: string };
    displayIcon: string;
  };
}
const { agent } = Astro.props;
---
<a class="card-cut agent-card" href={`/agents/${agent.id}/`}>
  <img src={agent.displayIcon} alt={agent.zh.name} loading="lazy" onerror="this.src='/favicon.svg'" />
  <div class="agent-card__name">{agent.zh.name}</div>
  <div class="agent-card__sub">{agent.en.name} · {agent.zh.role}</div>
</a>

<style>
  .agent-card { display: block; padding: 1rem; text-align: center; }
  .agent-card:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .agent-card img { width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: 0.5rem; }
  .agent-card__name { font-weight: 800; }
  .agent-card__sub { font-size: 0.75rem; color: var(--val-gray); }
</style>
```

- [ ] **Step 4: 写 src/components/SkillPanel.astro**

```astro
---
// 技能卡片：特工详情页技能区块
interface Props {
  ability: {
    slot: string;
    zh: { name: string; description: string };
    en: { name: string };
    icon: string;
  };
}
const { ability } = Astro.props;
---
<article class="card-cut skill">
  <header class="skill__head">
    <img src={ability.icon} alt="" loading="lazy" onerror="this.style.display='none'" />
    <div>
      <h3 class="skill__name">{ability.zh.name} <span class="skill__en">{ability.en.name}</span></h3>
      <span class="skill__slot">{ability.slot}</span>
    </div>
  </header>
  <p class="skill__desc">{ability.zh.description}</p>
</article>

<style>
  .skill { padding: 1rem; }
  .skill__head { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.6rem; }
  .skill__head img { width: 40px; height: 40px; object-fit: contain; }
  .skill__name { font-size: 1rem; margin-bottom: 0.1rem; }
  .skill__en { color: var(--val-gray); font-size: 0.8rem; font-weight: 400; }
  .skill__slot {
    display: inline-block;
    background: var(--val-red);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.1rem 0.45rem;
  }
  .skill__desc { font-size: 0.85rem; color: var(--val-gray); }
</style>
```

- [ ] **Step 5: 跑组件测试确认通过**

Run: `pnpm vitest run tests/components/AgentCard.test.ts`
Expected: PASS（2 个用例）

- [ ] **Step 6: Commit**

```bash
git add src/components/AgentCard.astro src/components/SkillPanel.astro tests/components/AgentCard.test.ts
git commit -m "feat: AgentCard 与 SkillPanel 组件"
```

---

### Task 9: 特工列表页（按角色分组 + 锚点导航）

**Files:**
- Create: `src/pages/agents/index.astro`

spec 定案的"构建期静态筛选"实现方式：**按角色分组区块 + 顶部锚点导航**——零客户端 JS，不加子路由。

- [ ] **Step 1: 写 src/pages/agents/index.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import AgentCard from '../../components/AgentCard.astro';
import agentsData from '../../data/agents.json';

const agents = agentsData.agents;

// 按角色分组（分组顺序跟随数据出现顺序，锚点 id 用序号避免中文转码问题）
const roleMap = new Map<string, typeof agents>();
for (const a of agents) {
  const key = a.zh.role || '其他';
  if (!roleMap.has(key)) roleMap.set(key, []);
  roleMap.get(key)!.push(a);
}
const groups = [...roleMap.entries()].map(([role, list]) => ({ role, list }));
---
<BaseLayout title="特工图鉴｜无畏契约资料站" description="无畏契约全部特工资料：技能、角色定位、中英对照">
  <main class="container section">
    <div class="label-cut">Agents</div>
    <h1>特工图鉴</h1>
    <p class="page-sub">{agents.length} 位特工 · 数据版本 {agentsData.version}</p>
    <nav class="role-nav">
      {groups.map((g, i) => <a href={`#role-${i}`}>{g.role}</a>)}
    </nav>
    {groups.map((g, i) => (
      <section id={`role-${i}`} class="role-group">
        <h2>{g.role}</h2>
        <div class="grid">
          {g.list.map((a) => <AgentCard agent={a} />)}
        </div>
      </section>
    ))}
  </main>
</BaseLayout>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o 'class="card-cut agent-card"' dist/agents/index.html | wc -l`
Expected: 与特工总数一致（如 `29`；注意产物是压缩 HTML，须用 `grep -o | wc -l` 计匹配次数，`grep -c` 只数行数）

- [ ] **Step 3: 预览抽查**

Run: `pnpm preview`，浏览器打开 `http://localhost:4321/agents/`
Expected: 深蓝黑底，特工按角色分组，顶部锚点导航可跳转，卡片图片懒加载
（数据文件 `src/data/agents.json` 已在 Task 7 生成）

- [ ] **Step 4: Commit**

```bash
git add src/pages/agents/index.astro
git commit -m "feat: 特工列表页（角色分组 + 锚点导航，零 JS）"
```

---

### Task 10: 特工详情页

**Files:**
- Create: `src/pages/agents/[id].astro`

- [ ] **Step 1: 写 src/pages/agents/[id].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import SkillPanel from '../../components/SkillPanel.astro';
import agentsData from '../../data/agents.json';

export function getStaticPaths() {
  return agentsData.agents.map((agent) => ({
    params: { id: agent.id },
    props: { agent },
  }));
}
const { agent } = Astro.props;
const portrait = agent.fullPortrait || agent.displayIcon;
---
<BaseLayout
  title={`${agent.zh.name} ${agent.en.name}｜无畏契约资料站`}
  description={`${agent.zh.name}（${agent.en.name}）：${agent.zh.role}。${agent.zh.description.slice(0, 60)}…`}
>
  <main class="container section">
    <a class="back" href="/agents/">← 返回特工列表</a>
    <div class="hero">
      <img class="hero__portrait" src={portrait} alt={agent.zh.name} onerror="this.src='/favicon.svg'" />
      <div>
        <div class="label-cut">{agent.zh.role} · {agent.en.role}</div>
        <h1>{agent.zh.name} <span class="hero__en">{agent.en.name}</span></h1>
        <p class="hero__desc">{agent.zh.description}</p>
      </div>
    </div>
    <h2>技能</h2>
    <div class="skills">
      {agent.abilities.map((ab) => <SkillPanel ability={ab} />)}
    </div>
    <p class="data-meta">技能数值暂以官方描述呈现 · 数据版本 {agentsData.version}</p>
  </main>
</BaseLayout>

<style>
  .hero { display: flex; gap: 2rem; align-items: center; margin-bottom: 2rem; }
  .hero__portrait { width: 280px; max-width: 40vw; object-fit: contain; }
  .hero__en { color: var(--val-gray); font-size: 0.6em; font-weight: 700; margin-left: 0.3rem; }
  .hero__desc { color: var(--val-gray); font-size: 0.9rem; margin-top: 0.6rem; max-width: 40em; }
  .skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.9rem; }
  @media (max-width: 768px) {
    .hero { flex-direction: column-reverse; text-align: center; }
  }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && ls dist/agents/ | head -8`
Expected: `index.html` 之外有若干特工目录（`jett/` 等）
Run: `grep -rl "技能" dist/agents/*/index.html | head -3`
Expected: 输出至少 3 个详情页路径

- [ ] **Step 3: 预览抽查**

浏览器打开 `http://localhost:4321/agents/jett/`（若 jett 不存在，从列表页任选一个）
Expected: 大图 + 中英文名 + 4-5 张技能卡（C/Q/E/X；带被动技能的特工如捷风为 5 张，第 5 张徽章显示「被动」），底部数据版本号

- [ ] **Step 4: Commit**

```bash
git add src/pages/agents/\[id\].astro
git commit -m "feat: 特工详情页（技能面板 + 双语对照）"
```

---

### Task 11: WeaponCard 组件

**Files:**
- Create: `src/components/WeaponCard.astro`
- Test: `tests/components/WeaponCard.test.ts`

- [ ] **Step 1: 写失败测试 tests/components/WeaponCard.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as Container } from 'astro/container';
import WeaponCard from '../../src/components/WeaponCard.astro';

const mkWeapon = (over: Record<string, unknown> = {}) => ({
  id: 'vandal',
  uuid: 'u',
  zh: { name: '暴徒', category: '步枪' },
  en: { name: 'Vandal', category: 'Rifle' },
  category: 'EEquippableCategory::Rifle',
  credits: 2900,
  displayIcon: 'https://example.com/vandal.png',
  stats: { fireRate: 9.75, magazineSize: 25, wallPenetration: 'Medium' },
  damageRanges: [],
  ...over,
});

describe('WeaponCard', () => {
  it('中英文名都显示且链接正确', async () => {
    const container = await Container.create();
    const html = await container.renderToString(WeaponCard, { props: { weapon: mkWeapon() } });
    expect(html).toContain('暴徒');
    expect(html).toContain('Vandal');
    expect(html).toContain('href="/weapons/vandal/"');
  });

  it('中英文名相同时只显示一个（如武器 API 未提供中文译名）', async () => {
    const container = await Container.create();
    const html = await container.renderToString(WeaponCard, {
      props: { weapon: mkWeapon({ zh: { name: 'Vandal', category: '步枪' } }) },
    });
    // img 的 alt 属性也含武器名，须只断言显示文本
    const shown = html.match(/class="[^"]*weapon-card__name[^"]*"[^>]*>([^<]+)</);
    expect(shown?.[1]?.trim()).toBe('Vandal');
  });

  it('价格显示信用点', async () => {
    const container = await Container.create();
    const html = await container.renderToString(WeaponCard, { props: { weapon: mkWeapon() } });
    expect(html).toContain('2900 信用点');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/components/WeaponCard.test.ts`
Expected: FAIL —— 找不到 `src/components/WeaponCard.astro`

- [ ] **Step 3: 写 src/components/WeaponCard.astro**

```astro
---
// 武器卡片：列表页复用
interface Props {
  weapon: {
    id: string;
    zh: { name: string; category: string };
    en: { name: string };
    credits: number;
    displayIcon: string;
  };
}
const { weapon } = Astro.props;
// 部分武器 zh-CN 名称与英文相同（玩家惯用英文名）：同名只显示一个
const name = weapon.zh.name !== weapon.en.name
  ? `${weapon.zh.name} ${weapon.en.name}`
  : weapon.en.name;
const price = weapon.credits > 0 ? `${weapon.credits} 信用点` : '默认装备';
---
<a class="card-cut weapon-card" href={`/weapons/${weapon.id}/`}>
  <img src={weapon.displayIcon} alt={name} loading="lazy" onerror="this.src='/favicon.svg'" />
  <div class="weapon-card__name">{name}</div>
  <div class="weapon-card__sub">{weapon.zh.category || '其他'}</div>
  <div class="weapon-card__price">{price}</div>
</a>

<style>
  .weapon-card { display: block; padding: 1rem; text-align: center; }
  .weapon-card:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .weapon-card img { height: 80px; object-fit: contain; margin: 0 auto 0.5rem; }
  .weapon-card__name { font-weight: 800; font-size: 0.95rem; }
  .weapon-card__sub { font-size: 0.75rem; color: var(--val-gray); }
  .weapon-card__price { font-size: 0.75rem; color: var(--val-red); font-weight: 700; margin-top: 0.25rem; }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/components/WeaponCard.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/components/WeaponCard.astro tests/components/WeaponCard.test.ts
git commit -m "feat: WeaponCard 组件（同名合并显示）"
```

---

### Task 12: 武器列表页（按类别分组）

**Files:**
- Create: `src/pages/weapons/index.astro`

- [ ] **Step 1: 写 src/pages/weapons/index.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import WeaponCard from '../../components/WeaponCard.astro';
import weaponsData from '../../data/weapons.json';

const weapons = weaponsData.weapons;

// 按中文类别分组（无 shopData 的近战等归入"其他"）
const catMap = new Map<string, typeof weapons>();
for (const w of weapons) {
  const key = w.zh.category || '其他';
  if (!catMap.has(key)) catMap.set(key, []);
  catMap.get(key)!.push(w);
}
const groups = [...catMap.entries()].map(([category, list]) => ({ category, list }));
---
<BaseLayout title="武器库｜无畏契约资料站" description="无畏契约全武器数据：伤害分段、射速、价格、穿透、弹匣">
  <main class="container section">
    <div class="label-cut">Weapons</div>
    <h1>武器库</h1>
    <p class="page-sub">{weapons.length} 件武器 · 数据版本 {weaponsData.version}</p>
    <nav class="role-nav">
      {groups.map((g, i) => <a href={`#cat-${i}`}>{g.category}</a>)}
    </nav>
    {groups.map((g, i) => (
      <section id={`cat-${i}`} class="role-group">
        <h2>{g.category}</h2>
        <div class="grid">
          {g.list.map((w) => <WeaponCard weapon={w} />)}
        </div>
      </section>
    ))}
  </main>
</BaseLayout>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o 'class="card-cut weapon-card"' dist/weapons/index.html | wc -l`
Expected: 与武器总数一致（如 `21`；用 `grep -o | wc -l` 计匹配次数）

- [ ] **Step 3: Commit**

```bash
git add src/pages/weapons/index.astro
git commit -m "feat: 武器列表页（类别分组 + 锚点导航）"
```

---

### Task 13: 武器详情页（参数表 + 伤害分段）

**Files:**
- Create: `src/pages/weapons/[id].astro`

- [ ] **Step 1: 写 src/pages/weapons/[id].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import weaponsData from '../../data/weapons.json';

export function getStaticPaths() {
  return weaponsData.weapons.map((weapon) => ({
    params: { id: weapon.id },
    props: { weapon },
  }));
}
const { weapon } = Astro.props;
const name = weapon.zh.name !== weapon.en.name
  ? `${weapon.zh.name} ${weapon.en.name}`
  : weapon.en.name;
const PEN_LABEL: Record<string, string> = { Low: '低', Medium: '中', High: '高' };
const pen = PEN_LABEL[weapon.stats.wallPenetration] ?? weapon.stats.wallPenetration;
const price = weapon.credits > 0 ? `${weapon.credits} 信用点` : '默认装备';
---
<BaseLayout title={`${name}｜无畏契约资料站`} description={`${name}：射速 ${weapon.stats.fireRate}，${price}。伤害分段、穿透与弹匣数据。`}>
  <main class="container section">
    <a class="back" href="/weapons/">← 返回武器库</a>
    <div class="label-cut">{weapon.zh.category || weapon.en.category || '武器'}</div>
    <h1>{name}</h1>
    <p class="page-sub">{price}</p>
    <img class="w-img" src={weapon.displayIcon} alt={name} onerror="this.src='/favicon.svg'" />
    <h2>基础参数</h2>
    <table>
      <tbody>
        <tr><th>射速</th><td>{weapon.stats.fireRate} 发/秒</td></tr>
        <tr><th>弹匣容量</th><td>{weapon.stats.magazineSize}</td></tr>
        <tr><th>墙体穿透</th><td>{pen}</td></tr>
      </tbody>
    </table>
    {weapon.damageRanges.length > 0 && (
      <>
        <h2>伤害分段</h2>
        <table>
          <thead>
            <tr><th>射程</th><th>爆头</th><th>躯干</th><th>腿部</th></tr>
          </thead>
          <tbody>
            {weapon.damageRanges.map((r) => (
              <tr>
                <td>{r.rangeStartMeters}–{r.rangeEndMeters}m</td>
                <td>{r.headDamage}</td>
                <td>{r.bodyDamage}</td>
                <td>{r.legDamage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
    <p class="data-meta">数据版本 {weaponsData.version} · 伤害为无甲数值，实际受护甲与距离衰减影响</p>
  </main>
</BaseLayout>

<style>
  .w-img { height: 120px; object-fit: contain; margin: 1.2rem 0; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -l "伤害分段" dist/weapons/*/index.html | head -3`
Expected: 至少 3 个武器详情页含伤害分段表（近战/无 damageRanges 的武器没有该表，属预期）

- [ ] **Step 3: 预览抽查**

浏览器打开 `http://localhost:4321/weapons/vandal/`（若 vandal 不存在，从列表页任选步枪）
Expected: 参数表 + 伤害分段表 + 数据版本注脚

- [ ] **Step 4: Commit**

```bash
git add src/pages/weapons/\[id\].astro
git commit -m "feat: 武器详情页（参数与伤害分段表）"
```

---

### Task 14: guides 内容集合与 3 篇种子文章

**Files:**
- Create: `src/content/config.ts`、`src/content/guides/getting-started.md`、`src/content/guides/economy-basics.md`、`src/content/guides/terms-glossary.md`

文件名用英文 slug（URL 友好），标题中文放 frontmatter。

- [ ] **Step 1: 写 src/content/config.ts（Astro 5 glob loader + zod schema）**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['入门', '机制', '经济', '术语']),
    excerpt: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { guides };
```

- [ ] **Step 2: 写种子文章 src/content/guides/getting-started.md**

```markdown
---
title: 无畏契约入门：一局游戏是怎么进行的
category: 入门
excerpt: 拆弹模式的胜负规则、回合流程与新人第一件事该做什么。
publishDate: 2026-09-25
---

## 一局是什么结构

标准模式（拆弹）为先赢 13 回合的一方获胜：进攻方要在 A/B 两个包点之一安装尖啸（Spike），然后守护它 45 秒不被拆除；防守方则要在爆炸前阻止安装，或在安装后完成拆除。回合内任意一方全灭也直接定胜负——但进攻方全灭时若尖啸已安且仍在倒计时，爆炸依旧算进攻方赢。

## 你开局该做什么

1. **跟随队友**：新人期不要单人游走，跟着大部队走一条路线。活着比杀人重要。
2. **枪口抬高**：默认把准星放在头部高度（头线），交火时更容易命中头部——本作爆头收益极高。
3. **先用子弹再用技能**：技能是创造机会的，不是替你赢的。对枪时专注压枪与位移，技能留到确认能补伤害或逃命时再交。
4. **听声音**：脚步声非常关键。非必要不要一直跑动（跑动脚步声很大），按住 Shift 慢走接近拐角。

## 经济一句话

赢局有奖励、输局有低保。金币紧张时，参考[经济篇](/guides/economy-basics/)决定是否起枪。

下一件事：把常用地图的 A/B 包点位置背下来——再去[特工图鉴](/agents/)挑一个顺眼的特工开始你的第一局。
```

- [ ] **Step 3: 写种子文章 src/content/guides/economy-basics.md**

```markdown
---
title: 经济系统：什么时候该存钱，什么时候该梭哈
category: 经济
excerpt: 信用点规则、连败补偿与 eco / 强起 / 全起的判断标准。
publishDate: 2026-09-26
---

## 信用点怎么来

- 赢下一回合：+3000
- 输掉一回合：+1900 起，连败每场递增 500，最高 2900
- 拆除尖啸：拆包者个人 +300
- 击杀：普通击杀 +200，刀杀 +1500（仅击杀者）
- 半场换边会重置双方经济

## 三个关键概念

**Eco（存钱局）**：本回合大概率打不赢时全队买最少的枪（手枪甚至裸装），把钱攒到下一回合全员起装。判断标准：队友平均存款不足一套主力装备（主枪约 2900 + 护甲 400–1000），且对手经济健康。

**强起（Force Buy）**：钱不够全起但局势需要（例如再输就是赛点）时，买便宜步枪或冲锋枪加技能碰运气。风险高，只在关键分使用。

**全起（Full Buy）**：主力步枪 + 护甲 + 技能齐全。团队同步最重要——一个人 eco 一个人全起，通常两头亏。

## 新手建议

跟着团队的买法走。开局看队友买什么就买什么，别做队伍里唯一"有钱不花"或"没钱硬起"的人。半场换边前记得看一眼自己的存款规划下半场。
```

- [ ] **Step 4: 写种子文章 src/content/guides/terms-glossary.md**

```markdown
---
title: 常用术语黑话表
category: 术语
excerpt: 开黑语音和弹幕里最常见的词，都在这了。
publishDate: 2026-09-27
---

## 对局相关

- **穿点（wallbang）**：子弹隔着掩体命中敌人。墙体有穿透等级，薄墙能穿。
- **架枪（hold an angle）**：守住某个点位等待敌人露头。
- **下包 / 拆包**：进攻方安装尖啸 / 防守方拆除尖啸。
- **点位（site）**：A 点、B 点，地图上的两个包点区域。
- **潜伏（lurk）**：脱离主战场，在侧翼截断对方回防或转点的敌人。
- **扫转（spray transfer）**：一梭子子弹连续击倒多名敌人。

## 经济相关

- **eco**：存钱局，见[经济篇](/guides/economy-basics/)。
- **强起（force）**：经济不足时强行购买作战。
- **全起（full buy）**：钱花满——主枪、护甲、技能一个不落。

## 角色相关

- **决斗 / 先锋 / 控场 / 哨卫**：四大特工定位。决斗开团，先锋突破，控场封锁视野，哨卫守后。
- **IGL**：队内指挥（in-game leader）。

术语没听懂？开一局自定义，边看[特工图鉴](/agents/)边试技能，比背术语快十倍。
```

- [ ] **Step 5: 构建验证**

Run: `pnpm build`
Expected: 构建成功（内容 schema 通过； Astro 5 的 glob loader 在 dev/build 时自动加载）

- [ ] **Step 6: Commit**

```bash
git add src/content
git commit -m "feat: guides 内容集合（zod schema）与 3 篇种子教学文章"
```

---

### Task 15: guides 列表页与详情页

**Files:**
- Create: `src/pages/guides/index.astro`、`src/pages/guides/[slug].astro`

- [ ] **Step 1: 写 src/pages/guides/index.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';

const guides = (await getCollection('guides', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
const categories = [...new Set(guides.map((g) => g.data.category))];
---
<BaseLayout title="新手教学｜无畏契约资料站" description="无畏契约新手教学：入门、机制、经济、术语">
  <main class="container section">
    <div class="label-cut">Guides</div>
    <h1>新手教学</h1>
    {categories.map((cat) => (
      <section class="role-group">
        <h2>{cat}</h2>
        <ul class="guide-list">
          {guides.filter((g) => g.data.category === cat).map((g) => (
            <li class="card-cut guide-item">
              <a class="guide-item__title" href={`/guides/${g.id}/`}>{g.data.title}</a>
              <p class="guide-item__excerpt">{g.data.excerpt}</p>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </main>
</BaseLayout>

<style>
  .guide-list { list-style: none; display: grid; gap: 0.75rem; }
  .guide-item { padding: 1rem 1.2rem; }
  .guide-item__title { font-weight: 800; }
  .guide-item__title:hover { color: var(--val-red); }
  .guide-item__excerpt { color: var(--val-gray); font-size: 0.85rem; margin-top: 0.25rem; }
</style>
```

- [ ] **Step 2: 写 src/pages/guides/[slug].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const guides = await getCollection('guides', ({ data }) => !data.draft);
  return guides.map((guide) => ({ params: { slug: guide.id }, props: { guide } }));
}
const { guide } = Astro.props;
const { Content } = await render(guide);
---
<BaseLayout title={`${guide.data.title}｜无畏契约资料站`} description={guide.data.excerpt}>
  <main class="container section">
    <a class="back" href="/guides/">← 返回教学列表</a>
    <div class="label-cut">{guide.data.category}</div>
    <h1>{guide.data.title}</h1>
    <p class="data-meta" style="margin-top:0.3rem">{guide.data.publishDate.toLocaleDateString('zh-CN')}</p>
    <article class="prose">
      <Content />
    </article>
  </main>
</BaseLayout>

<style>
  .prose { max-width: 46em; }
  .prose :global(h2) { margin-top: 1.6rem; font-size: 1.1rem; }
  .prose :global(p) { margin-top: 0.7rem; color: rgba(236, 232, 225, 0.85); }
  .prose :global(ul), .prose :global(ol) { margin-top: 0.7rem; padding-left: 1.4rem; }
  .prose :global(li) { margin-top: 0.35rem; color: rgba(236, 232, 225, 0.85); }
  .prose :global(a) { color: var(--val-red); }
  .prose :global(strong) { color: var(--val-cream); }
</style>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build && ls dist/guides/`
Expected: `index.html` + `getting-started/`、`economy-basics/`、`terms-glossary/` 三个目录
Run: `grep -c "存钱局" dist/guides/economy-basics/index.html`
Expected: ≥ 1

- [ ] **Step 4: Commit**

```bash
git add src/pages/guides
git commit -m "feat: 教学列表与文章详情页"
```

---

### Task 16: 首页

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: 写 src/pages/index.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AgentCard from '../components/AgentCard.astro';
import agentsData from '../data/agents.json';
import { getCollection } from 'astro:content';

const featuredAgents = agentsData.agents.slice(0, 6);
const guides = (await getCollection('guides', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
  .slice(0, 3);
---
<BaseLayout title="无畏契约中文资料站｜特工 · 武器 · 教学" description="无畏契约中文资料站：特工图鉴、武器数据、新手教学，数据跟随版本自动更新">
  <main>
    <section class="hero container">
      <div class="label-cut">Defy the Limits · 无畏契约</div>
      <h1>在这里，<span class="hl">精准</span>即是艺术</h1>
      <p class="subtitle">特工图鉴 · 武器参数 · 新手教学</p>
      <div class="hero__cta">
        <a class="btn btn-primary" href="/agents/">浏览特工</a>
        <a class="btn btn-ghost" href="/guides/">新手教学</a>
      </div>
    </section>
    <section class="container section-block">
      <h2>热门特工</h2>
      <div class="grid">
        {featuredAgents.map((a) => <AgentCard agent={a} />)}
      </div>
      <p class="more"><a href="/agents/">查看全部特工 →</a></p>
    </section>
    <section class="container section-block">
      <h2>最新教学</h2>
      <ul class="guide-list">
        {guides.map((g) => (
          <li class="card-cut guide-item">
            <a class="guide-item__title" href={`/guides/${g.id}/`}>{g.data.title}</a>
            <p class="guide-item__excerpt">{g.data.excerpt}</p>
          </li>
        ))}
      </ul>
      <p class="more"><a href="/guides/">全部教学 →</a></p>
    </section>
  </main>
</BaseLayout>

<style>
  .hero { padding: 5rem 1.5rem 3.5rem; max-width: 1080px; }
  .hero h1 { max-width: 12em; }
  .hl { color: var(--val-red); }
  .hero__cta { display: flex; gap: 0.9rem; margin-top: 1.6rem; }
  .section-block { padding-bottom: 3rem; }
  .more { margin-top: 1rem; font-weight: 700; font-size: 0.85rem; }
  .more a { color: var(--val-gray); }
  .more a:hover { color: var(--val-red); }
  .guide-list { list-style: none; display: grid; gap: 0.75rem; }
  .guide-item { padding: 1rem 1.2rem; }
  .guide-item__title { font-weight: 800; }
  .guide-item__title:hover { color: var(--val-red); }
  .guide-item__excerpt { color: var(--val-gray); font-size: 0.85rem; margin-top: 0.25rem; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o 'class="card-cut agent-card"' dist/index.html | wc -l`
Expected: `6`（首页展示 6 位特工；用 `grep -o | wc -l` 计匹配次数）

- [ ] **Step 3: 预览抽查（首页是门面，仔细看）**

浏览器打开 `http://localhost:4321/`
Expected: 对照 `docs/superpowers/mockups/visual-style.html` 的 A 卡片：深蓝黑底、红色 label-cut、大标题、红/描边双按钮、特工卡网格、教学列表；移动端窗口（375px 宽）下布局不错乱

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: 首页（hero + 热门特工 + 最新教学）"
```

---

### Task 17: SEO 与类型检查收尾

**Files:**
- Verify: 无新增文件；可能 Modify `astro.config.mjs`（仅当域名需要修正）

- [ ] **Step 1: 类型检查**

Run: `pnpm lint`
Expected: 0 errors, 0 warnings（astro check 通过）

- [ ] **Step 2: 全量构建 + sitemap 验证**

Run: `pnpm build && ls dist/sitemap-index.xml dist/sitemap-0.xml`
Expected: 两个文件都存在（@astrojs/sitemap 输出）
Run: `grep -c "canonical" dist/index.html`
Expected: ≥ 1（BaseLayout 的 canonical 标签）

- [ ] **Step 3: 全量测试无回归**

Run: `pnpm test`
Expected: 全部通过（api 7 + transform 8 + validate 7 + AgentCard 2 + WeaponCard 3 = 27 用例）

- [ ] **Step 4: Lighthouse 自查（手动，Chrome DevTools → Lighthouse → SEO + Performance）**

Run: `pnpm preview` 后对 `http://localhost:4321/` 跑 Lighthouse
Expected: Performance ≥ 90、SEO ≥ 90（spec 成功标准 2）。若不达标：优先检查图片尺寸（首页卡片图较大）与无障碍对比度，按报告修正。

- [ ] **Step 5: Commit（如有修正）**

```bash
git add -A
git commit -m "chore: SEO 与性能收尾"
```

---

### Task 18: Playwright E2E 冒烟

**Files:**
- Create: `playwright.config.ts`、`tests/e2e/smoke.spec.ts`

- [ ] **Step 1: 安装 Playwright 浏览器**

Run: `pnpm exec playwright install chromium`
Expected: chromium 下载安装成功（@playwright/test 已在 Task 1 安装）

- [ ] **Step 2: 写 playwright.config.ts**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 3: 写 tests/e2e/smoke.spec.ts（spec 定案的 4 条核心路径）**

```ts
import { expect, test } from '@playwright/test';

test('首页可访问且核心入口齐全', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('精准');
  await expect(page.getByRole('link', { name: '浏览特工' })).toBeVisible();
  await expect(page.getByRole('link', { name: '新手教学' })).toBeVisible();
});

test('特工列表 → 特工详情', async ({ page }) => {
  await page.goto('/agents/');
  await expect(page.getByRole('heading', { name: '特工图鉴' })).toBeVisible();
  await page.locator('.agent-card').first().click();
  await expect(page.getByRole('heading', { level: 2, name: '技能' })).toBeVisible();
  await expect(page.locator('.skill').first()).toBeVisible();
});

test('武器列表可访问', async ({ page }) => {
  await page.goto('/weapons/');
  await expect(page.getByRole('heading', { name: '武器库' })).toBeVisible();
  await expect(page.locator('.weapon-card').first()).toBeVisible();
});

test('教学列表 → 文章详情', async ({ page }) => {
  await page.goto('/guides/');
  await expect(page.getByRole('heading', { name: '新手教学' })).toBeVisible();
  await page.locator('.guide-item__title').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

- [ ] **Step 4: 跑 E2E（webServer 会自动先 preview）**

Run: `pnpm build && pnpm e2e`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: Playwright 冒烟（4 条核心路径）"
```

---

### Task 19: CI（push 校验 + 每日 cron 自动同步）

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: 写 .github/workflows/ci.yml**

push/PR 跑 lint + test + build；每日 UTC 03:00（北京时间 11:00）cron 同步数据并提交——spec 定案 P0 必选。

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 3 * * *'

jobs:
  verify:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build

  sync:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: 同步 valorant-api 数据
        run: pnpm sync
      - name: 提交数据变更（无变化则跳过）
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data
          if git diff --cached --quiet; then
            echo "数据无变更，跳过提交"
          else
            git commit -m "chore(sync): 每日数据自动同步"
            git push
          fi
```

- [ ] **Step 2: 本地验证 workflow 语法**

Run: `node -e "const yaml=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); console.log('lines:', yaml.split('\n').length)"`
Expected: 正常输出行数（语法级验证；真实执行需推送 GitHub 后在 Actions 页观察）
另用在线 actionlint 或推送后观察首次 workflow 运行（Task 20 推送后即触发 verify）。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: push 校验与每日自动数据同步（spec P0 必选）"
```

---

### Task 20: README 与 Vercel 部署

**Files:**
- Create: `README.md`
- Modify: `astro.config.mjs`（仅当实际分配域名与占位不符）

**注意**：本任务的 Vercel 导入与 GitHub 推送需要用户账号操作——执行者做到"一切就绪"，最后一步请用户参与。

- [ ] **Step 1: 写 README.md**

```markdown
# valorant-hub · 无畏契约中文资料站

面向国服玩家（附英文对照）的无畏契约（VALORANT）信息站：特工图鉴、武器数据、新手教学。

## 技术栈

- [Astro 5](https://astro.build) 全静态生成（默认零客户端 JS）
- 数据源：[valorant-api.com](https://valorant-api.com)（Riot 官方数据镜像），同步脚本自动拉取
- 部署：Vercel · CI：GitHub Actions

## 开发

    pnpm install
    pnpm sync      # 从 valorant-api.com 同步特工/武器数据到 src/data/
    pnpm dev       # 本地开发 http://localhost:4321

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm build` | 静态构建到 dist/ |
| `pnpm test` | vitest 单元与组件测试 |
| `pnpm e2e` | Playwright 冒烟（需先 build） |
| `pnpm lint` | astro check 类型检查 |
| `pnpm sync` | 手动同步游戏数据 |

## 数据维护

- `src/data/*.json` 由 `pnpm sync` 生成，**禁止手工编辑**——改了也会被下次同步覆盖
- 教学文章在 `src/content/guides/` 用 Markdown 维护，frontmatter 受 zod schema 约束
- GitHub Actions 每日 11:00（北京时间）自动同步数据并提交；同步失败不影响构建（构建只读已提交数据）

## 部署（Vercel）

1. 推送本仓库到 GitHub
2. vercel.com → Add New Project → 导入该仓库（Astro 自动识别，零配置）
3. 部署完成后，把 `astro.config.mjs` 的 `site` 更新为实际分配的域名并推送

## 声明

本站与 Riot Games 无关，仅供学习交流。VALORANT © Riot Games, Inc.
```

- [ ] **Step 2: 最终全量验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: 全部通过（lint 0 错、27 单测全绿、构建成功、4 条 E2E 通过）

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README（开发/部署/数据维护说明）"
```

- [ ] **Step 4: （需用户参与）推送 GitHub 并导入 Vercel**

1. 用户在 GitHub 创建空仓库 `valorant-hub`，本地 `git remote add origin <仓库URL> && git push -u origin main`
2. 观察 GitHub Actions 首次 `verify` workflow 变绿
3. vercel.com → Import 该仓库 → Deploy（Astro 零配置识别）
4. 若实际域名 ≠ `valorant-hub.vercel.app`：更新 `astro.config.mjs` 的 `site`、提交推送
5. 线上验证：打开站点首页，走一遍 4 条冒烟路径

Expected: 线上站点可访问，首页到特工详情 ≤ 3 次点击（spec 成功标准 3）

---

## Self-Review 记录（写计划时已核对）

1. **Spec 覆盖**：spec 第 2.1/2.2 节 P0 范围（首页/特工/武器/教学）→ Task 8-16；4.2 数据流与同步脚本 → Task 4-7；4.4 五项关键技术决策全部落地（译名双语合并 Task 5、图片热链+lazy+onerror Task 8/11、API 边界如实呈现 Task 10 注脚、SEO 基建 Task 1+17、零 JS 交互 Task 9/12）；第 5 节数据模型 → Task 5 注释与 Task 7 输出形状一致；第 6 节错误处理 → Task 4（重试）/6（校验）/7（原子写入）；第 7 节测试 → Task 4-6/8/11/18；第 8 节部署 → Task 19-20。
2. **Placeholder 扫描**：全部代码块完整，无 TBD/TODO/"稍后补充"；种子文章为全文。
3. **类型一致性**：`transform.mjs` 产出的 agent/weapon 字段与 `AgentCard`/`WeaponCard`/`SkillPanel` 的 Props 接口、`validate.mjs` 的断言字段、`agents.json` 顶层 `{ syncedAt, version, agents }` 与页面 import 的访问路径全部对齐；`SLOT_KEY` 映射 Ability1/Ability2/Grenade/Ultimate → Q/E/C/X 在 Task 5 与测试一致。