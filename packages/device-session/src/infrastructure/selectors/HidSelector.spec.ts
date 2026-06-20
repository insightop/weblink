import { describe, expect, it, vi, beforeEach } from 'vitest'
import { HidSelector } from './HidSelector'

function makeMockHidDevice(vid: number, pid: number, name?: string): HIDDevice {
  return {
    vendorId: vid,
    productId: pid,
    productName: name ?? 'TestHID',
    open: vi.fn(),
    close: vi.fn(),
    collections: [],
  } as unknown as HIDDevice
}

describe('HidSelector', () => {
  let selector: HidSelector

  beforeEach(() => {
    selector = new HidSelector()
  })

  it('type 返回 hid', () => {
    expect(selector.type).toBe('hid')
  })

  it('getIdentity 提取设备信息', () => {
    const device = makeMockHidDevice(0x1234, 0x5678, 'MyDevice')
    const id = selector.getIdentity(device)
    expect(id.type).toBe('hid')
    expect(id.usbVendorId).toBe(0x1234)
    expect(id.usbProductId).toBe(0x5678)
    expect(id.productName).toBe('MyDevice')
  })

  it('getIdentity 处理空 productName', () => {
    const device = makeMockHidDevice(0x1234, 0x5678)
    ;(device as unknown as { productName: null }).productName = null
    const id = selector.getIdentity(device)
    expect(id.productName).toBeUndefined()
  })
})
