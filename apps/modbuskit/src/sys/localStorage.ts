const KEY = (bucket: 'iregs'|'hregs'|'coils'|'dinputs') => `modbus:names:${bucket}`;

export function saveMap(bucket: string, map: Map<number,string>) {
  const arr: [number, string][] = [...map.entries()];
  localStorage.setItem(KEY(bucket as any), JSON.stringify(arr));
}

export function loadMap(bucket: string): Map<number,string> {
  const raw = localStorage.getItem(KEY(bucket as any));
  return raw ? new Map<number,string>(JSON.parse(raw)) : new Map();
}

// Ask browser to persist storage (best-effort)
export async function requestPersistence() {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    try { await navigator.storage.persist(); } catch (e) {
      console.warn("Failed to request storage persistence:", e);
    }
  }
}