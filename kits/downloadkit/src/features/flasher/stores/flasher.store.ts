import { defineStore } from "pinia";
import type { DownloadStage } from "@/core/types/download";
import type { StlinkTargetPreferenceV1 } from "@/features/flasher/services/stlinkTargetPreference";
import type { StlinkTargetVariant } from "@/transports/adapters/stlink.adapter";
import type { LogEntry, LogLevel } from "@/features/flasher/types/log";
import type { PluginConfigObject } from "@/plugins/config/pluginConfig.types";
import type { ChipFamily, FlasherType } from "@/plugins/types";

export type DeviceStatus = "idle" | "selecting" | "ready" | "failed";
export type DownloadResult = "idle" | "running" | "success" | "error";
export type RuntimePhase = "idle" | "downloading" | "verifying" | "completed" | "failed";

export const useFlasherStore = defineStore("flasher", {
  state: () => ({
    chipFamily: null as ChipFamily | null,
    flasherType: null as FlasherType | null,
    downloadResult: "idle" as DownloadResult,
    runtimePhase: "idle" as RuntimePhase,
    stage: "idle" as DownloadStage,
    progressPercent: 0,
    bytesWritten: 0,
    bytesTotal: 0,
    bytesPerSecond: 0,
    etaSeconds: null as number | null,
    downloadStats: {
      successCount: 0,
      failedCount: 0,
    },
    logs: [] as LogEntry[],
    activeLogLevels: ["trace", "debug", "info", "warning", "error"] as LogLevel[],
    firmwareReady: false,
    flasherStatus: "idle" as DeviceStatus,
    flasherLabel: null as string | null,
    flasherError: null as string | null,
    flasherCanFlash: true,
    flasherCanSelectConnection: true,
    flasherHint: "",
    targetPickerOpen: false,
    targetCandidates: [] as StlinkTargetVariant[],
    selectedTargetType: null as string | null,
    stlinkTargetSession: null as StlinkTargetPreferenceV1 | null,
    pluginConfigs: {} as Record<string, PluginConfigObject>,
  }),
  getters: {
    canStartDownload: (state) =>
      state.firmwareReady && state.flasherStatus === "ready" && Boolean(state.chipFamily && state.flasherType),
    canExecuteDownload: (state) =>
      state.firmwareReady && state.flasherStatus === "ready" && state.flasherCanFlash,
    filteredLogs: (state) => state.logs.filter((log) => state.activeLogLevels.includes(log.level)),
  },
  actions: {
    setChipFamily(value: ChipFamily | null) {
      this.chipFamily = value;
    },
    setFlasherType(value: FlasherType | null) {
      this.flasherType = value;
    },
    setStage(value: DownloadStage) {
      this.stage = value;
    },
    setDownloadResult(value: DownloadResult) {
      this.downloadResult = value;
    },
    setRuntimePhase(value: RuntimePhase) {
      this.runtimePhase = value;
    },
    resetDownloadResult() {
      this.downloadResult = "idle";
      this.runtimePhase = "idle";
    },
    setProgress(value: number) {
      this.progressPercent = value;
    },
    setProgressDetails(payload: {
      percent: number;
      bytesWritten: number;
      bytesTotal: number;
      bytesPerSecond: number;
      etaSeconds: number | null;
    }) {
      this.progressPercent = payload.percent;
      this.bytesWritten = payload.bytesWritten;
      this.bytesTotal = payload.bytesTotal;
      this.bytesPerSecond = payload.bytesPerSecond;
      this.etaSeconds = payload.etaSeconds;
    },
    setDownloadStats(payload: { successCount: number; failedCount: number }) {
      this.downloadStats = {
        successCount: Math.max(0, payload.successCount),
        failedCount: Math.max(0, payload.failedCount),
      };
    },
    incrementDownloadSuccess() {
      this.downloadStats.successCount += 1;
    },
    incrementDownloadFailed() {
      this.downloadStats.failedCount += 1;
    },
    clearDownloadStats() {
      this.downloadStats = { successCount: 0, failedCount: 0 };
    },
    setFirmwareReady(value: boolean) {
      this.firmwareReady = value;
    },
    setFlasherState(payload: { status: DeviceStatus; label: string | null; error: string | null }) {
      this.flasherStatus = payload.status;
      this.flasherLabel = payload.label;
      this.flasherError = payload.error;
    },
    setFlasherRuntime(payload: { canFlash: boolean; canSelectConnection: boolean; hint: string }) {
      this.flasherCanFlash = payload.canFlash;
      this.flasherCanSelectConnection = payload.canSelectConnection;
      this.flasherHint = payload.hint;
    },
    appendLog(entry: LogEntry) {
      this.logs.push(entry);
    },
    pushLog(message: string) {
      this.appendLog({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
        level: "info",
        message,
      });
    },
    setActiveLogLevels(levels: LogLevel[]) {
      this.activeLogLevels = levels;
    },
    toggleLogLevel(level: LogLevel) {
      if (this.activeLogLevels.includes(level)) {
        this.activeLogLevels = this.activeLogLevels.filter((item) => item !== level);
      } else {
        this.activeLogLevels = [...this.activeLogLevels, level];
      }
    },
    clearLogs() {
      this.logs = [];
    },
    openTargetPicker(candidates: StlinkTargetVariant[]) {
      this.targetCandidates = candidates;
      this.selectedTargetType = null;
      this.targetPickerOpen = true;
    },
    confirmTargetSelection(type: string) {
      this.selectedTargetType = type;
      this.targetPickerOpen = false;
    },
    cancelTargetSelection() {
      this.selectedTargetType = null;
      this.targetPickerOpen = false;
    },
    setStlinkTargetSession(session: StlinkTargetPreferenceV1 | null): void {
      this.stlinkTargetSession = session;
    },
    clearStlinkTargetSession(): void {
      this.stlinkTargetSession = null;
    },

    initPluginConfig(pluginId: string, defaults: PluginConfigObject): void {
      if (!this.pluginConfigs[pluginId]) {
        this.pluginConfigs[pluginId] = { ...defaults };
      }
    },
    setPluginConfig(pluginId: string, config: PluginConfigObject): void {
      this.pluginConfigs[pluginId] = { ...config };
    },
    updatePluginConfigField(pluginId: string, key: string, value: string | number | boolean): void {
      const current = this.pluginConfigs[pluginId] ?? {};
      this.pluginConfigs[pluginId] = { ...current, [key]: value };
    },
    getPluginConfig(pluginId: string): PluginConfigObject | undefined {
      return this.pluginConfigs[pluginId] ? { ...this.pluginConfigs[pluginId] } : undefined;
    },
    reset() {
      this.stage = "idle";
      this.downloadResult = "idle";
      this.runtimePhase = "idle";
      this.progressPercent = 0;
      this.bytesWritten = 0;
      this.bytesTotal = 0;
      this.bytesPerSecond = 0;
      this.etaSeconds = null;
      this.downloadStats = { successCount: 0, failedCount: 0 };
      this.logs = [];
      this.activeLogLevels = ["trace", "debug", "info", "warning", "error"];
      this.firmwareReady = false;
      this.flasherStatus = "idle";
      this.flasherLabel = null;
      this.flasherError = null;
      this.flasherCanFlash = true;
      this.flasherCanSelectConnection = true;
      this.flasherHint = "";
      this.targetPickerOpen = false;
      this.targetCandidates = [];
      this.selectedTargetType = null;
      this.stlinkTargetSession = null;
      this.pluginConfigs = {};
    },
  },
});
