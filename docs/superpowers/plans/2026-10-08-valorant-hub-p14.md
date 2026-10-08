# valorant-hub P14 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ① 特工上手教学页 ×29（数据驱动 + 手写详细讲解，教学栏目规模化）；② 选手设置库（灵敏度查证，准星库选手卡扩展）。用户要求：**内容要详细**（技能机制/用法/连招/常见错误级别，不是参数罗列）。

**Architecture:** 仿 map-guides 模式：新 content collection `agent-guides`（每特工一篇手写详细 md）+ 动态路由 `/guides/agents/[id]/`（md 内容 + 自动并入官方中文技能数据/点位联动/出场率联动）+ 列表页按角色分组。选手设置为独立数据文件 + 准星库页面渲染层合并。

**Tech Stack:** 同 P0-P13。

**用户决策记录（2026-10-08）:** "可以，但也要写的详细一点"（批准特工教学页 + 选手设置库，强调详细）

**探测记录（2026-10-08 实测）：**
- agents.json：29 特工，abilities 含 slot/zh.name/zh.description（官方中文）/icon——数据驱动层就绪；缺价格/参数（手写内容补）
- map-guides collection 为现成模式参照（13 篇地图攻略）
- prosettings 灵敏度已查证：nAts 800/0.49/392、ShahZam 800/0.265/212（与我们收录选手重合的 2 位）；其余待补搜
- 技能价格常识基准：C 键 200$/Q、E 键 200-400$（具体按特工），X 大招 6-8 点——**写进内容前逐特工核对游戏内真实价格**，拿不准的写"以游戏内为准"

**前置状态:** P0-P13 已上线；89 页；67 单测 + 18 E2E 全绿；本地 c78b6bc 与远端同步。

---

## 环境前提

- 工作目录 `/Users/shuojian/Alive/valorant-hub/`，git main 干净；今天日期 **2026-10-08**

## 关键背景（给零上下文的执行者）

- **内容质量红线**：用户明确要求"详细"——每技能必须有：价格/点数、机制详解（怎么生效）、用法要点（什么时候放/怎么放/连招）、常见错误；整篇含实战思路（进攻/防守）。**禁止**官方描述照搬充数、空洞套话（"用好可以赢"式废话）。
- **事实红线**：技能机制/参数是公开游戏信息，可写；**拿不准的价格/数值宁可省略或写"以游戏内当前版本为准"，不许编**。
- **联动设计**：详情页自动并入——官方中文技能名/描述/图标（agents.json）、该特工道具点位入口（lineups，`/maps/` 各图）、职业赛出场（meta.json 若该特工在当前赛事有 pick 数据）、特工图鉴互链。
- **测试教训（P13）**：content schema 枚举/字段改动要同步 config.ts（P13 曾因 category 枚举构建失败）。
- **计数核对**：页面 89 + 29（教学详情）+ 1（教学列表）= **119**；单测 **67 不变**（内容型）；E2E 18 + 2（教学列表 + 详情抽查）= **20**。

## 文件结构总览

```
src/content/config.ts                 # P14-1 加 agentGuides collection
src/content/agent-guides/*.md         # P14-2 29 篇手写详细教学（样例 jett.md 由主工程师写）
src/pages/guides/agents/index.astro   # P14-1 教学列表（按角色分组）
src/pages/guides/agents/[id].astro    # P14-1 详情页（md + 数据联动）
src/pages/guides/index.astro          # P14-1 加入口卡
src/pages/agents/[id].astro           # P14-1 加"上手教学"链接
src/data/pro-settings.json            # P14-3 选手灵敏度数据（查证到的）
src/pages/crosshairs/index.astro      # P14-3 选手卡加灵敏度行
tests/e2e/smoke.spec.ts               # P14-4 +2 用例
```

---

### Task P14-1: 架构 + 捷风格例（主工程师执行）

- [ ] config.ts 加 agentGuides（schema：agentId/title/publishDate/draft，正文 markdown）
- [ ] 写 `src/content/agent-guides/jett.md` 样例（详细标准：技能 C/Q/E/X 各带价格/机制/用法/错误 + 实战思路）——作为子代理的质量模板
- [ ] `/guides/agents/index.astro`：列表按角色分组（决斗者/先锋/控场者/哨位），数据从 agents.json 取角色 + agentGuides 存在性过滤
- [ ] `/guides/agents/[id].astro`：getStaticPaths 遍历 agentGuides；渲染 md 正文 + 头部（头像/角色/中英名）+ 联动区（技能官方描述卡、点位入口、meta 出场、图鉴链接）
- [ ] /guides/ 列表页入口卡 + /agents/[id]/ "上手教学 →" 链接
- [ ] 构建验证：30 页新增（29 详情 + 1 列表，若内容只先有 jett 则部分路由——**注意**：getStaticPaths 以 agentGuides 为源，内容没写齐前只生成已有条目；P14-2 完成后才是 29）→ 此步构建预期 90 页（89 + jett 详情 + 列表）
- [ ] Commit: `feat(p14): 特工教学架构 + 捷风格例`

### Task P14-2: 29 篇详细教学（3 子代理并行 + 主工程师审查）

分派（按角色均衡，jett 已完成）：
- **子代理 A（决斗者 + 部分先锋）**：reyna、phoenix、raze、neon、yoru、iso、waylay、veto、miks、gekko、breach、fade（12）
- **子代理 B（先锋 + 控场）**：skye、kay-o、sova、tejo、brimstone、omen、viper、astra、harbor、clove、cypress 相关真实特工按 agents.json 实际 29 人名单核对分派
- **子代理 C（哨位）**：sage、cypher、killjoy、chamber、deadlock、vyse + 剩余

（执行时以 `node -e "require('./src/data/agents.json')..."` 输出的 29 人真实清单为准修正分派，确保不重不漏）

每个子代理要求：
- 读 jett.md 样例为质量基准；读 agents.json 对应特工的官方中文技能名/描述（事实基础）
- 每篇 600-1000 字中文，结构对齐样例；技能价格按游戏常识，拿不准写"以游戏内为准"
- 不编造伤害数值（除非确定）；不用空洞套话
- 主工程师逐篇审查：抽查价格/机制事实 + 文风，不合格返工

### Task P14-3: 选手设置库

- [ ] 补搜重点选手 sens（TenZ/aspas/Derke/yay/cNed/ScreaM/zekken 等，prosettings 系）
- [ ] `src/data/pro-settings.json`：已查证 nAts 800/0.49/392、ShahZam 800/0.265/212 + 补搜结果；**查不到的不收录**（不硬编）
- [ ] 准星库页面选手卡：有 sens 数据的卡显示"灵敏度 DPI × sens ≈ edpi"行；数据说明注"来自社区公开资料，以选手当前实际为准"

### Task P14-4: 收尾（主工程师）

- [ ] E2E +2：教学列表页（/guides/agents/ h1 + 角色分组）+ 特工教学详情（/guides/agents/jett/ h1）→ 20 条
- [ ] 全链：lint 0/0、67 单测、**119 页**、20 E2E（首页超时重跑惯例）
- [ ] push + 线上验证 + 交付总结

---

## Self-Review 记录

1. **范围**：用户批准 ① 特工教学 ×29 + ② 选手设置；① 是主体。② 只做查证到的，宁缺毋假。
2. **质量**："详细"是硬要求——样例篇定标准，子代理对齐，逐篇审查。
3. **计数**：119 页、67 单测、20 E2E；P13 教训（schema 枚举）已规避——新 collection schema 新增无枚举冲突。
4. **分派修正**：29 人实际名单以 agents.json 为准（探测已确认 29 人），执行时核对不重不漏。