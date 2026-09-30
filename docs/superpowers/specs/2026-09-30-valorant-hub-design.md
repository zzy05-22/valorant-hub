# valorant-hub 设计文档：无畏契约中文信息站

- 日期：2026-09-30
- 状态：设计已与用户逐节确认，待评审
- 项目目录：`/Users/shuojian/Alive/valorant-hub/`

## 1. 背景与目标

为无畏契约（VALORANT）中文玩家社区提供一个数据准确、访问快速、跟随版本更新的中文信息站。

**覆盖范围**：特工 / 武器 / 地图数据、新手教学、版本资讯、电竞资讯。

**受众**：

- 国服玩家为主：使用国服译名（捷风 Jett、贤者 Sage、蝰蛇 Viper 等）与国服术语
- 兼顾国际服玩家：关键名词附英文对照

**项目性质**：发布给玩家社区使用，因此 SEO、性能、稳定部署是硬性指标，不是加分项。

**成功标准**：

1. 特工 / 武器核心数据与官方版本同步，全程无需人工维护
2. 全站静态生成，Lighthouse SEO / Performance ≥ 90
3. 从首页到任一特工详情 ≤ 3 次点击
4. 零成本运行（海外免费托管额度内）

## 2. 信息架构

### 2.1 站点地图

```
/                        首页（快速入口 + 最新版本资讯 + 精选教学）
/agents                  特工列表（按角色筛选：决斗 / 先锋 / 控场 / 哨卫）
/agents/[id]             特工详情（技能数据、背景、国服译名 + 英文对照）
/weapons                 武器列表（按类别：步枪 / 冲锋枪 / 霰弹 / 狙击 / 手枪 / 机枪）
/weapons/[id]            武器详情（伤害分段表、射速、价格、穿透、弹匣）
/maps                    地图列表
/maps/[id]               地图详情（点位说明、攻防思路）
/guides                  新手教学列表（按分类：入门 / 机制 / 经济 / 术语）
/guides/[slug]           教学文章
/esports                 电竞资讯列表（VCT 赛程、新闻）
/esports/[slug]          资讯详情
/patch-notes             版本更新资讯
404                      VALORANT 风格 404 页
```

### 2.2 MVP 分期

| 阶段 | 内容 | 说明 |
|------|------|------|
| **P0 首发** | 首页 + 特工 + 武器 + 教学 | 数据可自动同步的核心内容 |
| **P1 迭代** | 地图 + 版本资讯 + 电竞资讯 | 地图点位需人工编写，电竞数据手工维护 |
| **P2 远期** | 武器对比工具、特工阵容推荐、全站搜索 | 交互增强（Astro 岛屿），按需再做 |

YAGNI 原则：P2 功能不进入本次实现范围，只在架构上预留（构建产物为岛屿可局部挂 JS）。

## 3. 视觉设计

**方向：官方还原风**（已从 3 个方向中选定，mockup 存档于 `.superpowers/brainstorm/87303-1790735063/visual-style.html`）。

### 3.1 设计 token

```
--val-bg:        #0F1923   深蓝黑底
--val-red:       #FF4655   战术红（主色、CTA、强调）
--val-cream:     #ECE8E1   米白（主文字）
--val-gray:      rgba(236,232,225,.55)  次级文字
--val-line:      rgba(236,232,225,.12)  分隔线 / 边框
```

### 3.2 质感语言

- 切角几何：按钮与卡片用 `clip-path` 斜切角，呼应游戏 UI
- 排版：粗体无衬线大标题（`-apple-system / PingFang SC / Microsoft YaHei` 栈）；英文点缀用大字距小标签
- 首页 hero：红色小标签 + 米白大标题 + 红色 CTA + 描边次按钮
- 移动优先响应式：断点 768px / 1024px

## 4. 技术架构

### 4.1 选型

**Astro 5 静态站（SSG）+ Node 同步脚本**。从 3 个候选方案（Astro / Nuxt-Next 全栈 / 纯 HTML-JS）中选定，理由：内容站最优解——默认零客户端 JS、构建快、SEO 天然友好、免费托管零成本。

### 4.2 数据流

```
valorant-api.com（社区 API，资源源自 Riot 官方 CDN）
        │
        ▼  scripts/sync-valorant.mjs（pnpm sync 手动触发）
src/data/*.json ← 特工/武器/地图（zh-CN 主字段 + en-US 对照字段 + 同步时间戳）
        │
        ▼  astro build（构建时读取本地 JSON，全部静态渲染）
src/content/    ← 人工内容：guides / esports / patch-notes（Markdown + zod schema）
        │
        ▼
纯静态产物 → Vercel 或 Netlify 免费托管
```

**同步与构建解耦**：同步失败不影响构建（构建只读已提交的 JSON），这是静态站稳定性的关键。

### 4.3 目录结构

