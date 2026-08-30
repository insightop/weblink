import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, createT, resolveLocale, useKitI18n, type Locale } from './react'

// 回退链测试需要「zh 缺失但 en 存在」的键：真实字典全键对等（dictionaries.spec.ts
// 已锁定），此处以最小合成字典替换模块，只用于锁定 createT 的三级回退策略本身；
// 真实字典的结构与键覆盖另由 dictionaries.spec.ts 负责。
vi.mock('./dictionaries', () => ({
  messages: {
    'en-US': {
      connect_button: 'Connect',
      en_only: 'English only',
    },
    'zh-CN': {
      connect_button: '连接设备',
    },
  },
}))

/** 渲染 useKitI18n 的 Provider 包装器 */
function withLocale(locale: Locale) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <I18nProvider locale={locale}>{children}</I18nProvider>
  }
}

describe('resolveLocale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['zh-CN', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-TW', 'zh-CN'],
    ['ZH-cn', 'zh-CN'],
    ['en-US', 'en-US'],
    ['fr-FR', 'en-US'],
  ])('入参 %s → %s（入参优先，不受全局 navigator 影响）', (input, expected) => {
    vi.stubGlobal('navigator', { language: 'de-DE' })
    expect(resolveLocale(input)).toBe(expected)
  })

  it('无入参时按 navigator.language 探测：zh 开头 → zh-CN，其余 → en-US', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' })
    expect(resolveLocale()).toBe('zh-CN')
    vi.stubGlobal('navigator', { language: 'de-DE' })
    expect(resolveLocale()).toBe('en-US')
  })

  it('无 navigator（SSR）时回退 en-US', () => {
    vi.stubGlobal('navigator', undefined)
    expect(resolveLocale()).toBe('en-US')
    // 入参仍优先：SSR 下显式 zh 语言照样生效
    expect(resolveLocale('zh-Hans')).toBe('zh-CN')
  })
})

describe('createT 回退链', () => {
  it('当前语言字典命中时返回该语言值', () => {
    const t = createT('zh-CN')
    expect(t('connect_button')).toBe('连接设备')
  })

  it('当前语言缺失时回退到 en-US 值', () => {
    const t = createT('zh-CN')
    expect(t('en_only')).toBe('English only')
  })

  it('两个字典都缺失时返回 key 本身', () => {
    const tZh = createT('zh-CN')
    const tEn = createT('en-US')
    expect(tZh('no.such.key')).toBe('no.such.key')
    expect(tEn('no.such.key')).toBe('no.such.key')
  })

  it('en-US 作为当前语言时同样正常取词', () => {
    const t = createT('en-US')
    expect(t('connect_button')).toBe('Connect')
    expect(t('en_only')).toBe('English only')
  })
})

describe('I18nProvider / useKitI18n', () => {
  it('Provider 注入 locale 并提供取词函数', () => {
    const { result } = renderHook(() => useKitI18n(), {
      wrapper: withLocale('zh-CN'),
    })
    expect(result.current.locale).toBe('zh-CN')
    expect(result.current.t('connect_button')).toBe('连接设备')
  })

  it('Provider 切换 locale 后取词结果随之更新', () => {
    let locale: Locale = 'zh-CN'
    const { result, rerender } = renderHook(() => useKitI18n(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider locale={locale}>{children}</I18nProvider>
      ),
    })
    expect(result.current.t('connect_button')).toBe('连接设备')
    locale = 'en-US'
    rerender()
    expect(result.current.locale).toBe('en-US')
    expect(result.current.t('connect_button')).toBe('Connect')
  })

  it('useKitI18n 在 Provider 之外调用直接抛错（fail-fast，杜绝静默空文案）', () => {
    expect(() => renderHook(() => useKitI18n())).toThrowError(/I18nProvider/)
  })
})
