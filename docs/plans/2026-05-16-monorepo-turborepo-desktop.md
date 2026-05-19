# Weblink Monorepo Turborepo + Desktop Platform 实施计划

## 项目整体架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    分发层 (Distribution)                         │
│  Web (Cloudflare Pages) │ Electron (桌面) │ Tauri (桌面)       │
├─────────────────────────────────────────────────────────────────┤
│                    应用层 (apps/ 薄壳)                           │
│  web (聚合入口)  │  electron  │  tauri                          │
├─────────────────────────────────────────────────────────────────┤
│                    Kit 层 (kits/ 独立部署)                       │
│  serialkit │ cankit │ downloadkit │ ...                         │
├─────────────────────────────────────────────────────────────────┤
│                    共享层 (packages/)                             │
│  ui-vue │ utils │ tokens │ eslint-config │ tsconfig             │
├─────────────────────────────────────────────────────────────────┤
│                    工程基建层                                     │
│  turbo.json │ pnpm-workspace │ .github/workflows/ci.yml        │
└─────────────────────────────────────────────────────────────────┘
```

## 目录结构设计

```
weblink/
├── pnpm-workspace.yaml           ← kits/*, packages/*, apps/*
├── turbo.json                    ← Turborepo 构建编排
├── package.json
│
├── apps/                         ← 发行版薄壳
│   ├── web/                      ← 聚合首页 + 路由
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── App.vue
│   │   │   ├── config/kitRegistry.ts
│   │   │   ├── router/index.ts
│   │   │   ├── views/HomeView.vue
│   │   │   └── views/KitWrapper.vue
│   │   ├── index.html
│   │   ├── package.json          ← @weblink/web
│   │   ├── vite.config.ts
│   │   ├── tsconfig.app.json
│   │   └── tsconfig.node.json
│   ├── electron/                 ← Electron 壳
│   │   ├── package.json          ← @weblink/electron
│   │   ├── electron.vite.config.js
│   │   ├── src/
│   │   │   ├── main/index.ts
│   │   │   └── preload/index.ts
│   │   └── resources/
│   └── tauri/                    ← Tauri 壳
│       ├── package.json          ← @weblink/tauri
│       ├── src-tauri/
│       │   ├── Cargo.toml
│       │   ├── tauri.conf.json
│       │   └── src/
│       └── vite.config.ts
│
├── kits/                         ← 独立可部署 kit
│   ├── serialkit/                → serialkit.pages.dev
│   │   ├── src/
│   │   │   ├── index.ts          ← 导出 App 组件 (新增)
│   │   │   ├── main.ts           ← 独立入口 (保留)
│   │   │   ├── app/
│   │   │   │   ├── App.vue       ← 根组件
│   │   │   │   └── styles/
│   │   │   ├── features/
│   │   │   ├── domain/
│   │   │   └── infrastructure/
│   │   ├── index.html
│   │   ├── package.json          ← @weblink/serialkit
│   │   ├── vite.config.ts
│   │   ├── eslint.config.js
│   │   └── tsconfig.*.json
│   ├── downloadkit/              → weblink-downloadkit.pages.dev
│   ├── capturekit/
│   ├── flashkit/
│   ├── gnsskit/                  ← 纯 JS，无 Vue
│   ├── ipkit/
│   ├── modbuskit/                ← Svelte 5
│   ├── webrtckit/
│   ├── wirelesskit/
│   ├── cankit/
│   ├── hidkit/                   (placeholder)
│   ├── sensorkit/                (placeholder)
│   └── vkvmkit/                  (placeholder)
│
├── packages/                     ← 共享库
│   ├── ui-vue/                   ← 共享 Vue 组件
│   ├── utils/                    ← 工具函数
│   └── tokens/                   ← CSS 设计令牌
│
├── eslint-config/                ← 共享 ESLint 配置 (不放 packages/)
├── tsconfig/                     ← 共享 TS 配置 (不放 packages/)
│
└── src/                          ← 旧单体应用 (可删除)
```

## 核心模块划分

### 1. `kits/*/src/index.ts` — Kit 导出契约

每个 kit 必须在 `src/index.ts` 导出默认的 App 组件，供 web shell import。

```typescript
// kits/serialkit/src/index.ts
export { default as App } from "./app/App.vue"
```

对于有内部路由的 kit（downloadkit, ipkit），导出 routes：

```typescript
// kits/downloadkit/src/index.ts
export { default as App } from "./App.vue"
export { routes } from "./router/routes"
```

### 2. `apps/web/` — 聚合首页薄壳

职责：
- 列出所有 kit（`HomeView.vue`）
- 为每个 kit 配置路由（`/serialkit`, `/cankit`, ...）
- Vue kits 通过动态 import 加载为组件
- JS/Svelte kits 通过 iframe 兜底加载

### 3. `apps/electron/` — Electron 桌面薄壳

职责：
- Electron 主进程 + preload
- 引用 `apps/web` 的构建产物
- 提供平台 API（文件系统、IPC 等）

### 4. `apps/tauri/` — Tauri 桌面薄壳

职责：
- Tauri Rust 后端
- 引用 `apps/web` 的构建产物

### 5. `turbo.json` — 构建编排

```
packages/*:  build (无依赖)
kits/*:      build → 依赖 packages/* 的 build
apps/web:    build → 依赖所有 kits/* 的 build
apps/electron: build → 依赖 apps/web 的 build
apps/tauri:  build → 依赖 apps/web 的 build
```

## 数据流 / 调用关系

### Web Shell 加载 Vue Kit

```
用户访问 /serialkit
  → Vue Router 匹配
  → KitWrapper.vue 渲染
  → dynamic import("@weblink/serialkit")
  → SerialKit 的 App.vue 被加载
  → App.vue 中的 CSS（tokens.css, base.css）被包含
  → App.vue 渲染 SerialConsolePage.vue
```

### Web Shell 加载非 Vue Kit (iframe 兜底)

```
用户访问 /gnsskit
  → Vue Router 匹配
  → KitWrapper.vue 检测 kit 类型为 "iframe"
  → 渲染 <iframe src="https://gnsskit.pages.dev">
```

### 独立部署

```
Cloudflare Pages: 根目录 = kits/cankit
  → pnpm --filter @weblink/cankit build
  → kits/cankit/dist/ 作为部署目录
  → 访问: cankit.pages.dev
```

### Electron/Tauri

```
desktop 启动
  → 加载 apps/web/dist/index.html
  → 聚合页面渲染所有 kit
  → 用户在桌面应用中使用各 kit
```

## 关键技术选型

| 层面 | 选型 | 理由 |
|------|------|------|
| 构建编排 | Turborepo 2.x | pnpm workspace 最佳伴侣，缓存 + 并行 |
| Kit 导出 | `src/index.ts` 命名导出 | Vue + Vite 原生支持，简单直接 |
| Kit 加载 | Vue 动态 import（异步组件） | 代码分割，按需加载 |
| 非 Vue kit | iframe（仅 gnsskit + modbuskit） | 技术栈不兼容时的兜底方案 |
| Electron 构建 | electron-vite | 简化 Electron + Vite 集成 |
| Tauri | Tauri 2.x | Rust 后端，比 Electron 更轻量 |

## 开发步骤拆解

### Phase A：目录迁移（apps/* → kits/* + apps/web）

#### Task A1: 将 kit 目录从 apps/ 移到 kits/

**Step 1: 创建 kits/ 目录并移动 kit**

```bash
mkdir -p kits
mv apps/serialkit kits/
mv apps/capturekit kits/
mv apps/downloadkit kits/
mv apps/flashkit kits/
mv apps/gnsskit kits/
mv apps/ipkit kits/
mv apps/modbuskit kits/
mv apps/webrtckit kits/
mv apps/wirelesskit kits/
mv apps/cankit kits/
mv apps/hidkit kits/
mv apps/sensorkit kits/
mv apps/vkvmkit kits/
```

**Step 2: 更新 `pnpm-workspace.yaml`**

```yaml
packages:
  - "kits/*"
  - "packages/*"
  - "apps/*"
```

**Step 3: 验证**

```bash
pnpm install
```
Expected: 所有 workspace 包正确识别

**Step 4: Commit**

```bash
git add kits/ pnpm-workspace.yaml
git commit -m "refactor: move kits from apps/ to kits/"
```

#### Task A2: 将 apps/home 重命名为 apps/web

**Step 1: 移动目录**

```bash
mv apps/home apps/web
```

**Step 2: 更新 `apps/web/package.json`**

```json
{
  "name": "@weblink/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc -b --noEmit"
  },
  "dependencies": {
    "@weblink/tokens": "workspace:*",
    "@weblink/serialkit": "workspace:*",
    "@weblink/cankit": "workspace:*",
    "@weblink/downloadkit": "workspace:*",
    "@weblink/capturekit": "workspace:*",
    "@weblink/flashkit": "workspace:*",
    "@weblink/ipkit": "workspace:*",
    "@weblink/webrtckit": "workspace:*",
    "@weblink/wirelesskit": "workspace:*",
    "naive-ui": "^2.44.1",
    "vue": "^3.5.32",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@weblink/eslint-config": "workspace:*",
    "@weblink/tsconfig": "workspace:*",
    "@types/node": "^24.12.2",
    "@vitejs/plugin-vue": "^6.0.5",
    "typescript": "~6.0.2",
    "vite": "^8.0.4",
    "vue-tsc": "^3.2.6"
  }
}
```

**Step 3: 更新根 `package.json`**

```json
"dev": "turbo dev --filter=@weblink/web",
"build:web": "turbo build --filter=@weblink/web"
```

**Step 4: Commit**

```bash
git add apps/
git commit -m "refactor: rename apps/home to apps/web"
```

---

### Phase B：Kit 导出接口

每个 Vue kit 添加 `src/index.ts`，导出 App 组件。

#### Task B1: 为 serialkit 添加导出

**Files:**
- Create: `kits/serialkit/src/index.ts`

**Step 1: Create `kits/serialkit/src/index.ts`**

```typescript
export { default as App } from "./app/App.vue"
```

**Step 2: 更新 `kits/serialkit/package.json` exports**

在现有 package.json 的 scripts 后添加：

```json
"exports": {
  ".": "./src/index.ts"
}
```

**Step 3: 验证**

```bash
pnpm --filter @weblink/serialkit build
```
Expected: 构建成功（main.ts 独立入口仍然可用）

**Step 4: Commit**

```bash
git add kits/serialkit/src/index.ts kits/serialkit/package.json
git commit -m "feat(serialkit): add component export for web shell"
```

#### Task B2-B10: 为其余 Vue kit 添加导出

**通用模式**（适用于 cankit, capturekit, downloadkit, flashkit, webrtckit, wirelesskit, ipkit）：

每个 kit 创建 `src/index.ts`，内容取决于 App.vue 的位置：

| Kit | App.vue 位置 | index.ts 内容 |
|-----|------------|--------------|
| cankit | `src/app/App.vue` | `export { default as App } from "./app/App.vue"` |
| capturekit | `src/App.vue` | `export { default as App } from "./App.vue"` |
| downloadkit | `src/App.vue` | `export { default as App } from "./App.vue"; export { routes } from "./router/routes"` |
| flashkit | `src/App.vue` | `export { default as App } from "./App.vue"` |
| ipkit | `src/App.vue` | `export { default as App } from "./App.vue"; export { routes } from "./router/routes"` |
| webrtckit | `src/App.vue` | `export { default as App } from "./App.vue"` |
| wirelesskit | `src/app/App.vue` | `export { default as App } from "./app/App.vue"` |

每个 kit 的 `package.json` 添加 `"exports": { ".": "./src/index.ts" }`

**Commit per kit:**

```bash
git add kits/<kitname>/src/index.ts kits/<kitname>/package.json
git commit -m "feat(<kitname>): add component export"
```

#### Task B11: 将 kit 的 CSS 从 main.ts 移入 App.vue

**原因**: Web shell import App.vue 时，main.ts 中的 CSS 不会被包含。需要将 CSS 导入移到 App.vue 中。

**Affected kits and files:**

| Kit | CSS from main.ts | 移入 App.vue 的 import |
|-----|------------------|----------------------|
| serialkit | `tokens.css`, `base.css` | Add to App.vue script setup |
| cankit | `tokens.css`, `app.css` | Add to App.vue script setup |
| capturekit | `base.css` | Add to App.vue script setup |
| downloadkit | `@weblink/tokens/index.css`, `splitpanes.css`, `styles/index.css` | Add to App.vue script setup |
| flashkit | none | No change |
| ipkit | `styles/index.css` | Add to App.vue script setup |
| webrtckit | `tokens.css`, `base.css` | Add to App.vue script setup |
| wirelesskit | `tokens.css`, `base.css` | Add to App.vue script setup |

**通用修改模式**（以 serialkit 为例）：

`kits/serialkit/src/app/App.vue` 添加：

```vue
<script setup lang="ts">
import "@/app/styles/tokens.css";
import "@/app/styles/base.css";
import SerialConsolePage from "@/features/serialConsole/views/SerialConsolePage.vue";
</script>

<template>
  <SerialConsolePage />
</template>
```

**同时**: 从 `kits/serialkit/src/app/main.ts` 中移除 CSS 导入：

```typescript
// 之前
import "@/app/styles/tokens.css";
import "@/app/styles/base.css";

// 之后
// CSS 已移入 App.vue
```

**验证**: 同时验证独立 dev 和 web shell 加载

```bash
pnpm --filter @weblink/serialkit dev
```
Expected: 独立运行正常，CSS 正确

**Commit per kit:**

```bash
git add kits/<kitname>/
git commit -m "refactor(<kitname>): move CSS imports to App.vue for component export"
```

---

### Phase C：Kit with Router 改造

downloadkit 和 ipkit 有内部路由。Web shell 本身也用 Vue Router，需要避免冲突。

#### Task C1: downloadkit router 改造

**Files:**
- Modify: `kits/downloadkit/src/router/index.ts`

**Step 1: 改造 router/index.ts**

```typescript
import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import FlasherPage from "@/features/flasher/pages/FlasherPage.vue";

const history = import.meta.env.VITE_EMBEDDED
  ? createMemoryHistory()
  : createWebHistory();

const router = createRouter({
  history,
  routes: [{ path: "/", name: "flasher", component: FlasherPage }],
});

export default router;
```

**Step 2: 验证**

```bash
pnpm --filter @weblink/downloadkit dev
```
Expected: 独立运行正常（使用 webHistory）

**Step 3: Commit**

```bash
git add kits/downloadkit/src/router/index.ts
git commit -m "feat(downloadkit): support memory history for embedded mode"
```

#### Task C2: ipkit router 改造

同 C1 模式，修改 `kits/ipkit/src/router/index.ts`：

```typescript
import { createRouter, createWebHistory, createMemoryHistory } from "vue-router";
import { routes } from "@/router/routes";

const history = import.meta.env.VITE_EMBEDDED
  ? createMemoryHistory()
  : createWebHistory();

export const router = createRouter({
  history,
  routes,
});

export default router;
```

---

### Phase D：Web Shell 重构

#### Task D1: 创建 kitRegistry.ts

**Files:**
- Create: `apps/web/src/config/kitRegistry.ts`

```typescript
export interface KitConfig {
  id: string
  title: string
  description: string
  stack: "vue" | "js" | "svelte"
  /** 生产部署 URL（iframe 兜底用） */
  prodUrl: string
  /** 本地开发端口 */
  localPort?: number
}

