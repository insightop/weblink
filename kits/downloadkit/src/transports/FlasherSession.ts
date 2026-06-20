import { DeviceSession, DeviceIdentityStore, WebSerialTransport } from '@weblink/device-session'
import type { HardwareType, SessionStatus, HardwareIdentity, PersistedHardwareIdentity } from '@weblink/device-session'
import type { Transport } from '@weblink/device-session'
import type { DeviceSelector } from '@weblink/device-session'
import { WebUsbTransport } from './usb/WebUsbTransport'
import { WebHidTransport } from './hid/WebHidTransport'

export type { HardwareType, SessionStatus, HardwareIdentity, PersistedHardwareIdentity }
export type { Transport, DeviceSelector }

export interface FlasherSessionDeps {
  store?: DeviceIdentityStore
  createSelector?: (type: HardwareType) => DeviceSelector<unknown>
  createTransport?: (
    type: HardwareType,
    device?: unknown,
    config?: Record<string, unknown>,
  ) => Transport
}

export class FlasherSession {
  private static instance: FlasherSession | null = null

  private session: DeviceSession
  private _unsubDisconnect: (() => void) | null = null
  private _unsubReconnect: (() => void) | null = null

  private constructor(deps?: FlasherSessionDeps) {
    this.session = new DeviceSession({
      storageKey: 'downloadkit:flasher',
      store: deps?.store,
      createSelector: deps?.createSelector,
      createTransport: deps?.createTransport ?? this.defaultCreateTransport.bind(this),
    })
  }

  static getInstance(deps?: FlasherSessionDeps): FlasherSession {
    if (!FlasherSession.instance) {
      FlasherSession.instance = new FlasherSession(deps)
    }
    return FlasherSession.instance
  }

  static resetInstance(): void {
    FlasherSession.instance?.session.removeAllListeners()
    FlasherSession.instance = null
  }

  getStatus(): SessionStatus {
    return this.session.getStatus()
  }

  getTransport(): Transport | null {
    return this.session.getTransport()
  }

  getDeviceIdentity(): HardwareIdentity | null {
    return this.session.getDeviceIdentity()
  }

  onDisconnect(cb: (() => void) | null): void {
    this._unsubDisconnect?.()
    this._unsubDisconnect = cb ? this.session.on('disconnect', cb) : null
  }

  onReconnect(cb: (() => void) | null): void {
    this._unsubReconnect?.()
    this._unsubReconnect = cb ? this.session.on('reconnect', cb) : null
  }

  async acquire(type: HardwareType, identity?: PersistedHardwareIdentity): Promise<Transport> {
    return this.session.acquire(type, identity)
  }

  async release(): Promise<void> {
    return this.session.release()
  }

  async reopen(config: Record<string, unknown>): Promise<void> {
    return this.session.reopen(config)
  }

  async clearIdentity(): Promise<void> {
    return this.session.clearIdentity()
  }

  async loadPersistedIdentity(): Promise<PersistedHardwareIdentity | null> {
    return this.session.loadPersistedIdentity()
  }

  async tryRestore(): Promise<boolean> {
    return this.session.tryRestore()
  }

  startAutoReconnect(): void {
    this.session.startAutoReconnect()
  }

  stopAutoReconnect(): void {
    this.session.stopAutoReconnect()
  }

  private defaultCreateTransport(
    type: HardwareType,
    device?: unknown,
    config?: Record<string, unknown>,
  ): Transport {
    switch (type) {
      case 'serial':
        return new WebSerialTransport(device as SerialPort, (config?.baudRate as number) ?? 115200)
      case 'usb':
        return new WebUsbTransport(device as USBDevice)
      case 'hid':
        return new WebHidTransport(device as HIDDevice)
    }
  }
}
