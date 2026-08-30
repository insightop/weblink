/**
 * Vue 桥接测试：验证 EmbeddedPage 把 React 的 ProvisionPage 挂进 Vue 树，
 * 且 locale 切换时 React 树实时跟随（watchEffect 驱动），卸载时无报错。
 *
 * 环境说明：happy-dom 无 navigator.serial，ProvisionPage 的能力门会走
 * unsupported 分支；为验证真实连接按钮，这里 stubGlobal 让 isWebSerialSupported
 * 为真（navigator.serial 存在）且 isSecureContext 为真，走正常流程。
 */
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmbeddedPage } from './vue-entry'

/** 构造带 legacy:false vue-i18n 的测试宿主，返回 { wrapper, i18n } */
function mountWithI18n(locale: 'en-US' | 'zh-CN') {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en-US',
    messages: {
      'en-US': {},
      'zh-CN': {},
    },
  })
  const wrapper = mount(EmbeddedPage, { attachTo: document.body, global: { plugins: [i18n] } })
  return { wrapper, i18n }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EmbeddedPage Vue→React 桥接', () => {
  it('挂载后渲染 React 的「连接设备」按钮（能力门通过走正常流程）', async () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    const { wrapper } = mountWithI18n('en-US')
    // React 19 的 createRoot().render() 是异步（并发调度），需等待其 flush
    await vi.waitFor(() => {
      // React 树渲染进容器 div，按钮文案来自 en-US 字典
      expect(wrapper.text()).toContain('Connect Device')
    })
    wrapper.unmount()
  })

  it('切换 i18n locale 到 zh-CN 后按钮文案实时变为中文（locale 响应式）', async () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    const { wrapper, i18n } = mountWithI18n('en-US')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Connect Device')
    })
    // 切换全局 locale：watchEffect 依赖 locale.value，应触发 React 树重渲染
    i18n.global.locale.value = 'zh-CN'
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('连接设备')
    })
    wrapper.unmount()
  })

  it('unmount 后无报错（React 根被卸载，串口会话清理路径不抛异常）', () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    const { wrapper } = mountWithI18n('en-US')
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('unmount 后 React 根已卸载：容器内不再有按钮文案，且无报错', async () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    const { wrapper } = mountWithI18n('en-US')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Connect Device')
    })
    // 卸载后 React 根应已 unmount：容器内不再渲染任何按钮文案
    expect(() => wrapper.unmount()).not.toThrow()
    expect(wrapper.text()).not.toContain('Connect Device')
    // 完整资源链（React 根卸载 → useImprovSession 清理 → transport.close()）
    // 由 useImprovSession 的既有卸载测试覆盖（见 useImprovSession.spec.ts
    // 「卸载清理：close + 退订」）；此处仅验证桥接层确实卸载了 React 根，
    // 因为 ProvisionPage 不暴露 createTransport 注入点，无法在页面级注入
    // fake transport 断言 close 调用。
  })
})
