import type { DeviceSelector } from '../../domain/selector'
import type { HardwareIdentity, HardwareType } from '../../domain/types'

function getNavigatorSerial(): Serial | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { serial?: Serial }).serial
}

export class SerialSelector implements DeviceSelector<SerialPort> {
  readonly type: HardwareType = 'serial'

  async request(): Promise<SerialPort> {
    const serial = getNavigatorSerial()
    if (!serial) throw new Error('Web Serial is not supported')
    return serial.requestPort()
  }

  async getGranted(): Promise<SerialPort[]> {
    const serial = getNavigatorSerial()
    if (!serial?.getPorts) return []
    return serial.getPorts()
  }

  getIdentity(port: SerialPort): HardwareIdentity {
    const info = port.getInfo?.()
    if (!info) return { type: 'serial' }
    return {
      type: 'serial',
      usbVendorId: typeof info.usbVendorId === 'number' ? info.usbVendorId : undefined,
      usbProductId: typeof info.usbProductId === 'number' ? info.usbProductId : undefined,
    }
  }

  watchDisconnect(port: SerialPort, callback: () => void): void {
    try {
      (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect = callback
    } catch {
      // 某些浏览器不支持 ondisconnect 属性
    }
  }

  unwatchDisconnect(port: SerialPort): void {
    try {
      (port as unknown as { ondisconnect: (() => void) | null }).ondisconnect = null
    } catch {
      // ignore
    }
  }
}