export const KIT_REGISTRY: KitConfig[] = [
  { id: "serialkit", title: "Serial Kit", description: "WebSerial 串口调试", stack: "vue", prodUrl: "https://serialkit.pages.dev", localPort: 5174 },
  { id: "wirelesskit", title: "Wireless Kit", description: "Web Bluetooth / NFC", stack: "vue", prodUrl: "https://wirelesskit.pages.dev", localPort: 5175 },
  { id: "downloadkit", title: "Download Kit", description: "固件下载与烧录", stack: "vue", prodUrl: "https://weblink-downloadkit.pages.dev", localPort: 5176 },
  { id: "capturekit", title: "Capture Kit", description: "摄像头 / 麦克风 / 扬声器", stack: "vue", prodUrl: "https://capturekit.pages.dev", localPort: 5177 },
  { id: "gnsskit", title: "GNSS Kit", description: "GNSS / NMEA 数据分析", stack: "js", prodUrl: "https://gnsskit.pages.dev", localPort: 5178 },
  { id: "modbuskit", title: "Modbus Kit", description: "Modbus 调试面板", stack: "svelte", prodUrl: "https://modbuskit.pages.dev", localPort: 5179 },
  { id: "webrtckit", title: "WebRTC Kit", description: "WebRTC P2P / 信令调试", stack: "vue", prodUrl: "https://webrtckit.pages.dev", localPort: 5180 },
  { id: "flashkit", title: "Flash Kit", description: "SPI NOR / I2C EEPROM 编程", stack: "vue", prodUrl: "https://weblink-flashkit.pages.dev", localPort: 5181 },
  { id: "cankit", title: "CAN Kit", description: "slcan USB-CAN 调试", stack: "vue", prodUrl: "https://cankit.pages.dev", localPort: 5182 },
  { id: "ipkit", title: "IP Kit", description: "HTTP / WebSocket / DoH 调试", stack: "vue", prodUrl: "https://ipkit.pages.dev", localPort: 5183 },
  { id: "hidkit", title: "HID Kit", description: "HID 设备调试 (placeholder)", stack: "vue", prodUrl: "" },
  { id: "sensorkit", title: "Sensor Kit", description: "传感器调试 (placeholder)", stack: "vue", prodUrl: "" },
  { id: "vkvmkit", title: "VKVM Kit", description: "VirtualKVM (placeholder)", stack: "vue", prodUrl: "" },
]

