# weblink-capturekit

基于 **Vite + Vue 3 + TypeScript** 的浏览器多媒体设备调试页：摄像头预览、麦克风电平、扬声器/音频输出测试音。

## 环境要求

- **Chrome / Edge**（推荐）：对 `enumerateDevices`、`getUserMedia`、`AudioContext.setSinkId` 支持较完整。
- 页面需在 **HTTPS** 或 **localhost** 下打开，否则无法使用摄像头/麦克风。
- 首次使用需在浏览器中**允许**摄像头/麦克风权限；部分设备在授权前列表中的 `label` 为空，属正常现象。
- 各面板的设备**下拉框**在获得焦点或点击时会自动刷新列表（摄像头/麦克风在需要时会先申请权限），无需单独「刷新」按钮。

## 开发

```bash
npm install
npm run dev
```

默认开发端口 `5174`（若占用会自动顺延）。

## 脚本

| 命令                | 说明                         |
| ------------------- | ---------------------------- |
| `npm run dev`       | 开发服务器                   |
| `npm run build`     | 类型检查 + 生产构建          |
| `npm run preview`   | 预览构建产物                 |
| `npm run typecheck` | 仅 `vue-tsc`                 |
| `npm run lint`      | ESLint                       |
| `npm run format`    | Prettier                     |
| `npm test`          | Vitest（当前为领域函数单测） |

## 部署（Cloudflare Pages）

- **构建命令**：`npm run build`
- **输出目录**：`dist`
- **Node 版本**：与本地开发一致即可（建议 20 LTS）

## 架构说明

- `src/features/capturekit/`：调试 UI（含通用 `DeviceCard` 容器）、composables
- `src/domain/media/`：纯函数（电平、波形坐标、错误映射）
- `src/infrastructure/`：MediaDevices / Web Audio 薄封装、日志

## 限制说明

- **扬声器切换**：依赖 `AudioContext.setSinkId`（Chromium）；Safari/Firefox 能力可能受限，页面会提示。
- **麦克风与相机**分别占用独立 `MediaStream`，会各触发一次权限（便于调试隔离）。
