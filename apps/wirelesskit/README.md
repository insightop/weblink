# Weblink Wireless Kit

基于 Web Bluetooth 与 Web NFC 的无线调试工具集合（Vite + Vue 3 + TypeScript）。

## 功能

- **Bluetooth（Web Bluetooth）**
  - 选择设备（`requestDevice`）
  - 连接/断开（GATT）
  - 浏览 services / characteristics
  - 对 characteristic **Read / Write**（Text/Hex）
  - 对 characteristic **Notify** 订阅与接收（Text/Hex + 时间戳）

- **NFC（Web NFC）**
  - NDEF 扫描读取（展示 records 摘要）
  - NDEF 写入（Text / URL）

- **日志**
  - 右侧可折叠日志面板（分级过滤、关键字搜索、最新在上）

## 运行与构建

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## 使用前提与限制

- **必须在安全上下文运行**：HTTPS 或 `localhost`。
- **Web Bluetooth**：仅部分 Chromium 系浏览器支持；`requestDevice()` 必须由用户手势触发。
- **Web NFC**：支持范围更窄，通常仅 Android Chrome 可用。

## iframe 嵌入注意事项（如果被 weblink 主站内嵌）

- 目标站点需允许被 iframe 嵌入（CSP `frame-ancestors` / `X-Frame-Options`）。
- 父页面可能需要显式放行相关能力（Permissions Policy / iframe `allow`）。

## 项目结构（简化）

- `src/app/`：应用入口、全局样式
- `src/features/`：页面与组件（Bluetooth/NFC/Log）
- `src/infrastructure/`：Web API 封装与 session 生命周期
- `src/domain/`：纯函数（codec、NDEF 格式化、日志结构）
- `src/shared/`：通用 UI 与工具
