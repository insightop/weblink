import type { DeviceInfo } from '../../domain/types'
import { useKitI18n } from '../i18n/react'

/** 设备信息行：dt 标签 + dd 值（dl 语义内用 div 包裹，HTML5 合法） */
function DeviceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="improv-card__row">
      <dt className="improv-card__label">{label}</dt>
      <dd className="improv-card__value">{value}</dd>
    </div>
  )
}

/**
 * DeviceInfoCard — 设备信息卡。
 * name/firmware/version/chipFamily 恒显；osName/osVersion 仅在「有值」时显示
 * （null / 空串均视为设备不支持查询的缺失表达，spec「设备信息读取」）。
 */
export function DeviceInfoCard({ info }: { info: DeviceInfo }) {
  const { t } = useKitI18n()
  return (
    <dl className="improv-card">
      <DeviceRow label={t('device_info.name')} value={info.name} />
      <DeviceRow label={t('device_info.firmware')} value={info.firmware} />
      <DeviceRow label={t('device_info.version')} value={info.version} />
      <DeviceRow label={t('device_info.chip_family')} value={info.chipFamily} />
      {info.osName && <DeviceRow label={t('device_info.os_name')} value={info.osName} />}
      {info.osVersion && <DeviceRow label={t('device_info.os_version')} value={info.osVersion} />}
    </dl>
  )
}
