/**
 * @weblink/otakit 公开 API 入口。
 *
 * 同时导出 React 根组件与 Vue 桥接壳（EmbeddedPage），供不同消费方使用：
 * - KitWrapper（apps/web）经 @weblink/otakit/vue 子路径加载 vue-entry.ts，
 *   拿到 EmbeddedPage + messages/messagesZhCN；
 * - React 宿主或独立页面经本入口（@weblink/otakit）复用核心逻辑与组件。
 */
export { EmbeddedPage } from './vue-entry'
export { OtaPage } from './react-app/OtaPage'
export { useOtaSession } from './react-app/hooks/useOtaSession'
export { OtaSession } from './core/session/otaSession'
export { createSerialPortAdapter } from './core/serial/serialPortAdapter'
export { parseUrlParams } from './core/url-params/parseUrlParams'
export { fetchFirmwareFromUrl, readFirmwareFile } from './core/firmware/firmwareFetcher'
export { messages } from './react-app/i18n/en-US'
export { messagesZhCN } from './react-app/i18n/zh-CN'
// 类型
export type { Locale } from './react-app/i18n/useI18n'
export type { UrlParams, OtaTimeouts } from './core/url-params/types'
export type { OtaSessionOptions, ProgramProgress } from './core/session/otaSession.types'
export type {
  OtaStage,
  OtaState,
  StartOptions,
} from './react-app/hooks/useOtaSession'
