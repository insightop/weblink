# webrtckit

面向开发者的 **WebRTC 调试实验室**：全网格（mesh）多对多、音视频与 DataChannel、信令通过 **Cloudflare Pages Functions** 转发到 **独立 Worker 内的 Durable Object（WebSocket 房间）**。

Cloudflare 规定：**Pages 项目的 `wrangler.toml` 不能包含 `[[migrations]]`**；Durable Object 类必须部署在单独的 Worker 上，再在 Pages 里用 `script_name` 绑定（见根目录 [`wrangler.toml`](wrangler.toml) 与 [`workers/room-signaling/wrangler.toml`](workers/room-signaling/wrangler.toml)）。

## 功能概览

- **Mesh P2P**：房间内每个浏览器与其它成员各维护一条 `RTCPeerConnection`（含音视频轨与 `webrtckit-debug` DataChannel）。
- **信令**：`wss://<host>/api/room/<roomId>?peerId=<uuid>`，由 Durable Object 转发 SDP / ICE。
- **ICE**：默认公共 STUN；可在界面粘贴 JSON 数组或每行一个 `stun:/turn:` URL。
- **日志**：右侧可折叠日志抽屉，便于排查连接与 ICE。

## 部署顺序（必看）

根目录 [`wrangler.toml`](wrangler.toml) 里通过 `script_name = "webrtckit-room-worker"` 引用 **另一个** Worker。该 Worker **不会**随 `npm run build` 一起上传，必须在 **同一 Cloudflare 账号** 下单独存在，否则发布 Functions 时会报错：

`Error 8000109: Script webrtckit-room-worker not found`

### 方式 A：Cloudflare Pages 构建里一键部署（推荐）

在 Pages 项目 **设置 → 环境变量** 中为「生产」和「预览」添加：

- **`CLOUDFLARE_API_TOKEN`**：需包含 **Workers Scripts:Edit**（以及部署 Worker 所需权限）；用于构建阶段执行 `wrangler deploy`。

将 **构建命令** 从 `npm run build` 改为：

```bash
npm run pages:build
```

（即先 `deploy:worker`，再 `build`；输出目录仍为 **`dist`**。）

这样每次构建都会先更新/创建 `webrtckit-room-worker`，再构建静态资源并发布 Pages。

### 方式 B：本地或 CI 手动先部署 Worker

1. 在本机登录或配置 `CLOUDFLARE_API_TOKEN` 后执行：

   ```bash
   npm run deploy:worker
   ```

   脚本名固定为 **`webrtckit-room-worker`**（与 Pages 里 `script_name` 一致）。

2. Pages 的构建命令可继续用 **`npm run build`**，输出目录 **`dist`**。

若从未执行过第 1 步，或 Token 不在同一账号，就会出现 **8000109**。

## 本地开发

### 仅前端（无信令）

```bash
npm install
npm run dev
```

`/api/*` 由 Vite 代理到 `http://127.0.0.1:8788`，需另起 wrangler（见下）。

### 前端 + 信令

**前提**：已在云端部署过 **`webrtckit-room-worker`**，这样 `wrangler pages dev` 才能解析跨脚本 Durable Object 绑定（本地也可用 Dashboard 将预览环境绑定到同一 Worker）。

终端 A：

```bash
npm run build
npm run pages:dev
```

终端 B：

```bash
npm run dev
```

浏览器打开 Vite 地址（如 `http://localhost:5173`），两台设备使用同一 **房间 ID** 即可互通。

环境变量（可选）：

- `VITE_SIGNALING_BASE`：若 UI 与信令不同源，设为信令站点 origin（如 `https://webrtckit.pages.dev`）。

## 限制与说明

- **Mesh 音视频**随人数上升占用陡增，建议 **4～6 人**以内做音视频联调；更多节点请优先用 **DataChannel** 或拆房间。
- **对称 NAT / 防火墙** 可能需要 **TURN**；在 ICE 文本框中配置 TURN URL 与凭证。
- **HTTPS**：媒体采集与部分能力需要安全上下文（HTTPS 或 `http://localhost`）。
- **房间隐私**：当前房间 ID 可共享即加入；生产环境可在此基础上增加密码或短期 token。

## 主站 weblink 集成

已在 weblink 的 [`kitModules.js`](../weblink/src/features/kits/registry/kitModules.js) 中注册，地址 **`https://webrtckit.pages.dev`**。iframe 权限见主站 [`KitIframePane.vue`](../weblink/src/features/kits/components/KitIframePane.vue)（含 `camera`、`microphone`、`display-capture` 等）。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Vite 开发服务器 |
| `npm run build` | 类型检查 + 生产构建（仅前端，不部署 DO Worker） |
| `npm run pages:build` | **先** `deploy:worker` **再** `build`，供 Pages CI 使用 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 写入 |
| `npm run test` | Vitest 单元测试 |
| `npm run pages:dev` | 构建后 `wrangler pages dev ./dist` |
| `npm run deploy:worker` | 部署 Durable Object Worker（`webrtckit-room-worker`） |

## 架构摘要

- **前端**：Vue 3 + TypeScript，`domain` 与 `infrastructure` 分层。
- **Pages**：`functions/api/room/[roomId].ts` 将请求转到绑定在 **`webrtckit-room-worker`** 上的 **RoomSignaling** Durable Object。
- **Worker**：[`workers/room-signaling/`](workers/room-signaling/) 包含 DO 实现与 migrations。

## 许可

与 monorepo 主项目保持一致。
