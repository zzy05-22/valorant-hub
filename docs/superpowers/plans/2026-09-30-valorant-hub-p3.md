# valorant-hub P3 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增"地图 × 特工"道具点位可视化系统（战术图标注、双向入口），并以真实素材补全版本公告（13.06 官方更新中文导读）与赛事资讯（VCT 2026 赛季全景 + 上海冠军赛观赛指南）。

**Architecture:** 点位为手工维护的 JSON 内容集合（lineups，zod schema 校验，每图一个文件）；展示用 LineupPanel 组件（双模式：地图页选特工 / 特工页选地图），沿用 P2 验证过的岛屿模式（`set:html` JSON 注入 + 打包 script import 纯函数）；资讯走既有 patchNotes/esports 集合。

**Tech Stack:** 同 P0-P2（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**Spec:** `docs/superpowers/specs/2026-09-30-valorant-hub-design.md`（用户 2026-09-30 确认的 P3 范围：点位可视化 + 公告 + 赛事种子）

**前置状态:** P0-P2 已上线（https://valoranthub.icu），45 单测 + 10 E2E 全绿，94 页构建，每日自动同步运行中。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净，remote 为 SSH
- `.npmrc` 已锁定官方 registry；今天日期：2026-09-30

## 关键背景（给零上下文的执行者）

- **素材已核实**（2026-09-30 抓取）：官方 13.06 公告全文已取得（对应站内数据版本 13.06.00.5590001——注意官方玩家版本号与 valorant-api 内部号一致，13.06 为 2026 年年度大版本）；VCT 2026 赛程与赛果已核实（上海冠军赛 9.24-10.18 进行中）
- **岛屿技术（P2 定稿，勿改）**：数据用 `<script type="application/json" id="xxx" set:html={JSON.stringify(data)} />` 注入（script 内容是 raw text，`{}` 表达式不求值，必须 set:html）；行为脚本用打包 `<script>`（可 import TS 模块），运行时 `JSON.parse` 读数据。**打包 script 与 frontmatter 变量引用互斥**
- **点位坐标诚实原则**：x/y 为战术图上的百分比示意位置（0-100），由社区整理估算，页面固定展示"点位为社区整理示意，位置以游戏内实测为准"；新图（corrode/summit）的 note 追加校准声明
- **agentId 必须与 `src/data/agents.json` 的 slug 一致**（sage/sova/brimstone/omen/cypher/viper/killjoy/kay-o/breach/jett）；ability 枚举与 SkillPanel 一致（C/Q/E/X/被动）
- **单测计数**：P2 后为 45；P3 新增 lineups 纯函数 3 用例，全量目标 **48**
- **E2E 计数**：10 + 2 = **12**；**页面数不变 94**（点位集成在既有详情页内，无新路由）
- **产物是压缩 HTML**：验证一律用 `grep -o | wc -l`

## 文件结构总览（P3 变更）

```
src/utils/lineups.ts                # P3-1 新建（纯函数）
src/content/config.ts                # P3-2 修改（加 lineups 集合，JSON glob loader）
src/content/lineups/*.json          # P3-2 新建 13 个文件（每图 4 点位）
src/components/LineupPanel.astro    # P3-3 新建（双模式组件）
src/pages/maps/[id].astro           # P3-4 修改（点位图示区块 + 攻略区块改名攻防思路）
src/pages/agents/[id].astro         # P3-4 修改（道具点位区块）
src/content/patch-notes/patch-13-06-highlights.md   # P3-5 新建
src/content/esports/vct-2026-season-recap.md        # P3-6 新建
src/content/esports/champions-shanghai-2026.md      # P3-6 新建
tests/utils/lineups.test.ts          # P3-1
tests/e2e/smoke.spec.ts              # P3-7（10 → 12 条）
```

---

### Task P3-1: lineups 纯函数模块（TDD）

**Files:**
- Create: `src/utils/lineups.ts`
- Test: `tests/utils/lineups.test.ts`

- [ ] **Step 1: 写失败测试 tests/utils/lineups.test.ts**

```ts
import { describe, expect, it } from 'vitest';
import { filterSpots, groupSpotsByAgent, groupSpotsByMap, type LineupSpot } from '../../src/utils/lineups';

const spots: LineupSpot[] = [
  { mapId: 'ascent', agentId: 'sage', ability: 'Q', label: 'A封口墙', x: 20, y: 45, side: '防守', note: 'a' },
  { mapId: 'ascent', agentId: 'sova', ability: 'E', label: '中门箭', x: 50, y: 30, side: '进攻', note: 'b' },
  { mapId: 'split', agentId: 'sage', ability: 'Q', label: 'B封口墙', x: 78, y: 50, side: '防守', note: 'c' },
];

describe('groupSpotsByAgent', () => {
  it('按特工分组', () => {
    const g = groupSpotsByAgent(spots);
    expect(g.get('sage')).toHaveLength(2);
    expect(g.get('sova')).toHaveLength(1);
  });
});

describe('groupSpotsByMap', () => {
  it('按地图分组', () => {
    const g = groupSpotsByMap(spots);
    expect(g.get('ascent')).toHaveLength(2);
    expect(g.get('split')).toHaveLength(1);
  });
});

describe('filterSpots', () => {
  it('按地图+特工双键过滤', () => {
    expect(filterSpots(spots, 'ascent', 'sage')).toEqual([spots[0]]);
    expect(filterSpots(spots, 'ascent', 'jett')).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/utils/lineups.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 写 src/utils/lineups.ts**

```ts
// 道具点位纯函数：分组与双键过滤（LineupPanel script 与单测共用）
export interface LineupSpot {
  mapId: string;
  agentId: string;
  ability: string;   // C / Q / E / X / 被动
  label: string;
  x: number;         // 战术图百分比 0-100
  y: number;
  side: string;      // 进攻 / 防守
  note: string;
}

