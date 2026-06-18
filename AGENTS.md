# Weblink — Agent 指南

## 仓库结构

这是一个 **pnpm workspace** 单仓库，部署地址：https://weblink.pages.dev

- `apps/` — 可独立构建的应用（`@weblink/home` 聚合首页 + 各 `@weblink/*kit`）
- `packages/` — 共享库（`tokens`、`utils`、`ui-vue`、`eslint-config`、`tsconfig`）
- `src/` + `electron/` — **遗留代码**，正在向 `apps/*` 迁移，新功能不要放这里
- `src/libs/` — git 子模块（`webdap`、`webstlink`、`webdfu`），是 ARM 调试协议的 vendored fork

根目录外的 `weblink-*kit/` 文件夹是**独立 git 仓库**（各自有 `.git/`），不是子模块，也不在 pnpm workspace 管理范围内。

## 常用命令

所有命令在 `weblink/` 目录下执行：

```bash
pnpm install            # 安装全部依赖（pnpm 11，Node 24）
pnpm dev                # 启动 apps/home 聚合首页
pnpm dev:legacy         # 启动根目录遗留 Vue 应用（src/）
pnpm build              # 全量构建所有包
pnpm lint               # 遍历所有包执行 lint（有 lint 脚本的包才执行）
pnpm test               # 遍历所有包执行测试
pnpm format             # prettier --write 全仓库
pnpm changeset          # 创建变更集（版本管理）
```

单包操作：

```bash
pnpm --filter @weblink/downloadkit dev      # 只启动某个 kit
pnpm --filter @weblink/home build           # 只构建某个包
pnpm -r --if-present run lint               # 等同于 pnpm lint
```

## 依赖规则

- `packages/*` **不得**依赖 `apps/*`，共享代码只能放 `packages/`
- Vue 类应用可依赖 `@weblink/tokens`、`@weblink/utils`、`@weblink/ui-vue`
- 包名格式：`@weblink/serialkit`、`@weblink/downloadkit` 等

## 代码风格

Prettier 配置（`.prettierrc.json`）：无分号、单引号、行宽 100。

EditorConfig：2 空格缩进、LF 换行。

ESLint：Vue flat config + `@vue/eslint-config-prettier/skip-formatting`（格式化交给 Prettier）。

## CI

`.github/workflows/ci.yml`：pnpm 11 + Node 24，执行顺序为 `lint`（`continue-on-error: true`）→ `test` → `build`。lint 失败不阻塞构建。

## 技术栈

- Vue 3 + Vite + Vue Router + Pinia
- 部分包使用 TypeScript（`downloadkit`、`flashkit`、`capturekit`、`serialkit`、`home`），部分纯 JS（`gnsskit`、`modbuskit`）
- UI 库：naive-ui（部分 kit）
- 工具包：Web Serial、WebUSB、WebHID、WebRTC 等浏览器硬件 API，纯客户端运行

## 注意事项

- Vue DevTools 默认关闭，通过 `VITE_VUE_DEVTOOLS=1` 环境变量启用（Node 24 下有 localStorage shim 兼容处理）
- `electron/` 是桌面壳代码，与 web 应用分开，当前未集成到 pnpm workspace
- Changesets 配置 `commit: false`、`access: "restricted"`，基线分支为 `main`
