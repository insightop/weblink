# weblink-cankit

浏览器端经典 CAN 调试工具，支持两种**无 Electron**路径：

| 模式 | 传输 | 典型硬件 |
|------|------|----------|
| **slcan** | **Web Serial**（USB CDC 虚拟串口） | Lawicel / slcantty 风格适配器 |
| **gs_usb** | **WebUSB**（USB Bulk + 内核 `gs_usb` 协议） | candleLight、CANable 等兼容固件 |

## 浏览器与访问方式

| 要求 | 说明 |
|------|------|
| 内核 | **Chromium**（Chrome / Edge / Brave 等）。**Safari / Firefox** 对 Web Serial / WebUSB 支持有限或缺失。 |
| 安全上下文 | **HTTPS** 或 **localhost**，否则无法请求设备权限。 |
| WebUSB | 首次需用户手势授权；部分系统上若内核已占用设备，浏览器可能无法打开（需卸载内核驱动或换机试）。 |

## 协议边界

### slcan

- 实现：slcan 行格式（`r/t/R/T`、`O`/`C`、`S0`–`S8` 等）。
- 不实现：厂商私有 Bulk 协议。

### gs_usb

- 实现：与 Linux `drivers/net/can/usb/gs_usb` 一致的 **control（比特率 / MODE）** 与 **struct gs_host_frame**（20 字节经典帧）收发；比特率表参考 HubertD/cangaroo（48MHz / 80MHz fclk）。
- **不在范围**：需 **PCAN-Basic / CANlib** 的 PEAK、Kvaser 等（非 Web 能力）。

## 开发

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

## 部署

静态资源构建输出在 `dist/`，可托管到任意静态站或 Cloudflare Pages；部署站点需 **HTTPS** 以便用户授权串口 / USB。
