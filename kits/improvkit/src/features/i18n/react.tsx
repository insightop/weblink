import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { messages } from './dictionaries'

/** 支持的语言：默认 en-US，zh 开头的浏览器语言解析为 zh-CN */
export type Locale = 'en-US' | 'zh-CN'

/** useKitI18n 返回值：取词函数 + 当前语言 */
export interface KitI18nValue {
  t: (key: string) => string
  locale: Locale
}

/**
 * 解析界面语言：显式入参优先；未提供时探测 navigator.language
 * （zh 开头 → zh-CN，其余 → en-US）；无 navigator（SSR）回退 en-US。
 */
export function resolveLocale(input?: string): Locale {
  const candidate = input ?? (typeof navigator !== 'undefined' ? navigator.language : undefined)
  return candidate?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

/**
 * 创建取词函数：先查当前语言字典，缺失回退 en-US，再缺失返回 key 本身。
 * 回退链行为由 i18n.spec.tsx 用合成字典锁定（真实字典全键对等，无缺失键可测）。
 */
export function createT(locale: Locale): (key: string) => string {
  const dict = messages[locale] as Readonly<Record<string, string>>
  const fallback = messages['en-US'] as Readonly<Record<string, string>>
  return (key: string): string => dict[key] ?? fallback[key] ?? key
}

const I18nContext = createContext<KitI18nValue | null>(null)

/** i18n Provider：注入语言并缓存取词函数（locale 不变时不重建） */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<KitI18nValue>(() => ({ locale, t: createT(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** 消费 i18n：必须在 I18nProvider 内调用，否则 fail-fast 抛错 */
export function useKitI18n(): KitI18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useKitI18n must be used within I18nProvider')
  }
  return ctx
}
