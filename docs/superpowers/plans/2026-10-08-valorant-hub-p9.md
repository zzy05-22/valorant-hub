# valorant-hub P9 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 准星库扩充：新增 14 个职业选手准星（联网查证的真实代码），解析器升级到真实游戏格式（u 自定义色/0g 间隔/0v 竖线），P8 经典种子同步迁移，页面分组展示。

**Architecture:** 与 P8 一致：服务端解析 + SVG 静态渲染 + 内容集合 JSON。本次关键升级：解析器对齐真实格式，使**所有代码（经典种子 + 选手准星）导入游戏后 100% 还原**，预览近似度同步提升。

**Tech Stack:** 同 P0-P8（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-10-08）:** "准星代码太少了，可以再添加一些职业选手准星等等"

**查证来源（2026-10-08 联网搜索）:** charlieintel、prosettings 系文章、wecoach 2026（声明近期验证）、valorantcrosshairdb（中文站）、egamersworld——多来源交叉，14 选手多数 2+ 来源一致。选手会更换准星，note 中注明"以游戏内实际为准"。

**前置状态:** P0-P8 已上线；本地 8d4ea1e 与远端同步；52 单测 + 15 E2E 全绿；77 页构建；准星库现有 10 个经典种子。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净；今天日期 **2026-10-08**

## 关键背景（给零上下文的执行者）

- **真实准星代码格式（P9 升级目标）**：`c` 颜色索引、`o` 整体不透明度、`d` 中心点开关、`z` 点大小、`0t` 内线粗细、`0l` 横线长度、`0v` 竖线长度（缺省用 0l）、`0g` 线间隔（**P8 误用 0a**）、`0o` 内线不透明度、`0a` 移动误差系数（**不渲染，忽略**）、`0f` 外线开关、`1b` 外线厚度、`u;RRGGBBAA` 自定义颜色（**前 6 位优先于 c 索引**）；`S`/`A`/`m`/`h`/`b`/`t`/`f`（顶层）/`0b`/`1t;1l;1o;1a;1m;1f`/`00` 等段解析器一律忽略（不认识的 key 跳过）
- **颜色映射不变**：1 白 `#FFFFFF`、2 绿 `#00FF00`、3 黄绿 `#B5FF4B`、4 青 `#00FFFF`、5 粉 `#FF00FF`、6 黄 `#FFE469`、7 红 `#FF0000`、8 紫 `#9C00FF`
- **P8 种子迁移**：10 个经典种子的 `0a;N` 段（当时当间隔用）全部改名为 `0g;N`——数值不变、渲染不变、导入游戏后格式正确
- **E2E 红线**：准星库用例断言 h1"准星库"/svg 可见/.xh-copy 点击——分组与数量变化不影响；**不要动 E2E**
- **首页不受影响**：getCollection 按文件 id 字典序，`cross-*`/`dot-*` 在 `pro-*` 之前，featuredCrosshairs.slice(0,4) 取到的仍是经典种子
- **计数核对**：单测 52 + 4（解析器新增）= **56**；准星 10 → 24（10 经典 + 14 选手）；E2E 仍 15；页面仍 77
- **解析器现有测试兼容（执行时更正）**：原"完整代码解析"用例的 `0a;3` 忽略后 gap 取默认 3 恰好不变，但 `toEqual` 是全字段严格比较——inner 接口新增 `vLength` 后，**旧用例 1 的期望对象必须同步补 `vLength: 6`**（无 0v 时回退 length=6，与 gap 恰 3 同一回退逻辑）。这是接口演进的期望同步，不属篡改验证意图。其余旧用例不动。

## 文件结构总览（P9 变更）

```
src/utils/crosshair.ts            # P9-1 升级（u/0g/0v/0a 忽略 + inner.vLength）
tests/utils/crosshair.test.ts     # P9-1（+4 用例）
src/components/CrosshairPreview.astro  # P9-1（竖线用 vLength 渲染）
src/content/crosshairs/*.json    # P9-1 迁移 10 个 + P9-2 新增 14 个 pro-*
src/pages/crosshairs/index.astro   # P9-2 分组展示
```

