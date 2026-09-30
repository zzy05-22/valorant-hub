# valorant-hub P1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已上线的 P0 基础上新增三大模块：地图图鉴（数据自动同步）、版本资讯、电竞资讯（内容集合），并更新导航与首页。

**Architecture:** 复用 P0 全部模式——maps 数据走同步脚本（双语合并/校验/原子写入）；patch-notes 与 esports 走 Astro 内容集合（zod schema + Markdown）；页面全静态、零客户端 JS。

**Tech Stack:** 同 P0（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**Spec:** `docs/superpowers/specs/2026-09-30-valorant-hub-design.md`（2.1 站点地图 / 2.2 P1 分期 / 4.4 数据边界）

**前置状态:** P0 已上线（https://valorant-hub-five.vercel.app），27 单测 + 4 E2E 全绿，CI/CD 全链路打通。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净，remote 为 SSH
- Node ≥ 20.3 / pnpm ≥ 9，`.npmrc` 已锁定官方 registry（P0 修复，勿用内网镜像装包）
- 可访问 valorant-api.com
- 今天日期：2026-09-30

## 关键背景（给零上下文的执行者）

- **现有数据层**（勿破坏）：`scripts/lib/api.mjs`（fetchJson + 端点封装）、`transform.mjs`（双语合并）、`validate.mjs`（校验）、`sync-valorant.mjs`（CLI + 原子写入）；`src/data/` 已有 agents.json（29）、weapons.json（21）、version.json
- **maps API**：`GET /v1/maps?language={lang}` → `data[]` 字段：`uuid`、`displayName`（zh-CN 为中文译名，en-US 为英文）、`narrativeDescription`（背景故事）、`tacticalDescription`（战术说明）、`coordinates`（坐标文本，如 "45°26'…"）、`displayIcon`（战术俯视图）、`splash`（背景横图）。实测 27 条（标准竞技图 + TDM 图 + Skirmish/训练场，含两份重复的靶场条目）——全部展示不做过滤；`transformMaps` 按英文 slug 去重（保留首条），去重后 26 条
- **现有内容集合**：`src/content/config.ts` 已有 `guides` 集合（glob loader + zod schema），P1 新增 `esports` 与 `patch-notes` 两个集合
- **导航决策（已定）**：NavBar 共 5 项——特工 / 武器 / **地图** / 教学 / **资讯**（"资讯"指向 `/esports/`）。版本资讯 `/patch-notes/` 的入口放 Footer 与首页区块，不进顶部导航（避免移动端拥挤）
- **单测计数**：P0 为 27；P1 新增 transform maps 4（含去重用例） + validate maps 3 + MapCard 2 = 9，全量目标 **36**
- **产物是压缩 HTML**：验证一律用 `grep -o 'xxx' | wc -l`，不用 `grep -c`

## 文件结构总览（P1 变更）

```
scripts/lib/api.mjs                  # P1-1 修改：加 fetchMaps
scripts/lib/transform.mjs            # P1-1 修改：加 transformMaps
scripts/lib/validate.mjs            # P1-1 修改：加 validateMaps
scripts/sync-valorant.mjs           # P1-2 修改：拉取 maps，产出 maps.json
src/data/maps.json                  # P1-2 生成
src/components/MapCard.astro        # P1-3 新建
src/pages/maps/index.astro          # P1-4 新建
src/pages/maps/[id].astro           # P1-5 新建
src/content/config.ts               # P1-6 修改：加 esports / patch-notes 集合
src/content/patch-notes/*.md        # P1-6 新建 2 篇
src/content/esports/*.md            # P1-6 新建 2 篇
src/pages/patch-notes/index.astro   # P1-7 新建
src/pages/patch-notes/[slug].astro  # P1-7 新建
src/pages/esports/index.astro       # P1-8 新建
src/pages/esports/[slug].astro      # P1-8 新建
src/components/NavBar.astro         # P1-9 修改：加 地图/资讯
src/components/Footer.astro        # P1-9 修改：加站内链接
src/pages/index.astro               # P1-9 修改：加最新资讯区块
tests/fixtures/maps.zh-CN.json      # P1-1 生成
tests/fixtures/maps.en-US.json      # P1-1 生成
tests/transform.test.ts             # P1-1 修改：加 maps describe
tests/validate.test.ts              # P1-1 修改：加 maps describe
tests/components/MapCard.test.ts    # P1-3 新建
tests/e2e/smoke.spec.ts             # P1-10 修改：4 条 → 7 条
```

---

### Task P1-1: maps 数据链路（TDD：fixtures → fetchMaps/transformMaps/validateMaps + 测试）

**Files:**
- Create: `tests/fixtures/maps.zh-CN.json`、`tests/fixtures/maps.en-US.json`
- Modify: `scripts/lib/api.mjs`、`scripts/lib/transform.mjs`、`scripts/lib/validate.mjs`、`tests/transform.test.ts`、`tests/validate.test.ts`

