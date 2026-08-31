# 实施任务清单：add-improvkit

> 执行方式：subagent-driven-development——每个任务派发独立实现子代理（TDD），完成后先做规格符合性评审、再做代码质量评审；子代理一律不做 git commit。

## 1. 脚手架与依赖

- [ ] 1.1 创建 `kits/improvkit` 包骨架：package.json（deps：improv-wifi-serial-sdk@^2.8.1、react@^19.1.0、react-dom@^19.1.0、vue@^3.5.32、@weblink/tokens/utils；devDeps 参照 streamkit：@vitejs/plugin-react-swc、@vitejs/plugin-vue、@testing-library/react、happy-dom、@types/w3c-web-serial 等）、vite.config.ts（vue()+react() 双插件）、tsconfig.json/tsconfig.react.json、eslint.config.js、env.d.ts，并完成 pnpm install（如网络受限走本机 7890 代理）
- [ ] 1.2 构建链自证：vitest 空跑通过、tsc 与 vue-tsc 双 typecheck 通过、eslint 通过（此时仅骨架文件）

## 2. domain 层（传输无关）

- [ ] 2.1 `src/domain/types.ts` + `src/domain/errors.ts`：Ssid/DeviceInfo/ProvisionResult/DomainErrorCategory、SDK 错误码→领域类别映射表、STOPPED→DEVICE_WIFI_DISABLED 归类；TDD 先行（映射表逐项断言 + 非法值兜底）
- [ ] 2.2 `src/domain/transport.ts`：IImprovTransport 接口（connect/provision/scan/close + 订阅状态与错误事件）、统一 State 联合类型（含 AUTHORIZATION_REQUIRED 预留）；接口编译期一致性测试（类型级）

## 3. infrastructure：Web Serial 传输

- [ ] 3.1 `src/test/fakes/fakeImprovDevice.ts`：内存假串口设备（ReadableStream/WritableStream 实现 SerialPort 子集，按真实帧格式应答 RPC；帧常量从 improv-wifi-serial-sdk/dist/const.js 导入）+ 帧编解码单测（RED→GREEN）
- [ ] 3.2 `src/infrastructure/serial/serialTransport.ts`：实现 IImprovTransport，包装 ImprovSerial（构造注入工厂便于 mock）：连接（115200）、初始化超时→NOT_IMPROV_DEVICE、事件转发与状态映射、scan 降级语义、provision 结果、close 幂等释放资源
- [ ] 3.3 全链路集成测试（FakeImprovDevice × SerialTransport × 真实 ImprovSerial）：连接→读信息→扫描（支持/不支持两分支）→配网成功返回 nextUrl→密码错误 UNABLE_TO_CONNECT→close 后重连可用

## 4. React features（内核 UI）

- [ ] 4.1 `src/features/hooks/useImprovSession.ts`：会话生命周期、状态推进、扫描刷新、配网提交与失败重试、卸载清理；TDD（@testing-library/react renderHook + fake transport）
- [ ] 4.2 展示组件 `src/features/components/*`（ConnectionPanel/DeviceInfoCard/WifiForm/ProgressView/ResultView）+ `ProvisionPage.tsx` 组装 + CSS（tokens 变量）；能力检测分支（不支持 Web Serial / 非安全上下文）渲染测试
- [ ] 4.3 i18n 字典 `src/features/i18n/{en-US,zh-CN}.ts` + 文案键接线；缺失键回退策略测试

## 5. Vue 壳与聚合集成

- [ ] 5.1 `src/vue-entry.ts`：EmbeddedPage（createRoot 桥接 + useI18n locale 响应式重渲染 + 卸载清理），挂载/卸载无泄漏测试；`src/index.ts` 汇出 EmbeddedPage/ProvisionPage/hooks/messages/messagesZhCN
- [ ] 5.2 `apps/web/src/config/kitRegistry.ts` 追加 improvkit 注册项（懒加载 `import("@weblink/improvkit/vue")`）

## 6. 全量验证与交付

- [ ] 6.1 kit 全量验证：lint/typecheck/typecheck:vue/test/build 全绿；monorepo 根 `pnpm build:web` 通过
- [ ] 6.2 更新 kit README（使用方式、浏览器支持矩阵、BLE 扩展点说明）并输出手动验收清单（pnpm dev → /improvkit → 连真设备步骤）

## 7. 二期增强：扫描体验（#1-#4，esp-web-tools 差距）

- [ ] 7.1 domain：`IImprovTransport` 增加 `subscribeSSIDs(onChange): () => Promise<void>`（持续扫描接口，语义对齐 SDK subscribeSSIDs）
- [ ] 7.2 transport：实现 subscribeSSIDs 转发 SDK 的持续扫描；补充 FakeImprovDevice 支持多轮扫描应答 + 测试
- [ ] 7.3 hook：持续扫描替代一次性 scan（表单显示期间订阅/离开取消）、首扫宽限期（SCAN_GRACE_PERIOD）、最强网络预选、选中网络掉线回填；纯函数单测
- [ ] 7.4 WifiForm 增强：持续刷新列表展示、空态（宽限期后"未发现网络"）、预选高亮、掉线回填手动输入；渲染测试

## 8. 二期增强：串口日志控制台（#5，独立）

- [ ] 8.1 transport：`enterConsole(): Promise<ConsolePort>`（先 close 会话释放 reader，返回裸端口）+ 退出后重新初始化会话；测试
- [ ] 8.2 ConsoleView 组件：原始文本日志（TextDecoderStream+行分割）、日志累积+下载（Blob）、HardReset（esptool-js Transport+HardReset）；渲染测试
- [ ] 8.3 页面接线：ProvisionView/ResultView 增加"日志与控制台"入口，进入/退出控制台与配网会话切换无泄漏；测试
- [ ] 8.4 全量验证 + README 更新（新增扫描/控制台功能说明）
