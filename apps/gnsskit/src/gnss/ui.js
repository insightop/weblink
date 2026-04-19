// @ts-check

import { formatTimeWithMs, formatTimestamp } from "../utils/format.js";
import {
  applyNmeaSignalTierClass,
  createGsvMiniChart,
} from "../modules/gsvMiniChart.js";

/** 与主页面设备卡片诊断面板 `type-icon` 一致（Font Awesome） */
const GNSS_CARD_TYPE_ICONS = {
  GNRMC: "fa-location-arrow",
  GNGGA: "fa-map-pin",
  GNGSA: "fa-bullseye",
  GPGSV: "fa-satellite",
  GBGSV: "fa-satellite-dish",
  GAGSV: "fa-satellite",
  GLGSV: "fa-satellite",
  GNGSV: "fa-satellite",
  GQGSV: "fa-satellite",
};

export function createGnssUi() {
  /** @type {HTMLDivElement | null} */
  const rawLinesEl = document.getElementById("gnssRawLines");
  /** @type {HTMLDivElement | null} */
  const parsedGridEl = document.getElementById("gnssParsedGrid");
  /** @type {HTMLDivElement | null} */
  const rawBoxEl = document.getElementById("gnssRaw");
  /** @type {HTMLElement | null} */
  const parsedContainerEl = document.getElementById("gnssParsedContainer");
  /** @type {HTMLButtonElement | null} */
  const toggleBtn = document.getElementById("gnssTogglePort");
  /** @type {HTMLSpanElement | null} */
  const parsedHintEl = document.getElementById("gnssParsedHint");

  let lastRawCount = 0;
  let lastFirstRawId = null;
  let rawAutoScroll = true;
  let parsedAutoScroll = false;

  /** @type {Map<string, HTMLElement>} */
  const cardByKey = new Map();
  /** @type {Map<string, ReturnType<typeof createGsvMiniChart>>} */
  const gsvChartsByKey = new Map();
  /** @type {HTMLElement | null} */
  let emptyParsedEl = null;

  /** 距底部小于此像素视为「在底部」，跟新日志；往上滚则暂停自动滚动 */
  const RAW_NEAR_BOTTOM_PX = 20;

  if (rawBoxEl) {
    rawBoxEl.addEventListener(
      "scroll",
      () => {
        rawAutoScroll = isNearBottom(rawBoxEl, RAW_NEAR_BOTTOM_PX);
      },
      { passive: true },
    );
  }

  if (parsedContainerEl) {
    parsedContainerEl.addEventListener("scroll", () => {
      parsedAutoScroll = isNearBottom(parsedContainerEl);
    });
  }

  /**
   * @param {import("./state.js").getState extends any ? any : any} s
   */
  function render(s) {
    renderToolbar(s);
    renderRaw(s);
    renderParsed(s);
  }

  /**
   * @param {any} s
   */
  function renderToolbar(s) {
    if (toggleBtn) {
      const isConnected = s.status === "connected";
      toggleBtn.classList.toggle("connected", isConnected);
      toggleBtn.disabled = s.status === "connecting";
      const span = toggleBtn.querySelector("span");
      if (span) {
        span.textContent = isConnected
          ? "断开 GNSS"
          : s.status === "connecting"
            ? "连接中..."
            : "连接 GNSS";
      }
    }

    if (!parsedHintEl) return;
    if (s.status === "error") {
      parsedHintEl.textContent = s.errorMessage
        ? `错误：${s.errorMessage}`
        : "连接错误";
      parsedHintEl.classList.add("gnss-toolbar__hint--error");
      return;
    }
    if (s.status === "connecting") {
      parsedHintEl.textContent = "正在连接…";
      parsedHintEl.classList.remove("gnss-toolbar__hint--error");
      return;
    }
    if (s.status !== "connected") {
      parsedHintEl.textContent = "";
      parsedHintEl.classList.remove("gnss-toolbar__hint--error");
    }
  }

  /**
   * @param {any} s
   */
  function renderRaw(s) {
    if (!rawLinesEl) return;
    const lines = s.rawLines || [];

    const firstId = lines[0]?.id ?? null;
    const droppedHead =
      firstId != null && lastFirstRawId != null && firstId !== lastFirstRawId;

    if (lines.length < lastRawCount || droppedHead) {
      rawLinesEl.innerHTML = "";
      lastRawCount = 0;
    }

    const shouldScroll = rawBoxEl ? rawAutoScroll || lastRawCount === 0 : false;

    const frag = document.createDocumentFragment();
    for (let i = lastRawCount; i < lines.length; i++) {
      const row = document.createElement("div");
      row.className = "gnss-raw__line";
      const ts = document.createElement("span");
      ts.className = "gnss-raw__meta";
      ts.textContent = formatTimeWithMs(new Date(lines[i].tsMs));
      const text = document.createElement("span");
      text.textContent = lines[i].text;
      row.appendChild(ts);
      row.appendChild(text);
      frag.appendChild(row);
    }
    rawLinesEl.appendChild(frag);

    lastRawCount = lines.length;
    lastFirstRawId = firstId;

    if (rawBoxEl && shouldScroll) {
      // 下一帧再滚到底，避免布局/字体未结算时 scrollHeight 偏小
      globalThis.requestAnimationFrame(() => {
        rawBoxEl.scrollTop = rawBoxEl.scrollHeight;
      });
    }
  }

  /**
   * @param {any} s
   */
  function renderParsed(s) {
    if (!parsedGridEl) return;
    const snap = s.snapshot;
    if (parsedHintEl && s.status === "connected") {
      parsedHintEl.textContent = snap?.updatedAtMs
        ? `更新时间：${formatTimestamp(snap.updatedAtMs)}`
        : "";
      parsedHintEl.classList.remove("gnss-toolbar__hint--error");
    }

    /** 先所有 GN* 句型，再非 GN：GPGSV → GBGSV → GAGSV → GLGSV → GQGSV */
    const blocks = /** @type {Array<{key: string, data: any}>} */ ([
      { key: "GNRMC", data: snap?.rmc },
      { key: "GNGGA", data: snap?.gga },
      { key: "GNGSA", data: snap?.gsa },
      { key: "GNGSV", data: snap?.gngsv },
      { key: "GPGSV", data: snap?.gpgsv },
      { key: "GBGSV", data: snap?.gbgsv },
      { key: "GAGSV", data: snap?.gagsv },
      { key: "GLGSV", data: snap?.glgsv },
      { key: "GQGSV", data: snap?.gqgsv },
    ]).filter((b) => b.data);

    const shouldScroll = parsedContainerEl ? parsedAutoScroll : false;

    if (blocks.length === 0) {
      for (const ctrl of gsvChartsByKey.values()) {
        ctrl.destroy();
      }
      gsvChartsByKey.clear();
      // 不要频繁清空/重建，避免闪烁；只在需要时显示空态
      for (const [, el] of cardByKey) {
        el.remove();
      }
      cardByKey.clear();
      if (!emptyParsedEl) {
        emptyParsedEl = document.createElement("div");
        emptyParsedEl.className = "device-card-empty";
        emptyParsedEl.innerHTML = `<i class="fas fa-inbox"></i><span>暂无解析数据</span>`;
        parsedGridEl.appendChild(emptyParsedEl);
      }
      if (shouldScroll && parsedContainerEl) {
        parsedContainerEl.scrollTop = parsedContainerEl.scrollHeight;
      }
      return;
    }

    if (emptyParsedEl) {
      emptyParsedEl.remove();
      emptyParsedEl = null;
    }

    const nextKeys = new Set(blocks.map((b) => b.key));
    for (const [key, el] of cardByKey) {
      if (!nextKeys.has(key)) {
        gsvChartsByKey.get(key)?.destroy();
        gsvChartsByKey.delete(key);
        el.remove();
        cardByKey.delete(key);
      }
    }

    // 按固定顺序增量更新，避免 DOM 闪烁 & 保持滚动位置稳定
    for (const b of blocks) {
      let card = cardByKey.get(b.key);
      if (!card) {
        card = createCardShell(b.key);
        cardByKey.set(b.key, card);
      }
      updateCard(card, b.key, b.data, gsvChartsByKey);
      parsedGridEl.appendChild(card);
    }

    if (shouldScroll && parsedContainerEl) {
      parsedContainerEl.scrollTop = parsedContainerEl.scrollHeight;
    }
  }

  function exportRaw() {
    // 直接从当前 DOM 导出（包含时间戳）
    const rawBox = document.getElementById("gnssRawLines");
    if (!(rawBox instanceof HTMLElement)) return;
    const content =
      Array.from(rawBox.querySelectorAll(".gnss-raw__line"))
        .map((el) => (el.textContent ? el.textContent.trim() : ""))
        .filter(Boolean)
        .join("\n") + "\n";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gnss_raw_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  return { render, exportRaw };
}

/**
 * @param {string} key
 * @param {{ rows: Array<{label: string, value: string, tooltip?: string}>, summary: string }} data
 */
function createCardShell(key) {
  const card = document.createElement("section");
  card.className = "gnss-card";
  const isGsv = key.endsWith("GSV");
  if (isGsv) card.classList.add("gnss-card--gsv");
  card.dataset.key = key;

  const header = document.createElement("div");
  header.className = "gnss-card__header";

  const iconClass = GNSS_CARD_TYPE_ICONS[key] || "fa-circle";
  const iconEl = document.createElement("i");
  iconEl.className = `fas ${iconClass} gnss-card__type-icon`;
  iconEl.setAttribute("aria-hidden", "true");

  const titleEl = document.createElement("span");
  titleEl.className = "gnss-card__title";
  titleEl.textContent = key;

  const summaryEl = document.createElement("span");
  summaryEl.className = "gnss-card__summary";

  if (isGsv) {
    const main = document.createElement("div");
    main.className = "gnss-card__header-main";
    main.appendChild(iconEl);
    main.appendChild(titleEl);
    main.appendChild(summaryEl);
    const aside = document.createElement("div");
    aside.className = "gnss-card__header-aside";
    const chartWrap = document.createElement("div");
    chartWrap.className = "gnss-card__chart";
    chartWrap.setAttribute("aria-hidden", "true");
    const canvas = document.createElement("canvas");
    chartWrap.appendChild(canvas);
    aside.appendChild(chartWrap);
    header.appendChild(main);
    header.appendChild(aside);
  } else {
    header.appendChild(iconEl);
    header.appendChild(titleEl);
    header.appendChild(summaryEl);
  }

  const body = document.createElement("div");
  body.className = "gnss-card__body";

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

/**
 * @param {HTMLElement} card
 * @param {string} key
 * @param {{ rows: Array<{label: string, value: string, tooltip?: string}>, summary: string, signalTier?: 'green'|'blue'|'yellow'|'red'|null, gsv?: { validCount: number, avgSnr: number, tier: string } }} data
 * @param {Map<string, ReturnType<typeof createGsvMiniChart>>} gsvChartsByKey
 */
function updateCard(card, key, data, gsvChartsByKey) {
  const summaryEl = card.querySelector(".gnss-card__summary");
  if (summaryEl) summaryEl.textContent = data.summary || "";

  const iconEl = card.querySelector(".gnss-card__type-icon");
  applyNmeaSignalTierClass(iconEl, data.signalTier ?? null);

  if (key.endsWith("GSV")) {
    const canvas = card.querySelector(".gnss-card__chart canvas");
    const gsv = data.gsv;
    if (gsv && canvas && canvas.tagName === "CANVAS") {
      let ctrl = gsvChartsByKey.get(key);
      if (!ctrl) {
        ctrl = createGsvMiniChart(canvas);
        gsvChartsByKey.set(key, ctrl);
      }
      ctrl.pushSample(Date.now(), gsv.validCount, gsv.avgSnr);
    }
  }

  const body = card.querySelector(".gnss-card__body");
  if (!body) return;

  // 用 DocumentFragment 批量替换 body 内容，避免多次 reflow
  const frag = document.createDocumentFragment();
  for (const row of data.rows || []) {
    const r = document.createElement("div");
    r.className = "gnss-row";
    const l = document.createElement("span");
    l.className = row.tooltip
      ? "gnss-row__label gnss-row__label--tip"
      : "gnss-row__label";
    l.textContent = row.label;
    if (row.tooltip) l.dataset.tooltip = row.tooltip;
    const v = document.createElement("span");
    v.className = "gnss-row__value";
    v.textContent = row.value;
    r.appendChild(l);
    r.appendChild(v);
    frag.appendChild(r);
  }
  body.replaceChildren(frag);
}

/**
 * @param {HTMLElement} el
 * @param {number} [thresholdPx=16]
 */
function isNearBottom(el, thresholdPx = 16) {
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  return gap <= thresholdPx;
}
