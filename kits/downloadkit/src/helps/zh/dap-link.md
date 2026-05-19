# dap-link 模式（dap-link / DAPLink）

此模式通过 DAPLink（CMSIS-DAP 兼容调试器）经 **WebUSB** 与 npm 包 **`dapjs`** 将固件写入目标 Flash（与官方浏览器示例一致）；需浏览器与 DAPLink 固件均支持 WebUSB。

## 准备条件

- 目标板/调试器需要是支持 CMSIS-DAP 的 DAPLink 设备。
- 如需浏览器直接使用 WebUSB，请确保 DAPLink 固件包含 WebUSB 支持（不同 DAPLink 型号/固件版本可能不同）。
- 让目标板保持在可被调试器连接的状态，并正确接好 SWD：
  - `SWDIO`（常见为 `PA13`）
  - `SWCLK`（常见为 `PA14`）
  - **GND 必须共地**

## 连接方式

- 将 DAPLink 连接到目标板的 SWD 引脚（必要时参考你板子的 SWD 接线图）。
- 建议连接 `NRST`（若你的烧录/复位流程需要）。
- USB 线连接 DAPLink 到电脑（用于 WebUSB 权限申请）。

## 网页操作步骤

1. 在主页选择 `dap-link` 模式。
2. 选择固件文件（支持 `*.hex` / `*.bin`）。
3. 点击「下载固件」。
4. 浏览器会弹出设备授权/选择窗口，选择你的 DAPLink 设备并确认。
5. 等待进度条完成，成功后通常会断开调试器连接并让目标运行（取决于实现方式）。

## 常见问题

- **设备授权窗口找不到 DAPLink**
  - 确认 DAPLink 固件支持 WebUSB（或使用该项目支持的传输方式）。
  - 检查连接是否牢固、是否共地。
  - 重新插拔 USB / 更换 USB 口。

- **烧录失败**
  - 降低调试时钟/速率（若页面提供相关选项）。
  - 检查 SWDIO/SWCLK 接线是否正确。
  - 确认目标芯片没有开启导致无法写入的保护状态（需要结合芯片手册处理）。

## 驱动要点（Windows 常见）

- 若需要安装/替换驱动，请使用 `Zadig` 为 DAPLink 的相关接口安装 WinUSB/libusb 通用驱动。