- [ ] **Step 1: 生成 maps fixtures（真实 API 响应前 4 条）**

```bash
curl -sf 'https://valorant-api.com/v1/maps?language=zh-CN' -o /tmp/maps-zh.json
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/tmp/maps-zh.json','utf8'));j.data=j.data.slice(0,4);fs.writeFileSync('tests/fixtures/maps.zh-CN.json',JSON.stringify(j));"
curl -sf 'https://valorant-api.com/v1/maps?language=en-US' -o /tmp/maps-en.json
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/tmp/maps-en.json','utf8'));j.data=j.data.slice(0,4);fs.writeFileSync('tests/fixtures/maps.en-US.json',JSON.stringify(j));"
```

验证：`node -e "console.log(require('./tests/fixtures/maps.zh-CN.json').data.length)"` 输出 `4`

- [ ] **Step 2: 写失败测试——transform.test.ts 追加 maps describe**

在 `tests/transform.test.ts` 顶部追加 import：

```ts
import mapsZh from './fixtures/maps.zh-CN.json';
import mapsEn from './fixtures/maps.en-US.json';
```

在文件末尾追加：

```ts
describe('transformMaps', () => {
  const maps = transformMaps(mapsZh.data, mapsEn.data);

  it('至少合并出 1 张地图', () => {
    expect(maps.length).toBeGreaterThanOrEqual(1);
  });

  it('中英字段合并进同一条记录且 id 为英文 slug', () => {
    for (const m of maps) {
      expect(m.zh.name).toBeTruthy();
      expect(m.en.name).toBeTruthy();
      expect(m.id).toMatch(/^[a-z0-9-]+$/);
      expect(m.id).toBe(slugify(m.en.name));
    }
  });

  it('战术图与坐标字段保留', () => {
    for (const m of maps) {
      expect(typeof m.displayIcon).toBe('string');
      expect(typeof m.coordinates).toBe('string');
    }
  });

  it('同名不同 uuid 的条目按 slug 去重（避免详情页路径冲突）', () => {
    const mk = (uuid: string) => ({
      uuid, displayName: 'Dup Map', narrativeDescription: '', tacticalDescription: '',
      coordinates: '', displayIcon: '', splash: '',
    });
    const result = transformMaps([mk('u1'), mk('u2')], [mk('u1'), mk('u2')]);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('dup-map');
  });
});
```

- [ ] **Step 3: 写失败测试——validate.test.ts 追加 maps describe**

在 `tests/validate.test.ts` 的 import 行改为（加 validateMaps）：

```ts
import { validateAgents, validateWeapons, validateMaps, ValidationError } from '../scripts/lib/validate.mjs';
```

文件末尾追加：

