# 变更提案：新增 @weblink/otakit（通用 OpenBLT OTA 升级工具）

## Why

weblink 面向嵌入式开发者，但缺少"通用 OTA 固件升级"能力。OpenBLT 是成熟的开源 bootloader（feaser.com），其 host 库 `libopenblt` 已有 TS 忠实实现 `@insightop/libopenblt`（XCP 协议、Modbus RTU transport、HEX/SREC 解析、session、seed/key）。当前各交付项目（如 sesp）各自内嵌 OTA 上位机逻辑，重复且难以维护。需要一个**独立部署、人人可访问、带参数跳转即用**的通用 OTA 升级服务，让任意项目通过 URL 携带协议/固件地址跳转过来完成刷写，而无需把 OTA 代码引入各自项目。

## What Changes

- 新增 `kits/otakit/`（包名 `@weblink/otakit`）：基于 Web Serial + `@insightop/libopenblt` 的通用 OpenBLT OTA 升级工具
  - `core/` 层：传输无关的 OTA 刷写会话（`OtaSession`，从 sesp 的 `modbus-ota` 包移植并去 sesp 化）、`SerialPort` 适配器（transact → libopenblt SerialPort）、固件获取（URL 下载 / 本地上传解析）
  - `url-params/` 层：URL 参数解析（协议、从站地址、波特率、固件 URL、自动开始等），参考 downloadkit 的 `parseUrlParams` 模式
  - `react-app/` 层：React 实现的 OTA 调试工具 UI（串口选择 → 固件选择/上传 → 刷写进度 → 日志面板）
  - `vue-entry`：Vue 壳（EmbeddedPage，react-dom createRoot 桥接，照抄 streamkit 模式）
- 注册进 `apps/web` 的 `kitRegistry.ts`（懒加载 `import("@weblink/otakit/vue")`）
- 新增 npm 依赖：`react@^19.1.0`、`react-dom@^19.1.0`（workspace 已有基线）、`@insightop/libopenblt`（升级到 **0.2.2**，与 sesp 仓库版本对齐）
- 不改动任何现有 kit 与 packages 的行为

## Capabilities

### New Capabilities

- `ota-kit-core`: OTA 刷写领域行为——`OtaSession`（backdoor 重试连接、info table 检查、擦除/写入流程）、`SerialPort` 适配器、固件获取（URL/上传）、URL 参数解析
- `ota-kit-shell`: otakit 的呈现与集成行为——React 刷写界面（含浏览器能力检测与不支持提示）、Vue 壳桥接、kitRegistry 注册

### Modified Capabilities

（无——现有 spec 目录为空，本变更不修改既有能力）

## Impact

- **代码**：新增 `kits/otakit/**`；修改 `apps/web/src/config/kitRegistry.ts`（追加一项注册）
- **依赖**：kits/otakit 新增 `react`、`react-dom`、`@insightop/libopenblt`（升级到最新版）
- **构建**：vite 双插件（vue + react-swc）、双 typecheck（tsc + vue-tsc），与 streamkit 一致
- **风险**：Web Serial 仅 Blink 内核支持（iOS 全系不可用）——产品预期已确认：首版仅 Web，不支持 iOS；串口波特率默认 115200（可配置）
