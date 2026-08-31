# 变更提案：新增 @weblink/improvkit（Improv Wi-Fi 配网工具包）

## Why

weblink 面向嵌入式开发者，但缺少"给无屏 IoT 设备配网"的能力。Improv Wi-Fi 是开放标准（Apache-2.0），设备端生态成熟（ESPHome、Tasmota、WLED、ESP Web Tools 均已支持）。上游官方 JS SDK（improv-wifi-serial-sdk@2.8.1）提供框架无关的 core 类，可直接复用；其自带 web component UI 为英文 Material 弹窗，无法满足 weblink 中文 i18n 与统一设计语言的要求，因此 UI 层自研（React），协议层吃上游红利。

## What Changes

- 新增 `kits/improvkit/`（包名 `@weblink/improvkit`）：基于 Web Serial 的 Improv 配网全流程工具
  - domain 层：传输无关的配网状态机与 `IImprovTransport` 接口（为 BLE 预留扩展点，本期不实现 BLE）
  - infrastructure 层：包装 `ImprovSerial`（improv-wifi-serial-sdk 的 core 类，不引入其 lit/Material UI）
  - features 层：React 实现的配网流程 UI（能力检测 → 连接设备 → 设备信息 → 扫描选网/手动输入 → 密码 → 进度 → 成功/失败）
  - vue-entry：Vue 壳（EmbeddedPage，react-dom createRoot 桥接，照抄 streamkit 模式）
- 注册进 `apps/web` 的 `kitRegistry.ts`，支持中英文 i18n 消息合并
- 新增 npm 依赖：`improv-wifi-serial-sdk@^2.8.1`（仅 kits/improvkit）
- 不改动任何现有 kit 与 packages 的行为

## Capabilities

### New Capabilities

- `improv-provisioning`: Improv 配网领域行为——传输抽象接口、统一状态机（IDLE/CONNECTING/READY/AUTHORIZATION_REQUIRED/PROVISIONING/PROVISIONED/ERROR）、Web Serial 传输实现、Wi-Fi 扫描、凭据下发、错误映射
- `improv-kit-shell`: improvKit 的呈现与集成行为——React 配网界面（含浏览器能力检测与不支持提示）、Vue 壳桥接、kitRegistry 注册与 i18n

### Modified Capabilities

（无——现有 spec 目录为空，本变更不修改既有能力）

## Impact

- **代码**：新增 `kits/improvkit/**`；修改 `apps/web/src/config/kitRegistry.ts`（追加一项注册）
- **依赖**：kits/improvkit 新增 `improv-wifi-serial-sdk`、`react`、`react-dom`（workspace 已有 react 版本基线 ^19.1.0）
- **构建**：vite 双插件（vue + react-swc）、双 typecheck（tsc + vue-tsc），与 streamkit 一致
- **风险**：Web Serial/Web Bluetooth 仅 Blink 内核支持（iOS 全系不可用）——产品预期已确认：首版仅 Web，不支持 iOS；串口波特率固定 115200（协议约定）
