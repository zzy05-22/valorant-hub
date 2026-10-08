# valorant-hub P11 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ① VCT 职业赛 meta 板块（vlr event/agents 爬取：地图攻防胜率 + 特工 pick 矩阵）；② 地图中文报点词表（官方 callouts 数据 + 中文翻译映射）；③ 特工点位库总览（按地图聚合浏览 13 图 × 104 点位）。

**Architecture:** 沿用既有模式：vlr 爬虫（P10 同款 TDD/容错/原子写）+ content/data 增强 + 服务端渲染页面。报点词表 = 官方 API callouts 字段（数据层保留）+ 人工翻译映射表（渐进式，未命中保留英文）。点位库不新增未考证坐标——只做结构与浏览重组（P4"点位对不上"教训：宁缺毋假）。

**Tech Stack:** 同 P0-P10（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-10-08）:** "2和3可以添加，另外各个地图的特工点位"（对应 P11 生态分析报告的 S-② 职业赛 meta、S-③ 报点词表，外加点位库需求）

**探测记录（2026-10-08 实测）：**
- vlr.gg/event/agents/{id}：HTTP 200、559KB；结构为 HTML 表格：表头 `<th><img src="/img/vlr/game/agents/jett.png" ... title="Jett">`（特工名在 th 内 img 的 title 属性）；数据行 `<tr class="pr-global-row">`：`<span class="map-pseudo-icon">S</span>` + 地图名文本 + `<td class="mod-right">`（场次/ATK%/DEF%，注意 % 在独立文本节点）+ 每特工一个 `<td class="mod-color-sq mod-center" style="--stat-h:155">` 格子（内文百分比，--stat-h 是色阶强度值，pick=0% 时 --stat-h:0）
- vlr.gg/events：200；第一个条目即当前最重要赛事：`href="/event/2766/valorant-champions-2026"`（提取 id 与名称）
- valorant-api.com/v1/maps：含 `callouts` 字段（Ascent 22 个：`{regionName, superRegionName, location:{x,y,z}}`）
- **现 maps.json 无 callouts**（P0 transform 只保留了 id/uuid/zh/en/coordinates/displayIcon/splash）
- 点位库：`src/content/lineups/` 13 图（abyss/ascent/bind/breeze/corrode/fracture/haven/icebox/lotus/pearl/split/summit/sunset）× 每图 8 点 = 104；结构 `{mapId, spots:[{agentId, ability, label, x, y, side, note}]}`；纯函数 groupSpotsByAgent/groupSpotsByMap/filterSpots 已存在（src/utils/lineups.ts）

**前置状态:** P0-P10 已上线；本地 46b9000 与远端同步；62 单测 + 16 E2E 全绿；78 页构建。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净；今天日期 **2026-10-08**

## 关键背景（给零上下文的执行者）

- **vlr 爬虫模式**（scripts/lib/vlr.mjs）：解析纯函数导出可测 + fetch 函数 + sync 独立 try-catch warn-only；matches 类页面直接 fetch 无 cookie gate（event/agents 同样实测直接 200）
- **点位数据红线**：不新增任何未经真实考证的点位坐标（P4 教训：用户实测发现编造坐标后信任崩塌）。P11-3 只做**浏览结构重组**（总览页 + 按地图聚合视图），覆盖度如实展示（每图 8 个、标注覆盖特工数与"持续补充中"）
- **报点翻译边界**：CALLOUT_ZH 只收录**确定通行**的中文译名（如 A Site→A 点、Main→主道、Heaven→高台等社区通用叫法）；不确定的词条**不硬编**，展示英文原文（页面文案注明"通用译名整理中，未收录的以英文原名沟通即可"）
- **测试教训（P9/P10）**：`toEqual` 全字段严格比较；fixture 先写清返回结构；vlr 页面 % 与数字在独立文本节点，正则要容忍空白
- **计数核对**：单测 62 + 3（vlr meta）+ 2（callouts 翻译函数）= **67**；页面 78 + 1（meta）+ 1（lineups 总览）= **80**；E2E 16 + 2 = **18**；新数据文件 src/data/meta.json；maps.json 增加 callouts 数组字段

## 文件结构总览（P11 变更）

