// @ts-check

import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

/** 历史窗口 60s */
export const GSV_CHART_WINDOW_MS = 60_000;

/** 避免 NMEA 过密时堆点 */
const PUSH_THROTTLE_MS = 200;

const TIER_SUFFIXES = ["green", "blue", "yellow", "red"];

const LEGACY_TIER_PREFIX = "gsv-tier--";
const NMEA_TIER_PREFIX = "nmea-signal-tier--";

function hexToRgbTuple(hex) {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function readCssColorVar(name, fallbackRgb) {
  if (typeof document === "undefined") return fallbackRgb;
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!raw) return fallbackRgb;
    if (raw.startsWith("#")) {
      const t = hexToRgbTuple(raw);
      if (t) return `rgb(${t[0]},${t[1]},${t[2]})`;
    }
    return raw;
  } catch {
    return fallbackRgb;
  }
}

/**
 * @param {HTMLElement | null} el
 * @param {'green'|'blue'|'yellow'|'red'|null|undefined} tier
 */
export function applyNmeaSignalTierClass(el, tier) {
  if (!el) return;
  for (const suf of TIER_SUFFIXES) {
    el.classList.remove(`${NMEA_TIER_PREFIX}${suf}`);
    el.classList.remove(`${LEGACY_TIER_PREFIX}${suf}`);
  }
  if (tier === "green" || tier === "blue" || tier === "yellow" || tier === "red") {
    el.classList.add(`${NMEA_TIER_PREFIX}${tier}`);
  }
}

/** @deprecated 使用 applyNmeaSignalTierClass */
export function applyGsvSignalTierClass(el, tier) {
  applyNmeaSignalTierClass(el, tier);
}

/**
 * 单条纵轴：按该系列数据单独撑满纵向区间（与另一 Y 轴刻度无关）
 * @param {Array<{ y?: number | null }>} points
 * @param {{ floorZero?: boolean, fallback: { min: number, max: number } }} opts
 */
function computeYBounds(points, opts) {
  const nums = points
    .map((p) => p.y)
    .filter((v) => v != null && typeof v === "number" && Number.isFinite(v));
  const floorZero = opts.floorZero ?? false;
  const fb = opts.fallback;
  if (nums.length === 0) return { ...fb };
  let mn = Math.min(...nums);
  let mx = Math.max(...nums);
  if (mn === mx) {
    if (floorZero && mn >= 0) {
      return { min: 0, max: Math.max(1, mn + 1) };
    }
    return { min: mn - 1, max: mx + 1 };
  }
  const span = mx - mn;
  const pad = Math.max(span * 0.12, 0.5);
  let min = mn - pad;
  let max = mx + pad;
  if (floorZero && mn >= 0 && min < 0) min = 0;
  return { min, max };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {{ pushSample: (t: number, validCount: number, avgSnr: number|null) => void, destroy: () => void }}
 */
export function createGsvMiniChart(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      pushSample: () => {},
      destroy: () => {},
    };
  }

  const colorA = readCssColorVar("--chart-gsv-series-a", "rgb(13,148,136)");
  const colorB = readCssColorVar("--chart-gsv-series-b", "rgb(217,119,6)");

  /** @type {number} */
  let lastThrottleAt = 0;

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "有效星",
          borderColor: colorA,
          backgroundColor: "transparent",
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 1,
          yAxisID: "y",
          data: /** @type {Array<{x:number,y:number}>} */ ([]),
        },
        {
          label: "均C/N0",
          borderColor: colorB,
          backgroundColor: "transparent",
          fill: false,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 0,
          borderWidth: 1,
          yAxisID: "y1",
          spanGaps: true,
          data: /** @type {Array<{x:number,y:number|null}>} */ ([]),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      parsing: false,
      interaction: { mode: "nearest", intersect: false },
      layout: {
        padding: { left: 0, right: 0, top: 0, bottom: 0 },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          type: "linear",
          bounds: "data",
          min: Date.now() - GSV_CHART_WINDOW_MS,
          max: Date.now(),
          display: false,
        },
        y: {
          type: "linear",
          position: "left",
          display: false,
          min: 0,
          max: 1,
        },
        y1: {
          type: "linear",
          position: "right",
          display: false,
          min: 0,
          max: 1,
        },
      },
    },
  });

  const parent = canvas.parentElement;
  /** @type {{ disconnect: () => void } | null} */
  let ro = null;
  const RO =
    typeof globalThis !== "undefined" ? globalThis.ResizeObserver : undefined;
  if (parent && typeof RO === "function") {
    ro = new RO(() => {
      try {
        chart.resize();
      } catch (e) {
        console.warn("[gsvMiniChart] resize failed", e);
      }
    });
    try {
      ro.observe(parent);
    } catch (e) {
      console.warn("[gsvMiniChart] ResizeObserver observe failed", e);
    }
  }

  /**
   * @param {number} t
   * @param {number} validCount
   * @param {number|null} avgSnr
   */
  function pushSample(t, validCount, avgSnr) {
    const ds0 = chart.data.datasets[0].data;
    const ds1 = chart.data.datasets[1].data;
    const minX = t - GSV_CHART_WINDOW_MS;

    const mergeLast = t - lastThrottleAt < PUSH_THROTTLE_MS && ds0.length > 0;
    if (mergeLast) {
      const i0 = ds0.length - 1;
      const i1 = ds1.length - 1;
      ds0[i0] = { x: t, y: validCount };
      ds1[i1] = { x: t, y: avgSnr == null ? null : avgSnr };
    } else {
      ds0.push({ x: t, y: validCount });
      ds1.push({ x: t, y: avgSnr == null ? null : avgSnr });
      lastThrottleAt = t;
    }

    chart.data.datasets[0].data = ds0.filter((p) => p.x >= minX);
    chart.data.datasets[1].data = ds1.filter((p) => p.x >= minX);

    const xScale = chart.options.scales?.x;
    if (xScale && "min" in xScale && "max" in xScale) {
      xScale.min = minX;
      xScale.max = t;
    }

    const d0 = chart.data.datasets[0].data;
    const d1 = chart.data.datasets[1].data;
    const b0 = computeYBounds(d0, {
      floorZero: true,
      fallback: { min: 0, max: 1 },
    });
    const b1 = computeYBounds(d1, {
      floorZero: true,
      fallback: { min: 0, max: 45 },
    });

    const yScale = chart.options.scales?.y;
    const y1Scale = chart.options.scales?.y1;
    if (yScale && "min" in yScale && "max" in yScale) {
      yScale.min = b0.min;
      yScale.max = b0.max;
    }
    if (y1Scale && "min" in y1Scale && "max" in y1Scale) {
      y1Scale.min = b1.min;
      y1Scale.max = b1.max;
    }

    chart.update("none");
  }

  function destroy() {
    if (ro) {
      try {
        ro.disconnect();
      } catch {
        /* ignore */
      }
      ro = null;
    }
    chart.destroy();
  }

  return { pushSample, destroy };
}