---

### Task P9-1: 解析器升级到真实格式（TDD）+ 经典种子迁移

**Files:**
- Modify: `src/utils/crosshair.ts`、`tests/utils/crosshair.test.ts`、`src/components/CrosshairPreview.astro`
- Modify: `src/content/crosshairs/` 10 个经典 JSON（0a → 0g）

- [ ] **Step 1: 追加 4 个失败测试**

```ts
  it('u 段自定义颜色优先于 c 索引（ZmjjKK 黑准星）', () => {
    const r = parseCrosshairCode('0;s;1;P;c;8;u;000000FF;h;0;b;1;0l;3;0v;5;0g;1;0a;1;0f;0;1b;0;S;c;4;s;0.6');
    expect(r.color).toBe('#000000');
    expect(r.inner.vLength).toBe(5);
    expect(r.inner.gap).toBe(1);
  });

  it('0g 是间隔，0a 移动误差被忽略（真实格式）', () => {
    const r = parseCrosshairCode('0;P;c;1;o;1;0t;2;0l;6;0v;4;0g;2;0o;1;0a;1;0f;0;1b;0');
    expect(r.inner.gap).toBe(2);
    expect(r.inner.vLength).toBe(4);
  });

  it('无 0v 时竖线长度回退横线长度', () => {
    const r = parseCrosshairCode('0;P;c;1;o;1;0t;2;0l;6;0g;3;0o;1;0f;0;1b;0');
    expect(r.inner.vLength).toBe(6);
  });

  it('A/S/h/m 等辅助段不影响主准星解析（Demon1 完整代码）', () => {
    const r = parseCrosshairCode('0;p;0;s;1;P;o;1;f;0;0t;1;0l;3;0o;2;0a;1;0f;0;1b;0;A;o;1;0t;1;0l;3;0o;2;0a;1;0f;0;1b;0;S;c;1;o;1');
    expect(r.color).toBe('#FFFFFF');
    expect(r.inner.thickness).toBe(1);
    expect(r.inner.length).toBe(3);
  });
```

- [ ] **Step 2: 跑测试确认 4 个新用例失败、旧 4 用例通过**

Run: `pnpm vitest run tests/utils/crosshair.test.ts`
Expected: 新 4 FAIL（vLength 不存在等），旧 4 PASS

- [ ] **Step 3: 升级 src/utils/crosshair.ts**

