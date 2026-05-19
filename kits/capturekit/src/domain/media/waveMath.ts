/** 缓冲区最大绝对值，用于波形纵向缩放（避免除零） */
export function maxAbs(samples: Float32Array): number {
  let m = 1e-9;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i] ?? 0);
    if (v > m) m = v;
  }
  return m;
}

/**
 * 将时域样本映射到画布 y（像素），中线为 height/2，峰值贴合上下边距 pad。
 */
export function sampleToWaveformY(
  sample: number,
  peak: number,
  height: number,
  pad: number,
): number {
  const mid = height / 2;
  const denom = Math.max(peak, 1e-9);
  const norm = Math.max(-1, Math.min(1, sample / denom));
  const amp = height / 2 - pad;
  return mid - norm * amp;
}
