# ImprovKit — Improv Wi-Fi 串口配网工具包

基于 [Improv Wi-Fi](https://www.improv-wifi.com/) 开放标准与官方 SDK（`improv-wifi-serial-sdk@2.8.1`）的浏览器端配网工具包：为无屏 IoT 设备（ESP32 等）通过浏览器 **Web Serial** 传递 Wi-Fi 凭据，全程纯客户端运行，无需安装任何驱动或桌面软件。

## 简介

- **目标设备**：无屏、无输入能力的 IoT 设备（ESP32 等），固件需实现 Improv Wi-Fi Serial 协议（如 ESPHome 的 `improv_serial` 组件）。
- **配网方式**：浏览器通过 Web Serial 连接设备串口，读取设备信息、扫描附近 Wi-Fi、下发 SSID/密码，设备自行接入网络。
- **协议基础**：Improv Wi-Fi 开放标准 + 官方 SDK `improv-wifi-serial-sdk@2.8.1`。
- **运行形态**：纯浏览器端（Web Serial / Web 前端），无后端服务。

## 架构

Clean 分层，传输无关的核心状态机与具体传输实现解耦：

```
┌──────────────────────────────────────────────────────────────┐
│  features（React UI + useImprovSession hook）                 │
│  ProvisionPage / ConnectionPanel / WifiForm / ResultView…   │
└──────────────────────────────┬───────────────────────────────┘
                               │ 只依赖 IImprovTransport 接口
┌──────────────────────────────▼───────────────────────────────┐
│  domain（传输无关状态机 + 领域类型 + 错误类别）                 │
│  IImprovTransport 接口 / ImprovState / DomainErrorCategory   │
└──────────────────────────────┬───────────────────────────────┘
                               │ 实现
┌──────────────────────────────▼───────────────────────────────┐
│  infrastructure（具体传输实现）                                │
│  SerialTransport —— 包装 ImprovSerial（Web Serial）           │
└──────────────────────────────────────────────────────────────┘
```

| 层                 | 目录                         | 职责                                                                                                                                                                                  |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **domain**         | `src/domain/`                | 传输无关的配网状态机（`ImprovState`）、`IImprovTransport` 接口、领域类型（`DeviceInfo` / `Ssid` / `ProvisionResult`）、错误类别（`DomainErrorCategory`）。不依赖任何 SDK / 框架类型。 |
| **infrastructure** | `src/infrastructure/serial/` | `SerialTransport` 包装上游 `ImprovSerial`，把 SDK 事件/错误翻译为领域状态与错误类别，实现 `IImprovTransport` 接口。                                                                   |
| **features**       | `src/features/`              | React UI（`ProvisionPage` 及子组件）+ `useImprovSession` 会话编排 hook + i18n。                                                                                                       |
| **vue-entry**      | `src/vue-entry.ts`           | Vue 壳桥接：把 React 的 `ProvisionPage` 挂进 Vue 组件树，并让 React 树实时跟随 vue-i18n 的 locale 切换。                                                                              |

### React 内核 + Vue 壳

本 kit 采用 **React 内核 + Vue 壳** 模式，与 `streamkit` 同构：核心配网逻辑与 UI 用 React 实现，通过 `vue-entry.ts` 的薄壳（`defineComponent` + `createRoot`）桥接进 weblink 的 Vue 聚合应用。React 卸载会触发 `useImprovSession` 的 effect 清理，从而关闭串口会话并释放物理端口。

### BLE 扩展点

`IImprovTransport` 是 domain 层唯一对外操作接口，上层界面只依赖它、不接触具体传输类型。`ImprovState` 已预留 `AUTHORIZATION_REQUIRED` 状态（Web Serial 协议没有授权流程，不会产生该状态；未来 BLE 传输需设备授权时由对应实现驱动进入）。未来新增 BLE 配网时，只需在 `infrastructure/ble/` 下实现同一 `IImprovTransport` 接口即可，UI 与 hook 零改动。

## 浏览器支持矩阵

Web Serial 是浏览器硬件 API，支持情况取决于浏览器内核：

| 环境                        | 支持      |
| --------------------------- | --------- |
| Chrome / Edge（桌面）       | ✅ 支持   |
| Chrome / Edge（Android）    | ✅ 支持   |
| Firefox / Safari（桌面）    | ❌ 不支持 |
| iOS 全系（Safari / Chrome） | ❌ 不支持 |

**安全上下文要求**：串口 API 仅在 **HTTPS 或 localhost** 下开放。非安全上下文或浏览器不支持 Web Serial 时，`ProvisionPage` 的能力检测门会渲染引导提示页，不渲染任何配网入口。

## 使用方式

### a) 在 weblink 聚合首页进入 Improv Kit

`pnpm dev` 启动聚合首页后，从首页进入 **Improv Kit**（路由 `/improvkit`）。首页通过 `kitRegistry` 懒加载 `@weblink/improvkit/vue`，由 `KitWrapper` 挂载 `EmbeddedPage`。

### b) 独立 React 使用

```tsx
import { ProvisionPage } from '@weblink/improvkit'

// 自带 I18nProvider，locale 缺省按 navigator.language 探测（zh 开头 → zh-CN）
export function App() {
  return <ProvisionPage />
}
```

### c) 自定义宿主用 useImprovSession + I18nProvider

```tsx
import { I18nProvider, useImprovSession } from '@weblink/improvkit'

function MyHost() {
  const session = useImprovSession()
  // session: { state, deviceInfo, networks, scanUnavailable, errorCategory,
  //            lastUrl, busy, connect, refreshScan, submitCredentials,
  //            changeWifi, reset }
  return <button onClick={session.connect}>连接设备</button>
}

export function App() {
  return (
    <I18nProvider locale="zh-CN">
      <MyHost />
    </I18nProvider>
  )
}
```

## 依赖

| 依赖                     | 版本                  | 用途                                                                    |
| ------------------------ | --------------------- | ----------------------------------------------------------------------- |
| `improv-wifi-serial-sdk` | `^2.8.1`              | Improv Wi-Fi Serial 协议官方 SDK（会话、扫描、配网）                    |
| `esptool-js`             | `^0.6.0`              | 硬件复位（`HardReset` DTR/RTS 复位序列），**动态 import**，避免主包膨胀 |
| `react` / `react-dom`    | `^19.1.0`             | React 内核（配网 UI 与状态层）                                          |
| `vue` / `vue-i18n`       | `^3.5.32` / `^9.14.5` | Vue 壳桥接与国际化                                                      |

## 配网流程

```
连接设备 → 设备信息 → 扫描选网 / 手动输入 → 密码 → 进度 → 成功 / 失败
```

1. **连接设备**：点击「连接设备」，浏览器弹出 Web Serial 设备选择器，选择目标设备串口。
2. **设备信息**：连接成功后读取并展示设备信息（名称、固件、版本、芯片型号、操作系统等）。
3. **扫描选网 / 手动输入**：连接成功后进入表单视图，网络列表**持续扫描自动刷新**（对齐 esp-web-tools 的 `_syncScanning`，替代一次性 scan）；设备不支持扫描时降级为手动输入 SSID。网络条目按名称排序，显示信号强度与加密标记。
4. **密码**：输入 Wi-Fi 密码（可切换明文显示）。
5. **进度**：下发凭据后进入配网进度视图。
6. **成功 / 失败**：
   - 成功：展示「配网成功」页 + 设备信息 + 「访问设备」外链（设备返回的跳转 URL，仅 http/https 视为可安全打开）+ 「更换 Wi-Fi」按钮。
   - 失败：保留表单语境（设备信息 + 错误条 + 表单），可直接重试或更换 Wi-Fi。

### 扫描与选网增强

表单显示期间网络列表由 `subscribeSSIDs` **持续扫描**驱动，并叠加以下行为：

- **持续扫描自动刷新**：进入表单（READY）即订阅持续扫描，离开表单（进入配网/成功/连接态）自动取消；「重新扫描」按钮退化为「重新订阅持续扫描」，SDK 一经调用立即首扫，等价于一次手动刷新。
- **首次扫描宽限期**（`SCAN_GRACE_PERIOD = 12000ms`）：设备刚启动/刚烧录时首扫可能为空，宽限期内显示「正在扫描网络…」，宽限期结束仍无任何扫描结果才显示「未发现网络」空态，避免误报。
- **最强网络预选**：网络列表首次就绪（首个非空数组）时，自动预选信号最强（RSSI 最大）的网络写入 SSID 输入框；一旦用户手动输入或点选过，后续列表不再覆盖既有选择。
- **选中网络掉线回填**：当前选中的网络从后续扫描结果中消失时，把该 SSID 回填到手动输入框并提示「所选网络已不可用，可手动输入重试」，保留已输入的密码以便直接重连。

## 串口日志控制台

配网视图提供「日志与控制台」入口（表单视图与配网成功页均有），用于查看设备串口原始日志、下载日志或对设备做硬件复位。

- **进入方式**：点击配网视图的「日志与控制台」按钮，`enterConsole` 关闭 Improv 会话、取回裸串口端口，页面切换为 `ConsoleView` 控制台视图（保留设备信息等配网语境，退出后即可恢复配网）。
- **原始日志展示**：控制台从 `port.readable` 持续读取原始字节流，按行累积展示（`TextDecoder` 解码 + 按 `\n` 切行，未换行尾部暂存到下一 chunk）；读流结束或出错时显示「终端已断开」。
- **下载日志**：点击「下载日志」把已累积的全部原始文本导出为 `improvkit-logs.txt`。
- **硬件复位**：点击「复位设备」通过 esptool-js 的 `HardReset`（DTR/RTS 复位序列）重启设备。复位会重启设备、使当前 Improv 会话失效，成功后回到配网入口视图并提示「设备已复位，请重新连接以继续」——需重新连接设备才能继续配网。
- **退出控制台**：点击「退出」释放读流锁并恢复 Improv 会话，回到配网视图。

## 错误类别表

`DomainErrorCategory` 共十类，上层界面只处理这些类别。`REQUEST_CANCELLED` 刻意不提供文案，UI 对其静默。

| 类别                   | 用户可见含义                                          |
| ---------------------- | ----------------------------------------------------- |
| `NOT_IMPROV_DEVICE`    | 该设备不是 Improv 设备                                |
| `DEVICE_WIFI_DISABLED` | 设备 Wi-Fi 已被禁用，请启用后重试                     |
| `UNABLE_TO_CONNECT`    | 无法连接该 Wi-Fi 网络                                 |
| `UNKNOWN_COMMAND`      | 设备不支持该操作                                      |
| `TIMEOUT`              | 操作超时，请重试                                      |
| `BAD_HOSTNAME`         | 主机名不被设备接受                                    |
| `INVALID_PACKET`       | 设备返回了无效数据                                    |
| `UNKNOWN_ERROR`        | 发生未知错误                                          |
| `DISCONNECTED`         | 与设备的连接已断开                                    |
| `REQUEST_CANCELLED`    | 用户关闭了浏览器设备选择器（静默，不进入 ERROR 状态） |

## 开发

```bash
# 在 weblink 根目录执行
pnpm --filter @weblink/improvkit test            # 单元 + 集成测试（vitest）
pnpm --filter @weblink/improvkit typecheck       # React 侧类型检查（tsc）
pnpm --filter @weblink/improvkit typecheck:vue    # Vue 侧类型检查（vue-tsc）
pnpm --filter @weblink/improvkit lint            # ESLint（--max-warnings 0）
pnpm --filter @weblink/improvkit format          # Prettier 格式化
```

**TDD 约定**：本 kit 按 TDD 开发，每个模块先写规格测试再实现。测试资产：

- **FakeImprovDevice**（`src/test/fakes/fakeImprovDevice.ts`）：Improv Serial 线协议帧编解码 + 脚本化假设备端口，可模拟设备信息、扫描结果、配网成功/失败、非 Improv 设备（静默）、设备 Wi-Fi 关闭（STOPPED）、中途断连等场景。
- **真实 ImprovSerial 集成测试**（`src/test/integration/serialTransport.integration.spec.ts`）：`createSession` 未 mock，走真实 `new ImprovSerial(port, console)`，从线协议帧应答到 SDK 解析、状态映射、错误 reject 全程真实。

## 手动验收清单

前置：`pnpm dev` 启动聚合首页，浏览器打开 `/improvkit`（需 HTTPS 或 localhost 安全上下文），准备一台刷了 ESPHome `improv_serial` 固件的真实 ESP32。

| #   | 场景                   | 操作步骤                                 | 预期                                                                                 |
| --- | ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | 能力门（非安全上下文） | 用 http:// 非 localhost 地址打开页面     | 显示「串口功能需要安全上下文」提示，无配网入口                                       |
| 2   | 能力门（不支持浏览器） | 用 Firefox / Safari 打开页面             | 显示「当前浏览器不支持 Web Serial」提示，无配网入口                                  |
| 3   | 完整配网（成功）       | 连接设备 → 选网 → 输密码 → 提交          | 进入配网进度 → 显示「配网成功」页 + 设备信息 + 「访问设备」外链 + 「更换 Wi-Fi」按钮 |
| 4   | 设备信息展示           | 连接设备成功后                           | 展示设备名称、固件、版本、芯片型号等，与 ESP32 实际信息一致                          |
| 5   | 扫描选网               | 连接成功后                               | 自动扫描并列出附近 Wi-Fi（按名称排序，显示信号强度与加密标记）                       |
| 6   | 手动输入               | 设备不支持扫描时                         | 显示「设备不支持自动扫描，请手动输入 Wi-Fi 名称」提示，可手动输入 SSID               |
| 7   | 非 Improv 设备         | 连接一个非 Improv 设备（如普通串口设备） | 显示「该设备不是 Improv 设备」错误，可重试                                           |
| 8   | 密码错误               | 输入错误 Wi-Fi 密码提交                  | 显示「无法连接该 Wi-Fi 网络」错误，保留表单语境，可直接重试                          |
| 9   | 设备 Wi-Fi 关闭        | 设备 Wi-Fi 处于禁用状态时连接            | 显示「设备 Wi-Fi 已被禁用，请启用后重试」错误                                        |
| 10  | 中途拔线               | 配网过程中拔掉 USB 线                    | 显示「与设备的连接已断开」错误，可重新连接设备                                       |
| 11  | 更换 Wi-Fi             | 配网成功后点击「更换 Wi-Fi」             | 回到表单视图，可重新选网/输密码配网                                                  |
| 12  | 取消设备选择           | 点击「连接设备」后在选择器里取消         | 无错误提示（静默），回到入口视图，可再次连接                                         |
| 13  | 语言切换               | 在聚合首页切换中/英文                    | 配网界面文案实时跟随切换                                                             |
| 14  | 持续扫描刷新           | 连接成功后保持表单视图，观察网络列表     | 列表随设备持续扫描自动刷新（无需手动点「重新扫描」）                                 |
| 15  | 首次扫描宽限期         | 连接刚启动/刚烧录的设备                  | 宽限期内显示「正在扫描网络…」，宽限期结束仍无结果才显示「未发现网络」                |
| 16  | 最强网络预选           | 连接成功后首次出现网络列表               | 自动预选信号最强（RSSI 最大）的网络写入 SSID 输入框                                  |
| 17  | 选中网络掉线回填       | 选中某网络后让该网络从扫描结果消失       | 该 SSID 回填到手动输入框并提示「所选网络已不可用，可手动输入重试」，密码保留         |
| 18  | 进入控制台看日志       | 表单视图点击「日志与控制台」             | 切换为串口控制台视图，实时展示设备原始串口日志                                       |
| 19  | 下载日志               | 控制台内点击「下载日志」                 | 下载 `improvkit-logs.txt`，内容与已展示的原始日志一致                                |
| 20  | 硬件复位               | 控制台内点击「复位设备」                 | 设备重启，回到配网入口视图并提示「设备已复位，请重新连接以继续」                     |
| 21  | 退出控制台恢复配网     | 控制台内点击「退出」                     | 回到配网视图，可继续选网/输密码配网                                                  |
