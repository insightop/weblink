# ota-kit-core 规格（delta）

## Purpose

定义 otakit 的 OTA 刷写领域行为：传输无关的刷写会话（`OtaSession`）、`SerialPort` 适配器、固件获取、以及 URL 参数解析。本层不依赖 React/Vue，纯 TS，可被任意项目复用。

## ADDED Requirements

### Requirement: OtaSession 刷写会话

kit SHALL 提供 `OtaSession` 类，封装 `@insightop/libopenblt` 的 session/firmware API 为高级方法，对齐上游 BootCommander main.c 的职责分离：`OtaSession` 承担协议/串口/固件解析/内存操作，对外暴露 `connect()`、`program()`、`reset()`、`close()` 四个方法。

构造签名接收 `transact`、`slaveId`、`baudrate`（**必须显式传入，无默认**）、以及可选的 `OtaSessionOptions`。`parity`/`stopbits` 固定 0（NONE）与 1（ONE），不通过参数配置。

#### Scenario: 连接 bootloader（含 backdoor 重试）

- **WHEN** 调用 `connect()` 且设备未就绪
- **THEN** 按 backdoor 重试策略循环调用 `bltSessionStart()`，直到成功或超时；成功后执行 info table 检查，检查失败则抛出明确错误

#### Scenario: 编程固件

- **WHEN** 调用 `program(hexData, onProgress)` 且固件解析成功
- **THEN** 按 segment 以 32KB 分块擦除、256B 分块写入，并通过 `onProgress` 回调上报进度（phase/segment/bytes/percent）

#### Scenario: 复位与清理

- **WHEN** 调用 `reset()` 或 `close()`
- **THEN** 分别执行 `bltSessionStop()` 与 `bltSessionTerminate()`/`bltFirmwareTerminate()`，释放资源

### Requirement: SerialPort 适配器

kit SHALL 提供 `createSerialPortAdapter(transact)` 函数，将任意"帧收发函数"（`(frame: Uint8Array, timeoutMs?) => Promise<Uint8Array>`）适配为 libopenblt 的 `SerialPort` 接口（open/close/write/read），使任意能提供 `transact` 的通道（Web Serial、Node serialport、HTTP/WS 桥）都能接入刷写。

#### Scenario: transact 适配

- **WHEN** 传入一个 `transact` 函数并调用适配器
- **THEN** 返回的 `SerialPort` 的 `write()` 调用 `transact` 并缓存响应，`read()` 从缓存返回，`open()`/`close()` 为空操作

### Requirement: 固件获取

kit SHALL 提供固件获取能力：从 URL 下载固件内容（支持 CORS 代理）、或读取本地上传的固件文件（.hex/.srec）。固件内容以字符串形式传递给 `OtaSession.program()`。

#### Scenario: URL 下载固件

- **WHEN** 提供固件 URL
- **THEN** 通过 fetch 获取固件文本，支持进度回调，失败时抛出明确错误

#### Scenario: 本地上传固件

- **WHEN** 用户选择本地 .hex/.srec 文件
- **THEN** 读取文件文本并返回，供后续刷写

### Requirement: URL 参数解析

kit SHALL 提供 `parseUrlParams(search)` 纯函数，解析 URL query 为结构化参数，参考 downloadkit 的 `parseUrlParams` 模式。支持参数：`protocol`（传输类型，当前仅 `mb-rtu`）、`slaveId`、`baudrate`、`firmware`（固件 URL）、`auto`（自动开始）、`timeoutT1..T7`（XCP 超时）、`bypassFirmwareStart`。未知参数静默忽略。**不解析 `parity`/`stopbits`**（固定 0/1，仅 `baudrate` 可配置）。

#### Scenario: 解析完整参数

- **WHEN** 传入含全部已知参数的 query string
- **THEN** 返回结构化参数对象，数值型参数正确转换类型

#### Scenario: 空/未知参数

- **WHEN** 传入空 query 或仅含未知参数
- **THEN** 返回默认参数对象，未知参数被忽略

### Requirement: 参数化默认值

`OtaSession` 的擦除/写入 chunk 大小、XCP 超时、backdoor 重试超时/间隔 SHALL 可配置，默认值对齐上游 BootCommander main.c（擦除 32KB、写入 256B、timeouts 1000/2000/10000/1000/50/2000ms、backdoor 10s@100ms）。

#### Scenario: 默认值

- **WHEN** 未提供任何配置
- **THEN** 使用对齐 BootCommander 的默认值

#### Scenario: 自定义值

- **WHEN** 提供部分配置
- **THEN** 覆盖对应默认值，未提供的保持默认
