import { openDB } from 'idb';

const DB = 'hardware-session-db';
const STORE = 'device';
const KEY = 'current-device';
const SCHEMA_VERSION = 1;

export interface PersistedHardwareIdentity {
  type: 'serial' | 'usb' | 'hid';
  usbVendorId?: number;
  usbProductId?: number;
  lastConfig?: Record<string, unknown>;
}

export class DeviceIdentityStore {
  private async getDb() {
    return openDB(DB, SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }

  async load(): Promise<PersistedHardwareIdentity | null> {
    const db = await this.getDb();
    const result = await db.get(STORE, KEY);
    return (result as PersistedHardwareIdentity) ?? null;
  }

  async save(identity: PersistedHardwareIdentity): Promise<void> {
    const db = await this.getDb();
    await db.put(STORE, identity, KEY);
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE, KEY);
  }
}