```
valorant-hub/
├── scripts/sync-valorant.mjs      # 数据同步脚本（重试 / 校验 / 原子写入）
├── src/
│   ├── data/                      # 脚本生成的游戏数据 JSON（禁止手工编辑）
│   ├── content/
│   │   ├── guides/                # 教学文章 Markdown
│   │   ├── esports/               # 电竞资讯（初版手工维护）
│   │   └── config.ts              # 内容集合定义（zod schema）
│   ├── pages/                     # 路由（见 2.1 站点地图）
│   ├── components/                # AgentCard / WeaponCard / SkillPanel / NavBar / Footer…
│   ├── layouts/                   # 基础布局（响应式 + SEO meta）
│   └── styles/                    # 设计 token、切角 mixin、全局样式
├── tests/                         # 同步脚本 fixtures 测试
└── astro.config.mjs
```

### 4.4 关键技术决策

1. **译名策略**：同步时同时拉取 `language=zh-CN` 与 `language=en-US`，双语字段合并进同一 JSON；前端中文为主、副标注英文。不做运行时翻译。
2. **图片热链不落地**：特工 / 武器 / 技能图标直接引用 valorant-api.com 提供的 Riot 官方 CDN URL，`loading="lazy"` + `onerror` 占位降级。不为几百张图标做本地存储。
3. **API 数据能力边界**（如实声明）：
   - 武器：伤害分段（damageRanges）、价格、射速、穿透、弹匣 ✅ 完整
   - 特工：技能名 / 描述 / 图标 ✅；**技能具体数值**（伤害 / 血量 / 时长）API 不提供 → 初版用官方描述文案，数值表后续作为内容补充
   - 地图：基础信息 + 官方战术图 ✅；**点位攻略**需人工编写（P1）
4. **SEO 基建**：全站静态生成 + `sitemap.xml` + canonical + Open Graph meta；列表页用静态分页。
5. **交互预留**：P0 全站零 JS（纯 CSS 筛选用 `:checked` 或导航参数方案）；P2 交互模块以 Astro 岛屿形式局部挂载。

## 5. 数据模型

### 5.1 同步生成的 JSON（`src/data/`）

```jsonc
// agents.json
{
  "syncedAt": "2026-09-30T00:00:00Z",
  "agents": [{
    "id": "jett",
    "zh": { "name": "捷风", "description": "…", "role": "决斗者" },
    "en":  { "name": "Jett",  "description": "…", "role": "Duelist" },
    "roleIcon": "…", "fullPortrait": "…", "background": "…",
    "abilities": [{ "slot": "Q", "key": "…", "zh": {"name":"…","description":"…"}, "en": {"name":"…","description":"…"}, "icon": "…" }]
  }]
}

// weapons.json：含 category、credits 价格、damageRanges[]（射程分段伤害）、fireRate、magazineSize、wallPenetration 等

// maps.json：含中英名称、坐标、显示图标、战术小地图 URL、基础说明
```

### 5.2 内容集合 schema（`src/content/config.ts`）

- `guides`：title / category（入门、机制、经济、术语）/ excerpt / publishDate / draft
- `esports`：title / type（赛程、新闻）/ excerpt / publishDate
- `patch-notes`：title / patchVersion / publishDate / source URL

frontmatter 由 zod 校验，构建期拦截脏数据。

## 6. 错误处理

| 层面 | 处理方式 |
|------|----------|
| 同步脚本 | 请求失败指数退避重试 3 次；关键数据校验（名称 / 技能数组非空、数量下限）通过才落盘；原子写入（临时文件 + rename）避免半截 JSON |
| 构建 | 构建不触网；内容集合 schema 校验失败即构建失败，脏数据无法上线 |
| 页面 | 图标 `onerror` 降级占位图；VALORANT 风格 404；外链 `rel="noopener"` |

## 7. 测试策略

- **同步脚本（重点）**：以 fixtures（保存的 API 响应样本）离线测试，断言字段映射、双语合并、数据量下限（特工 ≥ 20、武器 ≥ 15）
- **关键组件**：AgentCard、WeaponCard 等核心组件渲染断言
- **E2E 冒烟**：Playwright 验证 4 条核心路径（首页 → 特工列表 → 特工详情 → 武器列表）可访问且核心元素存在
- **CI**：GitHub Actions push 触发 lint + 测试 + 构建；可选每日定时任务自动 `pnpm sync` 并提交数据更新

## 8. 部署

- 代码托管 GitHub，自动构建部署至 Vercel 或 Netlify（二选一，构建命令 `astro build`，产物纯静态）
- 接受国内访问速度波动的现实（已确认）
- 域名：初版用托管平台默认域名，后续可绑定自定义域名

## 9. 风险与限制

| 风险 | 缓解 |
|------|------|
| valorant-api.com 为社区维护，存在停更风险 | 数据 JSON 提交进 git；构建不依赖 API，快照永远可用 |
| 特工技能数值 API 缺失 | 初版用官方描述；数值表以内容形式人工补充 |
| 地图点位 / 攻略为人工创作 | P1 交付基础信息先行，攻略渐进补充 |
| 国服版本与国际服存在时间差 | 数据跟随 API 的国际服版本；页面标注数据版本号，不承诺国服同步 |