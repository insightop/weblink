export type HardwareType = 'serial' | 'usb' | 'hid'

export type SessionStatus = 'idle' | 'selecting' | 'ready' | 'disconnected'

export interface HardwareIdentity {
  type: HardwareType
  usbVendorId?: number
  usbProductId?: number
  manufacturerName?: string
  productName?: string
  serialNumber?: string
}

export interface PersistedHardwareIdentity extends HardwareIdentity {
  lastConfig?: Record<string, unknown>
}