```ts
const mkMap = (over: Record<string, unknown> = {}) => ({
  id: 'ascent', uuid: 'u',
  zh: { name: '亚海悬城', description: '', tacticalDescription: '' },
  en: { name: 'Ascent', description: '', tacticalDescription: '' },
  coordinates: '', displayIcon: '', splash: '',
  ...over,
});

describe('validateMaps', () => {
  it('数量达标且字段完整时通过', () => {
    const maps = Array.from({ length: 7 }, (_, i) => mkMap({ id: `map-${i}` }));
    expect(validateMaps(maps)).toBe(true);
  });

  it('数量不足 7 抛 ValidationError', () => {
    expect(() => validateMaps(Array.from({ length: 6 }, (_, i) => mkMap({ id: `map-${i}` })))).toThrow(ValidationError);
  });

  it('关键字段缺失抛 ValidationError', () => {
    const maps = Array.from({ length: 7 }, (_, i) =>
      i === 0 ? mkMap({ id: '' }) : mkMap({ id: `map-${i}` }),
    );
    expect(() => validateMaps(maps)).toThrow(ValidationError);
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

Run: `pnpm vitest run tests/transform.test.ts tests/validate.test.ts`
Expected: FAIL —— `transformMaps is not a function` / `validateMaps is not exported`

- [ ] **Step 5: 实现——api.mjs 追加端点（文件末尾追加一行）**

```js
export const fetchMaps = (lang) => fetchJson(`/maps?language=${lang}`);
```

- [ ] **Step 6: 实现——transform.mjs 追加 transformMaps（文件末尾追加）**

```js
export function transformMaps(zhList, enList) {
  const enByUuid = new Map(enList.map((m) => [m.uuid, m]));
  const seen = new Set();
  return zhList
    .filter((zh) => enByUuid.has(zh.uuid))
    .map((zh) => {
      const en = enByUuid.get(zh.uuid);
      return {
        id: slugify(en.displayName),
        uuid: zh.uuid,
        zh: {
          name: zh.displayName ?? '',
          description: zh.narrativeDescription ?? '',
          tacticalDescription: zh.tacticalDescription ?? '',
        },
        en: {
          name: en.displayName ?? '',
          description: en.narrativeDescription ?? '',
          tacticalDescription: en.tacticalDescription ?? '',
        },
        coordinates: zh.coordinates ?? '',
        displayIcon: zh.displayIcon ?? '',
        splash: zh.splash ?? '',
      };
    })
    .filter((m) => {
      // 去重：上游存在同名条目（如两份靶场 The Range），保留首条，避免详情页路径冲突
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
}
```

- [ ] **Step 7: 实现——validate.mjs 追加 validateMaps（文件末尾追加）**

```js
export function validateMaps(maps) {
  if (!Array.isArray(maps) || maps.length < 7) {
    throw new ValidationError(`maps 数量异常：${maps?.length ?? 0}（预期 ≥ 7）`);
  }
  for (const m of maps) {
    if (!m.id || !m.zh?.name || !m.en?.name) {
      throw new ValidationError(`map 关键字段缺失：${JSON.stringify(m).slice(0, 200)}`);
    }
  }
  return true;
}
```

- [ ] **Step 8: 跑测试确认通过**

Run: `pnpm vitest run tests/transform.test.ts tests/validate.test.ts`
Expected: transform 12 passed（8+4，含去重用例）、validate 10 passed（7+3）

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(p1): maps 数据链路（fetchMaps/transformMaps/validateMaps + 测试）"
```

---

### Task P1-2: sync CLI 扩展 maps 并重新同步

**Files:**
- Modify: `scripts/sync-valorant.mjs`

- [ ] **Step 1: 修改 scripts/sync-valorant.mjs（3 处小改）**

1）import 行改为：

```js
import { fetchAgents, fetchWeapons, fetchMaps, fetchVersion } from './lib/api.mjs';
```

2）import transform 行改为：

```js
import { transformAgents, transformWeapons, transformMaps } from './lib/transform.mjs';
```

3）import validate 行改为：

```js
import { validateAgents, validateWeapons, validateMaps } from './lib/validate.mjs';
```

4）main() 中 `Promise.all` 数组扩为 7 项（在 fetchWeapons('en-US') 之后、fetchVersion() 之前插入两行）：

```js
  const [agentsZh, agentsEn, weaponsZh, weaponsEn, mapsZh, mapsEn, versionRaw] = await Promise.all([
    fetchAgents('zh-CN'),
    fetchAgents('en-US'),
    fetchWeapons('zh-CN'),
    fetchWeapons('en-US'),
    fetchMaps('zh-CN'),
    fetchMaps('en-US'),
    fetchVersion(),
  ]);
```

5）validate 块后、`const syncedAt` 前插入：

```js
  const maps = transformMaps(mapsZh, mapsEn);
  validateMaps(maps);
```

（transform/validate agents 与 weapons 的现有调用保持不动）

6）写入块追加一行（weapons.json 写入之后）：

```js
  await atomicWrite(path.join(DATA_DIR, 'maps.json'), { syncedAt, version: version.versionNumber, maps });
```

7）完成日志行改为：

```js
  console.log(`[sync] 完成：agents=${agents.length} weapons=${weapons.length} maps=${maps.length} version=${version.versionNumber}`);
```

- [ ] **Step 2: 运行同步**

Run: `pnpm sync`
Expected: `[sync] 完成：agents=29 weapons=21 maps=26 version=13.06...`（27 条去重后 26）；`src/data/maps.json` 出现

- [ ] **Step 3: 数据抽查**

Run: `node -e "const m=require('./src/data/maps.json');console.log(m.maps.length, m.maps.map(x=>x.zh.name+'/'+x.en.name).slice(0,3).join(', '))"`
Expected: 地图数 + 前三张中英名（如 `11 亚海悬城/Ascent, ...`，zh 名以 API 返回为准）

- [ ] **Step 4: 全量测试无回归**

Run: `pnpm test`
Expected: 34 passed（27 + transform 4 + validate 3）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(p1): sync CLI 支持 maps 同步并生成地图数据快照"
```

---

### Task P1-3: MapCard 组件

**Files:**
- Create: `src/components/MapCard.astro`
- Test: `tests/components/MapCard.test.ts`

- [ ] **Step 1: 写失败测试 tests/components/MapCard.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as Container } from 'astro/container';
import MapCard from '../../src/components/MapCard.astro';

const sampleMap = {
  id: 'ascent', uuid: 'u',
  zh: { name: '亚海悬城', description: '', tacticalDescription: '' },
  en: { name: 'Ascent', description: '', tacticalDescription: '' },
  coordinates: "45°26'33\" N, 12°20'18\" E", displayIcon: 'https://example.com/ascent.png', splash: '',
};

describe('MapCard', () => {
  it('渲染中英文名、坐标并链接到详情页', async () => {
    const container = await Container.create();
    const html = await container.renderToString(MapCard, { props: { map: sampleMap } });
    expect(html).toContain('亚海悬城');
    expect(html).toContain('Ascent');
    expect(html).toContain('href="/maps/ascent/"');
  });

  it('战术图懒加载与 onerror 降级', async () => {
    const container = await Container.create();
    const html = await container.renderToString(MapCard, { props: { map: sampleMap } });
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('onerror');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/components/MapCard.test.ts`
Expected: FAIL —— 组件不存在

- [ ] **Step 3: 写 src/components/MapCard.astro**

```astro
---
// 地图卡片：列表页复用
interface Props {
  map: {
    id: string;
    zh: { name: string };
    en: { name: string };
    coordinates: string;
    displayIcon: string;
  };
}
const { map } = Astro.props;
---
<a class="card-cut map-card" href={`/maps/${map.id}/`}>
  <img src={map.displayIcon} alt={map.zh.name} loading="lazy" onerror="this.src='/favicon.svg'" />
  <div class="map-card__name">{map.zh.name}</div>
  <div class="map-card__sub">{map.en.name}</div>
</a>

<style>
  .map-card { display: block; padding: 1rem; text-align: center; }
  .map-card:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .map-card img { width: 100%; aspect-ratio: 1 / 0.625; object-fit: cover; margin-bottom: 0.5rem; }
  .map-card__name { font-weight: 800; }
  .map-card__sub { font-size: 0.75rem; color: var(--val-gray); }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/components/MapCard.test.ts`
Expected: PASS（2 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/components/MapCard.astro tests/components/MapCard.test.ts
git commit -m "feat(p1): MapCard 组件"
```

---

### Task P1-4: 地图列表页

**Files:**
- Create: `src/pages/maps/index.astro`

- [ ] **Step 1: 写 src/pages/maps/index.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import MapCard from '../../components/MapCard.astro';
import mapsData from '../../data/maps.json';

const maps = mapsData.maps;
---
<BaseLayout title="地图库｜无畏契约资料站" description="无畏契约全部地图：官方战术图、背景设定、坐标信息">
  <main class="container section">
    <div class="label-cut">Maps</div>
    <h1>地图库</h1>
    <p class="page-sub">{maps.length} 张地图 · 数据版本 {mapsData.version}</p>
    <div class="grid">
      {maps.map((m) => <MapCard map={m} />)}
    </div>
  </main>
</BaseLayout>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o 'class="card-cut map-card"' dist/maps/index.html | wc -l`
Expected: 与地图总数一致（26）

- [ ] **Step 3: Commit**

```bash
git add src/pages/maps/index.astro
git commit -m "feat(p1): 地图列表页"
```

---

### Task P1-5: 地图详情页

**Files:**
- Create: `src/pages/maps/[id].astro`

- [ ] **Step 1: 写 src/pages/maps/[id].astro**

点位攻略遵循 spec"P1 交付基础信息先行，攻略渐进补充"——页面用产品化文案说明，不用 TODO 字样。

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import mapsData from '../../data/maps.json';

export function getStaticPaths() {
  return mapsData.maps.map((map) => ({ params: { id: map.id }, props: { map } }));
}
const { map } = Astro.props;
const name = map.zh.name !== map.en.name ? `${map.zh.name} ${map.en.name}` : map.en.name;
---
<BaseLayout
  title={`${name}｜无畏契约资料站`}
  description={`${name}：官方战术图与背景设定。${(map.zh.tacticalDescription || '').slice(0, 50)}`}
>
  <main class="container section">
    <a class="back" href="/maps/">← 返回地图库</a>
    <div class="label-cut">{map.coordinates}</div>
    <h1>{name}</h1>
    <img class="m-img" src={map.displayIcon} alt={name} onerror="this.src='/favicon.svg'" />
    {map.zh.tacticalDescription && <h2>战术要点</h2>}
    {map.zh.tacticalDescription && <p class="m-text">{map.zh.tacticalDescription}</p>}
    {map.zh.description && <h2>背景设定</h2>}
    {map.zh.description && <p class="m-text">{map.zh.description}</p>}
    <h2>点位攻略</h2>
    <p class="m-text">社区点位攻略编写中，本页先呈现官方战术图与设定。想抢先用图？记住两条原则：进攻方看包点入口有哪些掩体，防守方看回防路线要几秒。</p>
    <p class="data-meta">数据版本 {mapsData.version}</p>
  </main>
</BaseLayout>

<style>
  .m-img { width: 100%; max-width: 640px; margin: 1.2rem 0; border: 1px solid var(--val-line); }
  .m-text { color: var(--val-gray); max-width: 46em; margin-bottom: 1rem; }
</style>
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && ls dist/maps/ && grep -o "战术要点\|背景设定\|点位攻略" dist/maps/ascent/index.html | sort | uniq -c`
Expected: `index.html` + 各地图目录；ascent 页含区块标题（无 tacticalDescription 的图会缺"战术要点"区块，属数据驱动预期）

- [ ] **Step 3: Commit**

```bash
git add "src/pages/maps/[id].astro"
git commit -m "feat(p1): 地图详情页（官方战术图 + 设定 + 攻略占位说明）"
```

---

### Task P1-6: esports / patch-notes 内容集合与种子文章

**Files:**
- Modify: `src/content/config.ts`（追加两个集合）
- Create: `src/content/patch-notes/data-synced-13-06.md`、`src/content/patch-notes/how-to-read-patches.md`、`src/content/esports/vct-explained.md`、`src/content/esports/how-to-watch.md`

- [ ] **Step 1: 修改 src/content/config.ts（全文替换为）**

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

const esports = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/esports' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['赛程', '新闻', '赛事科普']),
    excerpt: z.string(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

const patchNotes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/patch-notes' }),
  schema: z.object({
    title: z.string(),
    patchVersion: z.string(),
    excerpt: z.string(),
    source: z.string().url(),
    publishDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { guides, esports, patchNotes };
```

- [ ] **Step 2: 写 src/content/patch-notes/data-synced-13-06.md**

```markdown
---
title: 站点数据已同步至 13.06 版本
patchVersion: 13.06
excerpt: 本站特工、武器、地图数据已跟随国际服 13.06 版本，每日自动同步。
source: https://playvalorant.com/en-us/news/game-updates/
publishDate: 2026-09-30
---

## 数据版本说明

本站的游戏数据来自 [valorant-api.com](https://valorant-api.com)（Riot 官方数据镜像），当前同步版本为 **13.06**（国际服）。GitHub Actions 每天北京时间 11:00 自动拉取最新数据，版本更新后本站会在当天自动跟上，无需人工干预。

- 特工 / 武器 / 地图的名称、技能描述、伤害数值、价格均以数据源为准
- 国际服与国服存在版本时间差，本站数据跟随国际服，页脚会标注当前数据版本号

## 想看官方原文？

版本完整改动清单见 [官方游戏更新页](https://playvalorant.com/en-us/news/game-updates/)（英文），国服更新公告以国服官方渠道为准。
```

- [ ] **Step 3: 写 src/content/patch-notes/how-to-read-patches.md**

```markdown
---
title: 怎么读版本更新：影响你的三类改动
patchVersion: 通用
excerpt: 每次版本更新抓三个重点：武器数值、特工技能、新内容。
source: https://playvalorant.com/en-us/news/game-updates/
publishDate: 2026-09-29
---

## 第一类：武器数值调整

伤害、射速、价格、后坐力的改动直接改变对枪生态。看到常用武器被削不必急着弃用——先去[武器库](/weapons/)对比改动后的数值，很多"削弱"只是把滥用枪械拉回平衡线，熟练度仍然吃得开。

## 第二类：特工技能改动

技能数值（伤害、冷却、范围）和机制改动。技能改动对出场率的影响通常比武器更剧烈：一个技能增强就可能把冷门特工抬上主流。改动后第一件事是去[特工图鉴](/agents/)重读技能描述，确认自己对机制的理解没有过时。

## 第三类：新内容

新特工、新地图、新皮肤。新特工上线首周先在靶场试用技能组，再进对局；新地图则优先花一局人机跑图，记包点入口和回防路线——见[地图库](/maps/)。

## 一句话总结

版本更新不是考试，是换考卷。武器数值看生态位，技能改动看理解差，新内容先熟悉再上分。
```

- [ ] **Step 4: 写 src/content/esports/vct-explained.md**

```markdown
---
title: VCT 是什么：无畏契约电竞体系导读
type: 赛事科普
excerpt: 认识 VCT 的三层结构：赛区联赛、国际大赛、全球冠军赛。
publishDate: 2026-09-28
---

## VCT 三层结构

**VCT（VALORANT Champions Tour）**是无畏契约的全球职业赛事体系，自下而上分三层：

1. **赛区联赛（Region League）**：各赛区（美洲、EMEA、太平洋、CN 等）的常规职业联赛，是每个赛区的基础盘。选手大多从这里被世界看见。
2. **国际大赛（Masters）**：各赛区顶尖战队参加的国际锦标赛，一年多站，赛区强弱的试金石。
3. **全球冠军赛（Champions）**：一年一度的世界总决赛，VCT 赛季的终点。只有全年积分与区域资格赛筛选出的最强战队能站上这个舞台。

## 看懂一支强队要看什么

不是只看击杀数。观察三点：**道具协同**（技能怎么和队友的枪线配合）、**经济决策**（什么分敢强起）、**残局处理**（1v1 的信息利用）。这些和你在排位里要做的是同一件事——只是他们做得更稳。

## 从排位玩家到观众

看比赛是性价比最高的进阶方式：职业选手的站位和技能使用直接可抄。本站后续将跟进赛程速览与赛后资讯。
```

- [ ] **Step 5: 写 src/content/esports/how-to-watch.md**

```markdown
---
title: 从哪里开始看比赛：观赛渠道与观赛姿势
type: 赛事科普
excerpt: 官方直播渠道汇总，以及把比赛看成免费教学的三种姿势。
publishDate: 2026-09-27
---

## 观赛渠道

- **官方直播**：赛事期间在 YouTube 与 Twitch 的官方频道直播（搜索 VALORANT Esports）；国内平台转播以当期赛事公告为准
- **赛后回放**：官方 YouTube 频道提供完整对局回放与精彩集锦
- **赛程查询**：vlr.gg 等第三方数据站提供实时赛程与比分

## 三种观赛姿势

1. **看枪线**：职业哥的准星预瞄位、开枪节奏。注意他们在拐角前如何"架好再走"——这能直接改掉你的追枪坏习惯。
2. **看道具**：技能释放的时机比准度重要。留意先锋的开路顺序、哨卫的防守布置，对照[特工图鉴](/agents/)理解每个技能在团队里的角色。
3. **看经济**：解说报出的经济局选择（eco / 强起 / 全起）对照[经济教学](/guides/economy-basics/)，你会发现职业队的存钱逻辑和教学里写的是同一套。

## 提醒

别只看集锦。完整对局里的回合经济和站位选择才是可学习的部分，集锦看的是热闹，全程看的是门道。
```

- [ ] **Step 6: 构建验证（schema 通过）**

Run: `pnpm build`
Expected: 构建成功，`[content] Synced content` 无报错（此时还没有资讯页面渲染，属预期）

- [ ] **Step 7: Commit**

```bash
git add src/content
git commit -m "feat(p1): esports 与 patch-notes 内容集合及 4 篇种子文章"
```

---

### Task P1-7: 版本资讯页面（列表 + 详情）

**Files:**
- Create: `src/pages/patch-notes/index.astro`、`src/pages/patch-notes/[slug].astro`

- [ ] **Step 1: 写 src/pages/patch-notes/index.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';

const notes = (await getCollection('patchNotes', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
---
<BaseLayout title="版本资讯｜无畏契约资料站" description="无畏契约版本更新导读与本站数据同步说明">
  <main class="container section">
    <div class="label-cut">Patch Notes</div>
    <h1>版本资讯</h1>
    <p class="page-sub">数据每日自动同步 · 版本导读持续更新</p>
    <ul class="note-list">
      {notes.map((n) => (
        <li class="card-cut note-item">
          <a class="note-item__title" href={`/patch-notes/${n.id}/`}>{n.data.title}</a>
          <p class="note-item__meta">版本 {n.data.patchVersion} · {n.data.publishDate.toLocaleDateString('zh-CN')}</p>
          <p class="note-item__excerpt">{n.data.excerpt}</p>
        </li>
      ))}
    </ul>
  </main>
</BaseLayout>

<style>
  .note-list { list-style: none; display: grid; gap: 0.75rem; }
  .note-item { padding: 1rem 1.2rem; }
  .note-item__title { font-weight: 800; }
  .note-item__title:hover { color: var(--val-red); }
  .note-item__meta { color: var(--val-red); font-size: 0.75rem; margin-top: 0.25rem; }
  .note-item__excerpt { color: var(--val-gray); font-size: 0.85rem; margin-top: 0.25rem; }
</style>
```

- [ ] **Step 2: 写 src/pages/patch-notes/[slug].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const notes = await getCollection('patchNotes', ({ data }) => !data.draft);
  return notes.map((note) => ({ params: { slug: note.id }, props: { note } }));
}
const { note } = Astro.props;
const { Content } = await render(note);
---
<BaseLayout title={`${note.data.title}｜无畏契约资料站`} description={note.data.excerpt}>
  <main class="container section">
    <a class="back" href="/patch-notes/">← 返回版本资讯</a>
    <div class="label-cut">{note.data.patchVersion !== '通用' ? `版本 ${note.data.patchVersion}` : '版本导读'}</div>
    <h1>{note.data.title}</h1>
    <p class="data-meta" style="margin-top:0.3rem">{note.data.publishDate.toLocaleDateString('zh-CN')}</p>
    <article class="prose"><Content /></article>
  </main>
</BaseLayout>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build && ls dist/patch-notes/ && grep -o 'href="/patch-notes/[^"]*"' dist/patch-notes/index.html | sort -u | wc -l`
Expected: `index.html` + 2 个文章目录；列表页链接去重后 = 3（含"返回列表"自链或 2 篇文章链接 + 列表自身；以实际为准 ≥ 2）

- [ ] **Step 4: Commit**

```bash
git add src/pages/patch-notes
git commit -m "feat(p1): 版本资讯列表与详情页"
```

---

### Task P1-8: 电竞资讯页面（列表 + 详情）

**Files:**
- Create: `src/pages/esports/index.astro`、`src/pages/esports/[slug].astro`

- [ ] **Step 1: 写 src/pages/esports/index.astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';

const posts = (await getCollection('esports', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
---
<BaseLayout title="电竞资讯｜无畏契约资料站" description="VCT 赛事体系导读、观赛指南与赛事资讯">
  <main class="container section">
    <div class="label-cut">Esports</div>
    <h1>电竞资讯</h1>
    <p class="page-sub">赛事科普 · 观赛指南 · 赛程资讯</p>
    <ul class="note-list">
      {posts.map((p) => (
        <li class="card-cut note-item">
          <a class="note-item__title" href={`/esports/${p.id}/`}>{p.data.title}</a>
          <p class="note-item__meta">{p.data.type} · {p.data.publishDate.toLocaleDateString('zh-CN')}</p>
          <p class="note-item__excerpt">{p.data.excerpt}</p>
        </li>
      ))}
    </ul>
  </main>
</BaseLayout>

<style>
  .note-list { list-style: none; display: grid; gap: 0.75rem; }
  .note-item { padding: 1rem 1.2rem; }
  .note-item__title { font-weight: 800; }
  .note-item__title:hover { color: var(--val-red); }
  .note-item__meta { color: var(--val-red); font-size: 0.75rem; margin-top: 0.25rem; }
  .note-item__excerpt { color: var(--val-gray); font-size: 0.85rem; margin-top: 0.25rem; }
</style>
```

- [ ] **Step 2: 写 src/pages/esports/[slug].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('esports', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
const { Content } = await render(post);
---
<BaseLayout title={`${post.data.title}｜无畏契约资料站`} description={post.data.excerpt}>
  <main class="container section">
    <a class="back" href="/esports/">← 返回电竞资讯</a>
    <div class="label-cut">{post.data.type}</div>
    <h1>{post.data.title}</h1>
    <p class="data-meta" style="margin-top:0.3rem">{post.data.publishDate.toLocaleDateString('zh-CN')}</p>
    <article class="prose"><Content /></article>
  </main>
</BaseLayout>
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build && ls dist/esports/`
Expected: `index.html` + 2 个文章目录

- [ ] **Step 4: Commit**

```bash
git add src/pages/esports
git commit -m "feat(p1): 电竞资讯列表与详情页"
```

---

### Task P1-9: 导航、Footer 与首页资讯区块

**Files:**
- Modify: `src/components/NavBar.astro`、`src/components/Footer.astro`、`src/pages/index.astro`

- [ ] **Step 1: 修改 NavBar.astro（items 数组替换为 5 项）**

```astro
---
const items = [
  { href: '/agents/', label: '特工' },
  { href: '/weapons/', label: '武器' },
  { href: '/maps/', label: '地图' },
  { href: '/guides/', label: '教学' },
  { href: '/esports/', label: '资讯' },
];
---
```

（header/nav 结构与 scoped 样式保持不动）

- [ ] **Step 2: 修改 Footer.astro（正文 p 标签之前加站内链接区）**

在 `<p>数据来源：…` 这一行之前插入：

```astro
    <nav class="footer__links">
      <a href="/patch-notes/">版本资讯</a>
      <a href="/esports/">电竞资讯</a>
      <a href="/maps/">地图库</a>
    </nav>
```

scoped 样式里追加：

```css
  .footer__links { display: flex; gap: 1rem; margin-bottom: 0.4rem; font-weight: 700; }
  .footer__links a:hover { color: var(--val-red); }
```

- [ ] **Step 3: 修改 index.astro（frontmatter 追加 + 新区块）**

frontmatter 的 import 与取数追加：

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import AgentCard from '../components/AgentCard.astro';
import agentsData from '../data/agents.json';
import mapsData from '../data/maps.json';
import { getCollection } from 'astro:content';

const featuredAgents = agentsData.agents.slice(0, 6);
const featuredMaps = mapsData.maps.slice(0, 4);
const guides = (await getCollection('guides', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
  .slice(0, 3);
const patchNotes = (await getCollection('patchNotes', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
  .slice(0, 2);
const esports = (await getCollection('esports', ({ data }) => !data.draft))
  .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
  .slice(0, 2);
---
```

`<main>` 内"最新教学"区块之后、`</main>` 之前插入两个区块：

```astro
    <section class="container section-block">
      <h2>地图速览</h2>
      <div class="grid grid--wide">
        {featuredMaps.map((m) => (
          <a class="card-cut map-tease" href={`/maps/${m.id}/`}>
            <img src={m.splash || m.displayIcon} alt={m.zh.name} loading="lazy" onerror="this.src='/favicon.svg'" />
            <span class="map-tease__name">{m.zh.name}</span>
          </a>
        ))}
      </div>
      <p class="more"><a href="/maps/">全部地图 →</a></p>
    </section>
    <section class="container section-block">
      <h2>最新资讯</h2>
      <ul class="note-list">
        {patchNotes.map((n) => (
          <li class="card-cut note-item">
            <a class="note-item__title" href={`/patch-notes/${n.id}/`}>{n.data.title}</a>
            <p class="note-item__meta">版本 {n.data.patchVersion}</p>
          </li>
        ))}
        {esports.map((p) => (
          <li class="card-cut note-item">
            <a class="note-item__title" href={`/esports/${p.id}/`}>{p.data.title}</a>
            <p class="note-item__meta">{p.data.type}</p>
          </li>
        ))}
      </ul>
    </section>
```

scoped 样式追加（已有样式保持不动）：

```css
  .grid--wide { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .map-tease { position: relative; overflow: hidden; }
  .map-tease img { aspect-ratio: 16 / 9; object-fit: cover; width: 100%; }
  .map-tease__name { position: absolute; left: 0.8rem; bottom: 0.6rem; font-weight: 800; text-shadow: 0 1px 4px rgba(0,0,0,.9); }
  .note-list { list-style: none; display: grid; gap: 0.75rem; }
  .note-item { padding: 1rem 1.2rem; }
  .note-item__title { font-weight: 800; }
  .note-item__title:hover { color: var(--val-red); }
  .note-item__meta { color: var(--val-red); font-size: 0.75rem; margin-top: 0.25rem; }
```

- [ ] **Step 4: 构建验证**

Run: `pnpm build && grep -o '地图速览\|最新资讯' dist/index.html | sort | uniq -c`
Expected: 各 1；`grep -o 'href="/maps/' dist/index.html | wc -l` ≥ 5（4 卡 + 全部地图入口）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(p1): 导航加地图/资讯入口，Footer 站内链接，首页地图速览与最新资讯区块"
```

---

### Task P1-10: E2E 扩展与最终全量验证

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`（4 条 → 7 条）

- [ ] **Step 1: smoke.spec.ts 末尾追加 3 条用例**

```ts
test('地图列表可访问', async ({ page }) => {
  await page.goto('/maps/');
  await expect(page.getByRole('heading', { name: '地图库' })).toBeVisible();
  await expect(page.locator('.map-card').first()).toBeVisible();
});

test('版本资讯列表 → 文章详情', async ({ page }) => {
  await page.goto('/patch-notes/');
  await expect(page.getByRole('heading', { name: '版本资讯' })).toBeVisible();
  await page.locator('.note-item__title').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('电竞资讯列表可访问', async ({ page }) => {
  await page.goto('/esports/');
  await expect(page.getByRole('heading', { name: '电竞资讯' })).toBeVisible();
  await expect(page.locator('.note-item__title').first()).toBeVisible();
});
```

- [ ] **Step 2: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、**36 单测全绿**（27+9）、构建成功（58 + 地图 26 + 资讯 4 ≈ 88 页）、**7 条 E2E 全过**

- [ ] **Step 3: 推送部署**

```bash
git push
```

推送后 GitHub Actions verify 自动跑绿、Vercel 自动重新部署，线上应出现新模块。

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(p1): E2E 扩展至 7 条冒烟路径"
git push
```

（Step 3 的 push 若已包含全部提交，可合并到本步一次执行）

---

## Self-Review 记录

1. **Spec 覆盖**：spec 2.1 的 /maps、/maps/[id]、/patch-notes、/esports、/esports/[slug] → P1-4/5/7/8；2.2 P1 三模块齐备；导航决策（5 项 + Footer 版本入口）在计划"关键背景"中显式声明理由；点位攻略遵循 spec 风险表"基础信息先行"。
2. **Placeholder 扫描**：无 TBD/TODO；种子文章 4 篇为全文；地图攻略区块为产品化文案非工程占位。
3. **类型一致性**：transformMaps 产出字段（id/uuid/zh{name,description,tacticalDescription}/en{...}/coordinates/displayIcon/splash）与 MapCard Props、maps/[id] 页面、validateMaps 断言、MapCard 测试 sampleMap 一致；esports schema（type 枚举含"赛事科普"）与两篇种子文章的 type 值一致；patchNotes schema（patchVersion/source 必填）与两篇种子的 frontmatter 一致。
4. **计数核对**：单测 27+4(transform maps 含去重用例)+3(validate maps)+2(MapCard)=36；E2E 4+3=7；页面数 58+26(地图)+4(资讯)=88。