// @ts-check

import { BAUD_RATES, DEFAULT_BAUD_RATE } from "./gnss/constants.js";
import { getState, setState, subscribe } from "./gnss/state.js";
import { createGnssSerial } from "./gnss/serial.js";
import { createGnssNmeaPipeline } from "./gnss/pipeline.js";
import { createGnssUi } from "./gnss/ui.js";
import {
  loadGnssBaudRate,
  loadGnssRightPanelCollapsed,
  loadGnssSidebarWidthPx,
  saveGnssBaudRate,
  saveGnssRightPanelCollapsed,
  saveGnssSidebarWidthPx,
} from "./modules/appStorage.js";

const ui = createGnssUi();
const serial = createGnssSerial();
const nmea = createGnssNmeaPipeline();

function initBaudRateSelect() {
  const select = document.getElementById("gnssBaudRate");
  if (!(select instanceof HTMLSelectElement)) return;

  select.innerHTML = "";
  for (const rate of BAUD_RATES) {
    const opt = document.createElement("option");
    opt.value = String(rate);
    opt.textContent = String(rate);
    select.appendChild(opt);
  }

  const saved = loadGnssBaudRate();
  const initial =
    saved != null && BAUD_RATES.includes(saved) ? saved : DEFAULT_BAUD_RATE;
  select.value = String(initial);
  setState({ baudRate: initial });

  select.addEventListener("change", () => {
    const next = Number(select.value);
    if (!Number.isFinite(next)) return;
    setState({ baudRate: next });
    saveGnssBaudRate(next);
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function initGnssRightPanelLayout() {
  const toggle = document.getElementById("gnssRightPanelToggle");
  const panel = document.getElementById("gnssSidePanel");
  const layout = document.getElementById("gnssAppLayout");

  function syncToggleLabel() {
    const collapsed = panel?.classList.contains("collapsed");
    if (toggle) {
      toggle.textContent = collapsed ? "展开" : "折叠";
      toggle.setAttribute(
        "aria-label",
        collapsed ? "展开右侧面板" : "折叠右侧面板",
      );
    }
    layout?.classList.toggle("log-collapsed", !!collapsed);
  }

  if (panel && loadGnssRightPanelCollapsed()) {
    panel.classList.add("collapsed");
  }

  toggle?.addEventListener("click", () => {
    panel?.classList.toggle("collapsed");
    syncToggleLabel();
    saveGnssRightPanelCollapsed(
      panel?.classList.contains("collapsed") ?? false,
    );
  });

  syncToggleLabel();

  const handle = document.getElementById("gnssRightResizeHandle");
  const MIN = 260;
  const MAX = 720;

  const applyWidth = (widthPx) => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${widthPx}px`,
    );
  };

  const stored = loadGnssSidebarWidthPx();
  if (stored != null) {
    applyWidth(clamp(stored, MIN, MAX));
  }

  let dragging = false;
  const onMove = (e) => {
    if (!dragging || panel?.classList.contains("collapsed")) return;
    const next = clamp(
      Math.round(window.innerWidth - e.clientX),
      MIN,
      MAX,
    );
    applyWidth(next);
    saveGnssSidebarWidthPx(next);
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    handle?.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };

  handle?.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (panel?.classList.contains("collapsed")) return;
    dragging = true;
    handle.classList.add("is-dragging");
    handle.setPointerCapture?.(e.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });
}

function bindActions() {
  const toggleBtn = document.getElementById("gnssTogglePort");
  const clearBtn = document.getElementById("gnssClear");
  const exportBtn = document.getElementById("gnssExport");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", async () => {
      const { status, baudRate } = getState();
      if (status === "connected" || status === "connecting") {
        await serial.close();
        setState({ status: "disconnected", errorMessage: null });
        return;
      }

      setState({ status: "connecting", errorMessage: null });
      const result = await serial.open({ baudRate });
      if (!result.ok) {
        setState({ status: "error", errorMessage: result.errorMessage });
        return;
      }

      setState({ status: "connected", errorMessage: null });
      serial.startReadLoop((chunkText) => {
        nmea.pushChunk(chunkText);
      });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      setState((prev) => ({
        ...prev,
        rawLines: [],
        snapshot: { ...prev.snapshot, updatedAtMs: Date.now() },
      }));
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => ui.exportRaw());
  }
}

function init() {
  initBaudRateSelect();
  initGnssRightPanelLayout();
  bindActions();

  nmea.onUpdate((update) => {
    setState((prev) => ({
      ...prev,
      rawLines: update.rawLines ?? prev.rawLines,
      snapshot: update.snapshot ?? prev.snapshot,
    }));
  });

  subscribe((s) => ui.render(s));
}

window.addEventListener("load", init);
