/**
 * Vue 桥接入口（@weblink/web 的 KitWrapper 消费，见 apps/web/src/views/KitWrapper.vue）。
 *
 * 职责：把 React 的 ProvisionPage 挂进 Vue 组件树，并让 React 树实时跟随
 * vue-i18n 的 locale 切换（应用内切换语言时配网界面文案同步更新）。
 *
 * 资源链：React 卸载（root.unmount）会触发 useImprovSession 的 effect 清理，
 * 从而关闭串口会话并释放物理端口——因此本组件卸载时必须 unmount React 根，
 * 否则串口会一直占用直到页面刷新。
 */
import { defineComponent, h, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { createElement, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ProvisionPage } from './features/components/ProvisionPage'
import { resolveLocale, type Locale } from './features/i18n/react'
// KitWrapper 经 @weblink/improvkit/vue 子路径加载时只拿到本文件（vue-entry.ts）的
// 导出，而 KitWrapper 需要 messages / messagesZhCN 做 mergeLocaleMessage 合并进
// vue-i18n。为避免与 index.ts 形成循环依赖（index.ts 从本文件导入 EmbeddedPage，
// 若本文件再从 index 导入 messages 会成环），这里直接从 dictionaries.ts 导入并
// 重导出平铺字典，形态与 index.ts 的平铺导出一致。
import { messages as nestedMessages } from './features/i18n/dictionaries'

export const EmbeddedPage = defineComponent({
  name: 'ImprovKitEmbeddedPage',

  setup() {
    // legacy:false 的 vue-i18n 实例（KitWrapper 所在 app 树已注入），
    // 这里取到的是响应式 locale，供 watchEffect 追踪
    const { locale } = useI18n()
    const container = ref<HTMLDivElement>()
    let root: Root | undefined
    // watchEffect 的 stop 句柄：onMounted 内创建的 effect 运行在组件作用域之外
    // （getCurrentScope() 为 null），Vue 不会在卸载时自动 stop 它，必须显式捕获
    // 并在 onUnmounted 中手动 stop，否则该 effect 会持续存活并跟踪 locale.value，
    // 每次挂载/卸载累积泄漏（见下方 onMounted 注释）
    let stop: (() => void) | undefined
    // vue-tsc 以 Vue 的 JSX 配置检查本文件，ProvisionPage 的返回类型会被解析成
    // Vue VNode，与 React 的 createElement 入参不兼容；这里显式收窄为 React
    // 组件类型，让 vue-tsc 与 tsc(react) 两侧都能通过类型检查
    const ProvisionPageComponent = ProvisionPage as ComponentType<{ locale?: Locale }>

    onMounted(() => {
      if (!container.value) return
      root = createRoot(container.value)
      // 用 watchEffect 而非一次性渲染：它会在依赖（locale.value）变化时自动
      // 重跑，从而在应用内切换语言时用新 locale 重新渲染 React 树。若只在
      // onMounted 渲染一次，React 侧拿到的 locale 是固定的，切换语言不会生效。
      //
      // 注意：onMounted 回调运行在组件作用域之外，此处创建的 effect 不会像
      // setup() 期间创建的那样被 Vue 自动 stop（getCurrentScope() 为 null），
      // 因此必须捕获 stop 句柄并在 onUnmounted 中显式 stop，否则卸载后该
      // effect 仍存活并持续跟踪 locale.value，造成每次挂载/卸载累积泄漏。
      stop = watchEffect(() => {
        root?.render(createElement(ProvisionPageComponent, { locale: resolveLocale(locale.value) }))
      })
    })

    onUnmounted(() => {
      // 先 stop watchEffect：停止对 locale.value 的追踪，避免卸载后仍触发
      // root.render（此时 React 根即将被卸载，不应再渲染）
      stop?.()
      stop = undefined
      // 卸载 React 根：触发 useImprovSession 的 effect 清理（退订 + close），
      // 从而关闭串口会话并释放物理端口（见文件头资源链说明）
      root?.unmount()
      root = undefined
    })

    return () =>
      h('div', {
        ref: container,
        style: { width: '100%', height: '100%' },
      })
  },
})

/** en-US 平铺字典（KitWrapper 经 /vue 子路径加载时合并进 vue-i18n 的 en-US 命名空间） */
export const messages = nestedMessages['en-US']
/** zh-CN 平铺字典（KitWrapper 经 /vue 子路径加载时合并进 vue-i18n 的 zh-CN 命名空间） */
export const messagesZhCN = nestedMessages['zh-CN']
