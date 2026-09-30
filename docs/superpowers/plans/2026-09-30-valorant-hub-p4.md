# valorant-hub P4 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正点位系统（撤除不可信的图上红点标注，点位改为准确的结构化文字列表 + 战术图参考展示），新增点位标注工具页（玩家点选战术图生成真实坐标 JSON），并以"内容骨架"方式扩充点位覆盖（文字内容本计划产出，坐标由玩家用工具补充）。

**Architecture:** LineupPanel 撤红点（组件内删除 marks 渲染与相关 CSS，保留地图切换参考图与文字列表）；标注工具页为纯客户端岛屿（`set:html` 注入地图/特工数据 + 打包 script 处理点选坐标计算与 JSON 生成，全部静态元素无 scoped 陷阱）；骨架数据直接进既有 lineups 集合（坐标用 50/50 占位——撤红点后坐标不渲染，用工具重标时替换）。

**Tech Stack:** 同 P0-P3（Astro 5 / vitest / Playwright / GitHub Actions / Vercel）

**用户决策记录（2026-09-30）:** 用户实测反馈"点位对不上且不全"——坐标准确性验证结论：模型无游戏内实测能力、无外部数据源可接入、战术图视觉识别不足以校准坐标；用户确认方案 = 撤标注 + 标注工具 + 内容骨架分工（坐标由玩家标注）。

**前置状态:** P0-P3 已上线（https://valoranthub.icu），48 单测 + 12 E2E 全绿，97 页构建。

---

## 环境前提（执行前确认）

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 分支干净，remote 为 SSH
- `.npmrc` 已锁定官方 registry；今天日期：2026-09-30

## 关键背景（给零上下文的执行者）

- **撤红点的边界（重要）**：只删除"图上红点标注"（marks 渲染），**保留**战术图参考展示与地图切换逻辑（agent 模式下选地图切图的 `mapImg.src` 更新有用）；文字点位列表（.lineup__item）完整保留
- **骨架坐标占位**：新 52 条骨架的 x/y 一律写 `50, 50`——撤红点后坐标不渲染，占位无副作用；玩家用 /lineup-tool/ 标注时替换为真实坐标
- **骨架技能键位（已核实）**：jett C=Cloudburst（烟）、raze C=Boom Bot、raze E=Paint Shells（榴弹）、neon C=Fast Lane（能量墙）、harbor E=High Tide（水墙）、fade E=Haunt（侦察眼）、fade Q=Prowler、skye C=Guiding Light（闪光）、skye Q=Trailblazer（虎）、gekko E=Dizzy、chamber C=Trademark（陷阱）、deadlock Q=Sonic Sensor（声波感应）、clove E=Ruse（可隔墙/死后释放的烟）
- **骨架 note 写作原则**：只写"用途与场景"（准确的游戏机制知识），**不写具体站位**（站位细节玩家标坐标时补充）——这是诚实边界
- **单测计数不变 48**；**E2E 计数 12 + 1 = 13**（两条点位用例改断言不增删，工具页 +1）；**页面数 97 + 1 = 98**
- **产物是压缩 HTML**：验证一律用 `grep -o | wc -l`

## 文件结构总览（P4 变更）

```
src/components/LineupPanel.astro   # P4-1 修改（撤红点：删 marks 元素/渲染/CSS，声明文案更新）
tests/e2e/smoke.spec.ts            # P4-1 修改（2 条用例断言 .lineup__mark → .lineup__item）
src/content/lineups/*.json        # P4-2 修改（13 文件各追加 4 条骨架，共 52 条）
src/pages/lineup-tool.astro       # P4-3 新建（标注工具页）
tests/e2e/smoke.spec.ts            # P4-4 追加工具页用例 1 条
```

---

### Task P4-1: LineupPanel 撤红点改造 + E2E 用例更新

**Files:**
- Modify: `src/components/LineupPanel.astro`、`tests/e2e/smoke.spec.ts`