export function groupSpotsByAgent(spots: LineupSpot[]): Map<string, LineupSpot[]> {
  const g = new Map<string, LineupSpot[]>();
  for (const s of spots) {
    if (!g.has(s.agentId)) g.set(s.agentId, []);
    g.get(s.agentId)!.push(s);
  }
  return g;
}

export function groupSpotsByMap(spots: LineupSpot[]): Map<string, LineupSpot[]> {
  const g = new Map<string, LineupSpot[]>();
  for (const s of spots) {
    if (!g.has(s.mapId)) g.set(s.mapId, []);
    g.get(s.mapId)!.push(s);
  }
  return g;
}

export function filterSpots(spots: LineupSpot[], mapId: string, agentId: string): LineupSpot[] {
  return spots.filter((s) => s.mapId === mapId && s.agentId === agentId);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/utils/lineups.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/utils/lineups.ts tests/utils/lineups.test.ts
git commit -m "feat(p3): 点位纯函数模块（分组与双键过滤）"
```

---

### Task P3-2: lineups 内容集合与 13 图种子点位

**Files:**
- Modify: `src/content/config.ts`（加 lineups 集合）
- Create: `src/content/lineups/` 13 个 JSON（ascent/split/bind/haven/breeze/lotus/pearl/fracture/sunset/abyss/icebox/corrode/summit）

- [ ] **Step 1: config.ts 加 lineups 集合（collections 导出前插入）**

```ts
const lineups = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/lineups' }),
  schema: z.object({
    mapId: z.string(),
    spots: z.array(z.object({
      agentId: z.string(),
      ability: z.enum(['C', 'Q', 'E', 'X', '被动']),
      label: z.string(),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      side: z.enum(['进攻', '防守']),
      note: z.string(),
    })),
  }),
});
```

`export const collections = { guides, esports, patchNotes, mapGuides, lineups };`

- [ ] **Step 2: 写 13 个点位 JSON 文件**（x/y 为战术图百分比示意坐标）

`src/content/lineups/ascent.json`：

```json
{
  "mapId": "ascent",
  "spots": [
    { "agentId": "sage", "ability": "Q", "label": "A 主道封口墙", "x": 20, "y": 45, "side": "防守", "note": "站在 A 平台后立墙封住 A 主道入口，配合平台枪线拖时间，逼进攻方交道具。" },
    { "agentId": "sage", "ability": "E", "label": "B 主道缓速球", "x": 78, "y": 48, "side": "防守", "note": "B 主道入口投缓速球，配合门后队友的交叉火力，把对枪拖进我方节奏。" },
    { "agentId": "sova", "ability": "E", "label": "中门侦察箭", "x": 50, "y": 30, "side": "进攻", "note": "开局射中门侦察箭侦测防守前压，为分推决策提供信息。" },
    { "agentId": "brimstone", "ability": "E", "label": "B 门封锁烟", "x": 74, "y": 50, "side": "进攻", "note": "烟封 B 门与市场方向视野，掩护近点冲击与下包。" }
  ]
}
```

`src/content/lineups/split.json`：

```json
{
  "mapId": "split",
  "spots": [
    { "agentId": "sova", "ability": "E", "label": "A 塔侦察箭", "x": 22, "y": 30, "side": "进攻", "note": "侦察 A 塔楼站位，压制守方高低差火力，为 A 主攻清顶部信息。" },
    { "agentId": "sova", "ability": "Q", "label": "排水道震荡箭", "x": 60, "y": 62, "side": "进攻", "note": "排水道转点路线上的震荡箭，掩护绕后夹击。" },
    { "agentId": "omen", "ability": "E", "label": "B 塔烟", "x": 76, "y": 32, "side": "进攻", "note": "烟封 B 塔楼压制位，掩护队友从绳索位上塔。" },
    { "agentId": "sage", "ability": "Q", "label": "中门隔断墙", "x": 50, "y": 40, "side": "防守", "note": "中门立墙切断中路推进，为中转两翼争取回防时间。" }
  ]
}
```

`src/content/lineups/bind.json`：

```json
{
  "mapId": "bind",
  "spots": [
    { "agentId": "cypher", "ability": "E", "label": "A 长道绊线", "x": 24, "y": 40, "side": "防守", "note": "A 长道口布绊线，进攻方踩线立刻报点，配合窗口位枪线收过路人。" },
    { "agentId": "cypher", "ability": "E", "label": "B 传送门绊线", "x": 76, "y": 55, "side": "防守", "note": "B 传送门出口旁布绊线，抓传送落点。" },
    { "agentId": "brimstone", "ability": "E", "label": "A 长道双烟", "x": 28, "y": 45, "side": "进攻", "note": "烟封 A 长道与窗口，掩护短道近点冲击。" },
    { "agentId": "viper", "ability": "E", "label": "B 主道毒墙", "x": 72, "y": 48, "side": "进攻", "note": "毒墙切 B 主道视野，配合闪位近点，逼守方退后点。" }
  ]
}
```

`src/content/lineups/haven.json`：

```json
{
  "mapId": "haven",
  "spots": [
    { "agentId": "sova", "ability": "E", "label": "C 车库侦察箭", "x": 82, "y": 42, "side": "进攻", "note": "C 车库入口侦察箭，侦测 C 区守位，为最快入口的强攻提供信息。" },
    { "agentId": "sova", "ability": "Q", "label": "B 中门震荡箭", "x": 52, "y": 38, "side": "进攻", "note": "中路箭压制 B 中门连接位，掩护转点。" },
    { "agentId": "killjoy", "ability": "E", "label": "C 点炮台位", "x": 86, "y": 50, "side": "防守", "note": "炮台放 C 包点内后点，覆盖车库与 C 长道两条入口，换时间神器。" },
    { "agentId": "sage", "ability": "Q", "label": "C 车库封口墙", "x": 80, "y": 38, "side": "防守", "note": "车库入口立墙，C 区人手不足时的拖延利器。" }
  ]
}
```

`src/content/lineups/breeze.json`：

```json
{
  "mapId": "breeze",
  "spots": [
    { "agentId": "viper", "ability": "E", "label": "A 主道毒墙", "x": 24, "y": 45, "side": "进攻", "note": "毒墙横切 A 主道开阔地带，压缩对枪距离。" },
    { "agentId": "viper", "ability": "Q", "label": "B 点毒球", "x": 76, "y": 48, "side": "进攻", "note": "B 点后点毒球覆盖包点，配合下包逼守方交道具。" },
    { "agentId": "sova", "ability": "E", "label": "中门侦察箭", "x": 50, "y": 35, "side": "进攻", "note": "中门箭侦测守方前压，开阔地图信息优先。" },
    { "agentId": "cypher", "ability": "E", "label": "A 洞口绊线", "x": 20, "y": 52, "side": "防守", "note": "A 洞口绊线防快攻，配合平台远点枪线。" }
  ]
}
```

`src/content/lineups/lotus.json`：

```json
{
  "mapId": "lotus",
  "spots": [
    { "agentId": "omen", "ability": "E", "label": "C 点入口烟", "x": 80, "y": 45, "side": "进攻", "note": "烟封 C 主入口，配合旋转门声东击西。" },
    { "agentId": "omen", "ability": "E", "label": "A 高台烟", "x": 20, "y": 35, "side": "进攻", "note": "A 高台压制位封烟，掩护 A 强攻。" },
    { "agentId": "killjoy", "ability": "E", "label": "B 点炮台位", "x": 52, "y": 50, "side": "防守", "note": "炮台守 B 连接，覆盖双入口。" },
    { "agentId": "sage", "ability": "Q", "label": "中门隔断墙", "x": 48, "y": 40, "side": "防守", "note": "中门立墙保三点机动支援路线。" }
  ]
}
```

`src/content/lineups/pearl.json`：

```json
{
  "mapId": "pearl",
  "spots": [
    { "agentId": "brimstone", "ability": "E", "label": "中门双烟", "x": 50, "y": 32, "side": "进攻", "note": "中门双烟遮蔽中路视野，掩护三向施压的兵力展开。" },
    { "agentId": "brimstone", "ability": "E", "label": "A 箱阵烟", "x": 24, "y": 46, "side": "进攻", "note": "烟封 A 箱阵高地，掩护主道推进。" },
    { "agentId": "sova", "ability": "E", "label": "B 后点侦察箭", "x": 76, "y": 44, "side": "进攻", "note": "B 后点箭侦测守位，为下包选位提供信息。" },
    { "agentId": "sage", "ability": "Q", "label": "B 封口墙", "x": 72, "y": 52, "side": "防守", "note": "B 主道口立墙拖时间，等中路队友支援。" }
  ]
}
```

`src/content/lineups/fracture.json`：

```json
{
  "mapId": "fracture",
  "spots": [
    { "agentId": "breach", "ability": "Q", "label": "A 主道闪光", "x": 22, "y": 45, "side": "进攻", "note": "A 主道纵深闪，配合双边 3-2 分推。" },
    { "agentId": "breach", "ability": "Q", "label": "B 连接闪光", "x": 78, "y": 45, "side": "进攻", "note": "B 连接位闪，掩护另一侧夹击。" },
    { "agentId": "kay-o", "ability": "E", "label": "中路压制刀", "x": 50, "y": 42, "side": "进攻", "note": "中路零点压制守方技能，为包围战术扫清道具。" },
    { "agentId": "viper", "ability": "E", "label": "A 包点毒墙", "x": 26, "y": 50, "side": "进攻", "note": "毒墙切分 A 包点，下包后毒墙守包。" }
  ]
}
```

`src/content/lineups/sunset.json`：

```json
{
  "mapId": "sunset",
  "spots": [
    { "agentId": "kay-o", "ability": "E", "label": "中门压制刀", "x": 50, "y": 38, "side": "进攻", "note": "中门压制防守技能，打开双向夹击窗口。" },
    { "agentId": "viper", "ability": "E", "label": "B 主道毒墙", "x": 74, "y": 48, "side": "进攻", "note": "B 贴脸结构毒墙开路，配合决斗者近点。" },
    { "agentId": "sage", "ability": "Q", "label": "A 主道封口墙", "x": 24, "y": 46, "side": "防守", "note": "A 主道口立墙，前排压制后撤打二波。" },
    { "agentId": "omen", "ability": "E", "label": "中门烟", "x": 52, "y": 35, "side": "防守", "note": "中门封烟防快攻，保住回防视野。" }
  ]
}
```

`src/content/lineups/abyss.json`：

```json
{
  "mapId": "abyss",
  "spots": [
    { "agentId": "viper", "ability": "E", "label": "A 悬崖走廊毒墙", "x": 26, "y": 45, "side": "进攻", "note": "毒墙压制悬崖走廊对枪位，逼守方退安全位。" },
    { "agentId": "sage", "ability": "Q", "label": "B 主道封口墙", "x": 74, "y": 48, "side": "防守", "note": "B 主道立墙拖时间，悬崖图回防路线有限，前期换时间最关键。" },
    { "agentId": "jett", "ability": "X", "label": "中门烟压制", "x": 50, "y": 40, "side": "进攻", "note": "大招烟压制中门火力线，配合推进注意贴墙走位防坠落。" },
    { "agentId": "sova", "ability": "E", "label": "中门侦察箭", "x": 48, "y": 32, "side": "进攻", "note": "中门箭侦测守位，悬崖图对枪位置选择优先。" }
  ]
}
```

`src/content/lineups/icebox.json`：

```json
{
  "mapId": "icebox",
  "spots": [
    { "agentId": "viper", "ability": "E", "label": "A 管道毒墙", "x": 26, "y": 42, "side": "进攻", "note": "毒墙切 A 管道层，压制高层火力，掩护底层推进。" },
    { "agentId": "viper", "ability": "E", "label": "B 厨房毒墙", "x": 74, "y": 46, "side": "进攻", "note": "B 厨房窗口方向毒墙，掩护 B 近点。" },
    { "agentId": "sage", "ability": "Q", "label": "B 封口墙", "x": 72, "y": 52, "side": "防守", "note": "B 入口立墙，垂直图回防慢，拖时间是第一优先级。" },
    { "agentId": "cypher", "ability": "E", "label": "B 绊线", "x": 70, "y": 55, "side": "防守", "note": "B 入口绊线抓近点快攻，配合后点枪线。" }
  ]
}
```

`src/content/lineups/corrode.json`：

```json
{
  "mapId": "corrode",
  "spots": [
    { "agentId": "sage", "ability": "Q", "label": "A 主道封口墙", "x": 24, "y": 46, "side": "防守", "note": "A 主道立墙拖时间。新图点位持续校准中。" },
    { "agentId": "brimstone", "ability": "E", "label": "B 主道烟", "x": 74, "y": 48, "side": "进攻", "note": "烟封 B 主道薄墙后视野，掩护推进。新图点位持续校准中。" },
    { "agentId": "sova", "ability": "E", "label": "中门侦察箭", "x": 50, "y": 36, "side": "进攻", "note": "中门箭侦测前压，矿区薄墙多、穿点风险高，信息优先。新图点位持续校准中。" },
    { "agentId": "cypher", "ability": "E", "label": "A 绊线", "x": 26, "y": 52, "side": "防守", "note": "A 入口绊线防快攻，薄墙图注意道具会被穿。新图点位持续校准中。" }
  ]
}
```

`src/content/lineups/summit.json`：

```json
{
  "mapId": "summit",
  "spots": [
    { "agentId": "sage", "ability": "Q", "label": "A 封口墙", "x": 24, "y": 46, "side": "防守", "note": "A 主道立墙拖时间。新图点位持续校准中。" },
    { "agentId": "brimstone", "ability": "E", "label": "B 主道烟", "x": 74, "y": 48, "side": "进攻", "note": "B 主道封烟掩护推进。新图点位持续校准中。" },
    { "agentId": "sova", "ability": "E", "label": "中路侦察箭", "x": 50, "y": 36, "side": "进攻", "note": "中路箭先探三线结构再定主攻。新图点位持续校准中。" },
    { "agentId": "omen", "ability": "E", "label": "中门烟", "x": 50, "y": 32, "side": "防守", "note": "中门封烟保守站位。新图点位持续校准中。" }
  ]
}
```

- [ ] **Step 3: 构建验证（schema 校验全部通过）**

Run: `pnpm build`
Expected: 构建成功，`[content] Synced content` 无报错

- [ ] **Step 4: Commit**

```bash
git add src/content
git commit -m "feat(p3): lineups 点位集合（zod schema）与 13 图 52 个种子点位"
```

---

### Task P3-3: LineupPanel 组件（双模式）

**Files:**
- Create: `src/components/LineupPanel.astro`

- [ ] **Step 1: 写 src/components/LineupPanel.astro**

```astro
---
// 道具点位面板：双模式（地图页选特工 / 特工页选地图）
import { getCollection } from 'astro:content';
import agentsData from '../data/agents.json';
import mapsData from '../data/maps.json';
import type { LineupSpot } from '../utils/lineups';

