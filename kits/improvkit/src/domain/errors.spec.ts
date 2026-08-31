import { describe, expect, it } from 'vitest'
import {
  DomainProvisioningError,
  mapSdkErrorCode,
  mapSdkErrorMessage,
  type DomainErrorCategory,
} from './errors'

/**
 * SDK 错误码 → 领域错误类别 映射契约。
 * 已知错误码逐项断言；NO_ERROR(0x00) 与未知码按兜底契约处理为 UNKNOWN_ERROR。
 */
const errorCodeCases: ReadonlyArray<[code: number, expected: DomainErrorCategory]> = [
  [0x01, 'INVALID_PACKET'],
  [0x02, 'UNKNOWN_COMMAND'],
  [0x03, 'UNABLE_TO_CONNECT'],
  [0x05, 'BAD_HOSTNAME'],
  [0xfe, 'TIMEOUT'],
  [0xff, 'UNKNOWN_ERROR'],
  [0x00, 'UNKNOWN_ERROR'], // NO_ERROR 兜底契约
  [0x42, 'UNKNOWN_ERROR'], // 未知错误码兜底
]

describe('mapSdkErrorCode', () => {
  // NO_ERROR(0x00) 与未知码(0x42) 的兜底契约由表内 errorCodeCases 覆盖，不再单列 it 用例
  it.each(errorCodeCases)('maps SDK error code %d to %s', (code, expected) => {
    expect(mapSdkErrorCode(code)).toBe(expected)
  })
})

describe('mapSdkErrorMessage', () => {
  // 上游 ImprovSerial._setError 以 ERROR_MSGS[code] 的【字符串】reject（dist/serial.js
  // 已核实）；未收录码以 "UNKNOWN_ERROR (N)" 兜底。消息 → 类别 与 码 → 类别 必须
  // 同源（INVALID_RPC_PACKET 是唯一名称不同于类别的项）。
  const messageCases: ReadonlyArray<[message: string, expected: DomainErrorCategory]> = [
    ['INVALID_RPC_PACKET', 'INVALID_PACKET'],
    ['UNKNOWN_RPC_COMMAND', 'UNKNOWN_COMMAND'],
    ['UNABLE_TO_CONNECT', 'UNABLE_TO_CONNECT'],
    ['BAD_HOSTNAME', 'BAD_HOSTNAME'],
    ['TIMEOUT', 'TIMEOUT'],
    ['UNKNOWN_ERROR', 'UNKNOWN_ERROR'],
    ['UNKNOWN_ERROR (254)', 'UNKNOWN_ERROR'], // 未收录码的兜底字符串形态
    ['not-a-sdk-message', 'UNKNOWN_ERROR'], // 非 SDK 消息一律兜底
  ]

  it.each(messageCases)('maps rejection message %s to %s', (message, expected) => {
    expect(mapSdkErrorMessage(message)).toBe(expected)
  })
})

describe('DomainProvisioningError', () => {
  it('is instantiable, is an Error subclass and carries the category', () => {
    const err = new DomainProvisioningError('TIMEOUT', 'RPC timed out')

    expect(err).toBeInstanceOf(DomainProvisioningError)
    expect(err).toBeInstanceOf(Error)
    expect(err.category).toBe('TIMEOUT')
    expect(err.message).toBe('RPC timed out')
    expect(err.name).toBe('DomainProvisioningError')
  })

  it('falls back message to the category when message is omitted', () => {
    const err = new DomainProvisioningError('TIMEOUT')

    expect(err.message).toBe('TIMEOUT')
  })
})
