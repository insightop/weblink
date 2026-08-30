import type { DomainErrorCategory } from '../../domain/errors'
import { useKitI18n } from '../i18n/react'

/**
 * ErrorBanner — 错误提示条：按领域错误类别动态取词（error.<CATEGORY> 键，
 * 由 dictionaries.ts 固定前缀）。两类语境共用同一组件：连接面板 ERROR 态与
 * 表单上方的配网/扫描失败提示（DRY：错误条只有一种形态，不做两份标记）。
 */
export function ErrorBanner({ category }: { category: DomainErrorCategory }) {
  const { t } = useKitI18n()
  return (
    <div className="improv-error" role="alert">
      <span className="improv-error__icon" aria-hidden="true">
        ⚠
      </span>
      <p className="improv-error__text">{t(`error.${category}`)}</p>
    </div>
  )
}