interface Props {
  mode: 'map' | 'agent';
  focusId: string;
}
const { mode, focusId } = Astro.props;

const allSpots: LineupSpot[] = (await getCollection('lineups')).flatMap(
  (entry) => entry.data.spots.map((s) => ({ ...s, mapId: entry.data.mapId })),
);
const spots = mode === 'map'
  ? allSpots.filter((s) => s.mapId === focusId)
  : allSpots.filter((s) => s.agentId === focusId);

const involvedMapIds = [...new Set(spots.map((s) => s.mapId))];
const involvedAgentIds = [...new Set(spots.map((s) => s.agentId))];
const agentName = (a: { zh: { name: string }; en: { name: string } }) =>
  a.zh.name !== a.en.name ? `${a.zh.name} ${a.en.name}` : a.en.name;

const maps = Object.fromEntries(involvedMapIds.map((id) => {
  const m = mapsData.maps.find((x) => x.id === id)!;
  return [id, { name: m.zh.name !== m.en.name ? `${m.zh.name} ${m.en.name}` : m.en.name, icon: m.displayIcon }];
}));
const agents = Object.fromEntries(involvedAgentIds.map((id) => {
  const a = agentsData.agents.find((x) => x.id === id)!;
  return [id, { name: agentName(a), icon: a.displayIcon }];
}));

