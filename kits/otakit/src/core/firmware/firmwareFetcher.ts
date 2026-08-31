export async function fetchFirmwareFromUrl(
  url: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`固件下载失败 (HTTP ${response.status})`);
  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  if (!response.body || total === 0) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
    received += value.length;
    if (total > 0) onProgress?.(Math.round((received / total) * 100));
  }
  return result;
}

export async function readFirmwareFile(file: File): Promise<string> {
  return file.text();
}