export function findKit(id: string): KitConfig | undefined {
  return KIT_REGISTRY.find(k => k.id === id)
}
```

**Commit:**

```bash
git add apps/web/src/config/kitRegistry.ts
git commit -m "feat(web): add kit registry configuration"
```

#### Task D2: 创建 KitWrapper.vue

**Files:**
- Create: `apps/web/src/views/KitWrapper.vue`

```vue
<script setup lang="ts">
import { computed, defineAsyncComponent, h } from "vue";
import { useRoute } from "vue-router";
import { NResult, NButton } from "naive-ui";
import { findKit } from "@/config/kitRegistry";

const route = useRoute();
const kitId = computed(() => route.params.kitId as string);
const kitConfig = computed(() => findKit(kitId.value));

const KitComponent = computed(() => {
  if (!kitConfig.value) return null;
  const config = kitConfig.value;

  if (config.stack === "js" || config.stack === "svelte") {
    // iframe 兜底：JS 和 Svelte kit
    return defineAsyncComponent(() =>
      Promise.resolve({
        setup() {
          const url = import.meta.env.DEV && config.localPort
            ? `http://localhost:${config.localPort}`
            : config.prodUrl;
          return () =>
            h("div", { style: "height: 100%; width: 100%" }, [
              h("iframe", {
                src: url,
                style: "width: 100%; height: 100%; border: none",
                allow: "serial;usb;hid;bluetooth;nfc;camera;microphone",
                sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
              }),
            ]);
        },
      }),
    );
  }

  // Vue kit：动态 import
  const loaders: Record<string, () => Promise<any>> = {
    serialkit: () => import("@weblink/serialkit"),
    cankit: () => import("@weblink/cankit"),
    capturekit: () => import("@weblink/capturekit"),
    downloadkit: () => import("@weblink/downloadkit"),
    flashkit: () => import("@weblink/flashkit"),
    ipkit: () => import("@weblink/ipkit"),
    webrtckit: () => import("@weblink/webrtckit"),
    wirelesskit: () => import("@weblink/wirelesskit"),
  };

  const loader = loaders[config.id];
  if (!loader) return null;

  return defineAsyncComponent(() =>
    loader().then((mod) => ({
      setup() {
        return () => h(mod.App);
      },
    })),
  );
});

