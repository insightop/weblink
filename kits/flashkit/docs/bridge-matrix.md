# 桥接矩阵

列：**SPI** | **I²C**（总线能力）  
行：**桥后端**（主机协议栈 + 典型硬件）

| 桥后端 id | 传输 | 设备过滤器 | SPI | I²C | 备注 |
|-----------|------|--------------|-----|-----|------|
| `ch341-vendor-bulk` | WebUSB | USB `1a86:5512` | 是 | 是 | flashrom `ch341a_spi.c` 风格；CH341A 编程器模式 |
| `ftdi-mpsse-ft232h` | WebUSB | USB `0403:6014`（FT232H 常见 PID） | 是 | 否 | FTDI MPSSE SPI；macOS 上若被系统驱动占用可能无法 claim |
| `silabs-cp2130-hid` | WebUSB | USB `10c4:87a0` | 是 | 否 | CP2130 标准固件为 **Vendor/Bulk** SPI；矩阵 id 沿用计划命名 |
| `silabs-cp2112-hid` | WebHID | HID `10c4:ea90` | 否 | 是 | AN495 / Linux `hid-cp2112` 报告布局 |

## FTDI 与 I²C

- **硬件能力**：FT232H / FT2232H / FT4232H 等带 **MPSSE** 的型号，在电气上可用 GPIO 位带模拟 I²C，或通过 MPSSE 做时钟线扩展；并非像 SPI 那样有「硬件 I²C 主机外设」。
- **本仓库**：当前仅实现 **MPSSE SPI**（`ftdi-mpsse-ft232h`），**未**提供 FTDI 桥上的 I²C 路径；界面中 FT232H 与 **I²C 协议** 的组合为禁用状态。

## 其他 FTDI 型号未纳入矩阵的原因

常见可编程 USB 桥还有 **FT2232H**（双通道、PID 常为 `6010`）、**FT4232H**（四通道）等，同样具备 MPSSE。未默认加入兼容表是因为：

1. **PID/接口索引** 与单通道 FT232H（`6014`）不同，需分别枚举与测试；
2. 多通道设备需约定使用哪一路 MPSSE。

后续可在 `matrix/presets/ftdiMpsse.matrix.ts` 中按实机增加行，并在 `registry` 注册对应 `usbFilters` 与（若共用同一 `createUsb` 工厂）相同桥实现。

## 已验证硬件（请在实机测试后更新）

| 硬件 | 固件/批次 | 验证日期 | 备注 |
|------|-----------|----------|------|
| 黑色 CH341A 编程器 | — | — | 本地 `npm run dev` + Chromium |
| FT232H / CP2130 / CP2112 | — | — | 自动化 CI 无 USB/HID 实机；需本地烟测 |

## CI

工作流执行 `lint`、`test`、`build`（无实机 USB）。
