import { DeviceIdentityStore, type PersistedHardwareIdentity } from './DeviceIdentityStore';
import type { HardwareIdentity, HardwareType, SessionStatus } from './HardwareSession.types';
import type { DeviceSelector } from './selectors/DeviceSelector';
import type { Transport } from './types';
import { SerialSelector } from './selectors/SerialSelector';
import { UsbSelector } from './selectors/UsbSelector';
import { HidSelector } from './selectors/HidSelector';
import { WebSerialTransport } from './serial/WebSerialTransport';
import { WebUsbTransport } from './usb/WebUsbTransport';
import { WebHidTransport } from './hid/WebHidTransport';

export interface HardwareSessionDeps {
  store?: DeviceIdentityStore;
  createSelector?: (type: HardwareType) => DeviceSelector<unknown>;
  createTransport?: (type: HardwareType, config?: Record<string, unknown>) => Transport;
}

export class HardwareSession {
  private static instance: HardwareSession | null = null;

  private _status: SessionStatus = 'idle';
  private _transport: Transport | null = null;
  private _currentIdentity: HardwareIdentity | null = null;
  private _disconnectCallback: (() => void) | null = null;
  private _disconnectBound: (() => void) | null = null;

  private readonly store: DeviceIdentityStore;
  private readonly createSelectorFn: (type: HardwareType) => DeviceSelector<unknown>;
  private readonly createTransportFn: (type: HardwareType, config?: Record<string, unknown>) => Transport;

  private constructor(deps?: HardwareSessionDeps) {
    this.store = deps?.store ?? new DeviceIdentityStore();
    this.createSelectorFn = deps?.createSelector ?? this.defaultCreateSelector;
    this.createTransportFn = deps?.createTransport ?? this.defaultCreateTransport;
  }

  static getInstance(deps?: HardwareSessionDeps): HardwareSession {
    if (!HardwareSession.instance) {
      HardwareSession.instance = new HardwareSession(deps);
    }
    return HardwareSession.instance;
  }

  static resetInstance(): void {
    HardwareSession.instance = null;
  }

  getStatus(): SessionStatus {
    return this._status;
  }

  onDisconnect(cb: (() => void) | null): void {
    this._disconnectCallback = cb;
  }

  async acquire(type: HardwareType, identity?: PersistedHardwareIdentity): Promise<Transport> {
    if (this._transport) {
      throw new Error('Hardware session is already active. Call release() first.');
    }

    this._status = 'selecting';

    try {
      const selector = this.createSelectorFn(type);
      const device = identity
        ? (await this.tryMatchGranted(selector, identity)) ?? (await selector.request())
        : await selector.request();

      const transport = this.createTransportFn(type, identity?.lastConfig);
      const hardwareIdentity = selector.getIdentity(device);

      this.injectDevice(transport, type, device);

      this._disconnectBound = () => {
        this._status = 'disconnected';
        this._disconnectCallback?.();
      };
      selector.watchDisconnect(device, this._disconnectBound);

      await transport.open();

      this._transport = transport;
      this._currentIdentity = hardwareIdentity;
      this._status = 'ready';

      await this.store.save({
        ...hardwareIdentity,
        lastConfig: identity?.lastConfig,
      });

      return transport;
    } catch (e) {
      this._status = 'idle';
      throw e;
    }
  }

  async release(): Promise<void> {
    if (this._transport && this._currentIdentity) {
      const selector = this.createSelectorFn(this._currentIdentity.type);
      const device = this.extractDevice(this._transport, this._currentIdentity.type);
      if (device && this._disconnectBound) {
        selector.unwatchDisconnect(device, this._disconnectBound);
      }
    }

    this._disconnectBound = null;

    if (this._transport) {
      await this._transport.close().catch(() => undefined);
    }

    this._transport = null;
    this._currentIdentity = null;
    this._status = 'idle';
  }

  async reopen(config: Record<string, unknown>): Promise<void> {
    if (!this._transport || !this._currentIdentity) {
      throw new Error('No active session to reopen');
    }

    const identity = this._currentIdentity;
    const transport = this._transport;
    const type = identity.type;
    const device = this.extractDevice(transport, type);

    await transport.close().catch(() => undefined);

    const newTransport = this.createTransportFn(type, config);
    this.injectDevice(newTransport, type, device);

    await newTransport.open();

    this._transport = newTransport;
    this._currentIdentity = { ...identity };

    await this.store.save({ ...identity, lastConfig: config });
  }

  async clearIdentity(): Promise<void> {
    await this.store.clear();
  }

  // --- Default implementations (real browser API) ---

  private defaultCreateSelector(type: HardwareType): DeviceSelector<unknown> {
    switch (type) {
      case 'serial':
        return new SerialSelector();
      case 'usb':
        return new UsbSelector();
      case 'hid':
        return new HidSelector();
    }
  }

  private defaultCreateTransport(type: HardwareType, config?: Record<string, unknown>): Transport {
    switch (type) {
      case 'serial':
        return new WebSerialTransport((config?.baudRate as number) ?? 115200);
      case 'usb':
        return new WebUsbTransport();
      case 'hid':
        return new WebHidTransport();
    }
  }

  // --- Internal helpers ---

  private async tryMatchGranted(
    selector: DeviceSelector<unknown>,
    identity: PersistedHardwareIdentity,
  ): Promise<unknown | null> {
    const granted = await selector.getGranted();
    return (
      granted.find((d: unknown) => {
        const id = selector.getIdentity(d);
        return (
          identity.usbVendorId != null &&
          id.usbVendorId === identity.usbVendorId &&
          identity.usbProductId != null &&
          id.usbProductId === identity.usbProductId
        );
      }) ?? null
    );
  }

  private injectDevice(transport: Transport, type: HardwareType, device: unknown): void {
    switch (type) {
      case 'serial':
        (transport as WebSerialTransport).replacePort(device as SerialPort);
        break;
      case 'usb':
        (transport as WebUsbTransport).replaceDevice(device as USBDevice);
        break;
      case 'hid':
        (transport as WebHidTransport).replaceDevice(device as HIDDevice);
        break;
    }
  }

  private extractDevice(transport: Transport, type: HardwareType): unknown {
    switch (type) {
      case 'serial':
        return (transport as WebSerialTransport).port;
      case 'usb':
        return (transport as WebUsbTransport).device;
      case 'hid':
        return (transport as WebHidTransport).device;
    }
  }
}
