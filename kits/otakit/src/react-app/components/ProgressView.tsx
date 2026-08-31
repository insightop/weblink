import { useI18n } from '../i18n/useI18n'
import { isOtaErrorCode } from '../../core/session/otaSession.errors'
import type { OtaState } from '../hooks/useOtaSession'

interface ProgressViewProps {
  state: OtaState
}

export function ProgressView({ state }: ProgressViewProps) {
  const { t } = useI18n()
  // core 层错误以稳定 code 串（如 `xcp.connect_failed`）作为 message 抛出，
  // 这里检测到已知 code 就从 i18n 字典取词，未知 code 回退显示原文。
  const errorText =
    state.error && isOtaErrorCode(state.error) ? t(`ota.error.${state.error}`) : state.error
  const errorMessage = state.errorDetail ? `${errorText} ${state.errorDetail}` : errorText
  return (
    <div className="ota-progress">
      <div className="ota-progress-label">
        <span>{t(`ota.stage.${state.stage}`)}</span>
        <span>{Math.round(state.percent)}%</span>
      </div>
      <progress
        className="ota-progress-bar"
        max={100}
        value={Math.round(state.percent)}
        aria-label="progress"
      />
      {errorMessage && <p className="ota-error">{errorMessage}</p>}
    </div>
  )
}
