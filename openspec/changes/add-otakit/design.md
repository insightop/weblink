# 技术设计：@weblink/otakit

## Context

- weblink 为 pnpm workspace 单仓库（apps/kits/packages），kit 标准形态见 `kits/serialkit`（Clean 分层）与 `kits/gamepadkit`（纯 React）；"React 内核 + Vue 壳"已有先例 `kits/streamkit`/`kits/webtransportkit` 的 `vue-entry.ts` 桥接模式。
- 底层库事实（已验证）：`@insightop/libopenblt` 是上游 C libopenblt 的 TS 忠实实现，API 面 1:1 对齐（`bltSessionInit/Start/Stop/ClearMemory/WriteData/CheckInfoTable`、`bltFirmware*`、`bltUtil*`）。`SerialPort` 接口为字节级 `open/close/write/read`。`XcpTpMbRtu` 是 Modbus RTU transport。**全局单例**：`session.ts` 的 module-level `protocolPtr`，一次只能一个活动会话。
- 浏览器约束：Web Serial 仅 Blink 内核（桌面 Chrome/Edge + Android），要求 secure context；iOS 不支持（已确认不在范围）。
- 动机与范围见 proposal.md，行为契约见 specs/*。

## Goals / Non-Goals

**Goals:**
- Clean 分层的 kit：core（传输无关刷写会话 + 适配器 + 固件获取 + URL 解析）/ react-app（React UI）/ vue-entry（Vue 壳）
- OTA 刷写全流程：串口选择 → 固件选择（URL/上传）→ 连接 bootloader → 擦除/写入进度 → 成功/失败重试
- URL 参数预填与自动开始（参考 downloadkit 的 parseUrlParams 模式）
- 中英文 i18n，接入 kitRegistry 懒加载聚合

**Non-Goals:**
- 触发设备进入 bootloader（官方 libopenblt 无此 API，各项目自行触发后再跳转）
- 固件版本检查、固件存储管理（各项目自管）
- 多设备并发刷写（libopenblt 全局单例限制，单设备即可）
- 非 Modbus RTU transport（CAN/UART/USB/NET 为 libopenblt 未来扩展，本期不做）
- seed/key 解锁（`seedKeyAlgorithm` 不注入，本期不支持）
- parity/stopbits 可配置（固定 0/1，仅 baudrate 可配置）
- CORS 代理（固件 URL 直接 fetch，不经任何代理中转）
- 遥测（未来 otakit 自实现，本期不做）
- 不改动现有任何 kit 与 packages 的对外行为

## Decisions

### D1 底层复用 @insightop/libopenblt，升级到 0.2.2
```ts
import { bltSessionInit, bltSessionStart, bltSessionStop, bltSessionTerminate,
  bltSessionCheckInfoTable, bltSessionClearMemory, bltSessionWriteData,
  bltFirmwareInit, bltFirmwareTerminate, bltFirmwareLoadFromFile,
  bltFirmwareGetSegmentCount, bltFirmwareGetSegment, HexParser,
  BLT_SESSION_XCP_V10, BLT_TRANSPORT_XCP_V10_MBRTU, BLT_RESULT_OK,
  BLT_RESULT_ERROR_SESSION_INFO_TABLE, BLT_RESULT_ERROR_SESSION_INFO_TABLE_NOT_SUPPORTED,
  type SerialPort } from "@insightop/libopenblt";
```
- **基线版本定为 0.2.2**（与 sesp 仓库 `sesp/libopenblt` 一致），而非当前 weblink 锁定的 0.1.0。理由：0.1.0 的 `BltSessionSettingsXcpV10` 用 `seedKeyFile: string|null`，0.2.2 改用 `seedKeyAlgorithm?: XcpProtectAlgorithm`（类型不兼容）；且 `bypassFirmwareStart` 字段仅 0.2.2 存在，spec D5 需要它。移植源 `sesp_master/packages/modbus-ota/src/otaSession.ts` 使用的 `seedKeyFile: null` 是 0.1.0 写法，升级时需改为不再传 seed 字段（0.2.2 下 seed 可选）。
- seed/key 本期**不支持**（列为 Non-Goal）：`seedKeyAlgorithm` 不传入，仅适配默认无 seed/key 解锁流程；需要 seed/key 解锁的设备本期不可用，后续再扩展。
- 备选 A 自研协议层：重复造轮子，放弃上游红利，否决。
- 备选 B 引入其他 OTA 库：非 OpenBLT 生态，否决。
- 风险：libopenblt 全局单例 → 单设备串行刷写即可，本期不做并发。

### D2 OtaSession 从 sesp 的 modbus-ota 移植并去 sesp 化
`OtaSession` 从 `sesp_master/packages/modbus-ota/src/otaSession.ts` 移植，去掉 sesp 特定依赖（`@sesp/instrument` 的 emit、`@sesp/modbus-runtime` 的 IModbusSession），改为纯 TS + 注入回调。核心逻辑（SerialPort adapter、backdoor 重试、info table 检查、32KB 擦除/256B 写入流程）保持对齐上游 BootCommander main.c。

**修正移植源缺陷**：上游移植源将 `baudrate/parity/stopbits` 硬编码为 `115200/0/1`，且构造函数不接收串口参数。本期改为 `OtaSession` 构造参数接收 `baudrate`：
```ts
constructor(
  transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>,
  slaveId: number,
  baudrate: number,
  options?: OtaSessionOptions,
)
```
`parity` 固定 `0`（NONE）、`stopbits` 固定 `ONE`，不进 URL 参数、不进构造函数、不进 UI（保持最小）。`baudrate` 传给 `bltSessionInit` 的 transport settings。

### D3 SerialPort 适配器（transact → libopenblt SerialPort）
```ts
export function createSerialPortAdapter(
  transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>,
): SerialPort
```
- 这是"任意项目接入 OTA"的关键：任何能提供 `transact` 的通道（Web Serial、Node serialport、HTTP/WS 桥）都能接入刷写。
- Web Serial 的 `transact` 实现：`write(frame)` 后读响应，封装在 `react-app` 层的 serial 模块。

### D4 URL 参数解析（参考 downloadkit）
```ts
export const URL_PARAM_KEYS = {
  PROTOCOL: "protocol", SLAVE_ID: "slaveId", BAUD_RATE: "baudrate",
  FIRMWARE: "firmware",
  AUTO: "auto", TIMEOUT_T1: "timeoutT1", TIMEOUT_T3: "timeoutT3",
  TIMEOUT_T4: "timeoutT4", TIMEOUT_T5: "timeoutT5", TIMEOUT_T6: "timeoutT6",
  TIMEOUT_T7: "timeoutT7", BYPASS_FIRMWARE_START: "bypassFirmwareStart",
} as const;
```
- `parseUrlParams(search)` 纯函数，数值型参数正确转换类型，未知参数静默忽略。
- **已裁决：仅保留 `baudrate` 一个串口参数**（`parity`/`stopbits` 移出 URL 参数，固定 0/1），`baudrate` 真正传入 `OtaSession`。
- `bypassFirmwareStart` 类型定为数值 `0|1`（与 libopenblt `bypassFirmwareStart?: number` 接口对齐，0.2.2 内部按 `!==0` 转 boolean）。
- 与 downloadkit 的 `programmer_*` 前缀不同，otakit 参数扁平化（协议单一，无需插件前缀）。

### D5 固件 URL 下载：不做 CORS 代理
- **已裁决：不做 CORS 代理**，固件 URL 直接 `fetch()`，默认目标固件服务器已允许浏览器跨域访问（返回 `Access-Control-Allow-Origin`）。若目标服务器未配 CORS，浏览器会拦截 fetch，此场景下抛明确错误提示用户改用本地上传或本地下载后重试。不引入第三方 CORS 代理（避免私有固件经第三方中转的保密风险），不自建代理端点。

### D6 Vue 壳桥接与 i18n
照抄 streamkit 的 `vue-entry.ts`（`defineComponent` + `createRoot().render()`）。语言包由 kit 自带（`messages` / `messagesZhCN` 导出，KitWrapper 已有合并机制）；React 树内部按 locale 从自带字典取词，不直接依赖 vue-i18n 运行时。

### D7 样式
沿用 gamepadkit 先例：普通 CSS 文件 + BEM 风格类名 + `@weblink/tokens` 的 CSS 变量。naive-ui 是 Vue 组件库，不进 React 树。

### D8 测试策略（TDD 主战场）
1. **core 层**：纯逻辑 vitest 单测（URL 参数解析、SerialPort 适配器、OtaSession 流程）。
2. **core 集成测试**：`FakeSerialPort`——实现 libopenblt `SerialPort` 接口的内存假设备，按真实 Modbus RTU 帧格式应答 XCP 命令，覆盖连接→info table→擦除→写入→复位全链路，无需真硬件。
3. **react-app**：`@testing-library/react` + happy-dom（streamkit 已有先例），hook 用 fake transport 注入测试状态推进与重试逻辑。

## Risks / Trade-offs

- [libopenblt 全局单例] → 单设备串行刷写，本期不做并发；未来如需并发需改造 libopenblt 支持多实例。
- [Web Serial 仅 Blink 内核] → 能力检测 + 引导提示，iOS 明确不在范围。
- [React 与 Vue 双运行时体积] → kit 懒加载，仅进入该 kit 才下载两个运行时（streamkit 同款代价，可接受）。
- [URL 参数长度限制] → 固件 URL 一般可接受；如超长可后续支持 POST 传参（本期不做）。
- [seed/key 设备不可用] → 本期不支持 seed/key 解锁，需要 seed/key 解锁的设备刷写将失败，列为 Non-Goal；后续如需支持在 D1 处扩展 `seedKeyAlgorithm` 注入。

## Non-Goals（补充确认的条目）

- 触发设备进入 bootloader：官方 libopenblt 无此 API，各项目自行触发后再跳转。
- seed/key 解锁：本期不支持，`seedKeyAlgorithm` 不注入。
- CORS 代理：固件 URL 下载不经过任何代理，直接 fetch。
- parity/stopbits 可配置：固定 0/1，仅 baudrate 可配置。

## Risks / Trade-offs

- [libopenblt 全局单例] → 单设备串行刷写，本期不做并发；未来如需并发需改造 libopenblt 支持多实例。
- [Web Serial 仅 Blink 内核] → 能力检测 + 引导提示，iOS 明确不在范围。
- [React 与 Vue 双运行时体积] → kit 懒加载，仅进入该 kit 才下载两个运行时（streamkit 同款代价，可接受）。
- [URL 参数长度限制] → 固件 URL 一般可接受；如超长可后续支持 POST 传参（本期不做）。

## Migration Plan

纯增量变更：新增 `kits/otakit/**`，`kitRegistry.ts` 追加一项。回滚 = 删除目录 + 移除注册项。

## Open Questions

无（触发、版本检查、固件存储、串口授权均已与需求方确认）。