- [ ] **Step 1: 修改 LineupPanel.astro（5 处精确变更）**

1）模板：删除这一行（战术图与列表之间的标注层）：

```astro
        <div class="lineup__marks" id="lineup-marks"></div>
```

2）script：删除这一行（元素获取）：

```ts
    const marks = document.getElementById('lineup-marks') as HTMLElement;
```

3）script render() 内：删除这整段（marks 渲染，3 行）：

```ts
      marks.innerHTML = visible.map((s, i) => `
        <span class="lineup__mark" style="left:${s.x}%;top:${s.y}%" data-i="${i}" title="${s.label}"></span>
      `).join('');
```

4）声明文案替换：

```
旧：<p class="data-meta">点位为社区整理示意，位置以游戏内实测为准</p>
新：<p class="data-meta">点位由社区整理，站位细节以游戏内实测为准 · 图上精确标注可用<a href="/lineup-tool/">点位标注工具</a></p>
```

5）scoped 样式：删除这两条规则（`.lineup__marks` 与 `:global(.lineup__mark)` 整块，含其注释行）：

```css
  .lineup__marks { position: absolute; inset: 0; pointer-events: none; }
```

```css
  /* 动态注入元素（innerHTML）：Astro scoped 样式不命中运行时 DOM，必须 :global */
  :global(.lineup__mark) {
    position: absolute; width: 10px; height: 10px; border-radius: 50%;
    background: var(--val-red); box-shadow: 0 0 0 2px rgba(236,232,225,.8), 0 0 8px rgba(255,70,85,.8);
    transform: translate(-50%, -50%);
  }
```

（其余全部保留：`.lineup__map` 容器与 img（参考图）、`mapImg.src` 切换逻辑、`.lineup__list` 列表、picker 选择器与 `chip-btn--active` 高亮）

- [ ] **Step 2: 修改 tests/e2e/smoke.spec.ts（两条点位用例各一处断言）**

```
旧：await expect(page.locator('.lineup__mark').first()).toBeVisible();
新：await expect(page.locator('.lineup__item').first()).toBeVisible();
```

（两条用例各改这一行，其余步骤与点击交互不动）

- [ ] **Step 3: 构建验证**

Run: `pnpm build && grep -o 'lineup__mark' dist/maps/ascent/index.html | wc -l`
Expected: **0**（红点标记完全移除）
Run: `grep -o '点位标注工具' dist/maps/ascent/index.html | wc -l`
Expected: ≥ 1（声明文案中的工具入口）

- [ ] **Step 4: E2E 验证（本任务先单独跑点位两条）**

Run: `pnpm e2e --grep "点位"`
Expected: 2 passed（断言改为列表项后通过；此时工具页尚未创建但用例未引用工具页）

- [ ] **Step 5: Commit**

```bash
git add src/components/LineupPanel.astro tests/e2e/smoke.spec.ts
git commit -m "fix(p4): LineupPanel 撤除图上红点标注（坐标不可信），点位改为文字列表 + 战术图参考展示"
```

---

### Task P4-2: 13 图骨架扩充（52 条，坐标 50/50 占位）

**Files:**
- Modify: `src/content/lineups/` 13 个 JSON（每个 spots 数组追加 4 条）

- [ ] **Step 1: 13 个文件的 spots 数组末尾各追加 4 条骨架**（逐字一致；坐标一律 50/50 占位）

`ascent.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "B 主道烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾弹封 B 主道视野，掩护近点冲击。" },
    { "agentId": "raze", "ability": "C", "label": "A 主道 Boom Bot 清点", "x": 50, "y": 50, "side": "进攻", "note": "机器狗沿 A 主道搜索角落守位，清包点前必用信息。" },
    { "agentId": "harbor", "ability": "E", "label": "A 主道水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙横切 A 主道，缓慢推进压缩守方对枪空间。" },
    { "agentId": "fade", "ability": "E", "label": "B 区侦察眼", "x": 50, "y": 50, "side": "进攻", "note": "幽灵眼布置 B 区后方，暴露守位为分推决策提供信息。" }
```