```
scripts/lib/vlr.mjs                 # P11-1 加 parseEventAgents + fetchEventMeta
scripts/sync-valorant.mjs          # P11-1 加 meta 容错块；P11-2 maps transform 传 callouts
scripts/transform.ts（或对应文件）  # P11-2 maps 保留 callouts 字段
tests/vlr.test.ts                   # P11-1 +3 用例
tests/utils/callouts.test.ts        # P11-2 新建 +2 用例
src/utils/callouts.ts               # P11-2 新建（CALLOUT_ZH 映射 + translateCallouts 纯函数）
src/data/meta.json                  # P11-1 新建（sync 产物快照）
src/data/maps.json                  # P11-2 重新生成（含 callouts）
src/pages/esports/meta.astro         # P11-1 新建（职业赛 meta 页）
src/pages/lineups/index.astro       # P11-3 新建（点位库总览页）
src/pages/maps/[id].astro           # P11-2 加报点速查区块；P11-3 点位面板加"全部特工"视图
src/pages/esports/index.astro      # P11-1 加 meta 入口卡
src/pages/index.astro               # P11-1 首页板块位入口（轻量）
tests/e2e/smoke.spec.ts            # P11-4 +2 用例
```

---

### Task P11-1: VCT 职业赛 meta 板块

**Files:**
- Modify: `scripts/lib/vlr.mjs`、`scripts/sync-valorant.mjs`、`tests/vlr.test.ts`、`src/pages/esports/index.astro`
- Create: `src/pages/esports/meta.astro`、`src/data/meta.json`

- [ ] **Step 1: TDD——tests/vlr.test.ts 追加 3 个失败用例**（fixture 基于实测结构精简）

```ts
describe('parseEventAgents（职业赛 meta）', () => {
  const fixture = `<table><tr><th style="width: 42px; height: 40px; padding: 0;">
      <img src="/img/vlr/game/agents/jett.png" title="Jett"></th>
      <th><img src="/img/vlr/game/agents/omen.png" title="Omen"></th></tr>
    <tr class="pr-global-row "><td style="white-space: nowrap;"><span class="map-pseudo-icon">S</span>
      Split</td>
      <td class="mod-right">7</td><td class="mod-right">68%</td><td class="mod-right">32%</td>
      <td class="mod-color-sq mod-center" style="--stat-h:155">86%</td>
      <td class="mod-color-sq mod-center" style="--stat-h:0">0%</td></tr></table>`;

  it('解析地图行：场次与攻防胜率', () => {
    const r = parseEventAgents(fixture);
    expect(r.maps).toHaveLength(1);
    expect(r.maps[0]).toMatchObject({ name: 'Split', matches: 7, atkWin: 68, defWin: 32 });
  });

  it('解析特工 pick 矩阵（按 th 顺序对应）', () => {
    const r = parseEventAgents(fixture);
    expect(r.maps[0].picks).toEqual([
      { agent: 'Jett', pct: 86 },
      { agent: 'Omen', pct: 0 },
    ]);
  });

  it('parseEventList 提取当前赛事', () => {
    const list = parseEventList('<a href="/event/2766/valorant-champions-2026">...</a>');
    expect(list).toEqual({ id: 2766, name: 'Valorant Champions 2026' });
  });
});
```

- [ ] **Step 2: 确认 FAIL → 实现**（vlr.mjs）
  - `parseEventList(html)`：第一个 `href="/event/(\d+)/([a-z0-9-]+)"` → `{ id: Number, name: 短横线转空格后首字母大写 }`
  - `parseEventAgents(html)`：th 的 `title="([A-Za-z-]+)"` 收集特工名序列（kay-o 之类小写保留）；`<tr class="pr-global-row[^"]*">` 分块；块内：地图名（`map-pseudo-icon">[A-Z]</span>` 后的文本，trim）、三个 `mod-right`（场次/ATK/DEF，`(\d+)%?`）、`mod-color-sq` 格子按序对应特工（`--stat-h:0` 且文本 0% 表示 0 pick）
  - `fetchEventMeta()`：fetch /events → parseEventList → fetch `/event/agents/${id}` → parseEventAgents → `{ event, maps, syncedAt }`

- [ ] **Step 3: 6+3=9 passed 确认**

