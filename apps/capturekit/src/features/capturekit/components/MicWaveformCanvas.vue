<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { maxAbs, sampleToWaveformY } from "@/domain/media/waveMath";

const props = defineProps<{
  running: boolean;
  /** useMicLevelMeter.waveformData，模板传入时自动解包为当前缓冲或 null */
  samples: Float32Array | null;
}>();

const rootRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
let rafId = 0;
let ro: ResizeObserver | null = null;

function cssVar(name: string, el: HTMLElement, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function resizeCanvas(): void {
  const canvas = canvasRef.value;
  const root = rootRef.value;
  if (!canvas || !root) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = root.clientWidth;
  const h = root.clientHeight;
  if (w <= 0 || h <= 0) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function drawFrame(): void {
  const canvas = canvasRef.value;
  const root = rootRef.value;
  if (!canvas || !root) {
    rafId = requestAnimationFrame(tick);
    return;
  }
  const ctx = canvas.getContext("2d");
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!ctx || w <= 0 || h <= 0) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  const pad = 4;
  const bg = cssVar("--color-bg", root, "#0d1117");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const samples = props.samples;
  if (!props.running || !samples || samples.length === 0) {
    ctx.strokeStyle = "rgba(127, 127, 127, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, h / 2);
    ctx.lineTo(w - pad, h / 2);
    ctx.stroke();
    rafId = requestAnimationFrame(tick);
    return;
  }

  const peak = maxAbs(samples);
  const accent = cssVar("--color-accent", root, "#58a6ff");
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const n = samples.length;
  /** 长窗口时样本数多，按画布宽度下采样绘制，避免每帧上万次 lineTo */
  const plotW = w - pad * 2;
  const maxPoints = Math.min(n, Math.max(320, Math.ceil(plotW * 2)));
  const count = Math.max(2, maxPoints);
  const step = plotW / (count - 1);
  for (let j = 0; j < count; j++) {
    const i = Math.min(n - 1, Math.round((j * (n - 1)) / (count - 1)));
    const x = pad + j * step;
    const y = sampleToWaveformY(samples[i] ?? 0, peak, h, pad);
    if (j === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  rafId = requestAnimationFrame(tick);
}

function tick(): void {
  drawFrame();
}

onMounted(() => {
  resizeCanvas();
  ro = new ResizeObserver(() => {
    resizeCanvas();
  });
  if (rootRef.value) ro.observe(rootRef.value);
  rafId = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId);
  ro?.disconnect();
  ro = null;
});
</script>

<template>
  <div ref="rootRef" class="waveform" role="img" aria-label="麦克风波形">
    <canvas ref="canvasRef" class="waveform__canvas" />
  </div>
</template>

<style scoped>
.waveform {
  width: 100%;
  min-height: 120px;
  flex: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}
.waveform__canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 120px;
}
</style>