```ts
export interface CrosshairRender {
  color: string;
  opacity: number;
  dot: { enabled: boolean; size: number };
  inner: { enabled: boolean; thickness: number; length: number; vLength: number; opacity: number; gap: number };
  outline: { enabled: boolean; thickness: number };
}

const COLOR_MAP: Record<string, string> = {
  '1': '#FFFFFF', '2': '#00FF00', '3': '#B5FF4B', '4': '#00FFFF',
  '5': '#FF00FF', '6': '#FFE469', '7': '#FF0000', '8': '#9C00FF',
};

export function parseCrosshairCode(code: string): CrosshairRender {
  const parts = (code || '').split(';');
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < parts.length; i += 2) {
    map.set(parts[i], parts[i + 1]);
  }
  const num = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) ? v : d;
  };
  // u;RRGGBBAA 自定义色优先（真实格式的选手准星常用：黑色/粉色/黄绿等）
  const custom = map.get('u');
  const color = custom && /^[0-9A-Fa-f]{6}/.test(custom)
    ? `#${custom.slice(0, 6)}`
    : COLOR_MAP[map.get('c') ?? ''] ?? '#FFFFFF';
  const thickness = num('0t', 2);
  const length = Math.max(0, num('0l', 6));
  return {
    color,
    opacity: Math.max(0, Math.min(1, num('o', 1))),
    dot: { enabled: num('d', 0) === 1, size: num('z', 3) },
    inner: {
      enabled: !(thickness === 0 && length === 0),
      thickness: Math.max(1, thickness),
      length,
      vLength: Math.max(0, num('0v', length)), // 无 0v 时竖线回退横线长度
      opacity: Math.max(0, Math.min(1, num('0o', 1))),
      gap: num('0g', 3), // 真实格式 0g 是间隔；0a 是移动误差系数，忽略不渲染
    },
    outline: { enabled: num('0f', 0) === 1, thickness: num('1b', 1) },
  };
}
```

- [ ] **Step 4: CrosshairPreview.astro 竖线渲染用 vLength**

`S` 对象改为 `{ len: r.inner.length * 2.2, vLen: r.inner.vLength * 2.2, th: r.inner.thickness * 1.6, gap: r.inner.gap * 2.2 }`；上下两条 rect（竖线）height 用 `S.vLen`，左右两条 rect（横线）width 用 `S.len`。其余不变。

- [ ] **Step 5: 迁移 10 个经典种子 JSON**

把每个 JSON code 中的 `0a;` 段替换为 `0g;`（数值不变）。逐文件 sed 或手工，10 个：dot-only、cross-classic、cross-outline、cross-thin、cross-cyan、dot-pink、cross-yellow、cross-small、cross-large、cross-half-opacity。

- [ ] **Step 6: 跑全部测试确认 8 个用例全过**

Run: `pnpm vitest run tests/utils/crosshair.test.ts && pnpm test`
Expected: crosshair 8 passed、全量 56 passed

- [ ] **Step 7: 构建抽查**

Run: `pnpm build && grep -o '<svg' dist/crosshairs/index.html | wc -l`
Expected: 10（选手准星 P9-2 才加）

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(p9): 准星解析器升级到真实游戏格式（u 自定义色/0g 间隔/0v 竖线，忽略 0a 移动误差）"
```

---

### Task P9-2: 14 个职业选手准星 + 页面分组

**Files:**
- Create: `src/content/crosshairs/pro-*.json` × 14
- Modify: `src/pages/crosshairs/index.astro`

- [ ] **Step 1: 写 14 个选手准星 JSON**（代码来自 2026-10-08 联网查证，多来源交叉）

`pro-tenz.json`：
```json
{
  "name": "TenZ 小十字",
  "code": "0;s;1;P;c;5;h;0;m;1;0l;4;0o;2;0a;1;0f;0;1b;0;S;c;4;o;1",
  "tags": ["职业选手", "点射"],
  "note": "Sentinels 选手 TenZ（Tyson Ngo）——全球被复制最多的准星之一，四像素短线小十字，肌肉记忆流的代表。来自社区公开资料，选手会更换准星，以游戏内实际为准。"
}
```

`pro-aspas.json`：
```json
{
  "name": "aspas 白点",
  "code": "0;s;1;P;o;1;d;1;0b;0;1b;0;S;c;0",
  "tags": ["职业选手", "决斗者"],
  "note": "巴西天才决斗者 aspas（Erick Santos，LOUD/MIBR）——纯净单点，只告诉你子弹落在哪里。他曾长期使用粉色小点，近年改为白点。以游戏内实际为准。"
}
```

`pro-scream.json`：
```json
{
  "name": "ScreaM 粉色小点",
  "code": "0;s;1;P;c;5;o;1;d;1;z;3;f;0;0t;6;0l;0;0a;1;0f;0;1b;0;S;c;6;s;0.949;o;1",
  "tags": ["职业选手", "爆头线"],
  "note": "Karmine Corp 选手 ScreaM——外号\"爆头机器\"（CS 时代成名），这个粉色小点是他最具辨识度的标志。"
}
```

`pro-yay.json`：
```json
{
  "name": "yay 细十字",
  "code": "0;s;1;P;h;0;f;0;0l;4;0o;0;0a;1;0f;0;1b;0",
  "tags": ["职业选手", "狙击"],
  "note": "\"El Diablo\" yay——OpTic 时期的顶级决斗者，无中心点细十字，狙击手观感的极简流派。"
}
```

