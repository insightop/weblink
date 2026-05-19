# Weblink Monorepo 架构（摘要）

## 布局

- **`apps/`**：可独立构建、可独立发版的应用（`@weblink/home`、各 `@weblink/*kit`）。
- **`packages/`**：共享库（`@weblink/tokens`、`@weblink/utils`、`@weblink/ui-vue`、配置包等）。

## 依赖规则

- `packages/*` **不得**依赖 `apps/*`。
- Vue 工具类应用可依赖 `@weblink/tokens`、`@weblink/utils`、`@weblink/ui-vue`；非 Vue 的 kit 当前不接 workspace 包。

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 `apps/home` |
| `pnpm dev:legacy` | 启动仓库根目录遗留 `src/` 应用 |
| `pnpm build` | 全 workspace `build`（各包有 `build` 脚本则执行） |
| `pnpm test` | 运行各包测试 |

更完整的分层约定见各 kit 内文档（如 downloadkit 的架构说明）。
