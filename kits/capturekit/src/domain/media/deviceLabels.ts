/** 在 label 为空时展示占位（授权前常见） */
export function formatDeviceLabel(d: MediaDeviceInfo, _index: number): string {
  if (d.label?.trim()) return d.label.trim();
  return `${d.kind} (${d.deviceId.slice(0, 8)}…)`;
}
