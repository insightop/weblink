import type { DeviceInfo } from '../../domain/types'
import { useKitI18n } from '../i18n/react'
import { DeviceInfoCard } from './DeviceInfoCard'

export interface ResultViewProps {
  /** PROVISIONED 常伴设备信息；缺席时（理论不可达）成功页仍可渲染 */
  deviceInfo?: DeviceInfo
  /** 设备返回的跳转 URL：为空则渲染「访问设备」外链（spec 成功页跳转入口） */
  lastUrl?: string
  /** 更换 Wi-Fi：回调 hook 的 changeWifi（spec「已配网设备的换网」） */
  onChangeWifi: () => void
  /** 打开「日志与控制台」：回调 hook 的 enterConsole（D16 控制台入口） */
  onOpenConsole: () => void
}

/**
 * 设备返回的跳转 URL 不可信任：仅 http/https 视为可安全打开的外链；
 * new URL 解析失败（相对路径、乱串）或协议不符（javascript: 等）一律拒绝。
 */
function isSafeExternalUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * ResultView — 配网成功页：成功标题 + 设备信息卡 + 访问设备外链（存在时，
 * 新窗口打开并携带 noreferrer）+ 更换 Wi-Fi 按钮。
 */
export function ResultView({ deviceInfo, lastUrl, onChangeWifi, onOpenConsole }: ResultViewProps) {
  const { t } = useKitI18n()
  const safeUrl = lastUrl && isSafeExternalUrl(lastUrl) ? lastUrl : undefined

  return (
    <div className="improv-success">
      <h2 className="improv-success__title">{t('success_title')}</h2>
      {deviceInfo && <DeviceInfoCard info={deviceInfo} />}
      <div className="improv-success__actions">
        {safeUrl && (
          <a
            className="improv-button improv-button--primary"
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('visit_device')}
          </a>
        )}
        {lastUrl && !safeUrl && (
          <span className="improv-button improv-button--ghost" data-testid="unsafe-last-url">
            {lastUrl}
          </span>
        )}
        <button type="button" className="improv-button improv-button--ghost" onClick={onChangeWifi}>
          {t('change_wifi')}
        </button>
        <button
          type="button"
          className="improv-button improv-button--ghost"
          onClick={onOpenConsole}
        >
          {t('console_open')}
        </button>
      </div>
    </div>
  )
}
