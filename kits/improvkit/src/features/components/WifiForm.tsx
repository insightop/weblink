import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Ssid } from '../../domain/types'
import { droppedSsid, strongestSsid } from '../hooks/scanSelection'
import { useKitI18n } from '../i18n/react'

export interface WifiFormProps {
  /** undefined = 尚未成功扫描（可 rescan 恢复）；null = 设备不支持扫描；数组 = 列表 */
  networks?: Ssid[] | null
  /** 首扫宽限期已过仍无网络：UI 据此显示「未发现网络」空态（与 networks 空列表区分） */
  scanGraceExpired?: boolean
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
export function WifiForm({ networks, scanGraceExpired, busy, onSubmit, onRescan }: WifiFormProps) {
  const { t } = useKitI18n()
  // 设备不支持扫描（networks === null）→ 降级手动输入；与 hooks 层别名推导一致
  const scanUnavailable = networks === null
  // 最强网络预选 + 掉线回填（design.md D15）：
  // - 网络列表首次就绪（从 undefined → 数组）时，自动预选 RSSI 最大的网络写入
  //   手动输入框（password 等其余输入保留）；
  // - 当前选中的网络从后续扫描结果消失时，把该 SSID 回填到手动输入框并提示，
  //   保留密码以便直接重连。
  // 实现上用一个独立 ref 记录「当前被选中的网络 SSID」（点选或预选所致），与
  // 手动输入框解耦：用户后续手动改 SSID 不影响列表选中跟踪，掉线检测只看这个
  // ref。仅当列表（networks）变化时才跑，避免随每次按键重算。
  const selectedSsidRef = useRef<string | null>(null)
  // 是否已产生任何用户可见的选择决策（预选 / 点选 / 手动输入 / 掉线回填）。
  // 仅当「尚无有效选中」时才允许预选：一旦有任何决策，后续非空列表都不再覆盖
  // 既有内容（guard，防覆盖用户的手动输入 / 已选中 / 回填）。
  const selectionEstablishedRef = useRef(false)
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // 掉线回填提示：选中网络从扫描列表消失时提示（文案见 dictionaries）
  const [backfillNotice, setBackfillNotice] = useState(false)

  // 空 SSID 校验：前后空白视为空；busy 期间一律禁用（防重复提交）
  const canSubmit = ssid.trim() !== '' && !busy

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!canSubmit) return
    onSubmit(ssid.trim(), password)
  }

  // 预选 + 掉线回填：仅依赖 networks 变化驱动。
  // - 预选：首个「非空数组」且「尚无任何选择决策」时，预选信号最强的网络。D14 慢启动
  //   下首轮可能返回空数组（[]），此时不预选并保留等待；第二轮非空数组到达才预选，
  //   不能只看"首个数组"（否则空数组会永久吞掉预选）。
  // - 掉线回填：每次更新对 selectedSsidRef 判掉线。
  // selectedSsidRef 记录列表选中项，回填后复位；selectionEstablishedRef 记录是否已有决策。
  const previousNetworks = useRef<Ssid[] | null | undefined>(undefined)
  useEffect(() => {
    const previous = previousNetworks.current
    previousNetworks.current = networks
    if (!Array.isArray(networks)) return // 未就绪或设备不支持扫描：无预选/回填

    // 首个「非空数组」+ 尚无任何选择决策 → 预选信号最强网络。
    // 慢启动（D14）下首轮可能是空数组（[]）：上一次非"非空数组"（undefined/null/空数组）
    // 而本次为非空数组，即为首个非空数组，此时才预选。
    const prevNotEmpty = Array.isArray(previous) && previous.length > 0
    if (networks.length > 0 && !prevNotEmpty && !selectionEstablishedRef.current) {
      const strongest = strongestSsid(networks)
      if (strongest) {
        setSsid(strongest.name)
        selectedSsidRef.current = strongest.name
        selectionEstablishedRef.current = true
        return // 刚完成预选，本轮无需再做掉线回填
      }
    }
    // 掉线回填：仅处理「用户选中过」的列表项消失；手动输入不在跟踪范围
    const chosen = selectedSsidRef.current
    if (chosen) {
      const dropped = droppedSsid(chosen, networks)
      if (dropped) {
        setSsid(dropped)
        selectedSsidRef.current = null // 已回填，视作手动态
        setBackfillNotice(true)
      }
    }
  }, [networks])

  const handleSelectNetwork = (name: string): void => {
    setSsid(name)
    selectedSsidRef.current = name
    selectionEstablishedRef.current = true
    setBackfillNotice(false)
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
          {backfillNotice && (
            <p className="improv-networks__hint" data-testid="scan-backfill">
              {t('scan_backfill_hint')}
            </p>
          )}
          {/* 空态判定（D14 宽限期）：networks 仍为 undefined 表示设备尚未返回任何
              扫描结果——宽限期内显示"正在扫描"，宽限期结束仍空才显示"未发现网络"。
              空数组表示设备已确认扫描完毕且无网络，直接显示"未发现网络"。 */}
          {networks === undefined && !scanGraceExpired && (
            <p className="improv-networks__hint" data-testid="scan-waiting">
              {t('scan_scanning')}
            </p>
          )}
          {networks === undefined && scanGraceExpired && (
            <p className="improv-networks__hint" data-testid="scan-empty-grace">
              {t('scan_empty')}
            </p>
          )}
          {Array.isArray(networks) && networks.length === 0 && (
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
                    className={`improv-network${
                      ssid === network.name ? ' improv-network--selected' : ''
                    }`}
                    aria-label={networkAriaLabel(network)}
                    onClick={() => handleSelectNetwork(network.name)}
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
          onChange={(event) => {
            setSsid(event.target.value)
            selectionEstablishedRef.current = true // 手动输入即视为已有决策，后续不再预选
            // 手动输入即脱离"列表选中项"跟踪：清空 selectedSsidRef，让掉线检测
            // 不再对本来源生效——否则预选残留的 SSID 会在下次网络掉线时把用户的
            // 手动输入回填覆盖回列表项（F1 回归，与 handleSelectNetwork 对应）
            selectedSsidRef.current = null
          }}
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
