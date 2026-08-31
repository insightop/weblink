/**
 * @weblink/improvkit
 *
 * Improv Wi-Fi Serial 配网工具包 — 基于 improv-wifi-serial-sdk 的浏览器端设备配网。
 *
 * 对外导出：
 * - EmbeddedPage：Vue 桥接组件（KitWrapper 消费，见 vue-entry.ts）
 * - ProvisionPage：React 配网页面（供独立使用，自带 I18nProvider）
 * - useImprovSession：会话编排 hook（React 侧核心状态层）
 * - I18nProvider / useKitI18n：React i18n 上下文（供独立使用 / 自定义宿主）
 * - messages / messagesZhCN：平铺字典（KitWrapper 合并进 vue-i18n 所需形态）
 *
 * 字典形态说明：dictionaries.ts 的 messages 是 `{ 'en-US':…, 'zh-CN':… }`
 * 嵌套形态（React 侧按语言取词）；KitWrapper 期望 messages 是 en-US 的键值
 * 对象、messagesZhCN 是 zh-CN 的键值对象，故此处拆出两个平铺对象导出。
 */
export { EmbeddedPage } from './vue-entry'
export { ProvisionPage } from './features/components/ProvisionPage'
export { useImprovSession } from './features/hooks/useImprovSession'
export { I18nProvider, useKitI18n, type Locale } from './features/i18n/react'
import { messages as nestedMessages } from './features/i18n/dictionaries'

/** en-US 平铺字典（KitWrapper 合并进 vue-i18n 的 en-US 命名空间） */
export const messages = nestedMessages['en-US']
/** zh-CN 平铺字典（KitWrapper 合并进 vue-i18n 的 zh-CN 命名空间） */
export const messagesZhCN = nestedMessages['zh-CN']
