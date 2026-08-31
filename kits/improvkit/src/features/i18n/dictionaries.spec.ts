import { describe, expect, it } from 'vitest'
import { messages } from './dictionaries'

/**
 * 字典结构契约：en-US 与 zh-CN 全部成对提供（createT 的回退链成立的前提），
 * 且任务约定的必需键齐全、文案非空。createT 本身的回退行为见 i18n.spec.tsx。
 */
const requiredKeys: ReadonlyArray<string> = [
  // 页面标题 / 描述
  'page.title',
  'page.description',
  // 能力检测提示
  'unsupported_browser',
  'insecure_context',
  // 流程文案
  'connect_button',
  'connecting',
  'device_info.name',
  'device_info.firmware',
  'device_info.version',
  'device_info.chip_family',
  'device_info.os_name',
  'device_info.os_version',
  'wifi_label',
  'password_label',
  'show_password',
  'hide_password',
  'manual_ssid_placeholder',
  'scan',
  'scan_refresh',
  'scan_empty',
  'scan_scanning',
  'scan_backfill_hint',
  'scan_unavailable_hint',
  'reconnect',
  'provisioning',
  'success_title',
  'visit_device',
  'change_wifi',
  'retry',
  'close',
  // 控制台（ConsoleView）
  'console_title',
  'console_download',
  'console_exit',
  'console_disconnected',
  'console_reset',
  'console_reset_failed',
  // 控制台入口（配网视图「日志与控制台」）
  'console_open',
  'console_reset_reconnect',
  // 错误类别映射键（REQUEST_CANCELLED 不需要文案，UI 对其静默）
  'error.NOT_IMPROV_DEVICE',
  'error.DEVICE_WIFI_DISABLED',
  'error.UNABLE_TO_CONNECT',
  'error.UNKNOWN_COMMAND',
  'error.TIMEOUT',
  'error.BAD_HOSTNAME',
  'error.INVALID_PACKET',
  'error.DISCONNECTED',
  'error.UNKNOWN_ERROR',
]

describe('messages dictionaries', () => {
  it('en-US 与 zh-CN 键集合完全对等（全部成对提供）', () => {
    const enKeys = Object.keys(messages['en-US'])
    const zhKeys = Object.keys(messages['zh-CN'])
    expect([...zhKeys].sort()).toEqual([...enKeys].sort())
  })

  it('任务约定的必需键在两种语言下都存在且为非空文案', () => {
    for (const locale of ['en-US', 'zh-CN'] as const) {
      const dict = messages[locale] as Readonly<Record<string, string>>
      for (const key of requiredKeys) {
        expect(dict[key], `missing ${locale}.${key}`).toBeTruthy()
      }
    }
  })

  it('REQUEST_CANCELLED 没有错误文案键（UI 对其静默，不查找字典）', () => {
    expect('error.REQUEST_CANCELLED' in messages['en-US']).toBe(false)
    expect('error.REQUEST_CANCELLED' in messages['zh-CN']).toBe(false)
  })
})