const kitNotFound = computed(() => !kitConfig.value);
const kitUnavailable = computed(() => kitConfig.value && !KitComponent.value);
</script>

<template>
  <div class="kit-wrapper">
    <NResult v-if="kitNotFound" status="404" title="Kit Not Found">
      <template #footer>
        <NButton tag="a" href="/" type="primary">Back to Home</NButton>
      </template>
    </NResult>
    <NResult v-else-if="kitUnavailable" status="info" title="Kit Coming Soon">
      <template #footer>
        <NButton tag="a" href="/" type="primary">Back to Home</NButton>
      </template>
    </NResult>
    <Suspense v-else>
      <template #default>
        <KitComponent v-if="KitComponent" />
      </template>
      <template #fallback>
        <div class="loading">Loading...</div>
      </template>
    </Suspense>
  </div>
</template>

<style scoped>
.kit-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
```

**Commit:**

```bash
git add apps/web/src/views/KitWrapper.vue
git commit -m "feat(web): add KitWrapper for dynamic kit loading"
```

#### Task D3: 更新 router/index.ts

**Files:**
- Modify: `apps/web/src/router/index.ts`

```typescript
import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import KitWrapper from "../views/KitWrapper.vue";
import { KIT_REGISTRY } from "../config/kitRegistry";

