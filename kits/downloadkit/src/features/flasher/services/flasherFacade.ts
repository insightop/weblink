import { DownloadSession } from "../../../core/session/DownloadSession";
import { isUserCancelledError } from "../../../core/errors/ErrorCode";
import { detectBrowserCapabilities, getBrowserSupportHint } from "../../../plugins/capabilities";
import { globalPluginRegistry } from "../../../plugins/registry";
import type { ChipFamily, FlasherPlugin, FlasherType, PluginResolveCriteria, PluginRuntimeDeps } from "../../../plugins/types";
import type { FlasherProtocol } from "../../../protocols/types";
import { normalizeConfigBySchema } from "../../../plugins/config/pluginConfig.validators";
import type { PluginConfigObject } from "../../../plugins/config/pluginConfig.types";
import type { Transport } from "../../../transports/types";
import { useFlasherStore } from "../stores/flasher.store";
import { flasherLogger } from "./flasherLogger";
import { i18n } from "../../../i18n";
import { formatBytes, formatSpeed } from "../../../shared/format/formatBytes";
import { HardwareSession } from "../../../transports/HardwareSession";
import { DeviceIdentityStore } from "../../../transports/DeviceIdentityStore";

function t(key: string, values?: Record<string, unknown>): string {
  return String(i18n.global.t(key, (values ?? {}) as Record<string, unknown>));
}

interface PreparedInfo {
  pluginId: string;
  configKey: string;
}

let prepared: PreparedInfo | null = null;
/** 当前活跃的下载会话（供 cancelDownload() 和 disconnect 中断使用）。 */
let currentSession: DownloadSession | null = null;
/** 当前活跃的协议实例（供 disconnect 时立即中断 I/O 使用）。 */
let currentProtocol: FlasherProtocol | null = null;

/** 中断当前正在进行的下载（用户取消 / 串口被动断开 共用）。 */
export function cancelDownload(): void {
  currentSession?.cancel();
}

const SELECT_DEVICE_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function resolveCurrentPlugin(): FlasherPlugin | null {
  const store = useFlasherStore();
  if (!store.chipFamily || !store.flasherType) return null;
  const criteria: PluginResolveCriteria = {
    chipFamily: store.chipFamily as ChipFamily,
    flasherType: store.flasherType as FlasherType,
    capabilities: detectBrowserCapabilities(),
  };
  return globalPluginRegistry.tryResolve(criteria);
}


export function getCurrentPluginMeta(): FlasherPlugin | null {
  return resolveCurrentPlugin();
}

export function getCurrentDeviceDetails(): string[] {
  const hs = HardwareSession.getInstance();
  if (hs.getStatus() !== 'ready') return [];
  // 设备详情现在由 HardwareSession 统一管理
  return [];
}

function getPluginConfigSnapshot(plugin: FlasherPlugin): PluginConfigObject {
  const store = useFlasherStore();
  const defaults = plugin.createDefaultConfig?.() ?? {};
  const raw = store.getPluginConfig(plugin.id);
  if (plugin.normalizeConfig) {
    return plugin.normalizeConfig(raw);
  }
  if (!plugin.configSchema) return { ...defaults, ...(raw ?? {}) };
  return normalizeConfigBySchema(defaults, plugin.configSchema.fields, raw);
}

export interface FlasherOption {
  pluginId: string;
  label: string;
  flasherType: "serial" | "usb-dfu" | "st-link" | "dap-link";
  canSelectConnection: boolean;
  canFlash: boolean;
  isSupported: boolean;
  reason: string;
}

export function getFlasherOptionsForTarget(target: ChipFamily | null): FlasherOption[] {
  if (!target) return [];
  const capabilities = detectBrowserCapabilities();
  return globalPluginRegistry.listByTarget({ chipFamily: target, capabilities }).map(({ plugin, isSupported }) => {
    const reason = isSupported ? "" : getBrowserSupportHint(capabilities);
    return {
      pluginId: plugin.id,
      label: plugin.displayName,
      flasherType: plugin.flasherType,
      canSelectConnection: plugin.canSelectConnection,
      canFlash: plugin.canFlash,
      isSupported,
      reason,
    };
  });
}

export function getFlasherRuntimeInfo(): { canFlash: boolean; canSelectConnection: boolean; hint: string } {
  const capabilities = detectBrowserCapabilities();
  const store = useFlasherStore();
  if (!store.chipFamily || !store.flasherType) {
    return {
      canFlash: false,
      canSelectConnection: false,
      // 未完成 target/flasher 选择前，不展示"模式不可用"类提示，避免误导用户。
      hint: "",
    };
  }
  const plugin = resolveCurrentPlugin();
  if (!plugin) {
    return {
      canFlash: false,
      canSelectConnection: false,
      hint: t("flasherPage.runtimeUnavailable", { hint: getBrowserSupportHint(capabilities) }),
    };
  }
  const hint = plugin.canFlash ? "" : t("flasherPage.flashNotImplemented");
  return { canFlash: plugin.canFlash, canSelectConnection: plugin.canSelectConnection, hint };
}

