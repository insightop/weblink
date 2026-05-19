// Keep this file framework-agnostic; App.svelte owns state & persistence.

import type { WebSerialOptions } from "modbus-webserial";
import { WriteQuerySchema, type ReadFunction, type ReadQuery, type WriteFunction, type WriteQuery } from "./panels";
import * as z from "zod/v4-mini";

// -------------------------------------------------
// Type utilities
// -------------------------------------------------
type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? ((<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false)
    : false;

export type TAG = string;

// -------------------------------------------------
// Nametable stuff
// -------------------------------------------------
export type NameTableCategory = "iregs" | "hregs" | "coils" | "dinputs";

/* NameBucketMap */
export type NameBucketMap = {
  iregs: Map<number, string>;
  hregs: Map<number, string>;
  coils: Map<number, string>;
  dinputs: Map<number, string>;
};
export const NameBucketMapSchema: z.ZodMiniType<NameBucketMap> = z.object({
  iregs: z.map(z.number(), z.string()),
  hregs: z.map(z.number(), z.string()),
  coils: z.map(z.number(), z.string()),
  dinputs: z.map(z.number(), z.string()),
});
type _NameBucketMapExact = Expect<Equal<z.infer<typeof NameBucketMapSchema>, NameBucketMap>>;

/* Serializable NameBucketMap */
export type SerializableNameBucketMap = {
  iregs: [number, string][];
  hregs: [number, string][];
  coils: [number, string][];
  dinputs: [number, string][];
};
export const SerializableNameBucketMapSchema: z.ZodMiniType<SerializableNameBucketMap> = z.object({
  iregs: z.array(z.tuple([z.number(), z.string()])),
  hregs: z.array(z.tuple([z.number(), z.string()])),
  coils: z.array(z.tuple([z.number(), z.string()])),
  dinputs: z.array(z.tuple([z.number(), z.string()])),
});
type _SerializableNameBucketMapExact = Expect<Equal<z.infer<typeof SerializableNameBucketMapSchema>, SerializableNameBucketMap>>;

/* Helper maps and functions */
export const nameTableCategoryFromFunctionType: Record<WriteFunction | ReadFunction, NameTableCategory> = {
  read_input_registers: "iregs",
  read_holding_registers: "hregs",
  read_coils: "coils",
  read_discrete_inputs: "dinputs",
  write_registers: "hregs",
  write_coils: "coils",
};

export const resolveAddressName = (query: WriteQuery | ReadQuery, nts: NameTableSet): string | null => {
  const NameTableCategory = nameTableCategoryFromFunctionType[query.type];
  const name = nts.names[NameTableCategory].get(query.address);
  return name ?? null;
};

/* NameTableSet */
export type NameTableSet = {
  updatedAt: number;
  names: NameBucketMap;
};
export const NameTableSetSchema: z.ZodMiniType<NameTableSet> = z.object({
  updatedAt: z.number(),
  names: NameBucketMapSchema,
});
type _NameTableSetExact = Expect<Equal<z.infer<typeof NameTableSetSchema>, NameTableSet>>;

/* Serializable NameTableSet */
export type SerializableNameTableSet = {
  updatedAt: number;
  names: SerializableNameBucketMap;
};
export const SerializableNameTableSetSchema: z.ZodMiniType<SerializableNameTableSet> = z.object({
  updatedAt: z.number(),
  names: SerializableNameBucketMapSchema,
});
type _SerializableNameTableSetExact = Expect<Equal<z.infer<typeof SerializableNameTableSetSchema>, SerializableNameTableSet>>;

// -------------------------------------------------
// Connection
// -------------------------------------------------

export type ConnectionSettings = {
  deviceId: number;
  options: WebSerialOptions;
};
export const ConnectionSettingsSchema: z.ZodMiniType<ConnectionSettings> = z.object({
  deviceId: z.number(),
  options: z.object({
    baudRate: z.number(),
    dataBits: z.number().check(z.int()),
    parity: z.enum(["none", "even", "odd"]),
    stopBits: z.number().check(z.int()),
  }) as z.ZodMiniType<WebSerialOptions>,
});
type _ConnectionSettingsExact = Expect<Equal<z.infer<typeof ConnectionSettingsSchema>, ConnectionSettings>>;

// -------------------------------------------------
// Panel layout (future)
// -------------------------------------------------

export type PanelKind = "read_coils" | "read_holding_registers" | "write_registers" | "write_coils";

export type PanelLayoutItem = any; // matches z.any() below
export const PanelLayoutItemSchema:z.ZodMiniType<PanelLayoutItem> = z.object({
  unknown: z.any(), // Placeholder for future layout
});
type _PanelLayoutItemExact = Expect<Equal<z.infer<typeof PanelLayoutItemSchema>, PanelLayoutItem>>;

// -------------------------------------------------
// Configuration / profile
// -------------------------------------------------

export type Configuration = {
  nameTableSetId: TAG | null;
  layout?: PanelLayoutItem[];
  connectionSettings: ConnectionSettings;
  writeShortcuts: Record<string, WriteQuery>;
  updatedAt: number;
};
export const ConfigurationSchema: z.ZodMiniType<Configuration> = z.object({
  nameTableSetId: z.nullable(z.string()),
  layout: z.optional(z.array(PanelLayoutItemSchema)), // Placeholder for future layout
  connectionSettings: ConnectionSettingsSchema,
  writeShortcuts: z.record(z.string(), WriteQuerySchema),
  updatedAt: z.number(),
});
type _ConfigurationExact = Expect<Equal<z.infer<typeof ConfigurationSchema>, Configuration>>;
/* defaults */
export const defaultConfiguration: Configuration = {
  nameTableSetId: null,
  layout: [],
  connectionSettings: {
    deviceId: 1,
    options: {
      // Default 8N1
      baudRate: 9600,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
    },
  },
  writeShortcuts: {},
  updatedAt: Date.now(),
};

export const SCRATCH_ID: TAG = "__scratch__";

// -------------------------------------------------
// Library
// -------------------------------------------------
export type Library = {
  nameTables: Record<string, NameTableSet>;
  profiles: Record<string, Configuration>;
  activeProfileTag: string | null;
};
export const LibrarySchema:z.ZodMiniType<Library> = z.object({
  nameTables: z.record(z.string(), NameTableSetSchema),
  profiles: z.record(z.string(), ConfigurationSchema),
  activeProfileTag: z.nullable(z.string()),
});
type _LibraryExact = Expect<Equal<z.infer<typeof LibrarySchema>, Library>>;

/* Serializable Library */
export type SerializableLibrary = {
  nameTables: Record<string, SerializableNameTableSet>;
  profiles: Record<string, Configuration>;
  activeProfileTag: string | null;
};
export const SerializableLibrarySchema: z.ZodMiniType<SerializableLibrary> = z.object({
  nameTables: z.record(z.string(), SerializableNameTableSetSchema),
  profiles: z.record(z.string(), ConfigurationSchema),
  activeProfileTag: z.nullable(z.string()),
});
type _SerializableLibraryExact = Expect<Equal<z.infer<typeof SerializableLibrarySchema>, SerializableLibrary>>;

// Example library template
export const libraryTemplate: SerializableLibrary = {
  nameTables: {
    EXAMPLE_NAME_TABLE: {
      updatedAt: Date.now(),
      names: {
        iregs: [[0, "First IReg"], [1, "Second IReg"]],
        hregs: [[0, "First HReg"], [1, "Second HReg"]],
        coils: [[0, "First Coil"], [1, "Second Coil"]],
        dinputs: [[0, "First DInput"], [1, "Second DInput"]],
      },
    }
  },
  profiles: {
    EXAMPLE_PROFILE: defaultConfiguration
  },
  activeProfileTag: "EXAMPLE_PROFILE"
};

// -------------------------------------------------
// Constructors
// -------------------------------------------------
export function createEmptyNameTableSet(): NameTableSet {
  return {
    updatedAt: Date.now(),
    names: {
      iregs: new Map<number, string>(),
      hregs: new Map<number, string>(),
      coils: new Map<number, string>(),
      dinputs: new Map<number, string>(),
    },
  };
}

export function createEmptyLibrary(): Library {
  return {
    nameTables: {},
    profiles: {},
    activeProfileTag: null,
  };
}

// -------------------------------------------------
// Pure updaters
// -------------------------------------------------
export function upsertNameTableSet(lib: Library, tag: TAG, nts: NameTableSet): Library {
  return {
    ...lib,
    nameTables: { ...lib.nameTables, [tag]: { ...nts, updatedAt: Date.now() } },
  };
}

export function deleteNameTableSet(lib: Library, tag: TAG): Library {
  if (!lib.nameTables[tag]) {
    // ensure it exists
    return lib;
  }
  const next = { ...lib };
  delete next.nameTables[tag];
  return next;
}

export function upsertProfile(lib: Library, tag: TAG, cfg: Configuration): Library {
  return {
    ...lib,
    profiles: { ...lib.profiles, [tag]: { ...cfg, updatedAt: Date.now() } },
  };
}

export function deleteProfile(lib: Library, tag: TAG): Library {
  if (!lib.profiles[tag]) {
    // ensure it exists
    return lib;
  }
  const next = { ...lib };
  delete next.profiles[tag];
  return next;
}

export function setActiveProfile(lib: Library, tag: TAG | null): Library {
  return { ...lib, activeProfileTag: tag ?? null };
}

// -------------------------------------------------
// Serialization helpers (Map <-> JSON)
// -------------------------------------------------
export function toSerializableNameBucketMap(map: NameBucketMap): { [K in keyof NameBucketMap]: [number, string][] } {
  return {
    iregs: Array.from(map.iregs.entries()),
    hregs: Array.from(map.hregs.entries()),
    coils: Array.from(map.coils.entries()),
    dinputs: Array.from(map.dinputs.entries()),
  };
}

export function fromSerializableNameBucketMap(_obj: {
  [K in keyof NameBucketMap]: [number, string][];
}): NameBucketMap {
  const obj = structuredClone(_obj); // Ensure we don't mutate the original
  return {
    iregs: new Map<number, string>(obj.iregs),
    hregs: new Map<number, string>(obj.hregs),
    coils: new Map<number, string>(obj.coils),
    dinputs: new Map<number, string>(obj.dinputs),
  };
}

export function toSerializable(lib: Library): SerializableLibrary {
  const nameTables: Record<TAG, SerializableNameTableSet> = {};
  for (const [id, t] of Object.entries(lib.nameTables)) {
    nameTables[id] = {
      updatedAt: t.updatedAt,
      names: toSerializableNameBucketMap(t.names),
    };
  }
  return {
    nameTables,
    profiles: lib.profiles,
    activeProfileTag: lib.activeProfileTag ?? null,
  };
}

export function fromSerializable(_obj: SerializableLibrary): Library {
  const obj = structuredClone(_obj); // Ensure we don't mutate the original
  const nameTables: Record<TAG, NameTableSet> = {};
  for (const [tag, t] of Object.entries(obj.nameTables)) {
    nameTables[tag] = {
      updatedAt: t.updatedAt,
      names: fromSerializableNameBucketMap(t.names),
    };
  }
  return {
    nameTables,
    profiles: obj.profiles,
    activeProfileTag: obj.activeProfileTag ?? null,
  };
}

// -------------------------------------------------
// LocalStorage helpers
// -------------------------------------------------
export const STORAGE_VERSION = "v1";
const STORAGE_KEY = "modbus:library:" + STORAGE_VERSION;

export function saveLibrary(lib: Library) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSerializable(lib)));
  } catch {
    console.warn("Failed to save library to localStorage, it may be full or unavailable.");
    // TODO: handle more gracefully
  }
}

export function loadRawLibrary(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null; // Return null if nothing is stored
    return raw;
  } catch {
    console.warn("Failed to load library from localStorage, returning empty JSON.");
    return null; // Return null on error
  }
}

export function loadLibrary(): Library {
  try {
    const raw = loadRawLibrary();
    if (!raw) return createEmptyLibrary();
    return fromSerializable(JSON.parse(raw));
  } catch {
    console.log("Failed to load library from localStorage, returning empty library.");
    return createEmptyLibrary();
  }
}
