# @weblink/otakit — OpenBLT OTA 升级工具

通用 OpenBLT OTA 升级工具（XCP over Modbus RTU）。基于 Web Serial 在浏览器内完成
固件刷写，无需安装桌面驱动。

## 使用方式

在仓库根目录启动 weblink 聚合首页：

```bash
pnpm dev
```

启动后访问：

```
http://localhost:5173/otakit
```

（`apps/web` 的 KitWrapper 会按 `kitRegistry` 中的 `otakit` 项动态加载
`@weblink/otakit/vue`，把 React 的 OTA 界面挂进 Vue 壳。）

## URL 参数

`/otakit` 支持通过查询参数预填配置。所有参数均可选，未提供时使用默认值。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `protocol` | string | `mb-rtu` | 传输协议。当前仅支持 `mb-rtu`（Modbus RTU / XCP）。 |
| `slaveId` | number | `1` | Modbus 从站地址。 |
| `baudrate` | number | `115200` | 串口波特率。 |
| `firmware` | string | — | 固件下载 URL（Intel HEX 文本）。 |
| `auto` | `1`/`true` | `false` | 自动开始：挂载后自动下载 `firmware` 固件，选中串口后自动开始刷写（仅一次）。 |
| `timeoutT1` | number | `1000` | XCP 超时 T1（ms）。 |
| `timeoutT3` | number | `2000` | XCP 超时 T3（ms）。 |
| `timeoutT4` | number | `10000` | XCP 超时 T4（ms）。 |
| `timeoutT5` | number | `1000` | XCP 超时 T5（ms）。 |
| `timeoutT6` | number | `50` | XCP 超时 T6（ms）。 |
| `timeoutT7` | number | `2000` | XCP 超时 T7（ms）。 |
| `bypassFirmwareStart` | number | `0` | 跳过固件启动（backdoor 进入 bootloader 模式）。 |

> **注意：不解析 `parity` / `stopbits`。** 串口参数固定为 `parity=0`（无校验）、
> `stopbits=1`（1 停止位），仅 `baudrate` 可通过 URL 配置。若需其他校验/停止位
> 组合，需在 `OtaSession` 层扩展。

示例：

```
/otakit?slaveId=1&baudrate=115200&firmware=https://example.com/fw.hex&auto=1
```

## 浏览器支持矩阵

OTA 依赖 **Web Serial API**，仅 Blink 内核浏览器支持：

| 平台 | 浏览器 | 支持 |
| --- | --- | --- |
| 桌面 | Chrome / Edge | ✅ |
| 桌面 | Firefox / Safari | ❌ |
| Android | Chrome | ✅ |
| iOS | Safari / Chrome | ❌（iOS 无 Web Serial） |

**安全上下文要求**：Web Serial 仅在 secure context 下可用，即 **HTTPS** 或
**localhost**。非安全上下文（如通过 IP 访问的 HTTP）会提示
“需要安全上下文（HTTPS 或 localhost）”。

## 与 @insightop/libopenblt 的关系

`@weblink/otakit` 底层复用 **`@insightop/libopenblt`（版本 `0.2.2`）** 作为
OpenBLT 主机协议栈：

- `OtaSession` 调用 `bltSessionInit/Start/Stop/Terminate`、
  `bltSessionCheckInfoTable/ClearMemory/WriteData` 以及
  `bltFirmwareInit/LoadFromFile/GetSegment*` 完成 XCP 会话与固件编程；
- 传输层使用 `BLT_TRANSPORT_XCP_V10_MBRTU`（Modbus RTU），串口帧交换由
  `createSerialPortAdapter` 桥接到 Web Serial；
- 协议正确性（XCP 帧、校验、Info table 判定）由上游库保证，本 kit 只负责
  浏览器侧编排（串口选择、固件获取、进度/日志、URL 参数）。

## 从项目跳转接入

任何页面可通过带参数的 URL 直接跳转到 OTA 界面：

```js
// 例如在项目内跳转
window.location.href =
  '/otakit?slaveId=1&baudrate=115200&firmware=' +
  encodeURIComponent(firmwareUrl) +
  '&auto=1'
```

KitWrapper 会按 `/:kitId` 路由加载 `otakit`，并把查询参数透传给 React 的
`OtaPage`（`parseUrlParams` 解析 `window.location.search`）。

## 固件 URL 下载说明

`firmware` 参数指定的固件 URL 由 `fetchFirmwareFromUrl` **直接 `fetch`**，
**不做 CORS 代理**。因此：

- 固件服务器必须允许跨域（返回 `Access-Control-Allow-Origin` 头），否则浏览器
  会拦截下载；
- 下载进度按 `Content-Length` 计算（若服务器未返回该头则无进度显示）；
- 固件内容为 Intel HEX 文本，由 `bltFirmwareLoadFromFile` 解析。

## 架构简述

```
src/
├── core/            # 传输无关的核心逻辑
│   ├── session/     # OtaSession：XCP 会话编排（connect→program→reset）
│   ├── serial/      # serialPortAdapter：Web Serial ↔ libopenblt 桥接
│   ├── firmware/    # firmwareFetcher：URL 下载 / 文件读取
│   └── url-params/  # parseUrlParams：URL 参数解析
├── react-app/       # React UI（OtaPage + 组件 + useOtaSession hook + i18n）
└── vue-entry.ts     # Vue 壳（EmbeddedPage）：把 React 树挂进 Vue，跟随 vue-i18n locale
```

- **core**：传输无关，可被任意宿主复用（`@weblink/otakit` 主入口导出）。
- **react-app**：React UI 层，消费 core。
- **vue-entry**：Vue 桥接壳，供 `apps/web` 的 KitWrapper 经 `@weblink/otakit/vue`
  加载，并把 vue-i18n 的 locale 实时同步给 React 树。

## 手动验收清单

前置：`pnpm dev` 启动 weblink，浏览器使用 Chrome/Edge（localhost 即安全上下文）。

1. 访问 `http://localhost:5173/otakit`，确认 OTA 界面正常渲染（标题、串口选择、
   固件选择、开始按钮、进度、日志面板）。
2. 点击「选择串口」，选择已连接的目标设备串口。
3. 选择固件：
   - **URL 方式**：输入固件 URL → 点击「下载固件」，观察下载进度与日志；
   - **上传方式**：点击「上传固件」选择本地 `.hex` 文件。
4. 点击「开始刷写」，观察日志与进度：
   - 连接阶段（XCP 连接 / backdoor 重试）；
   - 擦除阶段（`erasing`，按 32KB 分块）；
   - 写入阶段（`writing`，按 256B 分块）；
   - 复位阶段（`resetting`）→ 完成（`done`）。
5. 用 URL 参数验证预填与自动开始：
   ```
   /otakit?slaveId=1&baudrate=115200&firmware=https://example.com/fw.hex&auto=1
   ```
   - 确认固件 URL 已预填；
   - 确认 `auto=1` 时挂载后自动下载固件，选中串口后自动开始刷写（仅一次）。
6. 异常路径抽查：
   - 固件 URL 跨域被拦截时，日志应提示下载失败；
   - 设备未进入 bootloader 时，连接阶段应报「设备未进入 bootloader 模式」。