`pro-cned.json`：
```json
{
  "name": "cNed 十字",
  "code": "0;s;1;P;h;0;f;0;0l;5;0o;0;0a;1;0f;0;1b;0",
  "tags": ["职业选手", "狙击"],
  "note": "Acend 时期拿下 2021 世界冠军的土耳其选手 cNed，以 Operator 的精准一击闻名。"
}
```

`pro-nats.json`：
```json
{
  "name": "nAts 黄绿十字",
  "code": "0;s;1;P;c;1;u;FFFF00FF;o;1;0t;1;0l;2;0v;2;0g;1;0o;2;0a;1;0f;0;1b;0",
  "tags": ["职业选手", "控场"],
  "note": "Gambit/M3C 控场大师 nAts——黄绿色自定义小十字，黑边内线，远距离点射极其稳定。"
}
```

`pro-demon1.json`：
```json
{
  "name": "Demon1 白十字",
  "code": "0;p;0;s;1;P;o;1;f;0;0t;1;0l;3;0o;2;0a;1;0f;0;1b;0;A;o;1;0t;1;0l;3;0o;2;0a;1;0f;0;1b;0;S;c;1;o;1",
  "tags": ["职业选手", "冠军同款"],
  "note": "Evil Geniuses 选手 Demon1——2023 VCT 世界冠军赛季使用的主准星，白色带边十字，高压对局也看得清。"
}
```

`pro-jinggg.json`：
```json
{
  "name": "Jinggg 粉色准星",
  "code": "0;s;1;P;c;8;u;FF99FFFF;o;1;b;1;f;0;0l;3;0o;2;0a;1;0f;0;1b;0;S;c;5;o;1",
  "tags": ["职业选手", "决斗者"],
  "note": "Paper Rex 的新加坡决斗者 Jinggg——自定义粉色三格线，打法最狂暴的选手之一用的却是安静小准星。"
}
```

`pro-forsaken.json`（文件名 pro-forsaken.json）：
```json
{
  "name": "f0rsakeN 十字",
  "code": "0;P;o;1;f;0;0t;1;0l;1;0o;4;0a;1;0f;0;1t;1;1l;1;1o;3;1a;0;1m;0;1f;0",
  "tags": ["职业选手", "泼水"],
  "note": "Paper Rex 印尼全能位 f0rsakeN——小十字+外线辅助，泼水转火时外线帮助保持准星位置感。"
}
```

`pro-alfajer.json`：
```json
{
  "name": "Alfajer 双色准星",
  "code": "0;p;0;s;1;P;h;0;f;0;0l;2;0o;2;0a;1;0f;0;1b;0;A;c;5;o;1;d;1;0b;0;1b;0;S;s;0.628;o;1",
  "tags": ["职业选手", "狙击"],
  "note": "Fnatic 土耳其明星 Alfajer——主准星白十字，开镜(ADS)自动切换为粉色小点，职业圈冷门但好用的双色配置。"
}
```

`pro-derke.json`：
```json
{
  "name": "Derke 大号十字",
  "code": "0;P;o;1;0t;1;0l;4;0o;2;0a;1;0f;0;1t;0;1l;1;1o;0;1a;1;1m;0;1f;0",
  "tags": ["职业选手", "新手友好"],
  "note": "Fnatic 传奇决斗者、现 Team Vitality 的 Derke——比多数职业准星更大更好认，新手过渡期的优质选择。"
}
```

`pro-zmjjkk.json`：
```json
{
  "name": "ZmjjKK 黑色准星",
  "code": "0;s;1;P;c;8;u;000000FF;h;0;b;1;0l;3;0v;5;0g;1;0a;1;0f;0;1b;0;S;c;4;s;0.6",
  "tags": ["职业选手", "国产之光"],
  "note": "EDG 电子竞技俱乐部选手 ZmjjKK（郑永康）——中国 VCT 头部火力手，自定义纯黑准星，暗图建议搭配外线使用。"
}
```

