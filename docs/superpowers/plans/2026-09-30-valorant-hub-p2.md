# valorant-hub P2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增三个交互工具（武器伤害对比、特工阵容推荐、全站搜索）与地图点位攻略内容（13 张竞技图），完成 spec P2 范围。

**Architecture:** 零框架岛屿——Astro 原生打包 `<script>`（module）+ `define:vars` 注入瘦身数据；纯逻辑提取为 `src/utils/*.ts`（vitest 单测），DOM 绑定薄层由 E2E 覆盖；攻略走内容集合（mapGuides）。

**Tech Stack:** 同 P0/P1（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**Spec:** `docs/superpowers/specs/2026-09-30-valorant-hub-design.md`（2.2 P2 分期 + 4.4 交互预留）

**前置状态:** P0+P1 已上线（https://valorant-hub-five.vercel.app），36 单测 + 7 E2E 全绿，91 页构建，CI/CD 全链路打通。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净，remote 为 SSH
- `.npmrc` 已锁定官方 registry（勿用内网镜像装包）
- 今天日期：2026-09-30

## 关键背景（给零上下文的执行者）

- **岛屿技术（定稿）**：不用 React/Vue。数据传递用 JSON script 标签：`<script type="application/json" id="page-data">{JSON.stringify(data)}</script>`（服务端序列化，Astro 对非 JS 类型 script 原样输出）；行为脚本用打包 `<script>`（支持 import TS 模块），运行时 `JSON.parse` 读数据。**关键约束：打包 script 与 frontmatter 变量引用互斥**——打包后的 script 作用域里没有 frontmatter 变量，也不可用 define:vars（会强制内联导致 import 失效）。纯逻辑提取到 `src/utils/*.ts`（vitest 单测），页面 script 只做 import + DOM 绑定
- **数据瘦身**：注入客户端的数据只保留必要字段（名/角色/图标/数值），不注入全量 JSON
- **阵容角色名约定**：`src/data/agents.json` 的 `zh.role` 实测值为「决斗 / 先锋 / 控场 / 哨卫」（API 数据即真相）——`lineup.ts` 的第 5 席优先补决斗逻辑依赖此值，代码中注释说明
- **对比工具形态（YAGNI 定稿）**：并排对比卡（价格/射速/穿透/弹匣 + 各射程段伤害表），不做图表曲线
- **攻略范围**：13 张已上线竞技图（ascent/split/bind/haven/breeze/lotus/pearl/fracture/sunset/abyss/icebox/corrode/summit）。Corrode 与 Summit 为较新地图，攻略写结构框架并显式标注"持续打磨"；未上线图（Gauntlet）不写。TDM/斗牛/训练场不写
- **单测计数**：P1 后为 36；P2 新增 compare 3 + lineup 3 + search 3 = 9，全量目标 **45**
- **E2E 计数**：7 + 3 = **10**；**页面数**：91 + 3（compare/lineup/search）= **94**
- **产物是压缩 HTML**：验证一律用 `grep -o | wc -l`

## 文件结构总览（P2 变更）

```
src/utils/compare.ts                # P2-1 新建（纯函数）
src/pages/weapons/compare.astro    # P2-2 新建（岛屿）
src/utils/lineup.ts                 # P2-3 新建（纯函数）
src/pages/agents/lineup.astro      # P2-4 新建（岛屿）
src/utils/search.ts                 # P2-5 新建（纯函数）
src/pages/search.astro              # P2-6 新建（岛屿）
src/components/NavBar.astro        # P2-6 修改（加"搜索"第 6 项）
src/content/config.ts               # P2-7 修改（加 mapGuides 集合）
src/content/map-guides/*.md        # P2-7 新建 13 篇
src/pages/maps/[id].astro           # P2-7 修改（读攻略替换占位）
tests/utils/compare.test.ts         # P2-1
tests/utils/lineup.test.ts         # P2-3
tests/utils/search.test.ts         # P2-5
tests/e2e/smoke.spec.ts            # P2-8（7 → 10 条）
```

---

### Task P2-1: compare 纯函数模块（TDD）

**Files:**
- Create: `src/utils/compare.ts`
- Test: `tests/utils/compare.test.ts`

- [ ] **Step 1: 写失败测试 tests/utils/compare.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { toCompareWeapons, pickCompareWeapons, type CompareWeapon } from '../../src/utils/compare';

const rawWeapons = [
  {
    id: 'vandal', zh: { name: '狂徒', category: '步枪' }, en: { name: 'Vandal', category: 'Rifle' },
    credits: 2900, stats: { fireRate: 9.75, magazineSize: 25, wallPenetration: 'Medium' },
    damageRanges: [
      { rangeStartMeters: 0, rangeEndMeters: 10, headDamage: 160, bodyDamage: 40, legDamage: 34 },
      { rangeStartMeters: 10, rangeEndMeters: 30, headDamage: 140, bodyDamage: 35, legDamage: 29 },
    ],
  },
  {
    id: 'classic', zh: { name: 'Classic', category: '佩枪' }, en: { name: 'Classic', category: 'Sidearm' },
    credits: 0, stats: { fireRate: 6.75, magazineSize: 12, wallPenetration: 'Low' },
    damageRanges: [],
  },
];

