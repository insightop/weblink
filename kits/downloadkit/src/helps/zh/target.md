# 目标

请先选择目标系列。

- `STM32`：启用 STM32 兼容的 Flasher。
- `ESP32`：启用 ESP32 兼容的 Flasher。
- `GD32`：启用 GD32 兼容的 Flasher（`serial` / `usb-dfu`）。
- `CH32`（WCH 沁恒）：启用 CH32 的 **串口 ISP（WCH 协议）**。请将 `BOOT0` 置高并复位进入 ISP，波特率默认 `115200`；与 STM32/GD32 的 AN3155 串口协议**不兼容**，请勿选错目标。

切换目标会自动更新可用的 Flasher 选项。
