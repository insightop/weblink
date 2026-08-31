# @weblink/otakit 通用 OpenBLT OTA 升级工具 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 weblink 中实现一个独立部署、人人可访问、带 URL 参数跳转即用的通用 OpenBLT OTA 升级工具（React 内核 + Vue 壳），底层复用 `@insightop/libopenblt`。

**Architecture:** Clean 分层——`core/`（传输无关刷写会话 + SerialPort 适配器 + 固件获取 + URL 解析，纯 TS 无 UI 依赖）/ `react-app/`（React 刷写界面）/ `vue-entry`（Vue 壳桥接，照抄 streamkit 模式）。OtaSession 从 sesp 的 modbus-ota 移植并去 sesp 化，对齐上游 BootCommander main.c 的线性流程。

**Tech Stack:** TypeScript、React 19、Vue 3、Vite 8、vitest、@testing-library/react、happy-dom、@insightop/libopenblt

**Spec:** `openspec/changes/add-otakit/specs/ota-kit-core/spec.md` 与 `openspec/changes/add-otakit/specs/ota-kit-shell/spec.md`

## Global Constraints

- 包名 `@weblink/otakit`，位于 `kits/otakit/`，pnpm workspace 管理
- React 版本基线 `^19.1.0`、react-dom `^19.1.0`（对齐 streamkit）
- `@insightop/libopenblt` 升级到 **0.2.2**（与 sesp 仓库对齐；0.1.0 无 `bypassFirmwareStart` 字段且 seed 配置不兼容）
- **仅保留 `baudrate` 一个串口 URL 参数**；`parity`/`stopbits` 不解析（固定 0/1），`baudrate` 必须传入 `OtaSession`
- **固件 URL 下载不做 CORS 代理**，直接 `fetch()`，默认目标服务器已允许跨域
- **本期不支持 seed/key**（`seedKeyAlgorithm` 不注入）
- 底层只依赖 `@insightop/libopenblt`，不引入其他 OTA 库
- `core/` 层 MUST NOT 依赖 React/Vue，纯 TS
- 不改动任何现有 kit 与 packages 的对外行为
- 子代理一律不做 git commit
- 文案中英文双语（i18n 键）
- 命名：目录 kebab-case、组件 PascalCase、TS 符号 camelCase/PascalCase

---

### Task 1: 脚手架与依赖

**Files:**
- Create: `kits/otakit/package.json`
- Create: `kits/otakit/vite.config.ts`
- Create: `kits/otakit/tsconfig.json`
- Create: `kits/otakit/tsconfig.react.json`
- Create: `kits/otakit/eslint.config.js`
- Create: `kits/otakit/env.d.ts`
- Create: `kits/otakit/src/index.ts`（占位）
- Create: `kits/otakit/src/vue-entry.ts`（占位）

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: 包骨架，供后续任务填充

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "@weblink/otakit",
  "private": true,
  "version": "0.1.0",
  "exports": {
    ".": "./src/index.ts",
    "./vue": "./src/vue-entry.ts"
  },
  "type": "module",
  "description": "通用 OpenBLT OTA 升级工具",
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.react.json",
    "typecheck:vue": "vue-tsc --noEmit -p tsconfig.json",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@weblink/tokens": "workspace:*",
    "@weblink/utils": "workspace:*",
    "@insightop/libopenblt": "0.2.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "vue": "^3.5.32"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@types/node": "^24.12.2",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@types/w3c-web-serial": "^1.0.8",
    "@vitejs/plugin-react-swc": "^4.3.1",
    "@vitejs/plugin-vue": "^6.0.5",
    "@weblink/eslint-config": "workspace:*",
    "@weblink/tsconfig": "workspace:*",
    "@weblink/vite-config": "workspace:*",
    "happy-dom": "^18.0.1",
    "typescript": "~6.0.2",
    "vite": "^8.0.4",
    "vitest": "^4.1.4",
    "vue-tsc": "^3.2.6"
  }
}
```

- [ ] **Step 2: 写 vite.config.ts（vue + react 双插件，照抄 streamkit）**

```ts
import { defineConfig, mergeConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import react from "@vitejs/plugin-react-swc";

export default mergeConfig(
  {
    plugins: [vue(), react()],
    test: {
      environment: "happy-dom",
      include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
    },
  },
  defineConfig({}),
);
```

- [ ] **Step 3: 写 tsconfig.json 与 tsconfig.react.json（照抄 streamkit）**

`tsconfig.json`:
```json
{
  "extends": "@weblink/tsconfig/vue-app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "skipLibCheck": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "src/vue-entry.ts"]
}
```

`tsconfig.react.json`:
```json
{
  "extends": "@weblink/tsconfig/react-app.json",
  "compilerOptions": {
    "ignoreDeprecations": "6.0",
    "skipLibCheck": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.react.tsbuildinfo",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vite/client", "react", "react-dom", "w3c-web-serial"]
  },
  "include": ["src/core/**/*.ts", "src/react-app/**/*.ts", "src/react-app/**/*.tsx"]
}
```

- [ ] **Step 4: 写 eslint.config.js（照抄 streamkit）**

```js
import { defineConfig } from "@weblink/eslint-config";
export default defineConfig();
```

- [ ] **Step 5: 写 env.d.ts**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: 写占位 src/index.ts 与 src/vue-entry.ts**

`src/index.ts`:
```ts
export {};
```

`src/vue-entry.ts`:
```ts
import { defineComponent, h } from "vue";
export const EmbeddedPage = defineComponent({
  name: "OtaKitEmbeddedPage",
  setup() {
    return () => h("div", "OTA Kit");
  },
});
```

- [ ] **Step 7: 安装依赖并自证**

Run: `cd /Users/bookshiyi/repos/weblink && pnpm install`（如网络受限走本机 7890 代理）
Run: `pnpm --filter @weblink/otakit test`
Run: `pnpm --filter @weblink/otakit typecheck`
Run: `pnpm --filter @weblink/otakit typecheck:vue`
Run: `pnpm --filter @weblink/otakit lint`
Expected: 全部通过（仅骨架文件）

- [ ] **Step 8: 提交（由主代理确认后执行）**

```bash
git add kits/otakit
git commit -m "feat(otakit): scaffold React+Vue kit skeleton"
```

---

### Task 2: core 层 — URL 参数解析

**Files:**
- Create: `kits/otakit/src/core/url-params/types.ts`
- Create: `kits/otakit/src/core/url-params/parseUrlParams.ts`
- Test: `kits/otakit/src/core/url-params/parseUrlParams.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `URL_PARAM_KEYS` 常量对象（含 SLAVE_ID/BAUD_RATE 等，**不含 PARITY/STOP_BITS**）
  - `interface UrlParams`（protocol/slaveId/baudrate/firmwareUrl/auto/timeouts/bypassFirmwareStart）
  - `parseUrlParams(search?: string): UrlParams`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect } from "vitest";
