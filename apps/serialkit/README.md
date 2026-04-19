# Weblink Serial Kit

基于 **WebSerial API** 的浏览器串口调试工具（Vite + Vue 3 + TypeScript）。

## 环境要求

- 推荐：**Chrome / Edge（Chromium）**
- 需要 **HTTPS** 或 **localhost**（安全上下文）
- Safari / Firefox 通常不支持 WebSerial（页面会提示）

## 功能

- **连接参数**：baudRate / dataBits / stopBits / parity / flowControl
- **接收区**：Text 与 Hex **同时显示**，支持自动滚动与清空
- **发送区**：Text / Hex 模式切换；Text 支持追加 LF/CRLF
- **日志面板**：右侧可折叠，支持过滤/清空/自动滚动

## 开发

```bash
npm install
npm run dev
```

## 脚本

- `npm run dev`：开发
- `npm run build`：类型检查 + 构建
- `npm run lint`：ESLint
- `npm run format`：Prettier
- `npm test`：Vitest（domain 纯函数）

## 使用说明（快速上手）

1. 进入页面后点击「**选择端口并连接**」，在浏览器弹窗中选择设备串口
2. 连接成功后，在「发送」面板选择 Text/Hex 模式并点击「发送」
3. 接收数据会在 **Text/Hex 两个视图**同步更新；右侧日志面板可查看事件与错误
