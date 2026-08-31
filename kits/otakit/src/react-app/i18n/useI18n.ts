import { createContext, useContext, useMemo } from 'react'
import { messages } from './en-US'
import { messagesZhCN } from './zh-CN'

export type Locale = 'en-US' | 'zh-CN'

/** 默认中文，与产品面向的国内用户环境一致；未包裹 Provider 时按中文渲染。 */
export const LocaleContext = createContext<Locale>('zh-CN')

const DICTS: Record<Locale, typeof messages> = {
  'en-US': messages,
  'zh-CN': messagesZhCN,
}

/**
 * useI18n — 读取当前 Locale 并返回字典取词函数 t()。
 * t(key) 逐字段查找：先按 `ota.stage.programming` 这类点路径，命中则返回，
 * 未命中回退到完整字典的 ota 命名空间兜底。简单起见这里只支持 ota 命名空间下的取词。
 */
export function useI18n() {
  const locale = useContext(LocaleContext)
  const dict = DICTS[locale] ?? DICTS['zh-CN']
  return useMemo(
    () => ({
      locale,
      t: (key: string): string => {
        const current = dict as Record<string, unknown>
        const parts = key.split('.')
        let node: unknown = current
        for (let i = 0; i < parts.length; i++) {
          if (node == null || typeof node !== 'object') return key
          const obj = node as Record<string, unknown>
          // 叶子键可能含点号（如 ota.error.erase.failed），先尝试把剩余部分拼成整键命中
          const rest = parts.slice(i).join('.')
          if (typeof obj[rest] === 'string') return obj[rest]
          node = obj[parts[i]]
        }
        return typeof node === 'string' ? node : key
      },
    }),
    [dict],
  )
}
