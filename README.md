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