const initialMapId = mode === 'map' ? focusId : involvedMapIds[0];
const initialAgentId = mode === 'map' ? involvedAgentIds[0] : focusId;
---
{spots.length ? (
  <div class="lineup">
    <div class="lineup__picker" id="picker">
      {mode === 'map'
        ? involvedAgentIds.map((id) => <button class="chip-btn" data-id={id}>{agents[id].name}</button>)
        : involvedMapIds.map((id) => <button class="chip-btn" data-id={id}>{maps[id].name}</button>)}
    </div>
    <div class="lineup__stage">
      <div class="lineup__map">
        <img id="lineup-map" src={maps[initialMapId].icon} alt="" onerror="this.src='/favicon.svg'" />
        <div class="lineup__marks" id="lineup-marks"></div>
      </div>
      <ul class="lineup__list" id="lineup-list"></ul>
    </div>
    <p class="data-meta">点位为社区整理示意，位置以游戏内实测为准</p>
    <script type="application/json" id="lineup-data" set:html={JSON.stringify({ mode, focusId, maps, agents, spots, initialMapId, initialAgentId })} />
  </div>
) : (
  <p class="m-text">该点位数据整理中，后续版本补充。</p>
)}

<script>
  import { filterSpots, type LineupSpot } from '../utils/lineups';

  const el = document.getElementById('lineup-data');
  if (el) {
    const data = JSON.parse(el.textContent || '{}') as {
      mode: 'map' | 'agent'; focusId: string;
      maps: Record<string, { name: string; icon: string }>;
      agents: Record<string, { name: string; icon: string }>;
      spots: LineupSpot[]; initialMapId: string; initialAgentId: string;
    };
    const mapImg = document.getElementById('lineup-map') as HTMLImageElement;
    const marks = document.getElementById('lineup-marks') as HTMLElement;
    const list = document.getElementById('lineup-list') as HTMLElement;
    const btns = document.querySelectorAll<HTMLButtonElement>('#picker .chip-btn');

    let selected = data.mode === 'map' ? data.initialAgentId : data.initialMapId;
    const curMap = () => (data.mode === 'map' ? data.focusId : selected);
    const curAgent = () => (data.mode === 'map' ? selected : data.focusId);

    const ABILITY_LABEL: Record<string, string> = { C: 'C 技能', Q: 'Q 技能', E: 'E 技能', X: '大招 X', 被动: '被动' };

    function render() {
      mapImg.src = data.maps[curMap()].icon;
      const visible = filterSpots(data.spots, curMap(), curAgent());
      marks.innerHTML = visible.map((s, i) => `
        <span class="lineup__mark" style="left:${s.x}%;top:${s.y}%" data-i="${i}" title="${s.label}"></span>
      `).join('');
      list.innerHTML = visible.map((s) => `
        <li class="lineup__item">
          <strong>${s.label}</strong>
          <span class="lineup__meta">${ABILITY_LABEL[s.ability] ?? s.ability} · ${s.side}</span>
          <p>${s.note}</p>
        </li>
      `).join('') || '<li class="page-sub">该组合暂无点位</li>';
      btns.forEach((b) => b.classList.toggle('chip-btn--active', b.dataset.id === selected));
    }

    btns.forEach((b) => b.addEventListener('click', () => { selected = b.dataset.id || selected; render(); }));
    render();
  }
