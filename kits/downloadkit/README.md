# weblink-downloadkit

基于 Vue 3 + TypeScript 的网页固件下载工具，支持 STM32、ESP32 与 GD32，并采用插件化三层架构：

- `core`: 状态机与统一下载流程
- `transport`: WebSerial / WebUSB / WebHID 传输层
- `protocol`: 芯片协议层（STM32/ESP32）

## 支持模式

- STM32: `serial`、`usb-dfu`、`st-link`、`dap-link`
- ESP32: `serial`（支持单 bin 与分区表+多镜像）
- GD32: `serial`、`usb-dfu`

## 页面结构（当前版本）

- 主功能区为整页四模块：`target`、`flasher`、`firmware`、`download`，统一由 `FunctionZone` 承载（title + content）。
- 每个 `FunctionZone` 右上角提供 `?` 帮助入口（悬停显示），内容来自 `src/helps/{zh,en}/*.md`。
- 右侧为可折叠日志侧栏（默认展开），支持拖拽调整主区/日志区宽度比例。
- 主题自动跟随系统 `prefers-color-scheme`（亮色/暗色），无手动开关。
- UI 组件优先使用 `naive-ui`，减少手写样式与控件实现。

## 交互行为（当前版本）

- `target` 与 `flasher` 均为 button group 单选。
- flasher 列表由插件注册表按当前 target + 浏览器能力动态生成。
- 切换 flasher 会立即触发对应连接选择窗口。
- `Download` 仅在“已选择 flasher 连接 + 已选择固件文件”时可点击。
- `usb-dfu` 在支持 WebUSB 的环境下可用于 STM32/GD32 DFU 烧录；`dap-link` 在支持 WebUSB 的环境下通过 npm `dapjs` 完成烧录。
- 若浏览器完全不支持 WebSerial/WebUSB/WebHID，应用启动会直接 `alert` 并进入不可用页面。
- 日志采用结构化模型（时间戳 + 级别 + 消息），支持多级别 chips 过滤与清空。
- 日志通过 `pino + flasherLogger` 统一输出与入库（业务层统一入口）。
- firmware 区使用 `n-upload + n-upload-dragger`，支持点击与拖拽选择，且采用受控文件列表仅保留“最新一次选择”。
- firmware 类型支持：`.hex`、`.bin`、`.elf`（`.elf` 当前会给出未实现解析提示）。
- 下载区采用单按钮状态机：`Download`（idle）-> `percent | speed | eta`（running）-> `Completed/Failed`（result），并支持直接开始下一轮下载。

## 开发环境

- Node.js 20+
- npm 10+
- Chromium 系浏览器（Chrome / Edge / Arc）

## 本地开发

```bash
npm install
npm run dev
```

UI split layout is powered by `splitpanes`.

## 测试与构建

```bash
npm run test
npm run build
```

## 架构文档

- `docs/architecture.md`
- `docs/plugin-development.md`
- `docs/esp32-image-modes.md`
- `docs/migration-baseline.md`
- `docs/logging.md`

## 参考资料

- [AN3155: USART protocol used in the STM32 bootloader](https://www.st.com/resource/en/application_note/an3155-usart-protocol-used-in-the-stm32-bootloader-stmicroelectronics.pdf)
- [AN2606: Introduction to system memory boot mode on STM32 MCUs](https://www.st.com/resource/en/application_note/an2606-introduction-to-system-memory-boot-mode-on-stm32-mcus-stmicroelectronics.pdf)
