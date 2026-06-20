import { describe, expect, it, vi, beforeEach } from 'vitest'
import { UsbSelector } from './UsbSelector'

function makeMockUsbDevice(vid: number, pid: number): USBDevice {
  return {
    vendorId: vid,
    productId: pid,
    manufacturerName: 'TestMfr',
    productName: 'TestProduct',
    serialNumber: 'SN123',
  } as unknown as USBDevice
}

describe('UsbSelector', () => {
  let selector: UsbSelector

  beforeEach(() => {
    selector = new UsbSelector()
  })

  it('type 返回 usb', () => {
    expect(selector.type).toBe('usb')
  })

  it('getIdentity 提取完整设备信息', () => {
    const device = makeMockUsbDevice(0x1a86, 0x5512)
    const id = selector.getIdentity(device)
    expect(id.type).toBe('usb')
    expect(id.usbVendorId).toBe(0x1a86)
    expect(id.usbProductId).toBe(0x5512)
    expect(id.manufacturerName).toBe('TestMfr')
    expect(id.productName).toBe('TestProduct')
    expect(id.serialNumber).toBe('SN123')
  })

  it('getIdentity 处理 null 值的名称字段', () => {
    const device = {
      vendorId: 0x1234,
      productId: 0x5678,
      manufacturerName: null,
      productName: null,
      serialNumber: null,
    } as unknown as USBDevice
    const id = selector.getIdentity(device)
    expect(id.manufacturerName).toBeUndefined()
    expect(id.productName).toBeUndefined()
    expect(id.serialNumber).toBeUndefined()
  })
})
