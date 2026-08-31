/**
 * Vue 桥接测试：验证 EmbeddedPage 把 React 的 OtaPage 挂进 Vue 树，
 * 且 locale 切换时 React 树实时跟随（watchEffect 驱动），卸载时无报错。
 *
 * 环境说明：happy-dom 无 navigator.serial，OtaPage 的能力门会走 unsupported
 * 分支而渲染不出标题；为验证真实 OtaPage，这里 stub 让 isWebSerial 与
 * window.isSecureContext 都为真，走正常流程渲染标题。
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

function stubCapabilities(serial = true, secure = true) {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true })
  Object.defineProperty(navigator, 'serial', {
    value: serial ? { requestPort: vi.fn(), getPorts: vi.fn() } : undefined,
    configurable: true,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EmbeddedPage Vue→React 桥接', () => {
  it('挂载后渲染 React OtaPage 的标题「OTA 升级工具」（zh-CN）', async () => {
    stubCapabilities(true, true)
    const { wrapper } = mountWithI18n('zh-CN')
    // React 19 的 createRoot().render() 是异步（并发调度），需等待其 flush
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OTA 升级工具')
    })
    wrapper.unmount()
  })

  it('挂载后渲染 React OtaPage 的标题「OTA Kit」（en-US）', async () => {
    stubCapabilities(true, true)
    const { wrapper } = mountWithI18n('en-US')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OTA Kit')
    })
    wrapper.unmount()
  })

  it('切换 i18n locale 到 zh-CN 后标题实时变为中文（locale 响应式）', async () => {
    stubCapabilities(true, true)
    const { wrapper, i18n } = mountWithI18n('en-US')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OTA Kit')
    })
    // 切换全局 locale：watchEffect 依赖 locale.value，应触发 React 树重渲染
    i18n.global.locale.value = 'zh-CN'
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OTA 升级工具')
    })
    wrapper.unmount()
  })

  it('unmount 后无报错（React 根被卸载，OtaSession 清理路径不抛异常）', () => {
    stubCapabilities(true, true)
    const { wrapper } = mountWithI18n('zh-CN')
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('unmount 后 React 根已卸载：容器内不再渲染标题，且无报错', async () => {
    stubCapabilities(true, true)
    const { wrapper } = mountWithI18n('zh-CN')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OTA 升级工具')
    })
    expect(() => wrapper.unmount()).not.toThrow()
    expect(wrapper.text()).not.toContain('OTA 升级工具')
    // 完整资源链（React 根卸载 → useOtaSession 清理 → OtaSession.close()）
    // 由 useOtaSession / OtaSession 的既有测试覆盖；此处仅验证桥接层确实卸载了
    // React 根，容器内不再保留任何标题文案。
  })
})