`split.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "中门烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封中门视野，掩护中路渗透。" },
    { "agentId": "raze", "ability": "E", "label": "B 塔榴弹压制", "x": 50, "y": 50, "side": "进攻", "note": "集束榴弹覆盖 B 塔楼区域，压制高低差火力。" },
    { "agentId": "neon", "ability": "C", "label": "B 主道能量墙", "x": 50, "y": 50, "side": "进攻", "note": "能量墙分隔 B 主道，掩护队友近点与拆分对枪。" },
    { "agentId": "fade", "ability": "E", "label": "A 区侦察眼", "x": 50, "y": 50, "side": "进攻", "note": "幽灵眼布置 A 区，侦测塔楼与主道守位。" }
```

`bind.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 长道烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 A 长道与窗口视野，掩护推进。" },
    { "agentId": "harbor", "ability": "E", "label": "B 主道水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙压制 B 主道，配合传送门声东击西。" },
    { "agentId": "gekko", "ability": "E", "label": "B 点 Dizzy 压制", "x": 50, "y": 50, "side": "进攻", "note": "Dizzy 悬浮压制 B 包点守位，迫使后撤交道具。" },
    { "agentId": "chamber", "ability": "C", "label": "B 传送门陷阱", "x": 50, "y": 50, "side": "防守", "note": "Trademark 布置传送门出口附近，减速踩线进攻方。" }
```

`haven.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "C 车库烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 C 车库入口视野，掩护最快路线冲击。" },
    { "agentId": "raze", "ability": "C", "label": "B 主道 Boom Bot", "x": 50, "y": 50, "side": "进攻", "note": "机器狗搜索 B 主道与窗口位，提供三点图稀缺的信息。" },
    { "agentId": "skye", "ability": "C", "label": "A 主道闪光鸟", "x": 50, "y": 50, "side": "进攻", "note": "闪光鸟掠过 A 主道致盲守位，配合队友近点。" },
    { "agentId": "neon", "ability": "C", "label": "A 主道能量墙", "x": 50, "y": 50, "side": "进攻", "note": "能量墙掩护 A 主道推进，三点图快速转点节奏器。" }
```

`breeze.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 洞口烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 A 洞口视野，掩护开阔地推进。" },
    { "agentId": "harbor", "ability": "E", "label": "中门水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙覆盖中门开阔区，远距离图的移动掩体。" },
    { "agentId": "fade", "ability": "E", "label": "B 区侦察眼", "x": 50, "y": 50, "side": "进攻", "note": "幽灵眼监视 B 区，开阔地图信息位价值最高。" },
    { "agentId": "deadlock", "ability": "Q", "label": "B 入口声波感应", "x": 50, "y": 50, "side": "防守", "note": "声波感应器守 B 入口，捕捉快攻并自动致聋。" }
```

`lotus.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 入口烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 A 主入口，配合旋转门佯攻。" },
    { "agentId": "raze", "ability": "E", "label": "B 连接榴弹", "x": 50, "y": 50, "side": "进攻", "note": "榴弹覆盖 B 连接区域，压制多点防守兵力。" },
    { "agentId": "skye", "ability": "Q", "label": "中门虎式侦察", "x": 50, "y": 50, "side": "进攻", "note": "Trailblazer 穿中门侦察推进路线，配合三点转点。" },
    { "agentId": "chamber", "ability": "C", "label": "C 入口陷阱", "x": 50, "y": 50, "side": "防守", "note": "Trademark 布置 C 入口，减速下水道路线进攻方。" }
```