const kitRoutes = KIT_REGISTRY.filter(k => k.prodUrl).map(kit => ({
  path: `/${kit.id}`,
  name: kit.id,
  component: KitWrapper,
}));

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "home", component: HomeView },
    ...kitRoutes,
  ],
});

export default router;
```

**Commit:**

```bash
git add apps/web/src/router/index.ts
git commit -m "feat(web): add kit routes"
```

#### Task D4: 更新 HomeView.vue

**Files:**
- Modify: `apps/web/src/views/HomeView.vue`

将 HomeView 的 kit 列表改为使用 kitRegistry，按钮改为 router-link：

```typescript
import { KIT_REGISTRY } from "@/config/kitRegistry";

const rows = computed(() =>
  KIT_REGISTRY.map(k => ({
    ...k,
    ready: k.prodUrl !== "",
  })),
);
```

模板中按钮从 `<NButton tag="a" :href="row.href">` 改为：

```vue
<NButton v-if="row.ready" tag="router-link" :to="'/' + row.id" type="primary" secondary>
  Open
</NButton>
<NButton v-else disabled type="primary" secondary>
  Coming Soon
</NButton>
```

移除旧的 `KitEnvKey`、`KitLink` 类型和 `hrefFor` 函数。

**Commit:**

```bash
git add apps/web/src/views/HomeView.vue
git commit -m "refactor(web): use kitRegistry for home page"
```

---

### Phase E：Desktop 壳

#### Task E1: 创建 apps/electron/

**Files:**
- Create: `apps/electron/package.json`

```json
{
  "name": "@weblink/electron",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "electron-vite build && electron-builder"
  },
  "dependencies": {
    "@electron-toolkit/utils": "^3.0.0"
  },
  "devDependencies": {
    "@weblink/web": "workspace:*",
    "electron": "^35.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.0.0",
    "@vitejs/plugin-vue": "^6.0.5"
  },
  "build": {
    "appId": "com.insightop.weblink",
    "productName": "Weblink",
    "win": { "target": "portable", "icon": "resources/icon.ico" },
    "mac": { "target": "dmg", "icon": "resources/icon.icns" },
    "linux": { "target": "AppImage", "icon": "resources/icon.png" },
    "files": ["out/**/*"]
  }
}
```

- Create: `apps/electron/electron.vite.config.js`

```javascript
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve("src/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve("src/preload/index.ts") },
      },
    },
  },
  renderer: {
    root: resolve("../web"),
    plugins: [vue()],
    build: {
      outDir: resolve("../web/dist"),
    },
    resolve: {
      alias: {
        "@": resolve("../web/src"),
      },
    },
  },
});
```

- Create: `apps/electron/src/main/index.ts`

```typescript
import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "Weblink",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- Create: `apps/electron/src/preload/index.ts`

