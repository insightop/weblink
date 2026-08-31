/**
 * OtaSession 错误码约定。
 *
 * core 层（传输无关）不依赖任何 UI/i18n，因此错误文案不在此硬编码中文。
 * 抛出的错误统一为 {@link OtaError}：`message` 是稳定的英文代码串（如
 * `xcp.connect_failed`），`detail` 携带可选的动态上下文（如擦除地址）。
 * UI 层（ProgressView）检测到该 code 后从 i18n 字典取对应文案展示，
 * 未知 code 回退显示原文。
 */
export const OTA_ERROR_CODES = [
  'xcp.connect_failed',
  'info_table.rejected',
  'info_table.error',
  'firmware.parse_failed',
  'firmware.no_segments',
  'firmware.segment_missing',
  'erase.failed',
  'write.failed',
] as const

export type OtaErrorCode = (typeof OTA_ERROR_CODES)[number]

/** 判断一个字符串是否为已知的 OtaError code（供 UI 层决定是否走 i18n 取词）。 */
export function isOtaErrorCode(value: string): value is OtaErrorCode {
  return (OTA_ERROR_CODES as readonly string[]).includes(value)
}

export class OtaError extends Error {
  readonly code: OtaErrorCode
  readonly detail?: string

  constructor(code: OtaErrorCode, detail?: string) {
    super(code)
    this.name = 'OtaError'
    this.code = code
    this.detail = detail
  }
}
