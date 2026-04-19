import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  FLASHER_PERSISTENCE_DB,
  FLASHER_PERSISTENCE_KEY,
  FLASHER_PERSISTENCE_STORE,
  PERSISTENCE_SCHEMA_VERSION,
} from "@/features/flasher/persistence/keys";
import type { PersistedFlasherSession } from "@/features/flasher/persistence/schema";
import type { PersistedFlasherSessionV2 } from "@/features/flasher/persistence/schema";

interface FlasherPersistenceDbSchema extends DBSchema {
  [FLASHER_PERSISTENCE_STORE]: {
    key: string;
    value: PersistedFlasherSession;
  };
}

export interface IFlasherPersistenceRepository {
  loadLastSession(): Promise<PersistedFlasherSession | null>;
  saveLastSession(session: PersistedFlasherSession): Promise<void>;
  clearLastSession(): Promise<void>;
}

export class FlasherPersistenceRepository implements IFlasherPersistenceRepository {
  private dbPromise: Promise<IDBPDatabase<FlasherPersistenceDbSchema>>;

  constructor() {
    this.dbPromise = openDB<FlasherPersistenceDbSchema>(FLASHER_PERSISTENCE_DB, PERSISTENCE_SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FLASHER_PERSISTENCE_STORE)) {
          db.createObjectStore(FLASHER_PERSISTENCE_STORE);
        }
      },
    });
  }

  private normalizeSession(session: PersistedFlasherSession | null): PersistedFlasherSessionV2 | null {
    if (!session) return null;
    if (session.version === 2) {
      return {
        ...session,
        downloadStats: {
          successCount: Math.max(0, session.downloadStats?.successCount ?? 0),
          failedCount: Math.max(0, session.downloadStats?.failedCount ?? 0),
        },
      };
    }
    return {
      version: 2,
      chipFamily: session.chipFamily,
      flasherType: session.flasherType,
      pluginConfigs: session.pluginConfigs ?? {},
      firmwareRows: session.firmwareRows ?? [],
      downloadStats: { successCount: 0, failedCount: 0 },
    };
  }

  async loadLastSession(): Promise<PersistedFlasherSession | null> {
    const db = await this.dbPromise;
    const session = (await db.get(FLASHER_PERSISTENCE_STORE, FLASHER_PERSISTENCE_KEY)) ?? null;
    return this.normalizeSession(session);
  }

  async saveLastSession(session: PersistedFlasherSession): Promise<void> {
    const db = await this.dbPromise;
    await db.put(FLASHER_PERSISTENCE_STORE, session, FLASHER_PERSISTENCE_KEY);
  }

  async clearLastSession(): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(FLASHER_PERSISTENCE_STORE, FLASHER_PERSISTENCE_KEY);
  }
}

export const flasherPersistenceRepository = new FlasherPersistenceRepository();