```typescript
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("platform", {
  isDesktop: true,
  isWeb: false,
  isTauri: false,
});
```

- Create: `apps/electron/resources/.gitkeep` (placeholder)

**Step 2: Commit**

```bash
git add apps/electron/
git commit -m "feat: create Electron desktop shell"
```

#### Task E2: 创建 apps/tauri/

**Files:**
- Create: `apps/tauri/package.json`

```json
{
  "name": "@weblink/tauri",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "build:debug": "tauri build --debug"
  },
  "dependencies": {},
  "devDependencies": {
    "@weblink/web": "workspace:*",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

- Create: `apps/tauri/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../web/src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

- Create: `apps/tauri/src-tauri/Cargo.toml`

```toml
[package]
name = "weblink"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- Create: `apps/tauri/src-tauri/tauri.conf.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/nicedoc/tauri-schema/v2/schema.json",
  "productName": "Weblink",
  "version": "0.1.0",
  "identifier": "com.insightop.weblink",
  "build": {
    "frontendDist": "../web/dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "pnpm dev --filter=@weblink/web",
    "beforeBuildCommand": "pnpm build --filter=@weblink/web"
  },
  "app": {
    "windows": [
      {
        "title": "Weblink",
        "width": 1280,
        "height": 860,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- Create: `apps/tauri/src-tauri/src/lib.rs`

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

- Create: `apps/tauri/src-tauri/src/main.rs`

```rust
fn main() {
  weblink_lib::run()
}
```

**Step 2: Commit**

```bash
git add apps/tauri/
git commit -m "feat: create Tauri desktop shell"
```

#### Task E3: 删除旧 electron/ 目录

```bash
rm -rf electron/
git add -A
git commit -m "chore: remove legacy electron directory"
```

---

### Phase F：Turbo.json 和根配置

#### Task F1: 创建 turbo.json

**Files:**
- Create: `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "format": {
      "cache": false
    }
  }
}
```

**Step 2: 更新根 `package.json`**

- 添加 turbo devDependency
- 更新 scripts 为 turbo 命令

```json
"devDependencies": {
  "turbo": "^2.0.0"
},
"scripts": {
  "dev": "turbo dev --filter=@weblink/web",
  "dev:web": "turbo dev --filter=@weblink/web",
  "dev:legacy": "vite",
  "build": "turbo run build",
  "build:web": "turbo build --filter=@weblink/web",
  "typecheck": "turbo run typecheck --if-present",
  "lint": "turbo run lint --if-present",
  "test": "turbo run test --if-present",
  "format": "prettier --write \"**/*.{js,mjs,cjs,ts,vue,json,md,css}\"",
  "changeset": "changeset"
}
```

**Step 3: 更新 `.gitignore`**

添加：`.turbo`

**Step 4: Commit**

```bash
git add turbo.json package.json .gitignore
git commit -m "feat: add Turborepo build orchestration"
```

#### Task F2: 更新 CI

**Files:**
- Modify: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint
        continue-on-error: true

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

**Commit:**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: use Turborepo for build orchestration"
```

---

### Phase G：全量验证

#### Task G1: 验证 Turborepo 缓存

**Step 1:** `pnpm build` (冷缓存)
**Step 2:** `pnpm build` (热缓存，应全部 cache hit)
**Step 3:** `touch kits/cankit/src/main.ts && pnpm build` (仅 cankit 重建)

#### Task G2: 验证各 kit 独立构建

```bash
for kit in serialkit cankit capturekit downloadkit flashkit ipkit webrtckit wirelesskit; do
  echo "=== $kit ===" && pnpm --filter @weblink/$kit build
done
```

#### Task G3: 验证 web 聚合构建

```bash
pnpm build
```
Expected: packages → kits → apps/web 顺序构建，全部成功

#### Task G4: 验证 dev 模式

```bash
pnpm dev
```
Expected: web 聚合页启动，可访问各 kit 路由

---

## 潜在风险与优化点

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Kit CSS 冲突 | 多个 kit 的全局 CSS 可能重复或冲突 | 确保 tokens.css/base.css 来自 `@weblink/tokens`，kit CSS 用 scoped |
| Kit with router 冲突 | downloadkit/ipkit 的内部 router 与 web shell router 冲突 | `VITE_EMBEDDED` 环境变量控制使用 memoryHistory |
| Kit naive-ui 重复注册 | 多个 kit 各自注册 naive-ui 插件 | Vite 自动 deduplicate，无需特殊处理 |
| Electron-vite 路径 | renderer root 指向 `../web`，相对路径可能不稳定 | 使用绝对路径 resolve |
| gnsskit/modbuskit iframe 跨域 | Cloudflare Pages 可能不允许 iframe | 在 kit 的 CF Pages 配置中设置 `X-Frame-Options` |

### 优化点

| 优化 | 说明 | 优先级 |
|------|------|--------|
| Remote Turbo Cache | CI 共享构建缓存 | 中 |
| Kit 代码分割 | 各 kit 的路由级代码分割 | 低 |
| Electron 自动更新 | electron-updater 集成 | 低 |
| `packages/components/` | 从 legacy src/ 中提取公共组件 | 中 |

---

## 执行顺序总览

```
Phase A: 目录迁移
  Task A1: kits/ 移动                    ← 独立
  Task A2: apps/home → apps/web          ← 依赖 A1

Phase B: Kit 导出接口
  Task B1-B10: 各 kit 添加 index.ts      ← 依赖 A1，可并行
  Task B11: CSS 移入 App.vue             ← 依赖 B1-B10

Phase C: Kit with Router 改造
  Task C1: downloadkit router            ← 依赖 B2
  Task C2: ipkit router                  ← 依赖 B10

Phase D: Web Shell 重构
  Task D1: kitRegistry.ts               ← 依赖 A2
  Task D2: KitWrapper.vue               ← 依赖 D1, B1-B10
  Task D3: router 更新                   ← 依赖 D1, D2
  Task D4: HomeView 更新                 ← 依赖 D1

Phase E: Desktop 壳
  Task E1: apps/electron/               ← 依赖 A2
  Task E2: apps/tauri/                  ← 依赖 A2
  Task E3: 清理旧 electron/             ← 依赖 E1

Phase F: Turbo + CI
  Task F1: turbo.json                   ← 独立
  Task F2: CI 更新                      ← 依赖 F1

Phase G: 全量验证                        ← 依赖所有
```