import { parseUrlParams } from "./parseUrlParams";

describe("parseUrlParams", () => {
  it("parses full known params with type conversion", () => {
    const p = parseUrlParams(
      "?protocol=mb-rtu&slaveId=1&baudrate=115200" +
      "&firmware=https://example.com/app.hex&auto=1&timeoutT1=1000&bypassFirmwareStart=0",
    );
    expect(p.protocol).toBe("mb-rtu");
    expect(p.slaveId).toBe(1);
    expect(p.baudrate).toBe(115200);
    expect(p.firmwareUrl).toBe("https://example.com/app.hex");
    expect(p.auto).toBe(true);
    expect(p.timeouts?.t1).toBe(1000);
    expect(p.bypassFirmwareStart).toBe(0);
  });

  it("returns defaults for empty search", () => {
    const p = parseUrlParams("");
    expect(p.protocol).toBe("mb-rtu");
    expect(p.slaveId).toBeUndefined();
    expect(p.auto).toBe(false);
  });

  it("ignores unknown params and parity/stopbits", () => {
    const p = parseUrlParams("?foo=bar&unknown=1&parity=1&stopbits=2");
    expect(p.protocol).toBe("mb-rtu");
    expect((p as any).foo).toBeUndefined();
    expect((p as any).parity).toBeUndefined();
    expect((p as any).stopbits).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @weblink/otakit test`
Expected: FAIL（parseUrlParams 未定义）

- [ ] **Step 3: 写实现**

`types.ts`:
```ts
export const URL_PARAM_KEYS = {
  PROTOCOL: "protocol",
  SLAVE_ID: "slaveId",
  BAUD_RATE: "baudrate",
  FIRMWARE: "firmware",
  AUTO: "auto",
  TIMEOUT_T1: "timeoutT1",
  TIMEOUT_T3: "timeoutT3",
  TIMEOUT_T4: "timeoutT4",
  TIMEOUT_T5: "timeoutT5",
  TIMEOUT_T6: "timeoutT6",
  TIMEOUT_T7: "timeoutT7",
  BYPASS_FIRMWARE_START: "bypassFirmwareStart",
} as const;

export interface OtaTimeouts {
  t1?: number; t3?: number; t4?: number; t5?: number; t6?: number; t7?: number;
}

export interface UrlParams {
  protocol: "mb-rtu";
  slaveId?: number;
  baudrate?: number;
  firmwareUrl?: string;
  auto: boolean;
  timeouts?: OtaTimeouts;
  bypassFirmwareStart?: number;
}
```

`parseUrlParams.ts`:
```ts
import { URL_PARAM_KEYS, type UrlParams, type OtaTimeouts } from "./types";

const KNOWN = new Set(Object.values(URL_PARAM_KEYS));

function toNumber(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export function parseUrlParams(search?: string): UrlParams {
  const params: UrlParams = { protocol: "mb-rtu", auto: false };
  if (!search) return params;
  const clean = search.startsWith("?") ? search.slice(1) : search;
  const usp = new URLSearchParams(clean);
  const timeouts: OtaTimeouts = {};

  for (const [key, value] of usp.entries()) {
    if (!KNOWN.has(key)) continue;
    switch (key) {
      case URL_PARAM_KEYS.SLAVE_ID: params.slaveId = toNumber(value); break;
      case URL_PARAM_KEYS.BAUD_RATE: params.baudrate = toNumber(value); break;
      case URL_PARAM_KEYS.FIRMWARE: params.firmwareUrl = value; break;
      case URL_PARAM_KEYS.AUTO: params.auto = value === "1" || value === "true"; break;
      case URL_PARAM_KEYS.BYPASS_FIRMWARE_START: params.bypassFirmwareStart = toNumber(value); break;
      case URL_PARAM_KEYS.TIMEOUT_T1: timeouts.t1 = toNumber(value); break;
      case URL_PARAM_KEYS.TIMEOUT_T3: timeouts.t3 = toNumber(value); break;
      case URL_PARAM_KEYS.TIMEOUT_T4: timeouts.t4 = toNumber(value); break;
      case URL_PARAM_KEYS.TIMEOUT_T5: timeouts.t5 = toNumber(value); break;
      case URL_PARAM_KEYS.TIMEOUT_T6: timeouts.t6 = toNumber(value); break;
      case URL_PARAM_KEYS.TIMEOUT_T7: timeouts.t7 = toNumber(value); break;
    }
  }
  if (Object.keys(timeouts).length > 0) params.timeouts = timeouts;
  return params;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @weblink/otakit test`
Expected: PASS

- [ ] **Step 5: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/core/url-params
git commit -m "feat(otakit): add URL params parsing"
```

---

### Task 3: core 层 — SerialPort 适配器

**Files:**
- Create: `kits/otakit/src/core/serial/serialPortAdapter.ts`
- Test: `kits/otakit/src/core/serial/serialPortAdapter.spec.ts`

**Interfaces:**
- Consumes: `@insightop/libopenblt` 的 `SerialPort` 类型
- Produces: `createSerialPortAdapter(transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>): SerialPort`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect, vi } from "vitest";
import { createSerialPortAdapter } from "./serialPortAdapter";

describe("createSerialPortAdapter", () => {
  it("write calls transact and caches response", async () => {
    const transact = vi.fn(async () => new Uint8Array([0x01, 0x02, 0x03]));
    const port = createSerialPortAdapter(transact);
    expect(await port.open("x", 0 as any, 0 as any, 0 as any)).toBe(true);
    expect(await port.write(new Uint8Array([0xaa]))).toBe(true);
    expect(transact).toHaveBeenCalledTimes(1);
    const chunk = await port.read(2);
    expect(Array.from(chunk)).toEqual([0x01, 0x02]);
  });

  it("read returns remaining bytes across calls", async () => {
    const transact = vi.fn(async () => new Uint8Array([0x01, 0x02, 0x03]));
    const port = createSerialPortAdapter(transact);
    await port.write(new Uint8Array([0xaa]));
    const a = await port.read(2);
    const b = await port.read(10);
    expect(Array.from(a)).toEqual([0x01, 0x02]);
    expect(Array.from(b)).toEqual([0x03]);
  });

  it("read returns empty when no response cached", async () => {
    const port = createSerialPortAdapter(async () => new Uint8Array());
    const chunk = await port.read(1);
    expect(chunk.length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @weblink/otakit test`
Expected: FAIL（createSerialPortAdapter 未定义）

- [ ] **Step 3: 写实现**

```ts
import type { SerialPort } from "@insightop/libopenblt";

export function createSerialPortAdapter(
  transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>,
): SerialPort {
  let responseBuffer = new Uint8Array(0);
  return {
    async open() { return true; },
    close() {},
    async write(data: Uint8Array): Promise<boolean> {
      const response = await transact(data);
      responseBuffer = response;
      return true;
    },
    async read(length: number): Promise<Uint8Array> {
      if (responseBuffer.length === 0) return new Uint8Array(0);
      const chunk = responseBuffer.slice(0, length);
      responseBuffer = responseBuffer.slice(length);
      return chunk;
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @weblink/otakit test`
Expected: PASS

- [ ] **Step 5: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/core/serial
git commit -m "feat(otakit): add SerialPort adapter"
```

---

### Task 4: core 层 — OtaSession 刷写会话

**Files:**
- Create: `kits/otakit/src/core/session/otaSession.ts`
- Create: `kits/otakit/src/core/session/otaSession.types.ts`
- Test: `kits/otakit/src/core/session/otaSession.spec.ts`
- Test: `kits/otakit/src/test/fakes/fakeSerialPort.ts`

**Interfaces:**
- Consumes: `@insightop/libopenblt` 的 `bltSession*`/`bltFirmware*`/`HexParser`/`BLT_*` 常量、`SerialPort` 类型；`createSerialPortAdapter`
- Produces:
  - `interface OtaSessionOptions`（timeouts/backdoorTimeoutMs/backdoorRetryIntervalMs/bypassFirmwareStart）
  - `interface ProgramProgress`（phase/segmentIndex/segmentTotal/bytesProcessed/bytesTotal/percent/detail）
  - `class OtaSession`（constructor(transact, slaveId, baudrate, options?)、connect()、program(hexData, onProgress?)、reset()、close()）；`baudrate` 必须显式传入，`parity`/`stopbits` 固定 0/1

- [ ] **Step 1: 写 FakeSerialPort 测试替身**

`src/test/fakes/fakeSerialPort.ts`:
```ts
import type { SerialPort } from "@insightop/libopenblt";

/** 内存假串口：write 记录帧，read 返回预置响应队列。 */
export class FakeSerialPort implements SerialPort {
  written: Uint8Array[] = [];
  private responses: Uint8Array[] = [];
  private buffer = new Uint8Array(0);

  queueResponse(data: Uint8Array): void { this.responses.push(data); }

  async open(): Promise<boolean> { return true; }
  close(): void {}
  async write(data: Uint8Array): Promise<boolean> {
    this.written.push(data);
    const next = this.responses.shift();
    if (next) this.buffer = next;
    return true;
  }
  async read(length: number): Promise<Uint8Array> {
    if (this.buffer.length === 0) return new Uint8Array(0);
    const chunk = this.buffer.slice(0, length);
    this.buffer = this.buffer.slice(length);
    return chunk;
  }
}
```

- [ ] **Step 2: 写失败的测试**

`otaSession.spec.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { OtaSession } from "./otaSession";
import { FakeSerialPort } from "../../test/fakes/fakeSerialPort";

describe("OtaSession", () => {
  it("connect succeeds when bltSessionStart returns OK", async () => {
    const port = new FakeSerialPort();
    const session = new OtaSession(async (frame) => {
      // 模拟 XCP CONNECT 成功响应
      return new Uint8Array([0x01, 0x6d, 0x02, 0xff, 0x00, 0x00, 0x00]);
    }, 1, 115200, { backdoorTimeoutMs: 100, backdoorRetryIntervalMs: 10 });
    await expect(session.connect()).resolves.toBeUndefined();
    session.close();
  });

  it("program parses hex and reports progress", async () => {
    const session = new OtaSession(async () => new Uint8Array([0x01, 0x6d, 0x02, 0xff, 0x00, 0x00, 0x00]), 1, 115200);
    const onProgress = vi.fn();
    const hex = ":020000040000FA\n:0400000000000000F0\n:00000001FF\n";
    await expect(session.program(hex, onProgress)).resolves.toBeUndefined();
    expect(onProgress).toHaveBeenCalled();
    session.close();
  });

  it("reset calls bltSessionStop", async () => {
    const session = new OtaSession(async () => new Uint8Array(), 1, 9600);
    await expect(session.reset()).resolves.toBeUndefined();
    session.close();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm --filter @weblink/otakit test`
Expected: FAIL（OtaSession 未定义）

- [ ] **Step 4: 写实现（从 sesp modbus-ota 移植并去 sesp 化）**

`otaSession.types.ts`:
```ts
export interface OtaSessionOptions {
  timeouts?: Partial<{ t1: number; t3: number; t4: number; t5: number; t6: number; t7: number }>;
  bypassFirmwareStart?: number;
  backdoorTimeoutMs?: number;
  backdoorRetryIntervalMs?: number;
}

export interface ProgramProgress {
  phase: "connecting" | "info_table" | "erasing" | "writing" | "resetting";
  segmentIndex?: number;
  segmentTotal?: number;
  bytesProcessed?: number;
  bytesTotal?: number;
  percent?: number;
  detail?: string;
}
```

`otaSession.ts`（核心，从 sesp 移植，去掉 emit 依赖）:
```ts
import {
  bltSessionInit, bltSessionStart, bltSessionStop, bltSessionTerminate,
  bltSessionCheckInfoTable, bltSessionClearMemory, bltSessionWriteData,
  bltFirmwareInit, bltFirmwareTerminate, bltFirmwareLoadFromFile,
  bltFirmwareGetSegmentCount, bltFirmwareGetSegment, HexParser,
  BLT_SESSION_XCP_V10, BLT_TRANSPORT_XCP_V10_MBRTU, BLT_RESULT_OK,
  BLT_RESULT_ERROR_SESSION_INFO_TABLE, BLT_RESULT_ERROR_SESSION_INFO_TABLE_NOT_SUPPORTED,
  type SerialPort,
} from "@insightop/libopenblt";
import { createSerialPortAdapter } from "../serial/serialPortAdapter";
import type { OtaSessionOptions, ProgramProgress } from "./otaSession.types";

const ERASE_CHUNK_SIZE = 32 * 1024;
const WRITE_CHUNK_SIZE = 256;
const DEFAULT_BACKDOOR_TIMEOUT_MS = 10_000;
const DEFAULT_BACKDOOR_RETRY_INTERVAL_MS = 100;

export class OtaSession {
  private readonly serialPort: SerialPort;
  private readonly slaveId: number;
  private readonly baudrate: number;
  private readonly options: Required<Pick<OtaSessionOptions, "backdoorTimeoutMs" | "backdoorRetryIntervalMs">> & OtaSessionOptions;

  constructor(
    transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>,
    slaveId: number,
    baudrate: number,
    options?: OtaSessionOptions,
  ) {
    this.slaveId = slaveId;
    this.baudrate = baudrate;
    this.options = {
      backdoorTimeoutMs: options?.backdoorTimeoutMs ?? DEFAULT_BACKDOOR_TIMEOUT_MS,
      backdoorRetryIntervalMs: options?.backdoorRetryIntervalMs ?? DEFAULT_BACKDOOR_RETRY_INTERVAL_MS,
      ...options,
    };
    this.serialPort = createSerialPortAdapter(transact);
  }

  async connect(): Promise<void> {
    const bypassFirmwareStart = this.options.bypassFirmwareStart ?? 0;
    bltSessionInit(BLT_SESSION_XCP_V10, {
      timeoutT1: this.options.timeouts?.t1 ?? 1000,
      timeoutT3: this.options.timeouts?.t3 ?? 2000,
      timeoutT4: this.options.timeouts?.t4 ?? 10000,
      timeoutT5: this.options.timeouts?.t5 ?? 1000,
      timeoutT6: this.options.timeouts?.t6 ?? 50,
      timeoutT7: this.options.timeouts?.t7 ?? 2000,
      seedKeyAlgorithm: undefined,
      connectMode: 0,
      bypassFirmwareStart,
    }, BLT_TRANSPORT_XCP_V10_MBRTU, {
      serialPort: this.serialPort,
      portName: "modbus",
      baudrate: this.baudrate,
      parity: 0,
      stopbits: 1,
      destinationAddr: this.slaveId,
    });

    let startResult = await bltSessionStart();
    if (startResult !== BLT_RESULT_OK) {
      const retryDeadline = Date.now() + this.options.backdoorTimeoutMs;
      while (Date.now() < retryDeadline) {
        await new Promise((r) => setTimeout(r, this.options.backdoorRetryIntervalMs));
        startResult = await bltSessionStart();
        if (startResult === BLT_RESULT_OK) break;
      }
      if (startResult !== BLT_RESULT_OK) {
        throw new Error("XCP 连接失败：设备未进入 bootloader 模式");
      }
    }

    const infoResult = await bltSessionCheckInfoTable();
    if (infoResult === BLT_RESULT_ERROR_SESSION_INFO_TABLE) {
      throw new Error("Info table 检查失败：设备拒绝升级");
    }
    if (infoResult !== BLT_RESULT_OK && infoResult !== BLT_RESULT_ERROR_SESSION_INFO_TABLE_NOT_SUPPORTED) {
      throw new Error(`Info table 检查错误: ${infoResult}`);
    }
  }

  async program(hexData: string, onProgress?: (p: ProgramProgress) => void): Promise<void> {
    bltFirmwareInit(HexParser);
    try {
      const loadOk = bltFirmwareLoadFromFile(hexData, 0);
      if (!loadOk) throw new Error("固件解析失败：无有效数据");
      const segCount = bltFirmwareGetSegmentCount();
      if (segCount === 0) throw new Error("固件解析失败：无有效数据段");
      const totalSize = this.computeTotalSize(segCount);

      let totalErased = 0;
      for (let i = 0; i < segCount; i++) {
        const seg = bltFirmwareGetSegment(i);
        if (!seg) throw new Error(`获取 segment ${i} 失败`);
        let remaining = seg.len;
        let addr = seg.address;
        while (remaining > 0) {
          const chunk = Math.min(remaining, ERASE_CHUNK_SIZE);
          const result = await bltSessionClearMemory(addr, chunk);
          if (result !== BLT_RESULT_OK) throw new Error(`擦除失败: 0x${addr.toString(16)}`);
          addr += chunk; remaining -= chunk; totalErased += chunk;
          onProgress?.({ phase: "erasing", segmentIndex: i, segmentTotal: segCount, bytesProcessed: totalErased, bytesTotal: totalSize, percent: Math.round((totalErased / totalSize) * 100) });
        }
      }

      let totalWritten = 0;
      for (let i = 0; i < segCount; i++) {
        const seg = bltFirmwareGetSegment(i);
        if (!seg) throw new Error(`获取 segment ${i} 失败`);
        let remaining = seg.len;
        let addr = seg.address;
        let offset = 0;
        while (remaining > 0) {
          const chunk = Math.min(remaining, WRITE_CHUNK_SIZE);
          const chunkData = seg.data.subarray(offset, offset + chunk);
          const result = await bltSessionWriteData(addr, chunk, chunkData);
          if (result !== BLT_RESULT_OK) throw new Error(`写入失败: 0x${addr.toString(16)}`);
          addr += chunk; offset += chunk; remaining -= chunk; totalWritten += chunk;
          onProgress?.({ phase: "writing", segmentIndex: i, segmentTotal: segCount, bytesProcessed: totalWritten, bytesTotal: totalSize, percent: Math.round((totalWritten / totalSize) * 100) });
        }
      }
    } finally {
      bltFirmwareTerminate();
    }
  }

  async reset(): Promise<void> {
    await bltSessionStop();
  }

  close(): void {
    bltSessionTerminate();
    bltFirmwareTerminate();
  }

  private computeTotalSize(segCount: number): number {
    let total = 0;
    for (let i = 0; i < segCount; i++) {
      const seg = bltFirmwareGetSegment(i);
      if (seg) total += seg.len;
    }
    return total || 1;
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @weblink/otakit test`
Expected: PASS

- [ ] **Step 6: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/core/session kits/otakit/src/test
git commit -m "feat(otakit): add OtaSession flashing session"
```

---

### Task 5: core 层 — 固件获取

**Files:**
- Create: `kits/otakit/src/core/firmware/firmwareFetcher.ts`
- Test: `kits/otakit/src/core/firmware/firmwareFetcher.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `fetchFirmwareFromUrl(url: string, onProgress?: (percent: number) => void): Promise<string>`
  - `readFirmwareFile(file: File): Promise<string>`

- [ ] **Step 1: 写失败的测试**

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchFirmwareFromUrl, readFirmwareFile } from "./firmwareFetcher";

describe("firmwareFetcher", () => {
  it("fetchFirmwareFromUrl returns text on success", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      text: async () => ":020000040000FA\n:00000001FF\n",
    } as any));
    vi.stubGlobal("fetch", mockFetch);
    const text = await fetchFirmwareFromUrl("https://example.com/app.hex");
    expect(text).toContain(":020000040000FA");
    vi.unstubAllGlobals();
  });

  it("fetchFirmwareFromUrl throws on non-ok", async () => {
    const mockFetch = vi.fn(async () => ({ ok: false, status: 404 } as any));
    vi.stubGlobal("fetch", mockFetch);
    await expect(fetchFirmwareFromUrl("https://example.com/x.hex")).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it("readFirmwareFile reads file text", async () => {
    const file = new File([":020000040000FA\n"], "app.hex", { type: "text/plain" });
    const text = await readFirmwareFile(file);
    expect(text).toContain(":020000040000FA");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @weblink/otakit test`
Expected: FAIL（函数未定义）

- [ ] **Step 3: 写实现**

```ts
export async function fetchFirmwareFromUrl(
  url: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`固件下载失败 (HTTP ${response.status})`);
  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  if (!response.body || total === 0) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
    received += value.length;
    if (total > 0) onProgress?.(Math.round((received / total) * 100));
  }
  return result;
}

export async function readFirmwareFile(file: File): Promise<string> {
  return file.text();
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @weblink/otakit test`
Expected: PASS

- [ ] **Step 5: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/core/firmware
git commit -m "feat(otakit): add firmware fetcher"
```

---

### Task 6: React features — 会话 hook

**Files:**
- Create: `kits/otakit/src/react-app/hooks/useOtaSession.ts`
- Test: `kits/otakit/src/react-app/hooks/useOtaSession.spec.tsx`

**Interfaces:**
- Consumes: `OtaSession`、`OtaSessionOptions`、`ProgramProgress`、`fetchFirmwareFromUrl`、`readFirmwareFile`
- Produces: `useOtaSession()` 返回 `{ state, start, reset, setFirmwareUrl, setFirmwareFile, setSerialConfig }`

- [ ] **Step 1: 写失败的测试**

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOtaSession } from "./useOtaSession";

describe("useOtaSession", () => {
  it("starts flashing and reaches done", async () => {
    const { result } = renderHook(() => useOtaSession());
    await act(async () => {
      await result.current.start({
        transact: async () => new Uint8Array([0x01, 0x6d, 0x02, 0xff, 0x00, 0x00, 0x00]),
        slaveId: 1,
        baudrate: 115200,
        hexData: ":020000040000FA\n:00000001FF\n",
      });
    });
    expect(result.current.state.stage).toBe("done");
  });

  it("reports failure on error", async () => {
    const { result } = renderHook(() => useOtaSession());
    await act(async () => {
      await result.current.start({
        transact: async () => { throw new Error("timeout"); },
        slaveId: 1,
        baudrate: 115200,
        hexData: ":020000040000FA\n:00000001FF\n",
      });
    });
    expect(result.current.state.stage).toBe("failed");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @weblink/otakit test`
Expected: FAIL（useOtaSession 未定义）

- [ ] **Step 3: 写实现**

```tsx
import { useCallback, useRef, useState } from "react";
import { OtaSession } from "../../core/session/otaSession";
import type { ProgramProgress } from "../../core/session/otaSession.types";

export type OtaStage =
  | "idle" | "connecting" | "programming" | "resetting" | "done" | "failed";

export interface OtaState {
  active: boolean;
  stage: OtaStage;
  percent: number;
  detail?: string;
  error?: string;
}

export interface StartOptions {
  transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>;
  slaveId: number;
  baudrate: number;
  hexData: string;
  bypassFirmwareStart?: number;
}

export function useOtaSession() {
  const [state, setState] = useState<OtaState>({ active: false, stage: "idle", percent: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const set = (v: Partial<OtaState>) => setState((p) => ({ ...p, ...v }));

  const start = useCallback(async (opts: StartOptions) => {
    if (stateRef.current.active) return;
    set({ active: true, stage: "connecting", percent: 0 });
    const session = new OtaSession(opts.transact, opts.slaveId, opts.baudrate, {
      bypassFirmwareStart: opts.bypassFirmwareStart,
    });
    try {
      await session.connect();
      set({ stage: "programming", percent: 0 });
      await session.program(opts.hexData, (p: ProgramProgress) => {
        if (p.percent != null) set({ percent: p.percent, detail: p.phase });
      });
      set({ stage: "resetting", percent: 100 });
      await session.reset();
      set({ stage: "done", percent: 100 });
    } catch (e) {
      set({ stage: "failed", error: e instanceof Error ? e.message : String(e) });
    } finally {
      session.close();
      set({ active: false });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ active: false, stage: "idle", percent: 0 });
  }, []);

  return { state, start, reset };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @weblink/otakit test`
Expected: PASS

- [ ] **Step 5: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/react-app/hooks
git commit -m "feat(otakit): add useOtaSession hook"
```

---

### Task 7: React features — UI 组件与页面

**Files:**
- Create: `kits/otakit/src/react-app/components/SerialSelect.tsx`
- Create: `kits/otakit/src/react-app/components/FirmwareSelect.tsx`
- Create: `kits/otakit/src/react-app/components/ProgressView.tsx`
- Create: `kits/otakit/src/react-app/components/LogPanel.tsx`
- Create: `kits/otakit/src/react-app/OtaPage.tsx`
- Create: `kits/otakit/src/react-app/ota.css`
- Test: `kits/otakit/src/react-app/OtaPage.spec.tsx`

**Interfaces:**
- Consumes: `useOtaSession`、`parseUrlParams`、`fetchFirmwareFromUrl`、`readFirmwareFile`
- Produces: `OtaPage` React 组件（含能力检测、串口选择、固件选择、刷写进度、日志面板）

- [ ] **Step 1: 写能力检测与页面测试**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OtaPage } from "./OtaPage";

describe("OtaPage", () => {
  it("shows unsupported message when no Web Serial", () => {
    Object.defineProperty(navigator, "serial", { value: undefined, configurable: true });
    render(<OtaPage />);
    expect(screen.getByText(/不支持|unsupported/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @weblink/otakit test`
Expected: FAIL（OtaPage 未定义）

- [ ] **Step 3: 写实现（组件 + 页面 + CSS）**

`OtaPage.tsx`（核心组装，含能力检测、URL 参数预填、串口选择、固件选择、刷写、日志）:
```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useOtaSession } from "./hooks/useOtaSession";
import { parseUrlParams } from "../core/url-params/parseUrlParams";
import { fetchFirmwareFromUrl, readFirmwareFile } from "../core/firmware/firmwareFetcher";
import { SerialSelect } from "./components/SerialSelect";
import { FirmwareSelect } from "./components/FirmwareSelect";
import { ProgressView } from "./components/ProgressView";
import { LogPanel } from "./components/LogPanel";
import { useI18n } from "./i18n/useI18n";
import "./ota.css";

export function OtaPage() {
  const { t } = useI18n();
  const { state, start, reset } = useOtaSession();
  const [serialSupported] = useState(() => typeof navigator !== "undefined" && "serial" in navigator);
  const [secureContext] = useState(() => typeof window !== "undefined" && window.isSecureContext);
  const [port, setPort] = useState<SerialPort | null>(null);
  const [firmwareUrl, setFirmwareUrl] = useState<string>("");
  const [hexData, setHexData] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const paramsRef = useRef(parseUrlParams(window.location.search));

  const appendLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg]);
  }, []);

  const handleStart = useCallback(async () => {
    if (!port || !hexData) return;
    const params = paramsRef.current;
    const transact = async (frame: Uint8Array, timeoutMs?: number) => {
      if (!port) throw new Error("no port");
      const writer = port.writable?.getWriter();
      await writer?.write(frame);
      writer?.releaseLock();
      const reader = port.readable?.getReader();
      const chunks: number[] = [];
      const deadline = Date.now() + (timeoutMs ?? 1000);
      while (Date.now() < deadline) {
        const { value, done } = await reader!.read();
        if (done) break;
        chunks.push(...Array.from(value));
        if (chunks.length >= 3 && chunks[2] > 0) {
          const total = 3 + chunks[2] + 2;
          if (chunks.length >= total) break;
        }
      }
      reader?.releaseLock();
      return new Uint8Array(chunks);
    };
    appendLog(`start slaveId=${params.slaveId ?? 1} baudrate=${params.baudrate ?? 115200}`);
    await start({ transact, slaveId: params.slaveId ?? 1, baudrate: params.baudrate ?? 115200, hexData, bypassFirmwareStart: params.bypassFirmwareStart });
  }, [port, hexData, start, appendLog]);

  if (!serialSupported) {
    return <div className="ota-kit">{t("ota.unsupported")}</div>;
  }
  if (!secureContext) {
    return <div className="ota-kit">{t("ota.insecure")}</div>;
  }

  return (
    <div className="ota-kit">
      <h1>{t("ota.title")}</h1>
      <SerialSelect onSelect={setPort} />
      <FirmwareSelect
        initialUrl={paramsRef.current.firmwareUrl}
        onUrlChange={setFirmwareUrl}
        onFile={async (f) => setHexData(await readFirmwareFile(f))}
        onUrlFetch={async (url) => setHexData(await fetchFirmwareFromUrl(url))}
      />
      <button onClick={handleStart} disabled={!port || !hexData || state.active}>{t("ota.start")}</button>
      <ProgressView state={state} />
      <LogPanel logs={logs} onClear={() => setLogs([])} />
    </div>
  );
}
```

`i18n/useI18n.ts`（React 树内按 locale 取词，locale 由 Vue 壳注入）:
```ts
import { createContext, useContext } from "react";
import { messages } from "./en-US";
import { messagesZhCN } from "./zh-CN";

export type Locale = "en-US" | "zh-CN";
export const LocaleContext = createContext<Locale>("zh-CN");

export function useI18n() {
  const locale = useContext(LocaleContext);
  const dict = locale === "zh-CN" ? messagesZhCN : messages;
  return {
    t: (key: keyof typeof messages) => dict[key] ?? messages[key] ?? key,
  };
}
```

`components/SerialSelect.tsx`:
```tsx
import { useState } from "react";

export function SerialSelect({ onSelect }: { onSelect: (port: SerialPort) => void }) {
  const [error, setError] = useState<string>("");
  const handleClick = async () => {
    try {
      const port = await navigator.serial.requestPort();
      onSelect(port);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取消选择");
    }
  };
  return (
    <div>
      <button onClick={handleClick}>选择串口</button>
      {error && <span>{error}</span>}
    </div>
  );
}
```

`components/FirmwareSelect.tsx`:
```tsx
import { useState } from "react";

export function FirmwareSelect({
  initialUrl, onUrlChange, onFile, onUrlFetch,
}: {
  initialUrl?: string;
  onUrlChange: (url: string) => void;
  onFile: (file: File) => void;
  onUrlFetch: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  return (
    <div>
      <input
        type="text"
        placeholder="固件 URL"
        value={url}
        onChange={(e) => { setUrl(e.target.value); onUrlChange(e.target.value); }}
      />
      <button onClick={() => url && onUrlFetch(url)}>下载固件</button>
      <input type="file" accept=".hex,.srec" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}
```

`components/ProgressView.tsx`:
```tsx
import type { OtaState } from "../hooks/useOtaSession";

export function ProgressView({ state }: { state: OtaState }) {
  return (
    <div>
      <div>阶段: {state.stage}</div>
      <div>进度: {state.percent}%</div>
      {state.error && <div style={{ color: "red" }}>{state.error}</div>}
    </div>
  );
}
```

`components/LogPanel.tsx`:
```tsx
export function LogPanel({ logs, onClear }: { logs: string[]; onClear: () => void }) {
  return (
    <div>
      <button onClick={onClear}>清空日志</button>
      <pre>{logs.join("\n")}</pre>
    </div>
  );
}
```

`ota.css`:
```css
.ota-kit { padding: 24px; font-family: system-ui, sans-serif; }
.ota-kit button { margin: 4px; }
.ota-kit pre { background: #f5f5f5; padding: 8px; max-height: 300px; overflow: auto; }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter @weblink/otakit test`
Expected: PASS

- [ ] **Step 5: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/react-app
git commit -m "feat(otakit): add React OTA UI"
```

---

### Task 8: Vue 壳与聚合集成

**Files:**
- Modify: `kits/otakit/src/vue-entry.ts`
- Modify: `kits/otakit/src/index.ts`
- Modify: `apps/web/src/config/kitRegistry.ts`

**Interfaces:**
- Consumes: `OtaPage`（React 组件）
- Produces: `EmbeddedPage`（Vue 组件）、`messages`/`messagesZhCN`（i18n 字典）、kitRegistry 注册项

- [ ] **Step 1: 写 vue-entry.ts（照抄 streamkit 桥接 + locale 响应式）**

```ts
import { defineComponent, h, onMounted, onUnmounted, ref, watchEffect } from "vue";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OtaPage } from "./react-app/OtaPage";
import { LocaleContext, type Locale } from "./react-app/i18n/useI18n";

export const EmbeddedPage = defineComponent({
  name: "OtaKitEmbeddedPage",
  setup() {
    const container = ref<HTMLDivElement>();
    const locale = ref<Locale>("zh-CN");
    let root: Root | undefined;

    onMounted(() => {
      if (container.value) {
        root = createRoot(container.value);
        root.render(createElement(LocaleContext.Provider, { value: locale.value }, createElement(OtaPage)));
      }
    });

    watchEffect(() => {
      // 应用内切换语言时，用当前 locale 重渲染 React 根
      if (root && container.value) {
        root.render(createElement(LocaleContext.Provider, { value: locale.value }, createElement(OtaPage)));
      }
    });

    onUnmounted(() => { root?.unmount(); });

    return () => h("div", { ref: container, style: { width: "100%", height: "100%" } });
  },
});
```

- [ ] **Step 2: 写 i18n 字典**

`src/react-app/i18n/en-US.ts`:
```ts
export const messages = {
  "ota.title": "OTA Kit",
  "ota.unsupported": "Web Serial is not supported. Please use Chrome/Edge.",
  "ota.insecure": "A secure context (HTTPS or localhost) is required.",
  "ota.selectPort": "Select Serial Port",
  "ota.firmwareUrl": "Firmware URL",
  "ota.downloadFirmware": "Download Firmware",
  "ota.uploadFirmware": "Upload Firmware",
  "ota.start": "Start Flashing",
  "ota.stage.idle": "Idle",
  "ota.stage.connecting": "Connecting",
  "ota.stage.programming": "Programming",
  "ota.stage.resetting": "Resetting",
  "ota.stage.done": "Done",
  "ota.stage.failed": "Failed",
  "ota.clearLog": "Clear Log",
};
```

`src/react-app/i18n/zh-CN.ts`:
```ts
export const messagesZhCN = {
  "ota.title": "OTA 升级工具",
  "ota.unsupported": "浏览器不支持 Web Serial，请使用 Chrome/Edge。",
  "ota.insecure": "需要安全上下文（HTTPS 或 localhost）。",
  "ota.selectPort": "选择串口",
  "ota.firmwareUrl": "固件 URL",
  "ota.downloadFirmware": "下载固件",
  "ota.uploadFirmware": "上传固件",
  "ota.start": "开始刷写",
  "ota.stage.idle": "空闲",
  "ota.stage.connecting": "连接中",
  "ota.stage.programming": "编程中",
  "ota.stage.resetting": "复位中",
  "ota.stage.done": "完成",
  "ota.stage.failed": "失败",
  "ota.clearLog": "清空日志",
};
```

- [ ] **Step 3: 写 index.ts 汇出**

```ts
export { EmbeddedPage } from "./vue-entry";
export { OtaPage } from "./react-app/OtaPage";
export { useOtaSession } from "./react-app/hooks/useOtaSession";
export { OtaSession } from "./core/session/otaSession";
export { createSerialPortAdapter } from "./core/serial/serialPortAdapter";
export { parseUrlParams } from "./core/url-params/parseUrlParams";
export { fetchFirmwareFromUrl, readFirmwareFile } from "./core/firmware/firmwareFetcher";
export { messages } from "./react-app/i18n/en-US";
export { messagesZhCN } from "./react-app/i18n/zh-CN";
export type { UrlParams } from "./core/url-params/types";
export type { OtaSessionOptions, ProgramProgress } from "./core/session/otaSession.types";
```

- [ ] **Step 3: 修改 kitRegistry.ts 的 otakit 注册项**

`apps/web/src/config/kitRegistry.ts` 中 **otakit 已存在**（当前 loader 为 `import("@weblink/otakit")`，指向旧的 Vue 骨架默认入口），需将已有项的 `loader` **改为 `@weblink/otakit/vue`**（走 React-Vue 桥接），不要新增重复项:
```ts
{
  id: "otakit",
  title: "OTA Kit",
  description: "OpenBLT 协议调试",
  loader: () => import("@weblink/otakit/vue"),
},
```
说明：当前仓库 `kits/otakit` 是遗留 Vue 骨架（`src/App.vue`、`src/main.ts`），本次实施将新增 `src/index.ts`（React 导出）与 `src/vue-entry.ts`（Vue 桥接）。由于旧的 `src/main.ts`/`App.vue` 是 dev 独立入口，不参与 kitRegistry，且 `package.json` 的 `exports` 增加 `"./vue"` 子路径后按方案生效。`kitRegistry` 里 otakit 项是**修改 loader**，不是新增。

- [ ] **Step 4: 运行验证**

Run: `pnpm --filter @weblink/otakit typecheck`
Run: `pnpm --filter @weblink/otakit typecheck:vue`
Run: `pnpm --filter @weblink/otakit lint`
Run: `pnpm --filter @weblink/otakit test`
Expected: 全部通过

- [ ] **Step 5: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/src/vue-entry.ts kits/otakit/src/index.ts apps/web/src/config/kitRegistry.ts
git commit -m "feat(otakit): add Vue bridge and kit registry"
```

---

### Task 9: 全量验证与交付

**Files:**
- Create: `kits/otakit/README.md`

**Interfaces:**
- Consumes: 全部已完成任务
- Produces: README 文档、验收清单

- [ ] **Step 1: 全量验证**

Run: `cd /Users/bookshiyi/repos/weblink && pnpm --filter @weblink/otakit lint`
Run: `pnpm --filter @weblink/otakit typecheck`
Run: `pnpm --filter @weblink/otakit typecheck:vue`
Run: `pnpm --filter @weblink/otakit test`
Run: `pnpm --filter @weblink/otakit build`
Run: `pnpm build:web`（monorepo 根）
Expected: 全部通过

- [ ] **Step 2: 写 README.md**

内容：使用方式（pnpm dev → /otakit）、URL 参数说明（protocol/slaveId/baudrate/firmware/auto 等）、浏览器支持矩阵（Chrome/Edge，不支持 iOS）、与 libopenblt 的关系、如何从项目跳转接入。

- [ ] **Step 3: 输出手动验收清单**

- `pnpm dev` 启动 weblink，访问 `/otakit`
- 选择串口 → 选择固件（URL 或上传）→ 点击开始刷写
- 观察连接/擦除/写入进度与日志
- 用 URL 参数 `?slaveId=1&firmware=...&auto=1` 验证预填与自动开始

- [ ] **Step 4: 提交（由主代理确认后执行）**

```bash
git add kits/otakit/README.md
git commit -m "docs(otakit): add README and acceptance checklist"
```
