export interface FetchedFirmware {
  name: string;
  blob: Blob;
  size: number;
}

function deriveFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : "firmware.bin";
  } catch {
    return "firmware.bin";
  }
}

/** 从 URL 拉取固件二进制。纯函数，无 Vue 依赖。 */
export async function fetchFirmware(
  url: string,
  signal?: AbortSignal,
): Promise<FetchedFirmware> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText || "Failed to fetch firmware"}`);
  }

  const blob = await response.blob();
  return {
    name: deriveFileName(url),
    blob,
    size: blob.size,
  };
}