- [ ] **Step 4: sync 加独立容错块**（patch-feed 块后）→ 原子写 `src/data/meta.json` → 跑 sync 生成快照**
  Run: `node scripts/sync-valorant.mjs`，Expected: `meta synced: Valorant Champions 2026 · N 张地图`

- [ ] **Step 5: /esports/meta/ 页面**
  - PageHero（label "Meta"、title "职业赛数据"、subtitle 赛事名 · 每日自动同步）
  - 区块① 地图攻防表：每图一行（图名/场次/ATK%/DEF% 双色条对比，复用 P10 赛程卡风格 card-cut）
  - 区块② 特工 pick 热力：每图一个 card，内列该图特工 pick 横条（宽度=pct%，色阶用 pct 映射红色强度，纯 CSS）
  - 数据说明脚注：数据源 vlr.gg、当日赛事、pct 为该图出场率
- [ ] **Step 6: 入口**——esports/index.astro 加"职业赛数据"入口卡（赛程入口卡旁）；首页板块位不动（避免首页过载，meta 从资讯进）

- [ ] **Step 7: 构建 79 页 + grep meta 页渲染 ≥1 → Commit**
  ```bash
  git add -A && git commit -m "feat(p11): VCT 职业赛 meta 板块（地图攻防 + 特工出场矩阵，vlr.gg 每日同步）"
  ```

---

### Task P11-2: 地图中文报点词表

**Files:**
- Modify: maps sync/transform 相关文件（先 grep 定位：`grep -rn "callouts\|displayIcon" scripts/ | head`）、`src/pages/maps/[id].astro`
- Create: `src/utils/callouts.ts`、`tests/utils/callouts.test.ts`

- [ ] **Step 1: transform 保留 callouts**——先定位 maps transform（scripts/ 下），在 map 记录里追加：
  ```ts
  callouts: (m.callouts ?? []).map((c: any) => ({
    region: c.regionName, zone: c.superRegionName,
    x: c.location?.x ?? 0, y: c.location?.y ?? 0,
  })),
  ```
  跑 sync 重新生成 maps.json，抽查 Ascent callouts = 22 条
- [ ] **Step 2: TDD——tests/utils/callouts.test.ts 2 用例**
  ```ts
  it('已知报点翻译为中文', () => {
    expect(translateCallouts([{ region: 'Main', zone: 'A' }, { region: 'Site', zone: 'B' }]))
      .toEqual([{ region: 'Main', zh: 'A 主道' }, { region: 'Site', zh: 'B 点' }]);
  });
  it('未收录词条保留英文原文（不硬编）', () => {
    expect(translateCallouts([{ region: 'Tree', zone: 'A' }])).toEqual([{ region: 'Tree', zh: 'Tree' }]);
  });
  ```
  （translateCallouts 返回结构以实现为准，用例先写清：输入 {region, zone}，输出 {region, zh}，zh = `zone==='A'?'A ':''` 前缀 + 译名或原文名）
- [ ] **Step 3: 实现 src/utils/callouts.ts**
  - `CALLOUT_ZH: Record<string, string>`：只收社区确定通用的译名，首批词条（按通行度）：Site→点、Main→主道、Lobby→大厅、Market→市场、Tree→大树、Heaven→高台、Hell→地狱、CT→守方家、T Spawn→攻方出生点、Spawn→出生点、Mid→中路、Link→连接口、Pad→跳板、U Hall→U 道、Sewers→下水道、Garage→车库、Vent→通风口、Tiles→瓷砖房、Aisle→走廊、Dungeon→地窖、Boxes→箱区、Cubby→卡位、Wooden→木门、Belt→传送带、Snow pile→雪堆、Kitchen→厨房、Generator→发电机、Ice Cream→冰淇淋车……（执行者可依据 maps.json 实际 callouts 词表增补**确定通行**的译名；拿不准的不加——这是红线）
  - `translateCallouts(callouts)`：`zh = (zone 前缀 A/B/C + ' ' 前缀逻辑) + (CALLOUT_ZH[region] ?? region)`；null/undefined 安全