/** Silently restore device connection from stored identity on page load. */
export async function tryRestoreConnection(): Promise<boolean> {
  const store = useFlasherStore();
  const plugin = resolveCurrentPlugin();
  if (!plugin || !plugin.canSelectConnection) return false;

  const hs = HardwareSession.getInstance();
  const restored = await hs.tryRestore();
  if (!restored) return false;

  const configKey = JSON.stringify(getPluginConfigSnapshot(plugin));
  prepared = { pluginId: plugin.id, configKey };
  store.setFlasherState({ status: 'ready', label: plugin.displayName, error: null });

  hs.onDisconnect(() => {
    currentProtocol?.abort?.();
    flasherLogger.warning(t('flasherPage.deviceDisconnected'));
    cancelDownload();
    store.setFlasherState({ status: 'disconnected', label: store.flasherLabel, error: null });
  });

  return true;
}

export async function prepareFlasherForCurrentSelection(options?: { forceReselect?: boolean }): Promise<void> {
  const store = useFlasherStore();
  const plugin = resolveCurrentPlugin();
  if (!plugin) {
    const hint = getFlasherRuntimeInfo().hint;
    store.setFlasherRuntime({ canFlash: false, canSelectConnection: false, hint });
    store.setFlasherState({ status: "failed", label: null, error: hint });
    throw new Error(hint);
  }

  store.setFlasherRuntime({
    canFlash: plugin.canFlash,
    canSelectConnection: plugin.canSelectConnection,
    hint: plugin.canFlash ? "" : t("flasherPage.flashNotImplemented"),
  });

  const configSnapshot = getPluginConfigSnapshot(plugin);
  const configKey = JSON.stringify(configSnapshot);
  const hs = HardwareSession.getInstance();

  // 检测配置变更或插件切换
  if (hs.getStatus() !== 'idle') {
    if (prepared?.pluginId !== plugin.id || options?.forceReselect) {
      await hs.release();
      prepared = null;
    } else if (prepared.configKey !== configKey) {
      // 配置变更（如波特率修改），保持设备连接但用新配置重建传输
      await hs.reopen(configSnapshot as Record<string, unknown>);
      prepared.configKey = configKey;
      store.setFlasherState({ status: 'ready', label: plugin.displayName, error: null });
      return;
    } else {
      // 已有活跃连接且配置未变
      store.setFlasherState({ status: 'ready', label: plugin.displayName, error: null });
      return;
    }
  }

  if (!plugin.canSelectConnection) {
    store.setFlasherState({ status: 'idle', label: null, error: t('flasherPage.noConnectionNeeded') });
    return;
  }

  // 使用 HardwareSession 管理连接流程
  store.setFlasherState({ status: 'pending', label: null, error: null });

  try {
    // 从持久化存储读取上次的设备身份（如有）
    const identityStore = new DeviceIdentityStore();
    const stored = await identityStore.load();

    const transport = await withTimeout(
      hs.acquire(plugin.connectionType, stored ?? undefined),
      SELECT_DEVICE_TIMEOUT_MS,
      t('flasherPage.deviceSelectionTimeout'),
    );

    if (hs.getStatus() !== 'ready') return; // user cancelled → stays pending

    prepared = { pluginId: plugin.id, configKey };
    store.setFlasherState({ status: 'ready', label: plugin.displayName, error: null });

    // 监听设备被动断开
    hs.onDisconnect(() => {
      currentProtocol?.abort?.();
      flasherLogger.warning(t('flasherPage.deviceDisconnected'));
      cancelDownload();
      store.setFlasherState({
        status: 'disconnected',
        label: store.flasherLabel,
        error: null,
      });
    });

    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.setFlasherState({ status: 'failed', label: null, error: message });
    await hs.release().catch(() => undefined);
    prepared = null;
    throw error;
  }
}

