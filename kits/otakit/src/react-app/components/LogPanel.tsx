import { useI18n } from '../i18n/useI18n'

interface LogPanelProps {
  lines: string[]
  onClear: () => void
}

export function LogPanel({ lines, onClear }: LogPanelProps) {
  const { t } = useI18n()
  return (
    <div className="ota-log">
      <div className="ota-log-head">
        <span>{t('ota.title')}</span>
        <button type="button" className="ota-btn ota-btn-small" onClick={onClear}>
          {t('ota.clearLog')}
        </button>
      </div>
      <pre className="ota-log-body">{lines.length === 0 ? '' : lines.join('\n')}</pre>
    </div>
  )
}