`pearl.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "中门烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封中门视野，掩护三向施压兵力展开。" },
    { "agentId": "neon", "ability": "C", "label": "B 主道能量墙", "x": 50, "y": 50, "side": "进攻", "note": "能量墙掩护 B 主道快速近点。" },
    { "agentId": "harbor", "ability": "E", "label": "A 主道水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙切 A 主道纵深，稳步推进控图。" },
    { "agentId": "fade", "ability": "Q", "label": "中门清道夫", "x": 50, "y": 50, "side": "进攻", "note": "Prowler 沿中门搜索并致盲守位，配合队友抢中。" }
```

`fracture.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 主道烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾掩护 A 主道，配合双边 3-2 分推。" },
    { "agentId": "raze", "ability": "C", "label": "中路 Boom Bot", "x": 50, "y": 50, "side": "进攻", "note": "机器狗搜索中路连接区，H 型结构的转点情报。" },
    { "agentId": "skye", "ability": "C", "label": "B 主道闪光鸟", "x": 50, "y": 50, "side": "进攻", "note": "闪光鸟致盲 B 主道守位，配合另一侧夹击。" },
    { "agentId": "clove", "ability": "E", "label": "A 包点隔墙烟", "x": 50, "y": 50, "side": "进攻", "note": "Ruse 可隔墙释放，下包后封包点视线守包。" }
```

`sunset.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "B 贴脸烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 B 近点视野，掩护贴脸快攻。" },
    { "agentId": "harbor", "ability": "E", "label": "A 主道水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙压制 A 主道，配合前排冲击。" },
    { "agentId": "fade", "ability": "E", "label": "市场侦察眼", "x": 50, "y": 50, "side": "进攻", "note": "幽灵眼监视市场转点路线，防回防夹击。" },
    { "agentId": "deadlock", "ability": "Q", "label": "中门声波感应", "x": 50, "y": 50, "side": "防守", "note": "感应器守中门，失中门即报警并致聋。" }
```

`abyss.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 悬崖走廊烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾压制悬崖走廊火力线，掩护贴墙推进。" },
    { "agentId": "raze", "ability": "C", "label": "中门 Boom Bot", "x": 50, "y": 50, "side": "进攻", "note": "机器狗搜索中门，悬崖图对枪位置选择优先。" },
    { "agentId": "neon", "ability": "C", "label": "B 主道能量墙", "x": 50, "y": 50, "side": "进攻", "note": "能量墙掩护 B 主道，注意悬崖边缘走位。" },
    { "agentId": "chamber", "ability": "C", "label": "A 入口陷阱", "x": 50, "y": 50, "side": "防守", "note": "Trademark 守 A 入口，踩线减速后撤打交叉火力。" }
```

`icebox.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 管道烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 A 管道层视野，掩护底层推进。" },
    { "agentId": "raze", "ability": "E", "label": "B 后点榴弹", "x": 50, "y": 50, "side": "进攻", "note": "榴弹覆盖 B 后点守位，垂直图压制火力点。" },
    { "agentId": "harbor", "ability": "E", "label": "B 厨房水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙压厨房窗口方向，掩护 B 近点。" },
    { "agentId": "skye", "ability": "C", "label": "A 主道闪光鸟", "x": 50, "y": 50, "side": "进攻", "note": "闪光鸟致盲 A 塔楼与管道层守位。" }
```

`corrode.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "A 主道烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 A 主道薄墙后视野，掩护推进。" },
    { "agentId": "neon", "ability": "C", "label": "中路能量墙", "x": 50, "y": 50, "side": "进攻", "note": "能量墙掩护中路推进。新图点位持续校准中。" },
    { "agentId": "fade", "ability": "E", "label": "B 区侦察眼", "x": 50, "y": 50, "side": "进攻", "note": "幽灵眼侦察 B 区，矿区薄墙多信息优先。新图点位持续校准中。" },
    { "agentId": "deadlock", "ability": "Q", "label": "A 入口声波感应", "x": 50, "y": 50, "side": "防守", "note": "感应器守 A 入口。新图点位持续校准中。" }
```

`summit.json` 追加：

