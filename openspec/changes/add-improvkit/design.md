# 技术设计：@weblink/improvkit

## Context

- weblink 为 pnpm workspace 单仓库（apps/kits/packages），kit 标准形态见 `kits/serialkit`（Clean 分层）与 `kits/gamepadkit`（纯 React）；"React 内核 + Vue 壳"已有先例 `kits/streamkit`/`kits/webtransportkit` 的 `vue-entry.ts` 桥接模式。
- 上游 SDK 事实（已验证）：`improv-wifi-serial-sdk@2.8.1` 的 npm 包**无 exports 字段**，子路径导入自由；`dist/serial.js` + `dist/const.js` 为纯 ESM、**不依赖 lit/@material/web**；core 类 `ImprovSerial(port, logger)`，事件 `state-changed` / `error-changed` / `disconnect`；`Logger` 接口为 `{ log, error, debug }`。
- 浏览器约束：Web Serial 仅 Blink 内核（桌面 Chrome/Edge + Android），要求 secure context；iOS 不支持（已确认不在范围）。
- 动机与范围见 proposal.md，行为契约见 specs/*。

## Goals / Non-Goals

**Goals:**
- Clean 分层的 kit：domain（传输无关状态机 + 接口）/ infrastructure（Web Serial 实现）/ features（React UI）/ vue-entry（Vue 壳）
- 配网全流程：能力检测 → 连接 → 设备信息 → 扫描选网/手动输入 → 密码 → 进度 → 成功（nextUrl 跳转）/ 失败重试 / 更换 Wi-Fi
- 中英文 i18n，接入 kitRegistry 懒加载聚合
- BLE 仅保留 domain 接口扩展点，不写实现

**Non-Goals:**
- BLE 传输实现、hostname/deviceName 编辑 UI（二期）、desktop shell、iOS 支持
- 不改动现有任何 kit 与 packages 的对外行为

## Decisions

### D1 协议层复用 SDK core 类，子路径导入
```ts
import { ImprovSerial } from "improv-wifi-serial-sdk/dist/serial.js";
import { ImprovSerialCurrentState, ImprovSerialErrorState } from "improv-wifi-serial-sdk/dist/const.js";
```
- **备选 A 自研协议层**：重复造轮子，放弃上游红利（RPC 序列化锁、超时、扫描合并），否决。
- **备选 B SDK web component**：shadow DOM 无 slot、英文硬编码、Material 风格、弹窗形态不可拆，与 weblink 产品形态结构性冲突，否决。
- 风险：无 exports 字段属于"隐式允许"，若上游未来加 exports 可能破坏导入 → 缓解：在 package.json 用精确版本 `^2.8.1` 并在 README 记录依赖点。

### D2 状态机映射（SDK → domain）
| ImprovSerialCurrentState | domain State |
|---|---|
| （未连接） | IDLE / CONNECTING |
| STOPPED(0x00) | ERROR（类别 `DEVICE_WIFI_DISABLED`） |
| READY(0x02) | READY |
| PROVISIONING(0x03) | PROVISIONING |
| PROVISIONED(0x04) | PROVISIONED |
| 连接失败/非 Improv 设备 | ERROR（类别 `NOT_IMPROV_DEVICE` 等） |

`AUTHORIZATION_REQUIRED` 为 BLE 预留态，Web Serial 不会产生。错误映射表集中在 domain 层单一模块，SDK 错误码不外泄。

### D3 扫描策略（v1）
进入 `READY` 后自动执行一次 `scan()`，UI 提供"刷新"按钮手动重扫。SDK 的 `subscribeSSIDs()` 持续轮询暂不启用（YAGNI）。设备返回 `UNKNOWN_RPC_COMMAND` 时标记"扫描不可用"，降级为纯手动输入 SSID。

### D4 Vue 壳桥接与 i18n
照抄 streamkit 的 `vue-entry.ts`（`defineComponent` + `createRoot().render()`）。增强点：`setup()` 中用 `useI18n()` 取响应式 locale，`watchEffect` 中以当前 locale 重渲染 React 根——应用内切换语言时 React 树实时跟随。语言包由 kit 自带（`messages` / `messagesZhCN` 导出，KitWrapper 已有合并机制）；React 树内部按 locale 从自带字典取词，不直接依赖 vue-i18n 运行时。
- **备选**：React 内部读 `navigator.language`——无法满足 spec 的"切换语言随之切换"场景，否决。

### D5 样式
沿用 gamepadkit 先例：普通 CSS 文件 + BEM 风格类名 + `@weblink/tokens` 的 CSS 变量。naive-ui 是 Vue 组件库，不进 React 树。

### D6 测试策略（TDD 主战场）
1. **domain 层**：纯逻辑 vitest 单测（错误映射表、状态机归约函数）。
2. **transport 单测**：`SerialTransport` 通过构造函数注入 `ImprovSerial` 工厂，用内存 mock 验证生命周期与事件转发。
3. **transport 集成测试**：`FakeImprovDevice`——实现 SerialPort 接口的内存假设备（ReadableStream/WritableStream），按真实线上帧格式应答 RPC（帧常量从已安装包 `dist/const.js` 导入，封包格式对照 `dist/serial.js` 源码实现），覆盖连接→信息→扫描→配网成功/失败→关闭全链路，无需真硬件。
4. **hooks/UI**：`@testing-library/react` + happy-dom（streamkit 已有先例），hook 用 fake transport 注入测试状态推进与重试逻辑。

## Risks / Trade-offs

- [上游无 exports 字段被收紧] → 锁定 `^2.8.1` + README 记录；必要时后续 vendor 一份薄封装。
- [`dist/*.js` 为 ESM 而 vitest/node 环境] → vite/vitest 原生支持 ESM；typecheck 用包内 `serial.d.ts`。
- [假设备的帧格式实现偏差导致测试误报] → 帧头/校验和常量直接从安装包导入，封包逻辑对照源码编写；集成测试失败时先核对帧格式再改业务码。
- [React 与 Vue 双运行时体积] → kit 懒加载，仅进入该 kit 才下载两个运行时（streamkit 同款代价，可接受）。

## Migration Plan

纯增量变更：新增 `kits/improvkit/**`，`kitRegistry.ts` 追加一项。回滚 = 删除目录 + 移除注册项。

## Open Questions

无（BLE 范围、波特率、iOS 取舍均已与需求方确认）。