- [ ] **Step 4: 地图详情页"报点速查"区块**——`/maps/[id]/` 点位面板之后加 section：
  - h2 "报点速查" + 说明文案（"官方 callout 与中文通行叫法对照；未收录以英文原名沟通即可"）
  - 按 zone 分组（A 区/B 区/中路/全场）网格展示：`A Main → A 主道`、`Tree → Tree`（中英并列，米白英文 + 红色中文）
  - 已有数据源：maps.json 的 map.callouts
- [ ] **Step 5: 测试 67 passed + 构建 79 页 + 抽查 Ascent 详情页含"报点速查"与"A 主道" → Commit**
  ```bash
  git add -A && git commit -m "feat(p11): 地图报点速查（官方 callouts + 中文通行译名对照）"
  ```

---

### Task P11-3: 特工点位库总览

**Files:**
- Create: `src/pages/lineups/index.astro`
- Modify: `src/pages/maps/[id].astro`

- [ ] **Step 1: /lineups/ 总览页**
  - frontmatter：getCollection('lineups') + getCollection 数据 maps 关联中文名；复用 groupSpotsByMap/groupSpotsByAgent
  - PageHero（label "Lineups"、title "特工点位库"、subtitle `13 张地图 · ${total} 个点位 · 攻防双视角`）
  - 地图卡网格（grid--wide）：每卡 = 地图名（中文）+ 点位数 + 覆盖特工头像排（小圆头像 + 数量）+ "查看点位 →" 链接到 `/maps/{id}/`（复用现有详情页点位面板，不重复造轮子）
  - 覆盖度说明条：如实文案——"点位持续补充中：当前每图收录 8 个高价值点位，覆盖 ${agentCount} 位特工；新点位经实测校准后收录"
- [ ] **Step 2: 地图详情页点位面板加"全部特工"视图**
  - LineupPanel 现状是选特工过滤（filterSpots）；增强：特工选择行首加"全部"按钮（显示该图全部点位分组标记，按 groupSpotsByAgent 分组着色/图例）——纯 script 增强零 JS 哲学下用 P2 岛模式（该面板本就有 script）
  - 图例：特工名 + 颜色点
- [ ] **Step 3: 构建 80 页 + 抽查 /lineups/ 渲染（13 卡 + "特工点位库"标题）→ Commit**
  ```bash
  git add -A && git commit -m "feat(p11): 特工点位库总览页（13 图聚合浏览 + 全部特工视图）"
  ```

---

### Task P11-4: E2E 扩展与全链（主工程师执行）

- [ ] **Step 1: smoke.spec.ts 追加 2 用例（18 条）**

```ts
test('职业赛 meta 页可访问', async ({ page }) => {
  await page.goto('/esports/meta/');
  await expect(page.getByRole('heading', { name: '职业赛数据' })).toBeVisible();
});

test('点位库总览页可访问', async ({ page }) => {
  await page.goto('/lineups/');
  await expect(page.getByRole('heading', { name: '特工点位库' })).toBeVisible();
  await expect(page.locator('.card-cut').first()).toBeVisible();
});
```

- [ ] **Step 2: 全链**：`pnpm lint && pnpm test && pnpm build && pnpm e2e`
  Expected: lint 0/0、**67 单测**、**80 页**、**18 E2E**（首页超时重跑一次的已知环境问题照旧）
- [ ] **Step 3: push + 线上验证**（meta 页/报点速查/点位库总览/地图详情页全部特工视图）

---

## Self-Review 记录

1. **范围覆盖**：生态分析 S-②（meta 板块）+ S-③（报点词表）+ 点位库浏览（用户追加）三项全落地。
2. **数据真实性**：meta 解析基于 559KB 实测 HTML（pr-global-row/th title 结构）；callouts 基于官方 API 实测（Ascent 22 条）；点位库**零新增坐标**——只重组浏览结构，杜绝 P4 式编造。
3. **翻译红线**：CALLOUT_ZH 只收确定通行译名，未命中保留英文原文；页面文案明示"整理中"，不用编造的译名充数。
4. **计数核对**：单测 67（62+3+2）、页面 80（78+meta+lineups）、E2E 18（16+2）、maps.json 含 callouts、新 meta.json。
5. **入口设计**：meta/赛程从资讯页进（导航不膨胀，P7 用户曾嫌导航问题）；点位库从地图详情页与首页既有板块自然延伸。