```json
    { "agentId": "jett", "ability": "C", "label": "B 主道烟", "x": 50, "y": 50, "side": "进攻", "note": "烟雾封 B 主道视野。新图点位持续校准中。" },
    { "agentId": "harbor", "ability": "E", "label": "A 主道水墙", "x": 50, "y": 50, "side": "进攻", "note": "水墙压制 A 主道。新图点位持续校准中。" },
    { "agentId": "raze", "ability": "C", "label": "中路 Boom Bot", "x": 50, "y": 50, "side": "进攻", "note": "机器狗搜索中路。新图点位持续校准中。" },
    { "agentId": "skye", "ability": "Q", "label": "中路虎式侦察", "x": 50, "y": 50, "side": "进攻", "note": "虎式侦察摸三线结构。新图点位持续校准中。" }
```

- [ ] **Step 2: 构建验证（schema 全过）**

Run: `pnpm build && node -e "const fs=require('fs');let t=0;for(const f of fs.readdirSync('./src/content/lineups')){t+=JSON.parse(fs.readFileSync('./src/content/lineups/'+f,'utf8')).spots.length};console.log('总点位数:',t)"`
Expected: 构建成功；总点位数 **104**（52 原有 + 52 骨架）

- [ ] **Step 3: Commit**

```bash
git add src/content/lineups
git commit -m "feat(p4): 点位内容骨架扩充 52 条（9 个新特工，坐标占位待工具标注）"
```

---

### Task P4-3: 点位标注工具页

**Files:**
- Create: `src/pages/lineup-tool.astro`

- [ ] **Step 1: 写 src/pages/lineup-tool.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import agentsData from '../data/agents.json';
import mapsData from '../data/maps.json';

const maps = mapsData.maps.map((m) => ({
  id: m.id,
  name: m.zh.name !== m.en.name ? `${m.zh.name} ${m.en.name}` : m.en.name,
  icon: m.displayIcon,
}));
const agents = agentsData.agents.map((a) => ({
  id: a.id,
  name: a.zh.name !== a.en.name ? `${a.zh.name} ${a.en.name}` : a.en.name,
}));
const firstIconed = maps.find((m) => m.icon)?.icon || '/favicon.svg';
---
<BaseLayout title="点位标注工具｜无畏契约资料站" description="点击战术图生成点位坐标与 JSON 数据，用于补充站点道具点位">
  <main class="container section">
    <div class="label-cut">Lineup Tool</div>
    <h1>点位标注工具</h1>
    <p class="page-sub">选地图 → 点击战术图上的点位位置 → 填写信息 → 复制 JSON 粘贴到 src/content/lineups/ 对应地图文件 → commit 推送上站</p>
    <div class="chips" id="map-picker">
      {maps.map((m) => (
        <button class="chip-btn" data-id={m.id} data-icon={m.icon}>{m.name}</button>
      ))}
    </div>
    <div class="tool-grid">
      <div class="stage">
        <img id="tactic-map" src={firstIconed} alt="战术图" />
        <span id="preview-dot"></span>
        <p class="page-sub" id="coord-hint">在图上点击任意位置开始标注</p>
      </div>
      <div class="form">
        <label class="f-row">特工
          <select id="f-agent">{agents.map((a) => <option value={a.id}>{a.name}</option>)}</select>
        </label>
        <label class="f-row">技能
          <select id="f-ability">
            <option value="C">C 技能</option>
            <option value="Q">Q 技能</option>
            <option value="E">E 技能</option>
            <option value="X">大招 X</option>
            <option value="被动">被动</option>
          </select>
        </label>
        <label class="f-row">阵营
          <select id="f-side">
            <option value="进攻">进攻</option>
            <option value="防守">防守</option>
          </select>
        </label>
        <label class="f-row">点位名称
          <input id="f-label" type="text" placeholder="如：A 主道封口墙" />
        </label>
        <label class="f-row">用法说明
          <textarea id="f-note" rows="3" placeholder="站位、时机、配合…"></textarea>
        </label>
        <button type="button" class="btn btn-primary" id="gen">生成 JSON</button>
        <textarea id="output" rows="5" readonly placeholder="生成的 JSON 会出现在这里"></textarea>
        <button type="button" class="btn btn-ghost" id="copy">复制</button>
      </div>
    </div>
    <p class="data-meta">坐标为图上百分比位置（保留一位小数）；骨架点位的 x/y 为占位值，标注后替换即可</p>
    <script type="application/json" id="tool-data" set:html={JSON.stringify({ maps })} />
  </main>
