import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'

interface SerialSelectProps {
  onSelect: (port: SerialPort) => void
}

export function SerialSelect({ onSelect }: SerialSelectProps) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)

  // happy-dom 未注册 navigator.serial，直接读取会抛错，故先判空
  const serial = typeof navigator !== 'undefined' ? navigator.serial : undefined

  async function handleSelect() {
    if (!serial) {
      setError(t('ota.unsupported'))
      return
    }
    try {
      const port = await serial.requestPort()
      setError(null)
      onSelect(port)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="ota-field">
      <button type="button" className="ota-btn" onClick={handleSelect}>
        {t('ota.selectPort')}
      </button>
      {error && <p className="ota-error">{error}</p>}
    </div>
  )
}
