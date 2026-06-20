import { DeviceIdentityStore } from '../infrastructure/DeviceIdentityStore'
import type { HardwareIdentity, HardwareType, PersistedHardwareIdentity, SessionStatus } from '../domain/types'
import type { DeviceSelector } from '../domain/selector'
import type { Transport } from '../domain/transport'
import { TypedEventEmitter } from '../domain/events'
import { SerialSelector } from '../infrastructure/selectors/SerialSelector'
import { UsbSelector } from '../infrastructure/selectors/UsbSelector'
import { HidSelector } from '../infrastructure/selectors/HidSelector'
import { WebSerialTransport } from '../infrastructure/transports/WebSerialTransport'

export interface DeviceSessionEvents {
  disconnect: void
  reconnect: void
}

export interface DeviceSessionDeps {
  storageKey?: string
  store?: DeviceIdentityStore
  createSelector?: (type: HardwareType) => DeviceSelector<unknown>
  createTransport?: (
    type: HardwareType,
    device?: unknown,
    config?: Record<string, unknown>,
  ) => Transport
}

export class DeviceSession extends TypedEventEmitter<DeviceSessionEvents> {
  private _status: SessionStatus = 'idle'
  private _transport: Transport | null = null
  private _currentIdentity: HardwareIdentity | null = null
  private _disconnectBound: (() => void) | null = null
  private _reconnectController: AbortController | null = null

  private readonly store: DeviceIdentityStore
  private readonly createSelectorFn: (type: HardwareType) => DeviceSelector<unknown>
  private readonly createTransportFn: (
    type: HardwareType,
    device?: unknown,
    config?: Record<string, unknown>,
  ) => Transport

  constructor(deps?: DeviceSessionDeps) {
    super()
    const storageKey = deps?.storageKey ?? 'default'
    this.store = deps?.store ?? new DeviceIdentityStore(storageKey)
    this.createSelectorFn = deps?.createSelector ?? this.defaultCreateSelector
    this.createTransportFn = deps?.createTransport ?? this.defaultCreateTransport
  }

  getStatus(): SessionStatus {
    return this._status
  }

  getTransport(): Transport | null {
    return this._transport
  }

  getDeviceIdentity(): HardwareIdentity | null {
    return this._currentIdentity
  }

  async acquire(type: HardwareType, identity?: PersistedHardwareIdentity): Promise<Transport> {
    if (this._transport) {
      throw new Error('Hardware session is already active. Call release() first.')
    }

    this._status = 'selecting'

    let selector: DeviceSelector<unknown> | null = null
    let device: unknown = null

    try {
      selector = this.createSelectorFn(type)
      device = identity
        ? (await this.tryMatchGranted(selector, identity)) ?? (await selector.request())
        : await selector.request()

      const transport = this.createTransportFn(type, device, identity?.lastConfig)
      const hardwareIdentity = selector.getIdentity(device)

      this._disconnectBound = () => {
        this._status = 'disconnected'
        this.emit('disconnect', undefined)
      }
      selector.watchDisconnect(device, this._disconnectBound)

      await transport.open()

      this._transport = transport
      this._currentIdentity = hardwareIdentity
      this._status = 'ready'

      await this.store.save({
        ...hardwareIdentity,
        lastConfig: identity?.lastConfig,
      })

      this.startAutoReconnect()

      return transport
    } catch (e) {
      if (selector && device && this._disconnectBound) {
        selector.unwatchDisconnect(device, this._disconnectBound)
      }
      this._disconnectBound = null
      this._status = 'idle'
      throw e
    }
  }

  async release(): Promise<void> {
    this.stopAutoReconnect()
    if (this._transport && this._currentIdentity) {
      const selector = this.createSelectorFn(this._currentIdentity.type)
      const device = this.extractDevice(this._transport, this._currentIdentity.type)
      if (device && this._disconnectBound) {
        selector.unwatchDisconnect(device, this._disconnectBound)
      }
    }

    this._disconnectBound = null

    if (this._transport) {
      await this._transport.close().catch(() => undefined)
    }

    this._transport = null
    this._currentIdentity = null
    this._status = 'idle'
  }

  async reopen(config: Record<string, unknown>): Promise<void> {
    if (!this._transport || !this._currentIdentity) {
      throw new Error('No active session to reopen')
    }

    const identity = this._currentIdentity
    const transport = this._transport
    const type = identity.type
    const device = this.extractDevice(transport, type)

    // #3: Unwatch disconnect before close to prevent race where
    // programmatic close triggers the disconnect handler.
    const selector = this.createSelectorFn(type)
    if (device && this._disconnectBound) {
      selector.unwatchDisconnect(device, this._disconnectBound)
    }

    await transport.close().catch(() => undefined)

    const newTransport = this.createTransportFn(type, device, config)

    try {
      await newTransport.open()
    } catch (e) {
      // #1: If open fails, clean up to avoid corrupt state.
      this._transport = null
      this._currentIdentity = null
      this._disconnectBound = null
      this._status = 'idle'
      throw e
    }

    // Rewatch disconnect on the new transport
    this._disconnectBound = () => {
      this._status = 'disconnected'
      this.emit('disconnect', undefined)
    }
    selector.watchDisconnect(device, this._disconnectBound)

    this._transport = newTransport
    this._currentIdentity = { ...identity }
    this._status = 'ready'

    await this.store.save({ ...identity, lastConfig: config })
  }

