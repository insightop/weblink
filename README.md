# Weblink

基于 web 技术的硬件调试工具集合

地址：https://weblink.pages.dev

## 功能

1. Serial
2. Camera
3. Microphone
4. Bluetooth
5. ST-Link
6. DAPLink
7. STM32USB-DFU
8. HID
9. Kits 工作台（iframe 聚合多个 kit）

## 开发

- 安装依赖

```sh
npm install
```

- 运行（编译&热更新）

```sh
npm run dev
```

- 编译（打包）

```sh
npm run build
```

- 格式化

```sh
npm run lint
```

## Kits 工作台（iframe 内嵌多 Kit）

入口：`/kits`（顶部导航 `Kits`）。

### 1) 配置各 Kit 的部署地址

在 `src/features/kits/registry/kitModules.js` 中为各 kit 配置 `url`：

- `serialkit` → `https://serialkit.pages.dev`
- `modbuskit` → `https://modbuskit.pages.dev`
- `gnsskit` → `https://gnsskit.pages.dev`
- `capturekit` → `https://capturekit.pages.dev`
- `downloadkit` → `https://weblink-downloadkit.pages.dev`
- `wirelesskit` → `https://wirelesskit.pages.dev`
- `webrtckit` → `https://webrtckit.pages.dev`
- `flashkit` → `https://weblink-flashkit.pages.dev`
- `cankit` → `https://cankit.pages.dev`
- `ipkit` → `https://ipkit.pages.dev`

支持同一 kit 打开多个实例（标签页），并会在刷新后从 localStorage 恢复。

### 2) 目标 Kit 站点必须允许被 iframe 嵌入

若 iframe 一直加载失败，多数是被安全策略拦截：

- `X-Frame-Options: DENY / SAMEORIGIN`
- 或 `Content-Security-Policy` 未允许 `frame-ancestors` 包含 weblink 域名

Cloudflare Pages 可通过 `_headers` 配置（示例）：

```txt
/*
  Content-Security-Policy: frame-ancestors 'self' https://weblink.pages.dev
```

请把 `https://weblink.pages.dev` 替换为你实际部署 weblink 的域名。
