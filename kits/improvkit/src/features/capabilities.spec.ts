import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSecureContext, isWebSerialSupported } from './capabilities'

/**
 * 浏览器能力检测：纯函数直读全局，测试用 vi.stubGlobal 模拟
 * 有/无 serial 的 navigator 与 secure context 两态，并覆盖无全局（SSR）兜底。
 */
describe('isWebSerialSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('navigator 带 serial 属性时为 true', () => {
    vi.stubGlobal('navigator', { serial: {} })
    expect(isWebSerialSupported()).toBe(true)
  })

  it('navigator 不带 serial 属性时为 false', () => {
    vi.stubGlobal('navigator', {})
    expect(isWebSerialSupported()).toBe(false)
  })

  it('无 navigator（SSR / 非浏览器）时安全返回 false', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isWebSerialSupported()).toBe(false)
  })
})

describe('isSecureContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('window.isSecureContext 为 true 时返回 true', () => {
    vi.stubGlobal('isSecureContext', true)
    expect(isSecureContext()).toBe(true)
  })

  it('window.isSecureContext 为 false（http 明文）时返回 false', () => {
    vi.stubGlobal('isSecureContext', false)
    expect(isSecureContext()).toBe(false)
  })

  it('window.isSecureContext 缺失时安全返回 false', () => {
    vi.stubGlobal('isSecureContext', undefined)
    expect(isSecureContext()).toBe(false)
  })
})
