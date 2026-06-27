# StreamKit — 远程支持工具包

基于 Cloudflare Realtime 的远程支持平台，提供屏幕共享、双向语音通话能力。

## 功能路线图

| 阶段 | 功能 | 状态 |
|------|------|------|
| Phase 1 | 屏幕共享 + 双向语音 | ✅ 核心完成 |
| Phase 2 | 远程批注（画笔叠加层） | 📋 计划中 |
| Phase 3 | 远程操作（鼠标/键盘） | 📋 计划中 |

## 架构

```
┌─────────────────────────────────────────────────────┐
│  @weblink/web (Vue SPA)                             │
│  └── KitWrapper.vue → vue-entry.ts → React AdminApp │
└─────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│  core (SDK)     │          │  Demo (远端)     │
│  signaling/     │          │  ShareScreen     │
│  webrtc/        │          │  joinSession()   │
│  room/          │          └────────┬────────┘
└────────┬────────┘                   │
         │         WebRTC P2P         │
         └────────────────────────────┘
                   │ (信令)
         ┌─────────▼──────────┐
         │  Durable Object    │
         │  (StreamKit)     │
         └────────────────────┘
```

### 三层结构

| 层 | 包名 | 说明 |
|---|---|---|
| **core** | `@weblink/streamkit-core` | 框架无关的 SDK，包含信令、WebRTC、房间管理。可独立发布 |
| **admin** | `kits/streamkit/src/admin/` | React 运维端组件，通过 vue-entry.ts 桥接嵌入 Vue 应用 |
| **demo** | `kits/streamkit/src/demo/` | React 远端示例组件，展示屏幕共享功能 |

### 技术栈

- **Core SDK**: 纯 TypeScript，零框架依赖
- **UI**: React 19 + `@vitejs/plugin-react-swc`
- **桥接**: Vue `defineComponent` + React `createRoot`（薄壳 ~15 行）
- **信令**: Cloudflare Pages Functions + Durable Objects
- **媒体**: WebRTC P2P（可选 Cloudflare TURN 兜底）

## 开发

```bash
# 安装依赖（在 weblink 根目录）
pnpm install

# Core SDK 测试
pnpm --filter @weblink/streamkit-core test

# Core SDK 类型检查
pnpm --filter @weblink/streamkit-core typecheck

# StreamKit 类型检查（Vue + React）
pnpm --filter @weblink/streamkit typecheck

# StreamKit 测试
pnpm --filter @weblink/streamkit test

# 启动 web 应用（包含 streamkit）
pnpm --filter @weblink/web dev

# 启动信令 Worker
cd kits/streamkit && npx wrangler dev --config workers/signaling/wrangler.toml

# 部署信令 Worker
cd kits/streamkit && pnpm deploy:worker
```

## SDK 集成

```typescript
import { createSession, joinSession, captureScreen } from "@weblink/streamkit-core";

// 运维端：创建房间
const session = await createSession({ signalingUrl: "wss://your-domain.com" });
console.log(`房间: ${session.roomId}, 密码: ${session.password}`);

session.on("remote-stream", (peerId, stream) => {
  videoElement.srcObject = stream;
});

// 远端：加入房间并共享屏幕
const session = await joinSession({ signalingUrl: "wss://your-domain.com", roomId, password });
const screen = await captureScreen();
for (const track of screen.stream.getTracks()) {
  session.addTrack(track, screen.stream);
}
```

## Cloudflare 配置

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/realtime) 创建 Realtime App
2. 获取 App ID 和 Secret
3. 如果需要 TURN 服务，在 Dashboard 启用并获取 TURN Service ID 和 Token

## 定价参考

- **SFU + TURN**：$0.05/GB 出站流量
- **免费额度**：1,000 GB/月（约 2,200 次 30 分钟会话）
- **入站流量**：免费
- 详见 [Cloudflare Realtime 定价](https://developers.cloudflare.com/realtime/sfu/pricing/)
