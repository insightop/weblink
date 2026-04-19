# 架构与工程约定（摘要）

## 分层

- **表现层**：`src/features/**` 下的 Vue 组件、路由；可依赖 Pinia、vue-i18n、Naive UI。
- **应用门面**：`src/features/flasher/services/flasherFacade.ts` 编排下载用例，可调用 `core/`、插件与 `i18n` 做日志文案。
- **领域核心**：`src/core/**` 不依赖 Vue；会话与状态机与 UI 解耦。
- **插件 / 协议 / 传输**：`src/plugins`、`src/protocols`、`src/transports`；通过接口与门面交互。

## 命名

- 目录：`kebab-case`（如 `helps`）。
- 组件文件：`PascalCase.vue`。
- TS 符号：`camelCase`（函数/变量）、`PascalCase`（类型/类）。

## 国际化

- 文案：`src/locales/*.json` + `vue-i18n`；持久化键 `app.locale`。
- 帮助文档：`src/helps/zh`、`src/helps/en` 分语言 Markdown。

## 质量

- Lint：`eslint`；类型：`vue-tsc`；测试：`vitest`。
