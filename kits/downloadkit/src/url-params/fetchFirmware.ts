export interface FetchedFirmware {
  name: string;
  blob: Blob;
  size: number;
}

function deriveFileName(url: string, headers?: Headers): string {
  // 1. Try Content-Disposition header
  if (headers) {
    const disposition = headers.get("content-disposition");
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"'\s;]+)["']?/i);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
  }

  // 2. Try fileName query parameter
  try {
    const fileNameParam = new URL(url).searchParams.get("fileName");
    if (fileNameParam) return fileNameParam;
  } catch {
    // ignore
  }

  // 3. Fall back to URL pathname
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
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
    name: deriveFileName(url, response.headers),
    blob,
    size: blob.size,
  };
}
