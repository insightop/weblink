import type { DeviceSelector } from '../../domain/selector'
import type { HardwareIdentity, HardwareType } from '../../domain/types'

function getNavigatorUsb(): USB | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { usb?: USB }).usb
}

export class UsbSelector implements DeviceSelector<USBDevice> {
  readonly type: HardwareType = 'usb'

  async request(filters?: USBDeviceFilter[]): Promise<USBDevice> {
    const usb = getNavigatorUsb()
    if (!usb) throw new Error('Web USB is not supported')
    return usb.requestDevice({ filters: filters ?? [] })
  }

  async getGranted(): Promise<USBDevice[]> {
    const usb = getNavigatorUsb()
    if (!usb?.getDevices) return []
    return usb.getDevices()
  }

  getIdentity(device: USBDevice): HardwareIdentity {
    return {
      type: 'usb',
      usbVendorId: device.vendorId,
      usbProductId: device.productId,
      manufacturerName: device.manufacturerName ?? undefined,
      productName: device.productName ?? undefined,
      serialNumber: device.serialNumber ?? undefined,
    }
  }

  private disconnectHandlers = new WeakMap<USBDevice, (e: USBConnectionEvent) => void>()

  watchDisconnect(device: USBDevice, callback: () => void): void {
    const usb = getNavigatorUsb()
    if (!usb) return
    const handler = (e: USBConnectionEvent) => {
      if (e.device === device) callback()
    }
    usb.addEventListener('disconnect', handler)
    this.disconnectHandlers.set(device, handler)
  }

  unwatchDisconnect(device: USBDevice): void {
    const usb = getNavigatorUsb()
    if (!usb) return
    const handler = this.disconnectHandlers.get(device)
    if (handler) {
      usb.removeEventListener('disconnect', handler)
      this.disconnectHandlers.delete(device)
    }
  }
}
