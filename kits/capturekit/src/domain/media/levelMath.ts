/**
 * 时域数据 RMS → 0..1，带简单平滑。
 */
export function rmsFromTimeDomain(data: Float32Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
}

/** 将 RMS 映射到可视电平（经验系数，可按听感微调） */
export function rmsToLevel(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-7));
  const minDb = -60;
  const maxDb = -10;
  const t = (db - minDb) / (maxDb - minDb);
  return Math.max(0, Math.min(1, t));
}

export function smoothLevel(prev: number, next: number, alpha = 0.35): number {
  return prev * (1 - alpha) + next * alpha;
}
