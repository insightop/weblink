export interface JedecId {
  readonly manufacturerId: number;
  readonly deviceIdHigh: number;
  readonly deviceIdLow: number;
}

export function parseJedecId(bytes: Uint8Array): JedecId {
  if (bytes.length < 3) {
    throw new Error("JEDEC ID expects at least 3 bytes");
  }
  return {
    manufacturerId: bytes[0] ?? 0,
    deviceIdHigh: bytes[1] ?? 0,
    deviceIdLow: bytes[2] ?? 0,
  };
}

export function formatJedecId(id: JedecId): string {
  const m = id.manufacturerId.toString(16).padStart(2, "0");
  const h = id.deviceIdHigh.toString(16).padStart(2, "0");
  const l = id.deviceIdLow.toString(16).padStart(2, "0");
  return `${m} ${h} ${l}`.toUpperCase();
}
