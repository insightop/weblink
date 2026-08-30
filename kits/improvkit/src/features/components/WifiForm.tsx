import { useState, type FormEvent } from 'react'
import type { Ssid } from '../../domain/types'
import { useKitI18n } from '../i18n/react'

export interface WifiFormProps {
  /** undefined = 尚未成功扫描（可 rescan 恢复）；null = 设备不支持扫描；数组 = 列表 */
  networks?: Ssid[] | null
  /** 提交 / 扫描进行中：禁用提交与重新扫描按钮，防止重复下发凭据与并发扫描 */
  busy: boolean
  onSubmit: (ssid: string, password: string) => void
  onRescan: () => void
}

/** 信号强度四档（dBm 越大越强）：≥-50 满格、≥-60 三格、≥-70 两格、其余一格 */
function signalTier(rssi: number): number {
  if (rssi >= -50) return 4
  if (rssi >= -60) return 3
  if (rssi >= -70) return 2
  return 1
}

/** 网络条目的可访问名称：网络名 + 信号档（/4）+ 是否加密 */
function networkAriaLabel(network: Ssid): string {
  return `${network.name} — signal ${signalTier(network.rssi)}/4, ${
    network.secured ? 'secured' : 'open'
  }`
}

/**
 * 单格信号条：恒定四格，前 tier 格点亮（on 变体）。
 * testid 仅作测试计数钩子（signal-bar-on/off），用户可见信息走 CSS。
 */
function SignalBars({ tier }: { tier: number }) {
  return (
    <span className="improv-network__bars" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          data-testid={i < tier ? 'signal-bar-on' : 'signal-bar-off'}
          className={`improv-network__bar${i < tier ? ' improv-network__bar--on' : ''}`}
        />
      ))}
    </span>
  )
}

/**
 * WifiForm — 凭据表单（spec「网络选择（扫描列表或手动输入）→ 密码输入」）。
 * 表单态局部自持（SSID/密码/可见性）；点选网络条目回填 SSID；扫描列表与
 * 重新扫描仅在设备支持扫描（networks !== null，扫描态由 prop 内部分化）时
 * 呈现。空 SSID（去首尾空白）禁用提交。
 */
export function WifiForm({ networks, busy, onSubmit, onRescan }: WifiFormProps) {
  const { t } = useKitI18n()
  // 设备不支持扫描（networks === null）→ 降级手动输入；与 hooks 层别名推导一致
  const scanUnavailable = networks === null
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // 空 SSID 校验：前后空白视为空；busy 期间一律禁用（防重复提交）
  const canSubmit = ssid.trim() !== '' && !busy

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit(ssid.trim(), password)
  }

  return (
    <form className="improv-form" onSubmit={handleSubmit}>
      {!scanUnavailable && (
        <div className="improv-networks">
          <div className="improv-networks__header">
            <button
              type="button"
              className="improv-button improv-button--ghost improv-networks__rescan"
              disabled={busy}
              onClick={onRescan}
            >
              {t('scan_refresh')}
            </button>
          </div>
          {networks && networks.length === 0 && (
            <p className="improv-networks__hint" data-testid="scan-empty">
              {t('scan_empty')}
            </p>
          )}
          {networks && networks.length > 0 && (
            <ul className="improv-networks__list">
              {networks.map((network) => (
                // 复合 key：同名网络可能以不同信号/加密态重复出现，单纯 name 会冲突
                <li key={`${network.name}-${network.rssi}-${network.secured}`}>
                  <button
                    type="button"
                    className="improv-network"
                    aria-label={networkAriaLabel(network)}
                    onClick={() => setSsid(network.name)}
                  >
                    <span className="improv-network__name">{network.name}</span>
                    <SignalBars tier={signalTier(network.rssi)} />
                    {network.secured && (
                      <span
                        className="improv-network__lock"
                        data-testid="lock-mark"
                        aria-hidden="true"
                      >
                        🔒
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {scanUnavailable && <p className="improv-networks__hint">{t('scan_unavailable_hint')}</p>}

      <div className="improv-form__field">
        <label className="improv-form__label" htmlFor="improv-ssid">
          {t('wifi_label')}
        </label>
        <input
          id="improv-ssid"
          className="improv-form__input"
          type="text"
          value={ssid}
          placeholder={t('manual_ssid_placeholder')}
          onChange={(event) => setSsid(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="improv-form__field">
        <label className="improv-form__label" htmlFor="improv-password">
          {t('password_label')}
        </label>
        <div className="improv-form__control">
          <input
            id="improv-password"
            className="improv-form__input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="improv-button improv-button--ghost improv-form__toggle"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {t(showPassword ? 'hide_password' : 'show_password')}
          </button>
        </div>
      </div>

      <div className="improv-form__actions">
        <button
          type="submit"
          className="improv-button improv-button--primary"
          disabled={!canSubmit}
        >
          {t('submit_wifi')}
        </button>
      </div>
    </form>
  )
}