</BaseLayout>

<script>
  const dataEl = document.getElementById('tool-data');
  if (dataEl) {
    const { maps } = JSON.parse(dataEl.textContent || '{}') as {
      maps: Array<{ id: string; name: string; icon: string }>;
    };
    const mapImg = document.getElementById('tactic-map') as HTMLImageElement;
    const dot = document.getElementById('preview-dot') as HTMLElement;
    const hint = document.getElementById('coord-hint') as HTMLElement;
    const btns = document.querySelectorAll<HTMLButtonElement>('#map-picker .chip-btn');
    let x = 50;
    let y = 50;

    function selectMap(id: string) {
      const m = maps.find((mm) => mm.id === id);
      if (m?.icon) mapImg.src = m.icon;
      dot.style.display = 'none';
      hint.textContent = '在图上点击任意位置开始标注';
      btns.forEach((b) => b.classList.toggle('chip-btn--active', b.dataset.id === id));
    }
    btns.forEach((b) => b.addEventListener('click', () => selectMap(b.dataset.id || '')));
    btns[0]?.click();

    mapImg.addEventListener('click', (e) => {
      const rect = mapImg.getBoundingClientRect();
      x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
      y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
      dot.style.display = '';
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
      hint.textContent = `当前坐标：x=${x}, y=${y}`;
    });

    const agentSel = document.getElementById('f-agent') as HTMLSelectElement;
    const abilitySel = document.getElementById('f-ability') as HTMLSelectElement;
    const sideSel = document.getElementById('f-side') as HTMLSelectElement;
    const labelInput = document.getElementById('f-label') as HTMLInputElement;
    const noteInput = document.getElementById('f-note') as HTMLTextAreaElement;
    const output = document.getElementById('output') as HTMLTextAreaElement;
    const copyBtn = document.getElementById('copy') as HTMLButtonElement;

    document.getElementById('gen')!.addEventListener('click', () => {
      const spot = {
        agentId: agentSel.value,
        ability: abilitySel.value,
        label: labelInput.value || '待命名点位',
        x,
        y,
        side: sideSel.value,
        note: noteInput.value || '待补充说明',
      };
      output.value = JSON.stringify(spot);
      output.select();
    });

    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(output.value);
      copyBtn.textContent = '已复制';
      setTimeout(() => { copyBtn.textContent = '复制'; }, 1200);
    });
  }
