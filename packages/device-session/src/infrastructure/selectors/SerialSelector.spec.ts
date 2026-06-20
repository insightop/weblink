import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SerialSelector } from './SerialSelector'

function makeMockSerialPort(vid?: number, pid?: number): SerialPort {
  return {
    getInfo: () => ({ usbVendorId: vid, usbProductId: pid }),
    open: vi.fn(),
    close: vi.fn(),
  } as unknown as SerialPort
}

describe('SerialSelector', () => {
  let selector: SerialSelector

  beforeEach(() => {
    selector = new SerialSelector()
  })

  it('type 返回 serial', () => {
    expect(selector.type).toBe('serial')
  })

  it('getIdentity 提取 VID/PID', () => {
    const port = makeMockSerialPort(0x1a86, 0x7523)
    const id = selector.getIdentity(port)
    expect(id.type).toBe('serial')
    expect(id.usbVendorId).toBe(0x1a86)
    expect(id.usbProductId).toBe(0x7523)
  })

  it('getIdentity 无信息时返回空', () => {
    const port = makeMockSerialPort()
    const id = selector.getIdentity(port)
    expect(id).toEqual({ type: 'serial' })
  })

  it('watchDisconnect 设置 ondisconnect', () => {
    const port = makeMockSerialPort(1, 2)
    const cb = vi.fn()
    selector.watchDisconnect(port, cb)
    const handler = (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect
    expect(handler).toBeInstanceOf(Function)
    handler!()
    expect(cb).toHaveBeenCalledOnce()
  })

  it('unwatchDisconnect 清除 ondisconnect', () => {
    const port = makeMockSerialPort(1, 2)
    const cb = vi.fn()
    selector.watchDisconnect(port, cb)
    selector.unwatchDisconnect(port)
    const handler = (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect
    expect(handler).toBeNull()
  })
})
