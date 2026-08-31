import { isSecureContext, isWebSerialSupported } from '../capabilities'
import { useImprovSession, type UseImprovSessionResult } from '../hooks/useImprovSession'
import { I18nProvider, resolveLocale, useKitI18n, type Locale } from '../i18n/react'
import { ConnectionPanel } from './ConnectionPanel'
import { ConsoleView } from './ConsoleView'
import { DeviceInfoCard } from './DeviceInfoCard'
import { ErrorBanner } from './ErrorBanner'
import { ProgressView } from './ProgressView'
import { ResultView } from './ResultView'
import { WifiForm } from './WifiForm'
import '../styles/provision.css'

export interface ProvisionPageProps {
  /** 界面语言；缺省按 navigator.language 探测（resolveLocale，zh 开头 → zh-CN） */
  locale?: Locale
}

/**
 * ProvisionPage — 配网界面入口（页面组装）。
 * 顶层职责：包 I18nProvider、执行能力检测门、挂载会话 hook；
 * 状态→视图映射下沉到 ProvisionView（接受 hook 结果），使其可被直接
 * 注入数据测试，避免对 useImprovSession 模块做 vi.mock。
 */
export function ProvisionPage({ locale }: ProvisionPageProps) {
  return (
    <I18nProvider locale={locale ?? resolveLocale()}>
      <ProvisionGate />
    </I18nProvider>
  )
}

/**
 * 能力检测门（spec「浏览器能力检测」）：非安全上下文 / 不支持 Web Serial
 * 时渲染引导提示页，MUST NOT 渲染任何配网入口——门通过前不挂载会话，
 * 避免在不可用环境里无谓创建传输。
 */
function ProvisionGate() {
  const { t } = useKitI18n()

  if (!isSecureContext()) {
    return (
      <div className="improv-page">
        <div className="improv-gate" role="alert">
          <p className="improv-gate__message">{t('insecure_context')}</p>
        </div>
      </div>
    )
  }

  if (!isWebSerialSupported()) {
    return (
      <div className="improv-page">
        <div className="improv-gate" role="alert">
          <p className="improv-gate__message">{t('unsupported_browser')}</p>
        </div>
      </div>
    )
  }

  return <SessionHost />
}

/** 会话宿主：能力门通过后挂载 hook，把结果交给纯渲染视图 */
function SessionHost() {
  const session = useImprovSession()
  // 表单语境断连的恢复入口：reset 关闭当前（已断）会话并作废在途动作，
  // connect 惰性重建全新传输立即重连（在宿主组装，ProvisionView 保持纯渲染）
  const handleReconnect = (): void => {
    session.reset()
    session.connect()
  }
  // 复位设备：优先走真实 esptool-js 硬件复位（transport.resetDevice，DTR/RTS
  // 重启设备）；transport 未实现 resetDevice 时回退到 resetConsole（= exitConsole，
  // 退出控制台回到配网视图）。真实复位会重启设备、使 Improv 会话失效，hook 侧
  // 已清理会话状态并置 resetNotice 提示用户重新连接。
  // 返回真实复位 promise（I1）：ConsoleView 的 handleReset 据此 await 真实复位，
  // 使 busy 态与错误路径真实——复位失败时 promise reject，ConsoleView 展示失败提示
  const handleReset = (): Promise<void> => {
    if (session.resetDevice) {
      return session.resetDevice()
    }
    session.resetConsole?.()
    return Promise.resolve()
  }
  return (
    <div className="improv-page">
      <ProvisionView {...session} onReconnect={handleReconnect} onReset={handleReset} />
    </div>
  )
}

/** 表单/入口视图的会话属性：hook 结果 + 断连恢复回调（由 SessionHost 组装） */
export interface ProvisionViewProps extends UseImprovSessionResult {
  /** ERROR + DISCONNECTED（表单语境物理断连）时渲染的恢复入口：重置后立即重连 */
  onReconnect: () => void
  /** 控制台复位设备回调（由 SessionHost 组装；ConsoleView 的 onReset 接线） */
  onReset: () => Promise<void>
}

/**
 * ProvisionView — 状态→视图的纯映射（单一数据源为 hook 结果）。
 *
 * 表单语境判定：READY 恒为表单；ERROR 时若 deviceInfo 仍保留（配网/扫描
 * 失败后 hook 保留表单语境，spec「密码错误导致失败后重试」）同样呈现
 * 「设备信息 + 错误条 + 表单」，而不是回退连接面板。
 */
export function ProvisionView(props: ProvisionViewProps) {
  const { t } = useKitI18n()
  const {
    state,
    deviceInfo,
    networks,
    scanGraceExpired,
    errorCategory,
    lastUrl,
    busy,
    connect,
    refreshScan,
    submitCredentials,
    changeWifi,
    reset,
    onReconnect,
    onReset,
    consolePort,
    enterConsole,
    exitConsole,
    resetNotice,
  } = props

  // 控制台模式：consolePort 存在即渲染 ConsoleView 替代配网视图（hook 已保证
  // 配网操作被拒绝，UI 层同样屏蔽表单/成功页，双保险）。onExit 接 exitConsole
  // 退出控制台回到配网视图；onReset 接宿主组装的 handleReset
  if (consolePort) {
    return <ConsoleView port={consolePort} onExit={() => exitConsole?.()} onReset={onReset} />
  }

  const showForm = state === 'READY' || (state === 'ERROR' && !!deviceInfo)

  if (showForm) {
    return (
      <>
        {deviceInfo && <DeviceInfoCard info={deviceInfo} />}
        {errorCategory && <ErrorBanner category={errorCategory} />}
        {resetNotice && (
          <div className="improv-reset-notice" role="status">
            {t('console_reset_reconnect')}
          </div>
        )}
        {state === 'ERROR' && errorCategory === 'DISCONNECTED' && (
          <button
            type="button"
            className="improv-button improv-button--primary"
            onClick={onReconnect}
          >
            {t('reconnect')}
          </button>
        )}
        <WifiForm
          networks={networks}
          scanGraceExpired={scanGraceExpired}
          busy={busy}
          onSubmit={submitCredentials}
          onRescan={refreshScan}
        />
        <button
          type="button"
          className="improv-button improv-button--ghost improv-console-open"
          onClick={() => enterConsole?.()}
        >
          {t('console_open')}
        </button>
      </>
    )
  }

  switch (state) {
    case 'PROVISIONING':
      return <ProgressView label={t('provisioning')} />
    case 'PROVISIONED':
      return (
        <ResultView
          deviceInfo={deviceInfo}
          lastUrl={lastUrl}
          onChangeWifi={changeWifi}
          onOpenConsole={() => enterConsole?.()}
        />
      )
    default:
      // IDLE / CONNECTING / ERROR（连接期失败无表单语境）；AUTHORIZATION_REQUIRED
      // 为 BLE 预留态，串口流程不可达，统一回落入口视图
      return (
        <>
          {resetNotice && (
            <div className="improv-reset-notice" role="status">
              {t('console_reset_reconnect')}
            </div>
          )}
          <ConnectionPanel
            state={state === 'CONNECTING' ? 'CONNECTING' : state === 'ERROR' ? 'ERROR' : 'IDLE'}
            errorCategory={errorCategory}
            busy={busy}
            onConnect={connect}
            onCancel={reset}
          />
        </>
      )
  }
}
