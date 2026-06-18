import type { HardwareIdentity, HardwareType } from '../HardwareSession.types';

export interface DeviceSelector<T> {
  readonly type: HardwareType;
  request(filters?: unknown): Promise<T>;
  getGranted(): Promise<T[]>;
  getIdentity(device: T): HardwareIdentity;
  watchDisconnect(device: T, callback: () => void): void;
  unwatchDisconnect(device: T): void;
}
