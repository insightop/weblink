import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useFlasherStore } from "@/features/flasher/stores/flasher.store";
import { createStlinkTargetSession } from "@/features/flasher/services/stlinkTargetPreference";
import type { StlinkTargetVariant } from "@/transports/adapters/stlink.adapter";

describe("flasher.store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("updates mode and chip family", () => {
    const store = useFlasherStore();
    expect(store.chipFamily).toBeNull();
    expect(store.flasherType).toBeNull();
    store.setChipFamily("esp32");
    store.setFlasherType("serial");
    expect(store.chipFamily).toBe("esp32");
    expect(store.flasherType).toBe("serial");
  });

  it("resets stage and logs", () => {
    const store = useFlasherStore();
    store.setStage("flashing");
    store.setProgress(50);
    store.pushLog("x");
    const variants: StlinkTargetVariant[] = [{ type: "X", freq: 1, flash_size: 1, sram_size: 1 }];
    store.setStlinkTargetSession(createStlinkTargetSession(variants, "X"));
    store.reset();
    expect(store.stage).toBe("idle");
    expect(store.progressPercent).toBe(0);
    expect(store.logs.length).toBe(0);
    expect(store.stlinkTargetSession).toBeNull();
  });

  it("clears ST-Link target session", () => {
    const store = useFlasherStore();
    const variants: StlinkTargetVariant[] = [{ type: "X", freq: 1, flash_size: 1, sram_size: 1 }];
    store.setStlinkTargetSession(createStlinkTargetSession(variants, "X"));
    expect(store.stlinkTargetSession).not.toBeNull();
    store.clearStlinkTargetSession();
    expect(store.stlinkTargetSession).toBeNull();
  });

  it("computes canStartFlash from firmware/device state", () => {
    const store = useFlasherStore();
    store.setChipFamily("stm32");
    store.setFlasherType("serial");
    store.setFirmwareReady(false);
    store.setFlasherState({ status: "idle", label: null, error: null });
    store.setFlasherRuntime({ canFlash: true, canSelectConnection: true, hint: "" });
    expect(store.canStartDownload).toBe(false);

    store.setFirmwareReady(true);
    store.setFlasherState({ status: "ready", label: "COM3", error: null });
    expect(store.canStartDownload).toBe(true);
  });

  it("allows button trigger but blocks execute when mode cannot flash", () => {
    const store = useFlasherStore();
    store.setChipFamily("stm32");
    store.setFlasherType("usb-dfu");
    store.setFirmwareReady(true);
    store.setFlasherState({ status: "ready", label: "STM32 DFU", error: null });
    store.setFlasherRuntime({ canFlash: false, canSelectConnection: true, hint: "暂未实现" });
    expect(store.canStartDownload).toBe(true);
    expect(store.canExecuteDownload).toBe(false);
  });

  it("stores structured logs and filters by level", () => {
    const store = useFlasherStore();
    store.appendLog({
      id: "1",
      timestamp: "2026-01-01T00:00:00.000Z",
      level: "info",
      message: "Connected",
    });
    store.appendLog({
      id: "2",
      timestamp: "2026-01-01T00:00:01.000Z",
      level: "error",
      message: "Failed",
    });

    expect(store.logs.length).toBe(2);
    expect(store.filteredLogs.length).toBe(2);

    store.setActiveLogLevels(["error"]);
    expect(store.filteredLogs.length).toBe(1);
    expect(store.filteredLogs[0].level).toBe("error");
  });

  it("clears structured logs", () => {
    const store = useFlasherStore();
    store.appendLog({
      id: "1",
      timestamp: "2026-01-01T00:00:00.000Z",
      level: "debug",
      message: "Debug info",
    });
    expect(store.logs.length).toBe(1);
    store.clearLogs();
    expect(store.logs.length).toBe(0);
  });

  it("tracks smart download result state", () => {
    const store = useFlasherStore();
    expect(store.downloadResult).toBe("idle");
    store.setDownloadResult("running");
    expect(store.downloadResult).toBe("running");
    store.setDownloadResult("success");
    expect(store.downloadResult).toBe("success");
    store.resetDownloadResult();
    expect(store.downloadResult).toBe("idle");
  });

  it("tracks and clears download stats", () => {
    const store = useFlasherStore();
    expect(store.downloadStats.successCount).toBe(0);
    expect(store.downloadStats.failedCount).toBe(0);
    store.incrementDownloadSuccess();
    store.incrementDownloadFailed();
    store.incrementDownloadFailed();
    expect(store.downloadStats.successCount).toBe(1);
    expect(store.downloadStats.failedCount).toBe(2);
    store.clearDownloadStats();
    expect(store.downloadStats.successCount).toBe(0);
    expect(store.downloadStats.failedCount).toBe(0);
  });
});