/** @returns true if flash completed successfully; false if user cancelled (e.g. ST-Link target picker). */
export async function startFlash(input: unknown, deps: PluginRuntimeDeps = {}): Promise<boolean> {
  const store = useFlasherStore();
  store.setDownloadResult("running");
  store.setRuntimePhase("downloading");
  // 新一轮下载开始时立刻清零，避免仍显示上一轮的 100%（握手阶段）
  store.setProgressDetails({
    percent: 0,
    bytesWritten: 0,
    bytesTotal: 0,
    bytesPerSecond: 0,
    etaSeconds: null,
  });
  const plugin = resolveCurrentPlugin();
  if (!plugin) {
    store.setDownloadResult("error");
    throw new Error(t("flasherPage.runtimeUnavailable", { hint: getBrowserSupportHint(detectBrowserCapabilities()) }));
  }
  if (!plugin.canFlash) {
    store.setDownloadResult("error");
    throw new Error(t("flasherPage.flashNotImplemented"));
  }
  const hs = HardwareSession.getInstance();
  const hs = HardwareSession.getInstance();
  const existingTransport = hs.getStatus() === 'ready' ? hs.getTransport() : null;

  let transport: Transport;
  if (existingTransport) {
    transport = existingTransport;
  } else if (!plugin.canSelectConnection) {
    transport = plugin.createTransport(getPluginConfigSnapshot(plugin));
  } else {
    store.setDownloadResult("error");
    throw new Error(t("flasherPage.selectConnectionFirst"));
  }

  if (!prepared || prepared.pluginId !== plugin.id) {
    store.setDownloadResult("error");
    throw new Error(t("flasherPage.selectConnectionFirst"));
  }

  const resetProgressIdle = (): void => {
    store.setProgressDetails({
      percent: 0,
      bytesWritten: 0,
      bytesTotal: 0,
      bytesPerSecond: 0,
      etaSeconds: null,
    });
    store.setStage("idle");
    store.setRuntimePhase("idle");
  };

  const configSnapshot = getPluginConfigSnapshot(plugin);
  const protocol = plugin.createProtocol(transport, deps, configSnapshot);
  const speedWindow: Array<{ t: number; w: number }> = [];

  flasherLogger.info(t("logMessages.starting"), {
    plugin: plugin.displayName,
    transport: transport.name,
    flasherType: store.flasherType,
    chipFamily: store.chipFamily,
    deviceLabel: store.flasherLabel,
    pluginConfig: configSnapshot,
  });

  let lastProgressLogAt = 0;
  let lastLoggedPercent = -1;
  const session = new DownloadSession({
    transport,
    protocol,
    onStageChange: (stage) => {
      store.setStage(stage);
      if (stage === "verifying") {
        store.setRuntimePhase("verifying");
      } else if (stage === "failed") {
        store.setRuntimePhase("failed");
      } else if (stage === "completed") {
        store.setRuntimePhase("completed");
      } else if (
        stage === "flashing" ||
        stage === "erasing" ||
        stage === "preparingImagePlan" ||
        stage === "syncing" ||
        stage === "probingTarget" ||
        stage === "connecting" ||
        stage === "resetting"
      ) {
        store.setRuntimePhase("downloading");
      }
      flasherLogger.debug(t("logMessages.stage", { stage }), {
        plugin: plugin.displayName,
        stage,
      });
    },
    onProgress: (progress) => {
      const now = Date.now();
      speedWindow.push({ t: now, w: progress.bytesWritten });
      while (speedWindow.length > 0 && now - speedWindow[0].t > 3000) {
        speedWindow.shift();
      }
      let bytesPerSecond = 0;
      if (speedWindow.length >= 2) {
        const first = speedWindow[0];
        const last = speedWindow[speedWindow.length - 1];
        const deltaBytes = Math.max(0, last.w - first.w);
        const deltaSec = Math.max(0.001, (last.t - first.t) / 1000);
        bytesPerSecond = deltaBytes / deltaSec;
      }
      const remaining = Math.max(0, progress.bytesTotal - progress.bytesWritten);
      const etaSeconds = bytesPerSecond > 1 ? Math.ceil(remaining / bytesPerSecond) : null;
      store.setProgressDetails({
        percent: progress.totalPercent,
        bytesWritten: progress.bytesWritten,
        bytesTotal: progress.bytesTotal,
        bytesPerSecond,
        etaSeconds,
      });

      // Avoid flooding the log UI; keep it useful and readable.
      const shouldLog =
        progress.totalPercent !== lastLoggedPercent &&
        (now - lastProgressLogAt > 350 || progress.totalPercent % 10 === 0);
      if (shouldLog) {
        lastLoggedPercent = progress.totalPercent;
        lastProgressLogAt = now;
        const progressLine = t("logMessages.progress", {
          percent: progress.totalPercent,
          written: formatBytes(progress.bytesWritten),
          total: formatBytes(progress.bytesTotal),
          speed: formatSpeed(bytesPerSecond),
        });
        flasherLogger.debug(progressLine, {
          plugin: plugin.displayName,
          stage: progress.stage,
          percent: progress.totalPercent,
          bytesWritten: progress.bytesWritten,
          bytesTotal: progress.bytesTotal,
          bytesPerSecond,
          etaSeconds,
        });
      }
    },
  });
  flasherLogger.info(t("logMessages.usingPlugin", { name: plugin.displayName }), {
    pluginId: plugin.id,
  });
  try {
    currentSession = session;
    currentProtocol = protocol;
    await session.run(input);
    store.setDownloadResult("success");
    store.setRuntimePhase("completed");
    store.incrementDownloadSuccess();
    flasherLogger.info(t("logMessages.succeeded"), { plugin: plugin.displayName });
    return true;
  } catch (error) {
    if (isUserCancelledError(error)) {
      store.setDownloadResult("idle");
      resetProgressIdle();
      flasherLogger.info(t("target.selectionCancelledLog"), { plugin: plugin.displayName });
      return false;
    }
    store.setDownloadResult("error");
    store.setRuntimePhase("failed");
    store.incrementDownloadFailed();
    const message =
      typeof error === "object" && error !== null && "userMessage" in error
        ? String((error as { userMessage: string }).userMessage)
        : error instanceof Error
          ? error.message
          : String(error);
    flasherLogger.error(t("logMessages.failed", { message }), { plugin: plugin.displayName, message });
    throw error;
  } finally {
    currentSession = null;
    currentProtocol = null;
  }
}
