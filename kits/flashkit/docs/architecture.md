# weblink-flashkit 架构

## 分层

- **表现层**：`src/features/**` 的 Vue 组件；依赖应用门面，不直接操作 USB 端点。
- **应用层**：`src/application/**`（如 `FlashWorkbenchFacade`）编排用例：选桥、选总线、选芯片、读/写/校验。
- **领域层**：`src/domain/**` 无浏览器依赖；SPI NOR / I²C EEPROM 命令序列与参数表。
- **基础设施层**：`src/infrastructure/**` — WebUSB 会话、CH341 Vendor Bulk 协议实现。
- **矩阵**：`src/matrix/**` — 桥后端 id、USB 过滤器、能力声明（SPI / I²C）。

## 命名

- 目录：`kebab-case`
- 组件：`PascalCase.vue`
- TS 类型/类：`PascalCase`；函数/变量：`camelCase`
- 桥后端 id：`kebab-case` 字符串（如 `ch341-vendor-bulk`）

## 质量

- `npm run lint` / `npm run test` / `vue-tsc`（见 `package.json`）