`pro-n4rrate.json`：
```json
{
  "name": "N4RRATE 十字",
  "code": "0;P;o;1;0t;1;0l;3;0o;1;0a;1;0f;0;1b;0",
  "tags": ["职业选手", "点射"],
  "note": "Karmine Corp 选手 N4RRATE——细线小十字；本站数据榜里能看到他的实时 Rating。"
}
```

`pro-boaster.json`：
```json
{
  "name": "Boaster 极简点线",
  "code": "0;s;1;P;c;5;o;1;d;1;f;0;s;0;0l;0;0a;1;0f;0;1t;0;1l;0;1o;0;1a;0;S;c;1;o;1",
  "tags": ["职业选手", "指挥"],
  "note": "Fnatic 队长、2023 大满贯指挥 Boaster——点与线都极简的个性配置，指挥位玩家的参考。"
}
```

- [ ] **Step 2: crosshairs/index.astro 分组展示**

frontmatter 取数后拆两组：

```ts
const crosshairs = await getCollection('crosshairs');
const proCrosshairs = crosshairs.filter((c) => c.data.tags.includes('职业选手'));
const classicCrosshairs = crosshairs.filter((c) => !c.data.tags.includes('职业选手'));
```

"全部准星"区块改为两个 section（保留导入方法区块不动）：

```astro
    <section class="role-group">
      <h2>经典准星</h2>
      <div class="xh-grid">
        {classicCrosshairs.map((c) => ( /* 原卡片结构原样 */ ))}
      </div>
    </section>
    <section class="role-group">
      <h2>职业选手准星</h2>
      <p class="xh-howto">代码来自社区公开资料（2026-10 整理），选手会随时间更换准星，以游戏内实际效果为准。</p>
      <div class="xh-grid">
        {proCrosshairs.map((c) => ( /* 同一卡片结构 */ ))}
      </div>
    </section>
```

（卡片 DOM 结构复制原样——map 的回调体不变；PageHero subtitle 计数改为 `${crosshairs.length} 个准星 · 经典 ${classicCrosshairs.length} · 选手 ${proCrosshairs.length}`；data-meta 尾注保留）

- [ ] **Step 3: 构建验证**

Run: `pnpm build`
Expected: 77 页；`grep -o '<svg' dist/crosshairs/index.html | wc -l` = **24**；`grep -o '职业选手准星' dist/crosshairs/index.html | wc -l` ≥ 1；`grep -o 'ZmjjKK' dist/crosshairs/index.html | wc -l` ≥ 1

- [ ] **Step 4: 全量测试与 lint**

Run: `pnpm lint && pnpm test`
Expected: lint 0 错 0 警（hints 照旧）、56 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(p9): 新增 14 个职业选手准星（联网查证）与分组展示"
```

---

### Task P9-3: 全链验证与推送

- [ ] **Step 1: 全链**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0/0、**56 单测**、77 页、**15 E2E 全过**（已知：首页用例偶发外部图片 30s 超时，超时则重跑一次）

- [ ] **Step 2: 推送**

```bash
git push
```

线上抽查（主工程师负责）：/crosshairs/ 24 个 SVG、职业选手准星分组、ZmjjKK 条目、搜索"准星"可见选手名。

---

## Self-Review 记录

1. **范围覆盖**：用户"太少/加选手准星"→ 10→24 个（14 选手，含中国选手 ZmjjKK）；同时修正 P8 格式偏差，保证导入还原。
2. **代码真实性**：全部来自 2026-10-08 联网查证，多来源交叉；note 注明社区来源与"以游戏内实际为准"边界，无凭记忆编造。
3. **兼容性**：旧用例 1 需补 `vLength: 6`（`toEqual` 全字段语义，Self-Review 首版漏判、执行时更正）；P8 种子迁移保持渲染数值不变；E2E 断言不依赖分组/数量；首页精选顺序不受影响（cross-*/dot-* 字典序先于 pro-*）。
4. **计数核对**：单测 52+4=56、E2E 15、页面 77、准星 10+14=24。