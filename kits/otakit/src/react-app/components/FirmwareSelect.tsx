import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'

interface FirmwareSelectProps {
  initialUrl?: string
  onUrlChange: (url: string) => void
  onUrlFetch: (url: string) => void
  onFile: (file: File) => void
}

export function FirmwareSelect({
  initialUrl = '',
  onUrlChange,
  onUrlFetch,
  onFile,
}: FirmwareSelectProps) {
  const { t } = useI18n()
  const [url, setUrl] = useState(initialUrl)

  // 受控：父组件可能重置 initialUrl，保持同步（KISS）
  useEffect(() => {
    setUrl(initialUrl)
  }, [initialUrl])

  function handleUrlChange(value: string) {
    setUrl(value)
    onUrlChange(value)
  }

  function handleFetch() {
    if (url.trim()) onUrlFetch(url.trim())
  }

  return (
    <div className="ota-field">
      <label className="ota-label" htmlFor="ota-firmware-url">
        {t('ota.firmwareUrl')}
      </label>
      <div className="ota-row">
        <input
          id="ota-firmware-url"
          type="text"
          className="ota-input"
          value={url}
          placeholder={t('ota.firmwareUrl')}
          onChange={(e) => handleUrlChange(e.target.value)}
        />
        <button type="button" className="ota-btn" onClick={handleFetch}>
          {t('ota.downloadFirmware')}
        </button>
      </div>
      <label className="ota-btn ota-upload">
        {t('ota.uploadFirmware')}
        <input
          type="file"
          aria-label={t('ota.uploadFirmware')}
          accept=".hex,.srec,.bin,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
          }}
        />
      </label>
    </div>
  )
}