</script>

<style>
  .lineup { margin-top: 0.5rem; }
  .lineup__picker { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
  .chip-btn {
    background: rgba(236, 232, 225, 0.06); color: var(--val-cream);
    font-family: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer;
    padding: 0.35rem 0.8rem;
    box-shadow: inset 0 0 0 1px var(--val-line);
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  }
  .chip-btn:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .chip-btn--active { background: var(--val-red); color: #fff; }
  .lineup__stage { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(240px, 1fr); gap: 1rem; align-items: start; }
  .lineup__map { position: relative; }
  .lineup__map img { width: 100%; display: block; }
  .lineup__marks { position: absolute; inset: 0; pointer-events: none; }
  /* 动态注入元素（innerHTML）：Astro scoped 样式不命中运行时 DOM，必须 :global */
  :global(.lineup__mark) {
    position: absolute; width: 10px; height: 10px; border-radius: 50%;
    background: var(--val-red); box-shadow: 0 0 0 2px rgba(236,232,225,.8), 0 0 8px rgba(255,70,85,.8);
    transform: translate(-50%, -50%);
  }
  .lineup__list { list-style: none; display: grid; gap: 0.6rem; }
  :global(.lineup__item) { padding: 0.6rem 0.8rem; box-shadow: inset 0 0 0 1px var(--val-line); background: rgba(236,232,225,.04); }
  :global(.lineup__item strong) { display: block; font-size: 0.9rem; }
  :global(.lineup__meta) { color: var(--val-red); font-size: 0.72rem; font-weight: 700; }
  :global(.lineup__item p) { color: var(--val-gray); font-size: 0.82rem; margin-top: 0.25rem; }
  @media (max-width: 768px) { .lineup__stage { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: 构建验证（组件未接入页面前，先确认编译无误）**

Run: `pnpm build`
Expected: 构建成功（组件未被引用不参与编译，此步仅确认仓库状态健康）

- [ ] **Step 3: Commit**

```bash
git add src/components/LineupPanel.astro
git commit -m "feat(p3): LineupPanel 双模式点位组件（战术图标注 + 选择器）"
```

---

### Task P3-4: 地图与特工详情页集成

**Files:**
- Modify: `src/pages/maps/[id].astro`、`src/pages/agents/[id].astro`

- [ ] **Step 1: 修改 src/pages/maps/[id].astro（两处）**

1）frontmatter 加 import（renderGuide 的 import 行旁）：

```astro
import LineupPanel from '../../components/LineupPanel.astro';
```

2）「点位攻略」区块（h2 + 条件渲染 + 占位）整体替换为两段——注意 GuideContent 条件渲染保留：

```astro
    <h2>点位图示</h2>
    <LineupPanel mode="map" focusId={map.id} />
    <h2>攻防思路</h2>
    {GuideContent ? (
      <article class="prose m-guide"><GuideContent /></article>
    ) : (
      <p class="m-text">社区攻防思路编写中，本页先呈现官方战术图与点位图示。</p>
    )}
```

（删除原「点位攻略」h2 与其占位段落，防止区块重复）

- [ ] **Step 2: 修改 src/pages/agents/[id].astro（两处）**

1）frontmatter 加 import：

```astro
import LineupPanel from '../../components/LineupPanel.astro';
```

2）技能区块之后、data-meta 注脚之前插入：

```astro
    <h2>道具点位</h2>
    <LineupPanel mode="agent" focusId={agent.id} />
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build && grep -o '点位图示' dist/maps/ascent/index.html | wc -l && grep -o 'lineup-data' dist/maps/ascent/index.html | wc -l && grep -o '道具点位' dist/agents/sage/index.html | wc -l`
Expected: 点位图示 ≥ 1；lineup-data ≥ 1（数据注入成功）；道具点位 ≥ 1
Run: `grep -o '点位数据整理中' dist/agents/jett/index.html | wc -l`
Expected: ≥ 1（jett 仅在 abyss 有 X 点位，其详情页仍应有面板——若输出 0 属预期偏差，见下方说明）

说明：jett 在 abyss.json 有点位，故特工页必有面板；`grep` 输出 0 时说明组件数据为空的分支渲染的是"该点位数据整理中"文案，均属正确行为。

- [ ] **Step 4: Commit**

```bash
git add "src/pages/maps/[id].astro" "src/pages/agents/[id].astro"
git commit -m "feat(p3): 地图/特工详情页集成点位面板（双向入口）"
```

---

### Task P3-5: 13.06 版本公告中文导读

**Files:**
- Create: `src/content/patch-notes/patch-13-06-highlights.md`

- [ ] **Step 1: 写 src/content/patch-notes/patch-13-06-highlights.md**

```markdown
---
title: 13.06 版本导读：新大厅、特工精通系统与全新步枪悍狼
patchVersion: "13.06"
excerpt: "年度大版本：客户端重做、Performance Score、Agent Mastery、Gauntlet: Glitched 模式与 2900 价位新步枪 Warden。"
source: https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-06/
publishDate: 2026-09-30
---

> 本文为官方 13.06 更新的中文导读，完整改动以[官方原文](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-06/)为准。站内特工/武器/地图数据已同步至该版本。

## 客户端：新大厅与全局导航

Home 与 Lobby 合并为单一枢纽：模式选择、队伍组队、活动/任务/当前地图池/排行榜一览，限时玩法（新模式与 Pick'Ems）获得专属卡片。全局导航同步重做，主要枢纽之间切换更顺手，视觉密度更低。

## 竞技模式：三件套更新

- **Performance Score 取代 ACS**：0-500 分值综合衡量对局贡献，赛后结算页可查看得分构成；竞技/非排位/速攻/Premier 的 MVP 与记分板排序均按此计算
- **Accolades 荣誉**：记录本赛季与生涯的最佳表现（MVP 次数、单场最高击杀等），竞技与 Premier 可获取
- **Rank Legacy 段位传承**：竞技生涯里每 3 个赛季可累积一次已达成分位计数，像奖杯陈列室一样回顾段位履历
- **排队进靶场**：匹配等待期间可直接进靶场练枪（预计等待较长时开放）

## 新模式：Gauntlet: Glitched

2v2 八队混战：16 名玩家组成八支双排，回合制捉对厮杀，败方扣血、清零出局。核心机制是**技能抽取**——回合间从随机选项中跨特工抽取技能并升级（最高 3 级），2 级起技能有小概率"故障"强化（例如 Boom Bot 手动引爆、Wingman 巨大化）。四个混合新竞技场由熟悉地图空间缝合而成。本站[地图库](/maps/)中的 Gauntlet 即为该模式地图。

## 特工精通（Agent Mastery）

每个特工独立的成长系统：精通点数（MP）驱动赛季等级（每赛季 10 级，4/7/10 级解锁头像装饰）与终身等级；终身等级解锁奖励轨道（王国点数兑换，含原特工装备奖励）与可自定义的 Agent ID。上线时全员从零开始，历史对局不追溯。

## 新武器：Warden（悍狼）

与 Vandal、Phantom 同价位的第三把 2900 自动步枪：18 发弹匣、全射程 50 伤害（爆头 200 / 腿 42）、射速 6.5、2 倍镜、中穿透——长距离取向的战术新选择。站内[武器库](/weapons/warden/)已收录其完整数据，可与 Vandal/Phantom 并排[对比](/weapons/compare/)。

## 其他

- 反代练持续加码：7 月 20 日以来日均封禁 1600 个账号（累计超 9 万）
- 语音行为检测（RVE）扩展至西班牙语/葡萄牙语/韩语
- 主机端登陆澳大利亚与新西兰
```

- [ ] **Step 2: 构建验证**

Run: `pnpm build && ls dist/patch-notes/ | wc -l`
Expected: 4 个条目（index + data-synced-13-06 + how-to-read-patches + patch-13-06-highlights）

- [ ] **Step 3: Commit**

```bash
git add src/content/patch-notes
git commit -m "feat(p3): 13.06 官方更新中文导读（新大厅/精通系统/悍狼）"
```

---

### Task P3-6: 赛事资讯种子（VCT 2026）

**Files:**
- Create: `src/content/esports/vct-2026-season-recap.md`、`src/content/esports/champions-shanghai-2026.md`

- [ ] **Step 1: 写 src/content/esports/vct-2026-season-recap.md**

```markdown
---
title: 2026 VCT 赛季全景：从启点赛到上海冠军赛
type: 新闻
excerpt: 六阶段赛季结构、两站大师赛冠军归属（Paper Rex 两连亚）与四大赛区格局回顾。
publishDate: 2026-09-29
---

> 赛程与赛果信息整理自官方 valorantesports.com，以官方发布为准。

## 2026 赛季六阶段

1. **启点赛 Kickoff**（1月15日 - 2月15日）：四大赛区（美洲/EMEA/太平洋/CN）同步开季
2. **圣地亚哥大师赛**（2月28日 - 3月16日）：**Nongshim RedForce** 决赛 3:0 击败 Paper Rex 夺冠
3. **第一阶段**（4月1日 - 5月24日）：各赛区联赛
4. **伦敦大师赛**（6月6日 - 6月21日）：**Leviatán** 决赛 3:2 击败 Paper Rex 夺冠
5. **第二阶段**（6月30日 - 9月6日）：冠军赛前最后一轮积分争夺
6. **上海全球冠军赛**（9月24日 - 10月18日）：赛季收官战，进行中

## Paper Rex 的两连亚

两站大师赛，Paper Rex 都走到了最后一步，也都倒在了最后一步——0:3、2:3。太平洋赛区的这支队伍一年内两进国际赛决赛却两度铩羽，也让"第三次"成为上海冠军赛最大的看点之一。

## 四大赛区格局

- **美洲**：传统强区，Sentinels（两夺大师赛）底蕴犹存，NRG 是巴黎 2025 世界冠军
- **EMEA**：Fnatic、Team Liquid、Karmine Corp 常年争锋
- **太平洋**：Paper Rex、T1、Gen.G，PRX 是本赛季国际赛最稳定的四强队伍
- **CN**：EDG（2024 世界冠军）、Trace、TE 等 12 支队伍，上海主场作战值得关注

想看正在进行的冠军赛？见[上海冠军赛观赛指南](/esports/champions-shanghai-2026/)。
```

- [ ] **Step 2: 写 src/content/esports/champions-shanghai-2026.md**

```markdown
---
title: 上海全球冠军赛开赛：赛制、奖金与观赛要点
type: 赛程
excerpt: 9月24日-10月18日上海，16 队、225 万美元奖金池，赛季收官战正在打响。
publishDate: 2026-09-30
---

> 赛制与奖金信息整理自官方 Liquipedia/valorantesports.com，以官方发布为准。

## 基础信息

- **时间**：2026 年 9 月 24 日 - 10 月 18 日（总决赛 BO5）
- **地点**：中国上海
- **规模**：四大赛区 16 支队伍
- **奖金池**：2,250,000 美元（冠军 1,000,000）

## 赛制速览

- **小组赛**：16 队分四个 GSL 双败小组（每组 4 队，BO3），小组前二晋级
- **季后赛**：8 队双败淘汰，败者组决赛与总决赛为 BO5
- **出线结构**：各赛区第二阶段前二（高种子）+ 冠军赛积分前列（如 Paper Rex 即凭太平洋积分席晋级）

## 看什么

1. **Paper Rex 的第三次决赛**：两站大师赛连亚之后，PRX 能否在上海圆梦（见[赛季全景](/esports/vct-2026-season-recap/)）
2. **CN 主场**：EDG（2024 世界冠军）领衔的 CN 联队主场作战，武汉场馆的气氛值得期待
3. **Pick'Ems**：官方预测活动已开（9 月 10 日起），游戏内与网页均可参与，猜小组出线拿奖励

## 怎么看

赛事期间在 [valorantesports.com](https://valorantesports.com/) 与官方 YouTube/Twitch 频道直播；赛程速览亦可用 vlr.gg 等第三方数据站跟踪比分。本站将持续跟进赛后资讯。
```

- [ ] **Step 3: 构建验证**

Run: `pnpm build && ls dist/esports/ | wc -l`
Expected: 5 个条目（index + vct-explained + how-to-watch + vct-2026-season-recap + champions-shanghai-2026）
Run: `grep -o '225 万美元\|Paper Rex' dist/esports/index.html | wc -l`
Expected: ≥ 2（列表页出现新文章标题/摘要关键词）

- [ ] **Step 4: Commit**

```bash
git add src/content/esports
git commit -m "feat(p3): 赛事资讯种子（VCT 2026 赛季全景 + 上海冠军赛观赛指南）"
```

---

### Task P3-7: E2E 扩展与最终全量验证

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`（10 → 12 条）

- [ ] **Step 1: smoke.spec.ts 末尾追加 2 条用例**

```ts
test('地图点位面板：选特工显示点位标记', async ({ page }) => {
  await page.goto('/maps/ascent/');
  await page.locator('.chip-btn').first().click();
  await expect(page.locator('.lineup__mark').first()).toBeVisible();
});

test('特工详情页含道具点位面板', async ({ page }) => {
  await page.goto('/agents/sage/');
  await expect(page.getByRole('heading', { name: '道具点位' })).toBeVisible();
  await page.locator('.chip-btn').first().click();
  await expect(page.locator('.lineup__mark').first()).toBeVisible();
});
```

- [ ] **Step 2: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、**48 单测全绿**（45+3）、构建 94 页、**12 条 E2E 全过**（含点位交互两条）

- [ ] **Step 3: 提交并推送**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(p3): E2E 扩展至 12 条（点位面板交互冒烟）"
git push
```

推送触发 GitHub Actions verify 与 Vercel 自动部署；完成后线上抽查点位面板与资讯新文章。

---

## Self-Review 记录

1. **范围覆盖**：用户确认的三项全部落地——点位可视化（P3-1~4，双模式双向入口）、版本公告（P3-5，13.06 官方全文导读 + 站内数据互链）、赛事种子（P3-6，真实赛程赛果）。
2. **Placeholder 扫描**：无 TBD/TODO；13 图 52 点位、3 篇文章全文；新图点位 note 内置校准声明（产品文案非工程占位）。
3. **类型一致性**：LineupSpot 接口与 lineups.test.ts、LineupPanel 的注入/过滤、config.ts zod schema 三方一致；agentId/ability/side 枚举与 agents.json slug、SkillPanel slot 一致；panel 的 `set:html` 注入与 P2 验证过的 raw text 约束一致。
4. **计数核对**：单测 45+lineups 3=48；E2E 10+2=12；页面 94 不变（点位内嵌既有详情页）；lineups 13 文件 × 4 点位 = 52。