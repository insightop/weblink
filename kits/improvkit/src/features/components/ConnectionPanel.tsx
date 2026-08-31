import type { DomainErrorCategory } from '../../domain/errors'
import { useKitI18n } from '../i18n/react'
import { ErrorBanner } from './ErrorBanner'
import { ProgressView } from './ProgressView'

/** 连接入口面板三态：REACT 层只关心这三种；其余预留态由 ProvisionView 归一 */
export type ConnectionPanelState = 'IDLE' | 'CONNECTING' | 'ERROR'

export interface ConnectionPanelProps {
  state: ConnectionPanelState
  /** 连接期失败的错误类别：ERROR 态存在时渲染错误提示条 */
  errorCategory?: DomainErrorCategory
  /** 会话动作进行中（hook 层 busy 重入守卫的 UI 侧保障）：入口连接按钮禁用 */
  busy?: boolean
  /** 连接 / 重试：回调 hook 的 connect */
  onConnect: () => void
  /** 取消：回调 hook 的 reset（回到 IDLE 入口） */
  onCancel: () => void
}

/**
 * ConnectionPanel — 配网会话入口面板。
 * - IDLE：标题 + 描述 + 主连接按钮（spec「配网流程界面」入口）
 * - CONNECTING：进度提示（复用 ProgressView）+ 取消按钮
 * - ERROR：错误提示条（errorCategory 存在时）+ 重试按钮；无类别时仅重试
 *   （hook 理论不可达的兜底，保留恢复路径）
 */
export function ConnectionPanel({
  state,
  errorCategory,
  busy,
  onConnect,
  onCancel,
}: ConnectionPanelProps) {
  const { t } = useKitI18n()

  if (state === 'CONNECTING') {
    return (
      <div className="improv-panel">
        <ProgressView label={t('connecting')} />
        <div className="improv-panel__actions improv-panel__actions--center">
          <button type="button" className="improv-button improv-button--ghost" onClick={onCancel}>
            {t('cancel')}
          </button>
        </div>
      </div>
    )
  }

  if (state === 'ERROR') {
    return (
      <div className="improv-panel">
        {errorCategory && <ErrorBanner category={errorCategory} />}
        <div className="improv-panel__actions">
          <button
            type="button"
            className="improv-button improv-button--primary"
            onClick={onConnect}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  // IDLE（及上层归一来的预留态）入口视图
  return (
    <div className="improv-panel">
      <h1 className="improv-panel__title">{t('page.title')}</h1>
      <p className="improv-panel__description">{t('page.description')}</p>
      <div className="improv-panel__actions">
        <button
          type="button"
          className="improv-button improv-button--primary"
          disabled={busy}
          onClick={onConnect}
        >
          {t('connect_button')}
        </button>
      </div>
    </div>
  )
}