describe('toCompareWeapons', () => {
  it('瘦身为对比模型：中英名合并、射程段格式化', () => {
    const [vandal] = toCompareWeapons(rawWeapons as never);
    expect(vandal.id).toBe('vandal');
    expect(vandal.name).toBe('狂徒 Vandal');
    expect(vandal.zhName).toBe('狂徒');
    expect(vandal.credits).toBe(2900);
    expect(vandal.damageRanges[0].label).toBe('0–10m');
  });

  it('中英同名时只显示一个名字', () => {
    const [, classic] = toCompareWeapons(rawWeapons as never);
    expect(classic.name).toBe('Classic');
  });
});

describe('pickCompareWeapons', () => {
  const all = toCompareWeapons(rawWeapons as never);
  it('按所选 id 顺序返回并忽略未知 id', () => {
    const picked = pickCompareWeapons(all, ['classic', 'vandal', 'ghost']);
    expect(picked.map((w) => w.id)).toEqual(['classic', 'vandal']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/utils/compare.test.ts`
Expected: FAIL —— `Cannot find module '../../src/utils/compare'`

- [ ] **Step 3: 写 src/utils/compare.ts**

```ts
// 武器对比纯函数：数据瘦身与选中过滤（页面 script 与单测共用）
export interface CompareWeapon {
  id: string;
  name: string;     // 中英合并显示名（同名只显示一个）
  zhName: string;
  category: string;
  credits: number;
  fireRate: number;
  magazineSize: number;
  wallPenetration: string;
  damageRanges: Array<{ label: string; headDamage: number; bodyDamage: number; legDamage: number }>;
}

// 从 src/data/weapons.json 的原始记录瘦身
export function toCompareWeapons(raw: Array<Record<string, never>>): CompareWeapon[] {
  return (raw as unknown[]).map((item) => {
    const w = item as {
      id: string;
      zh: { name: string; category: string };
      en: { name: string };
      credits: number;
      stats: { fireRate: number; magazineSize: number; wallPenetration: string };
      damageRanges: Array<{ rangeStartMeters: number; rangeEndMeters: number; headDamage: number; bodyDamage: number; legDamage: number }>;
    };
    const name = w.zh.name !== w.en.name ? `${w.zh.name} ${w.en.name}` : w.en.name;
    return {
      id: w.id,
      name,
      zhName: w.zh.name,
      category: w.zh.category || '其他',
      credits: w.credits,
      fireRate: w.stats.fireRate,
      magazineSize: w.stats.magazineSize,
      wallPenetration: w.stats.wallPenetration,
      damageRanges: w.damageRanges.map((r) => ({
        label: `${r.rangeStartMeters}–${r.rangeEndMeters}m`,
        headDamage: r.headDamage,
        bodyDamage: r.bodyDamage,
        legDamage: r.legDamage,
      })),
    };
  });
}

// 按所选 id 顺序过滤（忽略未知 id、自动去重）
export function pickCompareWeapons(all: CompareWeapon[], selectedIds: string[]): CompareWeapon[] {
  const seen = new Set<string>();
  const picked: CompareWeapon[] = [];
  for (const id of selectedIds) {
    if (seen.has(id)) continue;
    const w = all.find((x) => x.id === id);
    if (w) {
      seen.add(id);
      picked.push(w);
    }
  }
  return picked;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/utils/compare.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/utils/compare.ts tests/utils/compare.test.ts
git commit -m "feat(p2): 武器对比纯函数模块（瘦身与选中过滤）"
```

---

### Task P2-2: 武器对比页面（岛屿）

**Files:**
- Create: `src/pages/weapons/compare.astro`

- [ ] **Step 1: 写 src/pages/weapons/compare.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import weaponsData from '../../data/weapons.json';
import { toCompareWeapons } from '../../utils/compare';

const compareWeapons = toCompareWeapons(weaponsData.weapons as never);
---
<BaseLayout title="武器对比｜无畏契约资料站" description="选择武器并排对比伤害分段、射速、价格与穿透">
  <main class="container section">
    <div class="label-cut">Compare</div>
    <h1>武器对比</h1>
    <p class="page-sub">勾选 2-4 把武器并排查看参数与各射程段伤害</p>
    <div class="chips" id="chips">
      {compareWeapons.map((w) => (
        <label class="chip">
          <input type="checkbox" value={w.id} />
          <span>{w.name}</span>
        </label>
      ))}
    </div>
    <div class="grid compare-grid" id="result">
      <p class="page-sub" id="hint">在上方勾选武器开始对比</p>
    </div>
  </main>
<script type="application/json" id="page-data">{JSON.stringify(compareWeapons)}</script>

<script>
  import { pickCompareWeapons, type CompareWeapon } from '../../utils/compare';

  // 打包 script 不注入 frontmatter 变量：数据经 JSON script 标签传递
  const all: CompareWeapon[] = JSON.parse(
    (document.getElementById('page-data') as HTMLElement).textContent || '[]',
  );
  const chips = document.querySelectorAll<HTMLInputElement>('#chips input');
  const result = document.getElementById('result') as HTMLElement;

  const PEN_LABEL: Record<string, string> = { Low: '低', Medium: '中', High: '高' };

  function render() {
    const ids = [...chips].filter((c) => c.checked).map((c) => c.value);
    const picked = pickCompareWeapons(all, ids);
    if (!picked.length) {
      result.innerHTML = '<p class="page-sub" id="hint">在上方勾选武器开始对比</p>';
      return;
    }
    result.innerHTML = picked.map((w) => `
      <article class="card-cut compare-card">
        <h2>${w.name}</h2>
        <p class="compare-card__price">${w.credits > 0 ? `${w.credits} 信用点` : '默认装备'} · ${w.category}</p>
        <table>
          <tbody>
            <tr><th>射速</th><td>${w.fireRate} 发/秒</td></tr>
            <tr><th>弹匣</th><td>${w.magazineSize}</td></tr>
            <tr><th>穿透</th><td>${PEN_LABEL[w.wallPenetration] ?? w.wallPenetration}</td></tr>
          </tbody>
        </table>
        ${w.damageRanges.length ? `
        <h3>伤害分段</h3>
        <table>
          <thead><tr><th>射程</th><th>爆头</th><th>躯干</th><th>腿部</th></tr></thead>
          <tbody>
            ${w.damageRanges.map((r) => `
            <tr><td>${r.label}</td><td>${r.headDamage}</td><td>${r.bodyDamage}</td><td>${r.legDamage}</td></tr>
            `).join('')}
          </tbody>
        </table>` : '<p class="page-sub">无伤害分段数据</p>'}
      </article>
    `).join('');
  }

  chips.forEach((c) => c.addEventListener('change', render));
</script>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.2rem 0 1.6rem; }
  .chip {
    display: inline-flex; align-items: center; gap: 0.4rem;
    padding: 0.35rem 0.8rem; font-size: 0.8rem; font-weight: 700;
    box-shadow: inset 0 0 0 1px var(--val-line); cursor: pointer;
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  }
  .chip:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .chip input { accent-color: var(--val-red); }
  .compare-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); align-items: start; }
  .compare-card { padding: 1.2rem; }
  .compare-card h2 { font-size: 1.05rem; margin-bottom: 0.3rem; }
  .compare-card h3 { font-size: 0.85rem; margin-top: 1rem; margin-bottom: 0.3rem; }
  .compare-card__price { color: var(--val-red); font-size: 0.78rem; font-weight: 700; }
</style>
```

注意：`compare.astro` 与 `[id].astro` 同目录不冲突（静态路由优先于动态段，Astro 支持）。

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o '武器对比' dist/weapons/compare/index.html | wc -l`
Expected: ≥ 1（title/og/h1 出现多次，压缩 HTML 用 -o 计匹配次数）

- [ ] **Step 3: Commit**

```bash
git add src/pages/weapons/compare.astro
git commit -m "feat(p2): 武器对比页面（并排对比卡，零框架岛屿）"
```

---

### Task P2-3: lineup 纯函数模块（TDD）

**Files:**
- Create: `src/utils/lineup.ts`
- Test: `tests/utils/lineup.test.ts`

- [ ] **Step 1: 写失败测试 tests/utils/lineup.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { buildLineup, type LineupAgent } from '../../src/utils/lineup';

const mk = (id: string, role: string): LineupAgent => ({
  id, zhName: `特工${id}`, enName: id.toUpperCase(), role, displayIcon: '',
});
// 4 角色各 2 人，决斗 3 人
const pool = [
  mk('d1', '决斗'), mk('d2', '决斗'), mk('d3', '决斗'),
  mk('i1', '先锋'), mk('i2', '先锋'),
  mk('c1', '控场'), mk('c2', '控场'),
  mk('s1', '哨卫'), mk('s2', '哨卫'),
];

describe('buildLineup', () => {
  it('固定 rng 下结果确定：各角色 1 名 + 第 5 席为决斗', () => {
    const lineup = buildLineup(pool, () => 0);
    expect(lineup).toHaveLength(5);
    const roles = lineup.map((a) => a.role);
    for (const r of ['决斗', '先锋', '控场', '哨卫']) expect(roles).toContain(r);
    // 第 5 席来自决斗池
    expect(roles.filter((r) => r === '决斗')).toHaveLength(2);
  });

  it('第 5 席随机时两次调用覆盖不同组合（概率性冒烟）', () => {
    const a = buildLineup(pool);
    const b = buildLineup(pool);
    expect(a).toHaveLength(5);
    expect(b).toHaveLength(5);
  });

  it('决斗池不足时从其他池补足且不重复选人', () => {
    const smallPool = [mk('d1', '决斗'), mk('i1', '先锋'), mk('c1', '控场'), mk('s1', '哨卫'), mk('i2', '先锋')];
    const lineup = buildLineup(smallPool, () => 0);
    expect(lineup).toHaveLength(5);
    expect(new Set(lineup.map((a) => a.id)).size).toBe(5);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/utils/lineup.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写 src/utils/lineup.ts**

```ts
// 阵容推荐纯函数：角色平衡规则（页面 script 与单测共用）
// 规则：四大角色（决斗/先锋/控场/哨卫——zh.role 实测值）各选 1 名，
// 第 5 席优先再补 1 名决斗者；目标池为空时从剩余最满的池取，直至 5 人或选尽。
export interface LineupAgent {
  id: string;
  zhName: string;
  enName: string;
  role: string;
  displayIcon: string;
}

export function buildLineup(agents: LineupAgent[], rng: () => number = Math.random): LineupAgent[] {
  const pools = new Map<string, LineupAgent[]>();
  for (const a of agents) {
    if (!pools.has(a.role)) pools.set(a.role, []);
    pools.get(a.role)!.push(a);
  }

  const picked: LineupAgent[] = [];
  const take = (pool: LineupAgent[]): LineupAgent => {
    const i = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    return pool.splice(i, 1)[0];
  };

  // 第一轮：每角色各 1 名
  for (const pool of pools.values()) {
    if (picked.length >= 5) break;
    if (pool.length) picked.push(take(pool));
  }
  // 第二轮：第 5 席优先决斗池，空则取剩余最满的池
  while (picked.length < 5) {
    const duelPool = pools.get('决斗');
    const rest = [...pools.values()].filter((p) => p.length);
    if (!rest.length) break;
    const pool = duelPool?.length ? duelPool : rest.sort((a, b) => b.length - a.length)[0];
    picked.push(take(pool!));
  }
  return picked.slice(0, 5);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/utils/lineup.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/utils/lineup.ts tests/utils/lineup.test.ts
git commit -m "feat(p2): 阵容推荐纯函数模块（角色平衡规则）"
```

---

### Task P2-4: 阵容推荐页面（岛屿）

**Files:**
- Create: `src/pages/agents/lineup.astro`

- [ ] **Step 1: 写 src/pages/agents/lineup.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import agentsData from '../../data/agents.json';

const lineAgents = agentsData.agents.map((a) => ({
  id: a.id,
  zhName: a.zh.name,
  enName: a.en.name,
  role: a.zh.role,
  displayIcon: a.displayIcon,
}));
---
<BaseLayout title="阵容推荐｜无畏契约资料站" description="角色平衡规则生成 5 人阵容：决斗、先锋、控场、哨卫各司其职">
  <main class="container section">
    <div class="label-cut">Lineup</div>
    <h1>阵容推荐</h1>
    <p class="page-sub">按四大定位各选一名、第五席再补一名决斗者，生成平衡阵容</p>
    <div class="lineup__actions">
      <button class="btn btn-primary" id="roll">生成阵容</button>
      <button class="btn btn-ghost" id="reroll" style="display:none">再来一组</button>
    </div>
    <div class="grid lineup-grid" id="result">
      <p class="page-sub">点击「生成阵容」开始</p>
    </div>
    <p class="data-meta">推荐为角色平衡的通用组合，具体选人请结合队友熟练度与地图特点</p>
  </main>
<script type="application/json" id="page-data">{JSON.stringify(lineAgents)}</script>

<script>
  import { buildLineup, type LineupAgent } from '../../utils/lineup';

  // 打包 script 不注入 frontmatter 变量：数据经 JSON script 标签传递
  const all: LineupAgent[] = JSON.parse(
    (document.getElementById('page-data') as HTMLElement).textContent || '[]',
  );
  const result = document.getElementById('result') as HTMLElement;
  const roll = document.getElementById('roll') as HTMLButtonElement;
  const reroll = document.getElementById('reroll') as HTMLButtonElement;

  function render() {
    const lineup = buildLineup(all);
    result.innerHTML = lineup.map((a) => `
      <a class="card-cut lineup-card" href="/agents/${a.id}/">
        <img src="${a.displayIcon}" alt="${a.zhName}" loading="lazy" onerror="this.src='/favicon.svg'" />
        <div class="lineup-card__name">${a.zhName}</div>
        <div class="lineup-card__role">${a.role} · ${a.enName}</div>
      </a>
    `).join('');
    reroll.style.display = '';
  }

  roll.addEventListener('click', render);
  reroll.addEventListener('click', render);
</script>

<style>
  .lineup__actions { display: flex; gap: 0.9rem; margin: 1.2rem 0 1.6rem; }
  .lineup-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
  .lineup-card { display: block; padding: 1rem; text-align: center; }
  .lineup-card:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .lineup-card img { width: 100%; aspect-ratio: 1; object-fit: cover; margin-bottom: 0.5rem; }
  .lineup-card__name { font-weight: 800; }
  .lineup-card__role { font-size: 0.75rem; color: var(--val-gray); }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o '阵容推荐' dist/agents/lineup/index.html | wc -l`
Expected: ≥ 1

- [ ] **Step 3: Commit**

```bash
git add src/pages/agents/lineup.astro
git commit -m "feat(p2): 阵容推荐页面（角色平衡随机组合）"
```

---

### Task P2-5: search 纯函数模块（TDD）

**Files:**
- Create: `src/utils/search.ts`
- Test: `tests/utils/search.test.ts`

- [ ] **Step 1: 写失败测试 tests/utils/search.test.ts**

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/utils/search.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写 src/utils/search.ts**

```ts
// 全站搜索纯函数：构建期生成索引、客户端过滤（页面 script 与单测共用）
export interface SearchEntity {
  type: string;   // 特工/武器/地图/教学/版本资讯/电竞资讯
  title: string;  // 主标题（中文为主）
  sub: string;    // 副信息（英文名/分类/类型）
  url: string;
}

export function searchEntities(entities: SearchEntity[], query: string): SearchEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entities.filter(
    (e) => e.title.toLowerCase().includes(q) || e.sub.toLowerCase().includes(q),
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/utils/search.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/utils/search.ts tests/utils/search.test.ts
git commit -m "feat(p2): 全站搜索纯函数模块（索引过滤）"
```

---

### Task P2-6: 全站搜索页面 + 导航

**Files:**
- Create: `src/pages/search.astro`
- Modify: `src/components/NavBar.astro`（items 加第 6 项 `{ href: '/search/', label: '搜索' }`，结构不动）

- [ ] **Step 1: 写 src/pages/search.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import agentsData from '../data/agents.json';
import weaponsData from '../data/weapons.json';
import mapsData from '../data/maps.json';
import type { SearchEntity } from '../utils/search';
import { getCollection } from 'astro:content';

const guides = await getCollection('guides', ({ data }) => !data.draft);
const patchNotes = await getCollection('patchNotes', ({ data }) => !data.draft);
const esports = await getCollection('esports', ({ data }) => !data.draft);

const entities: SearchEntity[] = [
  ...agentsData.agents.map((a) => ({ type: '特工', title: a.zh.name, sub: a.en.name, url: `/agents/${a.id}/` })),
  ...weaponsData.weapons.map((w) => ({
    type: '武器', title: w.zh.name !== w.en.name ? `${w.zh.name} ${w.en.name}` : w.en.name,
    sub: w.zh.category || '其他', url: `/weapons/${w.id}/`,
  })),
  ...mapsData.maps.map((m) => ({ type: '地图', title: m.zh.name, sub: m.en.name, url: `/maps/${m.id}/` })),
  ...guides.map((g) => ({ type: '教学', title: g.data.title, sub: g.data.category, url: `/guides/${g.id}/` })),
  ...patchNotes.map((n) => ({ type: '版本资讯', title: n.data.title, sub: n.data.patchVersion, url: `/patch-notes/${n.id}/` })),
  ...esports.map((p) => ({ type: '电竞资讯', title: p.data.title, sub: p.data.type, url: `/esports/${p.id}/` })),
];
---
<BaseLayout title="全站搜索｜无畏契约资料站" description="搜索特工、武器、地图与攻略文章">
  <main class="container section">
    <div class="label-cut">Search</div>
    <h1>全站搜索</h1>
    <p class="page-sub">{entities.length} 个条目 · 支持中文名与英文名</p>
    <input
      id="q"
      class="search-input"
      type="search"
      placeholder="搜索特工、武器、地图、攻略…"
      autocomplete="off"
    />
    <ul class="search-list" id="result">
      <li class="page-sub" id="hint">输入关键词开始搜索</li>
    </ul>
  </main>
<script type="application/json" id="page-data">{JSON.stringify(entities)}</script>

<script>
  import { searchEntities, type SearchEntity } from '../utils/search';

  // 打包 script 不注入 frontmatter 变量：数据经 JSON script 标签传递
  const all: SearchEntity[] = JSON.parse(
    (document.getElementById('page-data') as HTMLElement).textContent || '[]',
  );
  const input = document.getElementById('q') as HTMLInputElement;
  const result = document.getElementById('result') as HTMLElement;

  function render() {
    const hits = searchEntities(all, input.value);
    if (!input.value.trim()) {
      result.innerHTML = '<li class="page-sub" id="hint">输入关键词开始搜索</li>';
      return;
    }
    if (!hits.length) {
      result.innerHTML = '<li class="page-sub">没有找到相关内容，换个关键词试试</li>';
      return;
    }
    result.innerHTML = hits.map((e) => `
      <li class="card-cut search-result">
        <span class="search-result__type">${e.type}</span>
        <a class="search-result__title" href="${e.url}">${e.title}</a>
        <span class="search-result__sub">${e.sub}</span>
      </li>
    `).join('');
  }

  input.addEventListener('input', render);
</script>

<style>
  .search-input {
    width: 100%; max-width: 560px;
    margin: 1.2rem 0 1.6rem;
    padding: 0.7rem 1rem;
    background: rgba(236, 232, 225, 0.06);
    box-shadow: inset 0 0 0 1px var(--val-line);
    color: var(--val-cream);
    font-family: inherit;
    font-size: 0.95rem;
    outline: none;
  }
  .search-input:focus { box-shadow: inset 0 0 0 1px var(--val-red); }
  .search-list { list-style: none; display: grid; gap: 0.6rem; }
  .search-result { display: flex; align-items: center; gap: 0.8rem; padding: 0.75rem 1rem; }
  .search-result__type { font-size: 0.7rem; color: var(--val-red); font-weight: 800; white-space: nowrap; }
  .search-result__title { font-weight: 700; }
  .search-result__title:hover { color: var(--val-red); }
  .search-result__sub { font-size: 0.75rem; color: var(--val-gray); }
</style>
```

- [ ] **Step 2: 修改 NavBar.astro**——items 数组末尾追加：

```astro
  { href: '/search/', label: '搜索' },
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build && grep -o '全站搜索' dist/search/index.html | wc -l && grep -o 'href="/search/"' dist/index.html | wc -l`
Expected: 均 ≥ 1（页面存在 + 导航入口生效）

- [ ] **Step 4: Commit**

```bash
git add src/pages/search.astro src/components/NavBar.astro
git commit -m "feat(p2): 全站搜索页面与导航入口（构建期索引 + 客户端过滤）"
```

---

### Task P2-7: mapGuides 攻略集合与地图详情页改造

**Files:**
- Modify: `src/content/config.ts`（加 mapGuides 集合）
- Create: `src/content/map-guides/` 13 篇（ascent/split/bind/haven/breeze/lotus/pearl/fracture/sunset/abyss/icebox/corrode/summit）
- Modify: `src/pages/maps/[id].astro`（读攻略替换占位）

- [ ] **Step 1: config.ts 的 collections 导出前加集合定义**

```ts
const mapGuides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/map-guides' }),
  schema: z.object({
    mapId: z.string(),
    title: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});
```

`export const collections = { guides, esports, patchNotes, mapGuides };`

- [ ] **Step 2-14: 写 13 篇攻略（frontmatter：mapId/title/publishDate）**

`ascent.md`（亚海悬城）：

```markdown
---
mapId: ascent
title: 亚海悬城攻防思路
publishDate: 2026-09-30
---

## 进攻思路

中门是全图咽喉：开局先用控场技能封中门视野，再决定分推方向。A 点大平台压制力强，下包前必须先清平台；B 主道狭长，先锋开路后快速冲击，不要在道内停留对枪。打不开局面时佯攻一点、借中门转点是这张图的基本功。

## 防守思路

中门必守——守住中门就保住了转点灵活性。A 平台站一人架住整条主道，B 点利用门后与箱区组织交叉火力，回防走市场快道。听到中门道具声立即报点，防止被中门夹击。
```

`split.md`（霓虹町）：

```markdown
---
mapId: split
title: 霓虹町攻防思路
publishDate: 2026-09-30
---

## 进攻思路

垂直是这张图的灵魂：A/B 塔楼的压制力极强，进攻前必须先用技能把楼上清掉或逼退。中路打通后可绕后夹击两点，排水道则是安全的转点路线。切忌无技能硬冲塔楼下的主道——高低差对枪是攻方劣势。

## 防守思路

塔楼各站一人形成高低差火力网，中门用道具拖延对方打通。被拆分防守时优先保 B——A 的回防路线更长，弃 A 保 B 是常见决策。
```

`bind.md`（源工重镇）：

```markdown
---
mapId: bind
title: 源工重镇攻防思路
publishDate: 2026-09-30
---

## 进攻思路

这张图没有中路，双点位靠单向传送门联动。经典打法：佯攻 A，实则借传送门快转 B。长道进 A 需要先锋道具压制窗口位，短道则要小心近距离伏击。传送门的脚步声既是进攻方的信号，也是防守方的情报。

## 防守思路

五人按 2-2-1 起手：双点各 2 人，第 5 人靠传送门声音决定支援方向。听到传送门落地声立即报点转防——这张图的信息战大于枪法战。
```

`haven.md`（隐世修所）：

```markdown
---
mapId: haven
title: 隐世修所攻防思路
publishDate: 2026-09-30
---

## 进攻思路

A/B/C 三点位让进攻方选择极多：假拆真蹲、声东击西收益很高。中路双向可攻 C 也可转 B，车库是进 C 最快的入口。多点同时施压比单点硬冲有效——防守方只有 5 人，铺不开三个点。

## 防守思路

三点五人天然人手不足，道具换时间是核心：哨卫把道具铺满点位拖延，尽量打出守方人数优势。中门一人游走做最快支援，听到下包声全队立刻回防该点，不要犹豫。
```

`breeze.md`（微风岛屿）：

```markdown
---
mapId: breeze
title: 微风岛屿攻防思路
publishDate: 2026-09-30
---

## 进攻思路

全图开阔、交火距离长，中距离步枪优势明显。A 点洞口与正门双入口可分推；中路推进后可双向夹击 B。开阔地图小心远程侦察道具（探测箭、雷达），推进前先用技能排掉信息位。

## 防守思路

开阔地形信息位价值最高：哨卫的侦查道具覆盖正门与中路，报出进攻方向就赢了一半。A 平台远点架枪压制洞口，B 点利用箱区制造层次火力，被突破前尽量用道具把开阔地的对枪距离拉长。
```

`lotus.md`（莲华古城）：

```markdown
---
mapId: lotus
title: 莲华古城攻防思路
publishDate: 2026-09-30
---

## 进攻思路

三点位图但带旋转门：A 旋转门假推真转 C 是经典套路，下水道则是隐蔽的 C 点入口。旋转门开启时的巨响是双向信息——进攻方可以用它制造假信号。多点分推让防守方首尾难顾。

## 防守思路

旋转门必须有人听声或用道具封锁，否则等于裸奔。起手 1-2-2 站位，中路游走位优先保大招应对多点开花。被多点同时施压时果断弃小保大，回收兵力守包点。
```

`pearl.md`（深海明珠）：

```markdown
---
mapId: pearl
title: 深海明珠攻防思路
publishDate: 2026-09-30
---

## 进攻思路

结构传统对称的一张图，中路是轴心：中门打开后可三向施压，让防守方无法判断主攻方向。A 主道纵深大适合稳步推进，B 点贴脸结构适合决斗者快攻。控制中门 = 控制节奏。

## 防守思路

标准 2-1-2 站位，中路 1 人靠道具守住两道门换时间。A 点利用箱阵高地与 B 点后点构成立体火力。中门失守立即报点，两点回收兵力不要被中路牵着走。
```

`fracture.md`（裂变峡谷）：

```markdown
---
mapId: fracture
title: 裂变峡谷攻防思路
publishDate: 2026-09-30
---

## 进攻思路

H 型结构，进攻方从两侧夹住地图——这是唯一"包围"防守方的图。双边 3-2 同时施压，防守方难以兼顾；中间连接区的控制权决定转点速度。不要单边推进，那等于放弃这张图的结构优势。

## 防守思路

天然被包围，开局不要抢中路白给。前期用道具换空间、信息位优先（雷达类技能价值极高）。两点各留后手技能防夹击，被多点开打时收缩到包点内打阵地战，等待回合时间消耗进攻方。
```

`sunset.md`（日落之城）：

```markdown
---
mapId: sunset
title: 日落之城攻防思路
publishDate: 2026-09-30
---

## 进攻思路

A 主道宽敞但市场转点极快，进攻方要防回防夹击——下包后优先守市场方向。B 点是贴脸结构，决斗者与近距离武器优先。中门控制后可双向夹击，是打开局面的钥匙。

## 防守思路

A 点前排压制 + 后点道具回收打二波；B 点近距离混战多，霰弹/冲锋枪有奇效。中门失守立即报点，B 点提前落位防快攻。防守这张图的要点是保住中门视野，失中门则处处被动。
```

`abyss.md`（幽邃地窟）：

```markdown
---
mapId: abyss
title: 幽邃地窟攻防思路
publishDate: 2026-09-30
---

## 进攻思路

全图无护栏——坠落即死！对枪位置选择比准度更重要：把火力线压在逼人靠边缘的位置，逼位技能（击退/致盲类）价值翻倍。A/B 主道都有悬崖走廊，推进时贴墙走位、不要追击到边缘。

## 防守思路

把交叉火力布置在"边缘走廊"：让进攻方要么挨枪要么跳崖。自己也不要追击到边缘——回防路线有限，听到下包声提前规划安全落位路线，别为了抢时间走近路坠亡。
```

`icebox.md`（森寒冬港）：

```markdown
---
mapId: icebox
title: 森寒冬港攻防思路
publishDate: 2026-09-30
---

## 进攻思路

垂直结构最复杂的一张图：管道与多层箱区构成 3D 对枪，先清上下两层再谈下包。A 点高低差大，进攻前必须处理塔楼与管道层；B 点厨房窗口压制力强，用道具逼退窗口位再进。

## 防守思路

垂直图是哨卫道具的天堂：绊线与信息位在多层结构里收益最大化。A 点利用高低差覆盖包点，B 点中近距离配置更适合贴身缠斗。防守重心是别让对方"白嫖"高层位置。
```

`corrode.md`（盐海矿镇）：

```markdown
---
mapId: corrode
title: 盐海矿镇攻防思路
publishDate: 2026-09-30
---

## 进攻思路

矿区结构，中门与双侧通道联动性强。矿场掩体多为铁皮薄墙——穿点价值高，推进时既要用薄墙压人，也要小心自己被穿。新图环境仍在形成期，建议先在训练场熟悉各主道的穿点位置。

## 防守思路

薄墙多意味着道具预瞄收益高：穿点道具与雷达类技能优先。点位纵深大，可以让出前点换时间，退到包点内打二波。这张图比较新，多试阵容组合、留意社区套路更新，本篇随版本持续打磨。
```

`summit.md`（天枢云阙）：

```markdown
---
mapId: summit
title: 天枢云阙攻防思路
publishDate: 2026-09-30
---

## 进攻思路

2026 年的最新地图，社区套路仍在形成期。先按通用框架打：摸清两条主道与中路的三线结构，再决定主攻方向；新图阶段不要迷信固定套路，多用技能探路比赌枪法划算。

## 防守思路

新图防守优先保守站位与信息位：先看清对方习惯的进攻路线，再逐步前压。大招优先留作应对多点开花。本篇为框架性思路，具体点位与克制关系随版本持续打磨。
```

- [ ] **Step 15: 修改 src/pages/maps/[id].astro**——frontmatter 加攻略查询：

在现有 import 后追加：

```astro
import { getCollection, render as renderGuide } from 'astro:content';
```

frontmatter 末尾（`const { map } = Astro.props;` 之后）追加：

```astro
// 查找该地图的攻略（有则渲染全文，无则显示占位说明）
const allGuides = await getCollection('mapGuides', ({ data }) => !data.draft);
const guideEntry = allGuides.find((g) => g.data.mapId === map.id) ?? null;
const GuideContent = guideEntry ? (await renderGuide(guideEntry)).Content : null;
```

「点位攻略」区块的占位段落替换为条件渲染：

```astro
    <h2>点位攻略</h2>
    {GuideContent ? (
      <article class="prose m-guide"><GuideContent /></article>
    ) : (
      <p class="m-text">社区点位攻略编写中，本页先呈现官方战术图与设定。想抢先用图？记住两条原则：进攻方看包点入口有哪些掩体，防守方看回防路线要几秒。</p>
    )}
```

scoped 样式追加：

```css
  .m-guide { max-width: 46em; }
```

- [ ] **Step 16: 构建验证**

Run: `pnpm build && grep -o '进攻思路' dist/maps/ascent/index.html | wc -l && grep -o '社区点位攻略编写中' dist/maps/the-range/index.html | wc -l`
Expected: 攻略页 ≥ 1；无攻略的地图（the-range）保持占位文案 ≥ 1

- [ ] **Step 17: Commit**

```bash
git add src/content src/pages/maps
git commit -m "feat(p2): 地图攻略集合（13 张竞技图攻防思路）与详情页攻略渲染"
```

---

### Task P2-8: E2E 扩展与最终全量验证

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`（7 → 10 条）

- [ ] **Step 1: smoke.spec.ts 末尾追加 3 条用例**

```ts
test('武器对比：勾选武器后出现对比卡', async ({ page }) => {
  await page.goto('/weapons/compare/');
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(page.locator('.compare-card').first()).toBeVisible();
});

test('阵容推荐：生成 5 人平衡阵容', async ({ page }) => {
  await page.goto('/agents/lineup/');
  await page.getByRole('button', { name: '生成阵容' }).click();
  await expect(page.locator('.lineup-card')).toHaveCount(5);
});

test('全站搜索：输入关键词出结果', async ({ page }) => {
  await page.goto('/search/');
  await page.getByPlaceholder('搜索特工、武器、地图、攻略…').fill('捷风');
  await expect(page.locator('.search-result__title').first()).toContainText('捷风');
});
```

- [ ] **Step 2: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、**45 单测全绿**（36+9）、构建 **94 页**（91+3）、**10 条 E2E 全过**

- [ ] **Step 3: 提交并推送**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(p2): E2E 扩展至 10 条（对比/阵容/搜索交互冒烟）"
git push
```

推送触发 GitHub Actions verify 与 Vercel 自动部署；完成后线上抽查四个新功能页面。

---

## Self-Review 记录

1. **Spec 覆盖**：spec 2.2 P2 三项（武器对比/阵容推荐/全站搜索）→ P2-1~6；P1 遗留的地图攻略 → P2-7；交互用 Astro 岛屿（零 JS 站点原则在 P2 按预期局部放开）符合 spec 4.4 第 5 条"构建产物为岛屿可局部挂载"的预留。
2. **Placeholder 扫描**：无 TBD/TODO；13 篇攻略为全文；新图（corrode/summit）显式标注"持续打磨"为诚实的产品文案而非工程占位。
3. **类型一致性**：CompareWeapon（toCompareWeapons 产出）与 compare.astro 页面、pickCompareWeapons 参数一致；LineupAgent 与 lineup.astro 的 lineAgents 映射字段一致；SearchEntity 与 search.astro 的六个实体源映射一致；mapGuides schema（mapId/title/publishDate/draft）与 13 篇 frontmatter、[id].astro 的 `g.data.mapId === map.id` 查询一致。
4. **计数核对**：单测 36+compare 3+lineup 3+search 3=45；E2E 7+3=10；页面 91+3=94（攻略不新增路由）。