</script>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0 1.2rem; }
  .chip-btn {
    background: rgba(236, 232, 225, 0.06); color: var(--val-cream);
    font-family: inherit; font-size: 0.72rem; font-weight: 700; cursor: pointer;
    padding: 0.3rem 0.6rem; box-shadow: inset 0 0 0 1px var(--val-line);
    clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  }
  .chip-btn:hover { box-shadow: inset 0 0 0 1px var(--val-red); }
  .chip-btn--active { background: var(--val-red); color: #fff; }
  .tool-grid { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(280px, 1fr); gap: 1.5rem; align-items: start; }
  .stage { position: relative; }
  .stage img { width: 100%; display: block; cursor: crosshair; box-shadow: inset 0 0 0 1px var(--val-line); }
  .stage .page-sub { margin-top: 0.5rem; }
  .stage span {
    position: absolute; width: 12px; height: 12px; border-radius: 50%;
    background: var(--val-red); box-shadow: 0 0 0 2px rgba(236,232,225,.8), 0 0 10px rgba(255,70,85,.9);
    transform: translate(-50%, -50%); display: none; pointer-events: none;
  }
  .form { display: grid; gap: 0.75rem; }
  .f-row { display: grid; gap: 0.25rem; font-size: 0.8rem; color: var(--val-gray); font-weight: 700; }
  .f-row select, .f-row input, .f-row textarea {
    background: rgba(236, 232, 225, 0.06); color: var(--val-cream);
    font-family: inherit; font-size: 0.85rem; padding: 0.5rem 0.6rem;
    box-shadow: inset 0 0 0 1px var(--val-line); outline: none; border: none;
  }
  .f-row select:focus, .f-row input:focus, .f-row textarea:focus { box-shadow: inset 0 0 0 1px var(--val-red); }
  .form textarea {
    background: rgba(236, 232, 225, 0.04); color: var(--val-cream);
    font-family: ui-monospace, monospace; font-size: 0.78rem; padding: 0.6rem;
    box-shadow: inset 0 0 0 1px var(--val-line); border: none; outline: none; width: 100%;
  }
  @media (max-width: 768px) { .tool-grid { grid-template-columns: 1fr; } }
</style>
```

注意：本页所有可交互元素均为静态模板元素（script 只改属性/值，无 innerHTML 动态注入），无 P3-7 的 scoped 样式陷阱。

- [ ] **Step 2: 构建验证**

Run: `pnpm build && grep -o '点位标注工具' dist/lineup-tool/index.html | wc -l`
Expected: ≥ 1

- [ ] **Step 3: Commit**

```bash
git add src/pages/lineup-tool.astro
git commit -m "feat(p4): 点位标注工具页（点选战术图生成坐标与 JSON）"
```

---

### Task P4-4: 工具页 E2E 与最终全量验证

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`（追加 1 条，共 13 条）

- [ ] **Step 1: smoke.spec.ts 末尾追加工具页用例**

```ts
test('标注工具页：选图并点击生成坐标', async ({ page }) => {
  await page.goto('/lineup-tool/');
  await expect(page.getByRole('heading', { name: '点位标注工具' })).toBeVisible();
  await page.locator('#tactic-map').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('#coord-hint')).toContainText('x=');
});
```

- [ ] **Step 2: 全链路验证**

Run: `pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: lint 0 错 0 警、48 单测全绿、构建 **98 页**（97+1）、**13 条 E2E 全过**

- [ ] **Step 3: 提交并推送**

```bash
git add tests/e2e/smoke.spec.ts
git commit -m "test(p4): E2E 扩展至 13 条（工具页冒烟）"
git push
```

推送触发 GitHub Actions verify 与 Vercel 自动部署；完成后线上抽查：地图页无红点、点位列表正常、工具页可点选。

---

## Self-Review 记录

1. **范围覆盖**：用户确认的三项全部落地——撤标注（P4-1，消除"对不上"误导）、标注工具（P4-3，坐标可持续标注）、内容骨架（P4-2，9 个新特工 52 条，特工覆盖 10 → 19）。
2. **Placeholder 扫描**：骨架坐标 50/50 是**有意占位**（撤红点后不渲染，工具标注时替换——数据流转在"关键背景"显式声明）；note 只写机制用途不虚构站位（诚实边界）。
3. **类型一致性**：骨架 52 条的 agentId 均为 agents.json 真实 slug（raze/harbor/fade/neon/skye/gekko/chamber/deadlock/clove + jett 扩点，与 P3 校验过的 slug 库一致）；ability 枚举 C/Q/E/X/被动与 zod schema 一致；工具页生成的 spot 字段结构与 zod schema 完全一致（agentId/ability/label/x/y/side/note）。
4. **计数核对**：单测 48 不变；E2E 12+1=13；页面 97+1=98；lineups 总点位 52+52=104，特工覆盖 19 个（原 10 + 新 9）。