import { openDB } from 'idb'
import type { PersistedHardwareIdentity } from '../domain/types'

const DB_NAME = 'device-session-db'
const STORE_NAME = 'identities'
const SCHEMA_VERSION = 1

export class DeviceIdentityStore {
  constructor(private readonly storageKey: string) {}

  private async getDb() {
    return openDB(DB_NAME, SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  async load(): Promise<PersistedHardwareIdentity | null> {
    const db = await this.getDb()
    const result = await db.get(STORE_NAME, this.storageKey)
    return (result as PersistedHardwareIdentity) ?? null
  }

  async save(identity: PersistedHardwareIdentity): Promise<void> {
    const db = await this.getDb()
    await db.put(STORE_NAME, identity, this.storageKey)
  }

  async clear(): Promise<void> {
    const db = await this.getDb()
    await db.delete(STORE_NAME, this.storageKey)
  }
}
