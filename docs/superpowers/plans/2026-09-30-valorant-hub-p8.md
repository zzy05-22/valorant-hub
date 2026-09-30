# valorant-hub P8 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除武器展示层（列表/详情/对比工具/首页威力榜板块），新增准星代码模块（/crosshairs/：SVG 实时渲染预览 + 种子准星库 + 一键复制导入代码）。

**Architecture:** 准星解析为纯函数（服务端解析代码→渲染参数），CrosshairPreview 组件 SVG 静态渲染（零客户端负担）；准星数据走内容集合（JSON 手工维护，用户可持续添加）；复制按钮为纯增强 script（无 JS 时页面完整）。武器数据层（sync/validate/测试）保留不动，仅删展示层——未来可随时恢复。

**Tech Stack:** 同 P0-P7（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-09-30）:** "再加入准星代码模块，可以把武器枪型模块删除"——删除范围经方案说明（对比工具与首页威力榜随武器页删除）。

**前置状态:** P0-P7 已上线（https://valoranthub.icu），54 单测 + 16 E2E 全绿，99 页构建。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净；今天日期 2026-09-30

## 关键背景（给零上下文的执行者）

- **准星代码格式**：分号分隔的参数段（`0;P;c;1;o;1;d;1;z;3;0t;2;0l;6;0o;1;0a;3;0f;0;1b;0`）。解析映射（本站自洽定义，预览近似渲染、以游戏内导入效果为准）：`c` 颜色索引（1-8）、`o` 整体不透明度、`d` 中心点开关、`z` 点大小、`0t` 内线粗细、`0l` 内线长度、`0o` 内线不透明度、`0a` 线间隔、`0f` 外线开关、`1b` 外线厚度
- **颜色映射**：1 白 `#FFFFFF`、2 绿 `#00FF00`、3 黄绿 `#B5FF4B`、4 青 `#00FFFF`、5 粉 `#FF00FF`、6 黄 `#FFE469`、7 红 `#FF0000`、8 紫 `#9C00FF`
- **删除红线（E2E 兼容）**：`首页数据榜板块齐全`用例目前断言"武器威力榜" heading——武器威力榜板块删除后该用例必挂，**必须同步改为"热门准星"**（计划 P8-4 已列）
- **数据层保留**：sync 的 weapons 同步、validate、api/transform 的 weapons 测试全部不动；stats.ts 的 rankWeaponDamage 及测试保留（数据能力，未来恢复即用）；**compare.ts 与 WeaponCard 属展示层依赖，删除**
- **计数核对**：单测 54 - 3（compare）- 3（WeaponCard）+ 4（crosshair）= **52**；E2E 16 - 2（武器列表/武器对比）+ 1（准星库）= **15**；页面 99 - 22（weapons 列表+21 详情）- 1（compare）+ 1（crosshairs）= **77**
- **产物验证**：scoped 内联 HTML / 全局样式在 dist/_astro/*.css（已知打包行为）

## 文件结构总览（P8 变更）

```
src/utils/crosshair.ts            # P8-1 新建（解析器纯函数）
tests/utils/crosshair.test.ts     # P8-1
src/components/CrosshairPreview.astro  # P8-2 新建（SVG 渲染）
src/content/config.ts              # P8-2 修改（加 crosshairs 集合）
src/content/crosshairs/*.json     # P8-2 新建 10 个种子
src/pages/crosshairs/index.astro   # P8-2 新建（准星库页面）
src/pages/weapons/（整个目录）    # P8-3 删除（index/[id]/compare）
src/components/WeaponCard.astro   # P8-3 删除
tests/components/WeaponCard.test.ts  # P8-3 删除
src/utils/compare.ts + tests/utils/compare.test.ts  # P8-3 删除
src/components/NavBar.astro       # P8-3 修改（武器 → 准星）
src/pages/index.astro              # P8-3 修改（武器威力榜板块 → 热门准星板块；hero 徽章 21 武器 → 准星数）
src/pages/search.astro            # P8-3 修改（weapons 实体段删、crosshairs 段加）
tests/e2e/smoke.spec.ts          # P8-4（删 2 改 1 加 1）
```

---

### Task P8-1: 准星代码解析器纯函数（TDD）

**Files:**
- Create: `src/utils/crosshair.ts`
- Test: `tests/utils/crosshair.test.ts`

- [ ] **Step 1: 写失败测试 tests/utils/crosshair.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { parseCrosshairCode } from '../../src/utils/crosshair';

describe('parseCrosshairCode', () => {
  it('解析完整代码：颜色/点/内线/外线参数到位', () => {
    const r = parseCrosshairCode('0;P;c;4;o;1;d;1;z;3;0t;2;0l;6;0o;1;0a;3;0f;1;1b;1');
    expect(r.color).toBe('#00FFFF');
    expect(r.opacity).toBe(1);
    expect(r.dot).toEqual({ enabled: true, size: 3 });
    expect(r.inner).toEqual({ enabled: true, thickness: 2, length: 6, opacity: 1, gap: 3 });
    expect(r.outline).toEqual({ enabled: true, thickness: 1 });
  });

  it('缺失参数取默认值（白色小点准星）', () => {
    const r = parseCrosshairCode('0;P;c;1;d;1;z;3');
    expect(r.color).toBe('#FFFFFF');
    expect(r.dot.enabled).toBe(true);
    expect(r.inner.thickness).toBe(2); // 默认粗细 2
  });

  it('颜色索引 6 映射黄色', () => {
    expect(parseCrosshairCode('0;P;c;6;o;1').color).toBe('#FFE469');
  });

  it('空串与非法输入返回默认白色准星', () => {
    const r = parseCrosshairCode('');
    expect(r.color).toBe('#FFFFFF');
    expect(r.inner.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/utils/crosshair.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写 src/utils/crosshair.ts**

```ts
// 准星代码解析器（服务端解析 → 渲染参数结构，CrosshairPreview 与单测共用）
// 代码格式：分号分隔的参数段（缺失参数取默认值）；预览为近似渲染，以游戏内导入效果为准
export interface CrosshairRender {
  color: string;
  opacity: number;
  dot: { enabled: boolean; size: number };
  inner: { enabled: boolean; thickness: number; length: number; opacity: number; gap: number };
  outline: { enabled: boolean; thickness: number };
}

const COLOR_MAP: Record<string, string> = {
  '1': '#FFFFFF', '2': '#00FF00', '3': '#B5FF4B', '4': '#00FFFF',
  '5': '#FF00FF', '6': '#FFE469', '7': '#FF0000', '8': '#9C00FF',
};

export function parseCrosshairCode(code: string): CrosshairRender {
  // 段格式 "key;value"，配对解析
  const parts = (code || '').split(';');
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < parts.length; i += 2) {
    map.set(parts[i], parts[i + 1]);
  }
  const num = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) ? v : d;
  };
  const color = COLOR_MAP[map.get('c') ?? ''] ?? '#FFFFFF';
  const thickness = num('0t', 2);
  return {
    color,
    opacity: Math.max(0, Math.min(1, num('o', 1))),
    dot: { enabled: num('d', 0) === 1, size: num('z', 3) },
    inner: {
      // 内线关闭 = 长度与粗细均为 0（游戏中点掉内线即如此编码）
      enabled: !(thickness === 0 && num('0l', 6) === 0),
      thickness: Math.max(1, thickness),
      length: Math.max(0, num('0l', 6)),
      opacity: Math.max(0, Math.min(1, num('0o', 1))),
      gap: num('0a', 3),
    },
    outline: { enabled: num('0f', 0) === 1, thickness: num('1b', 1) },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/utils/crosshair.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/utils/crosshair.ts tests/utils/crosshair.test.ts
git commit -m "feat(p8): 准星代码解析器纯函数（TDD）"
```

---

### Task P8-2: CrosshairPreview 组件 + 种子数据 + 准星库页面

**Files:**
- Create: `src/components/CrosshairPreview.astro`、`src/pages/crosshairs/index.astro`
- Modify: `src/content/config.ts`（加 crosshairs 集合）
- Create: `src/content/crosshairs/` 10 个 JSON

- [ ] **Step 1: config.ts 加 crosshairs 集合（collections 导出前）**

```ts
const crosshairs = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/crosshairs' }),
  schema: z.object({
    name: z.string(),
    code: z.string(),
    tags: z.array(z.string()),
    note: z.string(),
  }),
});
```

`export const collections = { guides, esports, patchNotes, mapGuides, lineups, crosshairs };`

- [ ] **Step 2: 写 10 个种子准星 JSON（参数自洽构造）**

`src/content/crosshairs/dot-only.json`：

```json
{
  "name": "极简小点",
  "code": "0;P;c;1;o;1;d;1;z;3;0t;0;0l;0;0o;0;0a;1;0f;0;1b;0",
  "tags": ["新手友好", "点射"],
  "note": "只有一个中心白点，不遮挡视野，点射稳。最适合刚从 CS 转来的玩家适应弹道。"
}
```

`cross-classic.json`：

```json
{
  "name": "经典十字",
  "code": "0;P;c;1;o;1;d;0;z;1;0t;2;0l;6;0o;1;0a;3;0f;0;1b;0",
  "tags": ["通用", "新手友好"],
  "note": "标准白十字，均衡的长度与间隔，绝大多数场合不出错的选择。"
}
```

`cross-outline.json`：

```json
{
  "name": "空心十字",
  "code": "0;P;c;1;o;1;d;0;z;1;0t;2;0l;6;0o;1;0a;3;0f;1;1b;1",
  "tags": ["通用"],
  "note": "带黑色外线的十字，浅色/雪地图上依然清晰可见。"
}
```

`cross-thin.json`：

```json
{
  "name": "细线十字",
  "code": "0;P;c;1;o;1;d;1;z;2;0t;1;0l=5;0o;1;0a;2;0f;0;1b;0",
  "tags": ["爆头线", "点射"],
  "note": "1 号粗细的细线十字，视野遮挡最小，爆头线更容易贴合头部。"
}
```

**注意**：`0l=5` 是笔误示例——正确写法是 `0l;5`。正确代码：`0;P;c;1;o;1;d;1;z;2;0t;1;0l;5;0o;1;0a;2;0f;0;1b;0`

`cross-cyan.json`：

```json
{
  "name": "青色十字",
  "code": "0;P;c;4;o;1;d;1;z;2;0t;2;0l;5;0o;1;0a;3;0f;0;1b;0",
  "tags": ["高可见", "泼水"],
  "note": "青色在多数地图背景中对比度高，长枪管泼水时也看得清弹道落点。"
}
```

`dot-pink.json`：

```json
{
  "name": "粉色小点",
  "code": "0;P;c;5;o;1;d;1;z;3;0t;0;0l;0;0o;0;0a;1;0f;0;1b;0",
  "tags": ["点射", "狙击"],
  "note": "狙击镜下的小点准星——狙击开镜自带十字，小点仅作腰射参考。"
}
```

`cross-yellow.json`：

```json
{
  "name": "黄色十字",
  "code": "0;P;c;6;o;1;d;1;z;2;0t;2;0l;6;0o;1;0a;3;0f;0;1b;0",
  "tags": ["高可见"],
  "note": "黄色在深色地图（Icebox/映射手）背景上最不糊的色系之一。"
}
```

`cross-small.json`：

```json
{
  "name": "迷你十字",
  "code": "0;P;c;1;o;1;d;1;z;2;0t;2;0l;3;0o;1;0a;2;0f;0;1b;0",
  "tags": ["爆头线", "近战"],
  "note": "短十字，近距离缠斗与贴头线两不误。"
}
```

`cross-large.json`：

```json
{
  "name": "大号十字",
  "code": "0;P;c;1;o;1;d;0;z;1;0t;2;0l;9;0o;1;0a;5;0f;0;1b;0",
  "tags": ["泼水"],
  "note": "长线大间隔十字，泼水压枪时看弹道偏移更直观。"
}
```

`cross-half-opacity.json`：

```json
{
  "name": "半透明十字",
  "code": "0;P;c;1;o;0.5;d;1;z;2;0t;2;0l;6;0o;1;0a;3;0f;0;1b;0",
  "tags": ["视野优先"],
  "note": "整体半透明，准星在视野里但目标永远优先——喜欢极简观感的玩家之选。"
}
```

- [ ] **Step 3: 写 src/components/CrosshairPreview.astro（SVG 服务端渲染）**

```astro
---
// 准星 SVG 预览：服务端解析代码渲染，零客户端 JS
import { parseCrosshairCode } from '../utils/crosshair';

interface Props {
  code: string;
  size?: number;
}
const { code, size = 64 } = Astro.props;
const r = parseCrosshairCode(code);

// 64×64 视窗缩放：游戏内长度 1-10 映射 ×2.2，粗细 1-6 映射 ×1.6
const S = { len: r.inner.length * 2.2, th: r.inner.thickness * 1.6, gap: r.inner.gap * 2.2 };
const C = 32;
const outlineW = r.outline.enabled ? Math.max(1, r.outline.thickness) : 0;
const innerOpacity = r.inner.opacity * r.opacity;
---
<svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="准星预览" style="display:block">
  {r.inner.enabled && r.inner.length > 0 && (
    <g>
      {outlineW > 0 && (
        <g fill="rgba(0,0,0,.85)">
          <rect x={C - S.th / 2 - outlineW} y={C - S.gap - S.len - outlineW} width={S.th + outlineW * 2} height={S.len + outlineW * 2} />
          <rect x={C - S.th / 2 - outlineW} y={C + S.gap - outlineW} width={S.th + outlineW * 2} height={S.len + outlineW * 2} />
          <rect x={C - S.gap - S.len - outlineW} y={C - S.th / 2 - outlineW} width={S.len + outlineW * 2} height={S.th + outlineW * 2} />
          <rect x={C + S.gap - outlineW} y={C - S.th / 2 - outlineW} width={S.len + outlineW * 2} height={S.th + outlineW * 2} />
        </g>
      )}
      <g fill={r.color} opacity={innerOpacity}>
        <rect x={C - S.th / 2} y={C - S.gap - S.len} width={S.th} height={S.len} />
        <rect x={C - S.th / 2} y={C + S.gap} width={S.th} height={S.len} />
        <rect x={C - S.gap - S.len} y={C - S.th / 2} width={S.len} height={S.th} />
        <rect x={C + S.gap} y={C - S.th / 2} width={S.len} height={S.th} />
      </g>
    </g>
  )}
  {r.dot.enabled && (
    <circle cx={C} cy={C} r={Math.max(0.8, r.dot.size * 0.7)} fill={r.color} opacity={r.opacity} />
  )}
</svg>
```

- [ ] **Step 4: 写 src/pages/crosshairs/index.astro（准星库页面）**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import PageHero from '../../components/PageHero.astro';
import CrosshairPreview from '../../components/CrosshairPreview.astro';
import { getCollection } from 'astro:content';

const crosshairs = await getCollection('crosshairs');
---
<BaseLayout title="准星库｜无畏契约资料站" description="热门准星代码合集：SVG 实时预览、一键复制，游戏内导入即用">
  <PageHero label="Crosshairs" title="准星库" subtitle={`${crosshairs.length} 个准星 · 预览为近似渲染 · 以游戏内导入效果为准`} />
  <main class="container section">
    <section class="role-group">
      <h2>导入方法</h2>
      <p class="xh-howto">
        游戏内 <b>设置 → 十字准星 → 准星配置</b> → 点击 <b>导入配置代码</b> → 粘贴本页任意准星的代码 → 确定。想分享自己的准星？同样页面点击<b>复制配置代码</b>。
      </p>
    </section>
    <section class="role-group">
      <h2>全部准星</h2>
      <div class="xh-grid">
        {crosshairs.map((c) => (
          <div class="card-cut xh-card">
            <div class="xh-card__preview"><CrosshairPreview code={c.data.code} size={72} /></div>
            <div class="xh-card__info">
              <b>{c.data.name}</b>
              <div class="xh-card__tags">{c.data.tags.map((t) => <span>{t}</span>)}</div>
              <p>{c.data.note}</p>
            </div>
            <div class="xh-card__code">
              <code>{c.data.code}</code>
              <button type="button" class="btn btn-primary xh-copy" data-code={c.data.code}>复制代码</button>
            </div>
          </div>
        ))}
      </div>
    </section>
    <p class="data-meta">准星由社区整理；预览为参数近似渲染，实际以游戏内效果为准。想上架你的准星？在 src/content/crosshairs/ 加一个 JSON 即可。</p>
    <script type="application/json" id="xh-data" set:html={JSON.stringify({})} />
  </main>
</BaseLayout>

<script>
  // 复制按钮（纯增强：无 JS 时页面完整，仅复制不可用）
  const btns = document.querySelectorAll<HTMLButtonElement>('.xh-copy');
  btns.forEach((b) => {
    b.addEventListener('click', async () => {
      const code = b.dataset.code ?? '';
      try {
        await navigator.clipboard.writeText(code);
        b.textContent = '已复制 ✓';
      } catch {
        // clipboard 不可用时退化为选中代码文本
        const codeEl = b.parentElement?.querySelector('code');
        if (codeEl) {
          const range = document.createRange();
          range.selectNodeContents(codeEl);
          const sel = getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          b.textContent = '已选中，Ctrl+C 复制';
        }
      }
      setTimeout(() => { b.textContent = '复制代码'; }, 1500);
    });
  });
</script>

<style>
  .xh-howto { color: var(--val-gray); max-width: 46em; font-size: 0.9rem; line-height: 1.8; }
  .xh-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  @media (max-width: 768px) { .xh-grid { grid-template-columns: 1fr; } }
  .xh-card { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .xh-card__preview { background: rgba(236, 232, 225, 0.04); border-radius: 12px; padding: 0.8rem; display: flex; align-items: center; justify-content: center; }
  .xh-card__info b { color: var(--val-cream); font-size: 1rem; }
  .xh-card__tags { display: flex; gap: 0.4rem; margin: 0.35rem 0; flex-wrap: wrap; }
  .xh-card__tags span { background: rgba(255, 70, 85, 0.12); color: var(--val-red); font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
  .xh-card__info p { color: var(--val-gray); font-size: 0.82rem; line-height: 1.6; }
  .xh-card__code { display: flex; align-items: center; gap: 0.6rem; }
  .xh-card__code code { flex: 1; font-family: ui-monospace, monospace; font-size: 0.68rem; color: var(--val-gray); background: rgba(236, 232, 225, 0.04); padding: 0.5rem 0.6rem; overflow-x: auto; white-space: nowrap; }
  .xh-copy { font-size: 0.72rem; padding: 0.5rem 0.9rem; white-space: nowrap; }
</style>
```

（注意：`<script type="application/json" id="xh-data">` 行**不需要**——本页无 set:html 数据注入需求，删除该行，防止照抄冗余）

- [ ] **Step 5: 构建验证**

Run: `pnpm build && ls dist/crosshairs/ && grep -o '准星库' dist/crosshairs/index.html | wc -l`
Expected: index.html 存在、准星库 ≥ 1；`grep -o '<svg' dist/crosshairs/index.html | wc -l` = 10（十个准星 SVG 全渲染）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(p8): 准星库页面（SVG 预览 + 10 个种子准星 + 一键复制）"
```

---

### Task P8-3: 武器模块删除与导航/首页/搜索替换

**Files:**
- Delete: `src/pages/weapons/`（3 文件）、`src/components/WeaponCard.astro`、`tests/components/WeaponCard.test.ts`、`src/utils/compare.ts`、`tests/utils/compare.test.ts`
- Modify: `src/components/NavBar.astro`、`src/pages/index.astro`、`src/pages/search.astro`

- [ ] **Step 1: 删除武器展示层文件**

```bash
git rm -r src/pages/weapons
git rm src/components/WeaponCard.astro tests/components/WeaponCard.test.ts src/utils/compare.ts tests/utils/compare.test.ts
```

- [ ] **Step 2: NavBar.astro 替换武器项**

```
旧：{ href: '/weapons/', label: '武器' },
新：{ href: '/crosshairs/', label: '准星' },
```

- [ ] **Step 3: index.astro 三处替换**

1）frontmatter：删除武器榜相关三行（topWeapons/maxHead 定义与 rankWeaponDamage import 保留语句中删掉 `rankWeaponDamage`——import 行改为只导入 `roleDistribution, lineupContributors`），新增准星取数：

```ts
import CrosshairPreview from '../components/CrosshairPreview.astro';
const featuredCrosshairs = (await getCollection('crosshairs')).slice(0, 4);
```

2）hero 浮动徽章第二项替换：

```
旧：<div class="card-cut hero6__stat floaty" style="animation-delay:1s"><b style="color:#FF4655">21</b><span>武器 WEAPONS</span></div>
新：<div class="card-cut hero6__stat floaty" style="animation-delay:1s"><b style="color:#FF4655">{featuredCrosshairs.length + 6}</b><span>准星 CROSSHAIRS</span></div>
```

（数值示意——直接写死 `10` 亦可，展示种子总数；用 `{crosshairs.length}` 需 frontmatter 取全量。简化：写死 10）

3）武器威力榜板块整体替换为热门准星板块：

```
旧：<!-- ⑥ 武器威力榜 TOP6 --> …（整个 block6 section，含 topWeapons map 与 board6__foot）
新：<!-- ⑥ 热门准星（武器模块删除后的对等板块） -->
<section class="block6">
  <header class="block6__head"><h2>热门准星</h2><span class="block6__en">CROSSHAIRS</span><a class="block6__more" href="/crosshairs/">全部准星 →</a></header>
  <div class="block6__grid block6__grid--wide">
    {featuredCrosshairs.map((c) => (
      <div class="card-cut card-lift" style="display:flex;align-items:center;gap:.8rem;padding:.9rem">
        <CrosshairPreview code={c.data.code} size={56} />
        <div>
          <b style="color:var(--val-cream);font-size:.92rem;display:block">{c.data.name}</b>
          <span style="color:var(--val-gray);font-size:.72rem">{c.data.tags.join(' · ')}</span>
        </div>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 4: search.astro 索引替换**

1）weapons 实体段删除（`...weaponsData.weapons.map(...)` 整段 + 若 weaponsData import 不再使用则删除 import）

2）新增准星实体段（在 maps 段之后）：

```ts
  ...(await getCollection('crosshairs')).map((c) => ({
    type: '准星', title: c.data.name, sub: c.data.tags.join(' '), url: '/crosshairs/',
  })),
```

- [ ] **Step 5: 构建验证**

Run: `pnpm build`
Expected: 构建成功、**77 页**（99 - 22 - 1 + 1）
Run: `ls dist/weapons 2>&1 | head -1`（应不存在）；`grep -o '>准星<' dist/index.html | wc -l` ≥ 1（导航项）；`grep -o '热门准星' dist/index.html | wc -l` ≥ 1（首页板块）；`grep -o '武器威力榜' dist/index.html | wc -l` = 0（旧板块移除）

- [ ] **Step 6: 全量测试**

Run: `pnpm test`
Expected: **52 passed**（54 - compare 3 - WeaponCard 3 + crosshair 4）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(p8): 删除武器展示层，导航/首页/搜索替换为准星模块"
```

---

### Task P8-4: E2E 调整与最终全量验证

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`（16 → 15 条）

- [ ] **Step 1: 三处调整**

1）删除用例 `武器列表可访问` 与 `武器对比：勾选武器后出现对比卡`（整段删除）

2）`首页数据榜板块齐全` 用例的武器断言替换：

```
旧：await expect(page.getByRole('heading', { name: '武器威力榜' })).toBeVisible();
新：await expect(page.getByRole('heading', { name: '热门准星' })).toBeVisible();
```

3）末尾追加准星库用例：

```ts
test('准星库页面与预览复制', async ({ page }) => {
  await page.goto('/crosshairs/');
  await expect(page.getByRole('heading', { name: '准星库' })).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();
  await page.locator('.xh-copy').first().click();
  await expect(page.locator('.xh-copy').first()).toContainText(/已复制|已选中/);
});
```

- [ ] **Step 2: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、**52 单测全绿**、**77 页构建**、**15 条 E2E 全过**

- [ ] **Step 3: 提交并推送**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(p8): E2E 调整至 15 条（准星库冒烟，武器用例退场）"
git push
```

推送触发 GitHub Actions verify 与 Vercel 自动部署；线上抽查：/crosshairs/ 渲染与复制、导航准星项、首页热门准星板块、/weapons/ 404。

---

## Self-Review 记录

1. **范围覆盖**：用户两点全部落地——准星模块（解析器/预览/10 种子/库页/复制，P8-1/2）+ 武器删除（展示层全清，数据层保留可逆，P8-3）。
2. **Placeholder 扫描**：种子 JSON 中 `cross-thin.json` 代码段含笔误标注说明（正文显式更正为 `0l;5`）——执行者必须用更正后的代码；无其他占位。
3. **一致性**：解析映射与种子代码自洽（颜色表/默认值）；CrosshairPreview 服务端解析与解析器共用接口；E2E 武器威力榜断言的连锁更新已列入 P8-4（红线）。
4. **计数核对**：单测 54-6+4=52、E2E 16-2+1=15、页面 99-23+1=77。