  async clearIdentity(): Promise<void> {
    await this.store.clear()
  }

  async loadPersistedIdentity(): Promise<PersistedHardwareIdentity | null> {
    return this.store.load()
  }

  startAutoReconnect(): void {
    this.stopAutoReconnect()

    const identity = this._currentIdentity
    if (!identity) return

    const controller = new AbortController()
    this._reconnectController = controller
    const signal = controller.signal

    switch (identity.type) {
      case 'serial': {
        const nav = navigator as Navigator & { serial?: { addEventListener: Function } }
        if (!nav.serial?.addEventListener) break
        nav.serial.addEventListener(
          'connect',
          async (e: Event) => {
            const port = (e as unknown as { port: SerialPort }).port
            const info = port.getInfo?.()
            if (!info) return
            if (this._status !== 'disconnected') return
            if (
              identity.usbVendorId != null &&
              identity.usbProductId != null &&
              info.usbVendorId === identity.usbVendorId &&
              info.usbProductId === identity.usbProductId
            ) {
              const restored = await this.tryRestore()
              if (restored) this.emit('reconnect', undefined)
            }
          },
          { signal },
        )
        break
      }
      case 'usb': {
        const nav = navigator as Navigator & { usb?: USB }
        if (!nav.usb?.addEventListener) break
        nav.usb.addEventListener(
          'connect',
          async (e: Event) => {
            const device = (e as USBConnectionEvent).device
            if (this._status !== 'disconnected') return
            if (
              identity.usbVendorId != null &&
              identity.usbProductId != null &&
              device.vendorId === identity.usbVendorId &&
              device.productId === identity.usbProductId
            ) {
              const restored = await this.tryRestore()
              if (restored) this.emit('reconnect', undefined)
            }
          },
          { signal },
        )
        break
      }
      // hid: navigator.hid has no connect/disconnect events
    }
  }

  stopAutoReconnect(): void {
    this._reconnectController?.abort()
    this._reconnectController = null
  }

  async tryRestore(): Promise<boolean> {
    if (this._transport) return false

    const identity = await this.store.load()
    if (!identity) return false

    this._status = 'selecting'
    try {
      const selector = this.createSelectorFn(identity.type)
      const device = await this.tryMatchGranted(selector, identity)
      if (!device) {
        this._status = 'idle'
        return false
      }

      const transport = this.createTransportFn(identity.type, device, identity.lastConfig)
      const hardwareIdentity = selector.getIdentity(device)

      this._disconnectBound = () => {
        this._status = 'disconnected'
        this.emit('disconnect', undefined)
      }
      selector.watchDisconnect(device, this._disconnectBound)
      await transport.open()

      this._transport = transport
      this._currentIdentity = hardwareIdentity
      this._status = 'ready'

      await this.store.save({ ...hardwareIdentity, lastConfig: identity.lastConfig })
      this.startAutoReconnect()
      return true
    } catch {
      this._status = 'idle'
      return false
    }
  }

  // --- Default implementations ---

  private defaultCreateSelector(type: HardwareType): DeviceSelector<unknown> {
    switch (type) {
      case 'serial':
        return new SerialSelector()
      case 'usb':
        return new UsbSelector()
      case 'hid':
        return new HidSelector()
    }
  }

  private defaultCreateTransport(
    type: HardwareType,
    device?: unknown,
    config?: Record<string, unknown>,
  ): Transport {
    if (type === 'serial') {
      return new WebSerialTransport(device as SerialPort, (config?.baudRate as number) ?? 115200)
    }
    throw new Error(
      `No default transport for type "${type}". Inject createTransport via DeviceSessionDeps.`,
    )
  }

  // --- Internal helpers ---

  private async tryMatchGranted(
    selector: DeviceSelector<unknown>,
    identity: PersistedHardwareIdentity,
  ): Promise<unknown | null> {
    const granted = await selector.getGranted()
    return (
      granted.find((d: unknown) => {
        const id = selector.getIdentity(d)
        return (
          identity.usbVendorId != null &&
          id.usbVendorId === identity.usbVendorId &&
          identity.usbProductId != null &&
          id.usbProductId === identity.usbProductId
        )
      }) ?? null
    )
  }

  private extractDevice(transport: Transport, _type: HardwareType): unknown {
    const record = transport as Record<string, unknown>
    if ('port' in record) return record.port
    if ('device' in record) return record.device
    return null
  }
}
