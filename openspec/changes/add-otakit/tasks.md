# 实施任务清单：add-otakit

> 执行方式：subagent-driven-development——每个任务派发独立实现子代理（TDD），完成后先做规格符合性评审、再做代码质量评审；子代理一律不做 git commit。

## 1. 脚手架与依赖

- [ ] 1.1 创建 `kits/otakit` 包骨架：package.json（deps：react@^19.1.0、react-dom@^19.1.0、vue@^3.5.32、`@insightop/libopenblt@0.2.2`、@weblink/tokens/utils；devDeps 参照 streamkit：@vitejs/plugin-react-swc、@vitejs/plugin-vue、@testing-library/react、happy-dom、@types/w3c-web-serial 等）、vite.config.ts（vue()+react() 双插件）、tsconfig.json/tsconfig.react.json、eslint.config.js、env.d.ts，并完成 pnpm install（如需网络加速走本机 7890 代理）
- [ ] 1.2 构建链自证：vitest 空跑通过、tsc 与 vue-tsc 双 typecheck 通过、eslint 通过（此时仅骨架文件）

## 2. core 层（传输无关）

- [ ] 2.1 `src/core/url-params/types.ts` + `src/core/url-params/parseUrlParams.ts`：URL_PARAM_KEYS 常量、UrlParams 接口、parseUrlParams 纯函数（数值转换、未知忽略）；TDD 先行（完整参数/空参数/未知参数逐项断言）。**注意：仅 baudrate，无 parity/stopbits；bypassFirmwareStart 为数值 0|1**
- [ ] 2.2 `src/core/serial/serialPortAdapter.ts`：createSerialPortAdapter(transact) 函数（write 调 transact 缓存响应、read 从缓存返回、open/close 空操作）；TDD（transact 适配行为断言）
- [ ] 2.3 `src/core/session/otaSession.ts`：OtaSession 类（构造函数接收 transact/slaveId/**baudrate**/options；connect 含 backdoor 重试 + info table 检查、program 32KB 擦除/256B 写入 + onProgress、reset、close），从 sesp modbus-ota 移植并去 sesp 化，**`seedKeyFile` 移除、`parity/stopbits` 固定 0/1、baudrate 传入 transport settings**；TDD（FakeSerialPort 集成测试覆盖连接→info table→擦除→写入→复位全链路）
- [ ] 2.4 `src/core/firmware/firmwareFetcher.ts`：固件获取（URL 下载带进度 / 本地上传读取）；TDD（URL 下载成功/失败、本地文件读取）。**不做 CORS 代理，直接 fetch**

## 3. React features（内核 UI）

- [ ] 3.1 `src/react-app/hooks/useOtaSession.ts`：会话生命周期、状态推进、刷写提交与失败重试、卸载清理；TDD（@testing-library/react renderHook + fake transport）
- [ ] 3.2 展示组件 `src/react-app/components/*`（SerialSelect/ConnectionPanel/FirmwareSelect/ProgressView/LogPanel）+ `OtaPage.tsx` 组装 + CSS（tokens 变量）；能力检测分支（不支持 Web Serial / 非安全上下文）渲染测试
- [ ] 3.3 URL 参数预填与自动开始：启动时 parseUrlParams 预填配置，auto=1 且固件 URL 存在时选串口后自动开始；TDD
- [ ] 3.4 i18n 字典 `src/react-app/i18n/{en-US,zh-CN}.ts` + 文案键接线；缺失键回退策略测试

## 4. Vue 壳与聚合集成

- [ ] 4.1 `src/vue-entry.ts`：EmbeddedPage（createRoot 桥接 + 卸载清理），挂载/卸载无泄漏测试；`src/index.ts` 汇出 EmbeddedPage/OtaPage/hooks/messages/messagesZhCN
- [ ] 4.2 `apps/web/src/config/kitRegistry.ts` 追加 otakit 注册项（懒加载 `import("@weblink/otakit/vue")`）

## 5. 全量验证与交付

- [ ] 5.1 kit 全量验证：lint/typecheck/typecheck:vue/test/build 全绿；monorepo 根 `pnpm build:web` 通过
- [ ] 5.2 更新 kit README（使用方式、URL 参数说明、浏览器支持矩阵）并输出手动验收清单（pnpm dev → /otakit → 连真设备步骤）
