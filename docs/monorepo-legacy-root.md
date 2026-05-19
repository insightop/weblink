# 根目录 `src/` 与 `electron/`（遗留说明）

Monorepo 引入后，**主聚合入口**为 [`apps/home`](../apps/home)：使用 `pnpm dev` 或 `pnpm --filter @weblink/home dev` 启动。

## `src/`（仓库根下的 Vue 应用）

- 历史 **Weblink 工作台**（多 Tab / iframe 等）仍位于仓库根目录 [`src/`](../src)。
- 启动：`pnpm dev:legacy`（使用根目录 [`vite.config.js`](../vite.config.js)）。
- 长期方向：将仍需要的功能迁入 `apps/*` 或单一 `apps/desktop`，然后删除或缩小根 `src/`，避免与 `apps/home` 双入口混淆。

## `electron/`

- 桌面壳相关代码仍保留在 [`electron/`](../electron)。
- 若未来单独发版桌面应用，建议迁入 `apps/desktop` 并在此文档更新路径。

## 与 `apps/home` 的关系

- **不要**把 `apps/home` 与根 `src/` 混在同一入口；新功能优先落在 `apps/*`。
