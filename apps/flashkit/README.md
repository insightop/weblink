# weblink-flashkit

矩阵式板载存储编程工具（SPI NOR、I²C EEPROM）。支持 **WebUSB**（CH341A、FTDI MPSSE、Silicon Labs CP2130 Vendor/Bulk）与 **WebHID**（CP2112 SMBus 桥）。CH341 SPI 与 [flashrom](https://flashrom.org/) `ch341a_spi.c` 时序对齐。

## 浏览器

- Chromium 系（Chrome / Edge / Arc）
- 需 **HTTPS** 或 `localhost` 以使用 WebUSB / WebHID
- 连接设备需 **用户手势**（点击按钮）
- **WebHID**（如 CP2112）与 WebUSB 一样受安全上下文与用户授权约束

## 开发

```bash
npm install
npm run dev
```

```bash
npm run test
npm run build
npm run lint
```

## 架构

见 [docs/architecture.md](docs/architecture.md) 与 [docs/bridge-matrix.md](docs/bridge-matrix.md)。

## 安全与免责

对器件的擦写可能不可逆；请在断开目标板电源或确认接线正确后再操作。作者不对误操作造成的硬件损坏负责。
