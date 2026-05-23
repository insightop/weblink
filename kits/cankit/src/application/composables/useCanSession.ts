import { computed, onUnmounted, ref, shallowRef } from "vue";
import type { RxFrameRow } from "../../domain/can/types.js";
import { CanKitError } from "../../domain/errors/can-kit-error.js";
import { SlcanCanSession } from "../slcan-can-session.js";
import { GsUsbCanSession } from "../gs-usb-can-session.js";
import type { ConnectOptions } from "../can-session.types.js";
import { DEFAULT_MAX_RX_FRAMES } from "../can-session.types.js";
import { logError } from "../../shared/logger.js";
import { requestGsUsbDevice } from "../../infrastructure/usb/web-usb-guards.js";

export type TransportMode = "slcan" | "gs_usb";

function createEmitHandler(
  rxRows: { value: RxFrameRow[] },
  logLines: { value: string[] },
  errorMessage: { value: string | null },
) {
  return (ev: import("@/application/can-session.types.js").SessionEvent) => {
    if (ev.type === "rx") {
      const next = [...rxRows.value, ev.row];
      if (next.length > DEFAULT_MAX_RX_FRAMES) {
        next.splice(0, next.length - DEFAULT_MAX_RX_FRAMES);
      }
      rxRows.value = next;
    } else if (ev.type === "parse_error") {
      const line = `[parse] ${ev.message}${ev.line ? `: ${ev.line}` : ""}`;
      logLines.value = [...logLines.value, line].slice(-500);
    } else {
      logError(ev.error);
      errorMessage.value =
        ev.error instanceof Error ? ev.error.message : String(ev.error);
    }
  };
}

export function useCanSession() {
  const serialSupported = computed(
    () => typeof navigator !== "undefined" && "serial" in navigator,
  );
  const usbSupported = computed(
    () => typeof navigator !== "undefined" && "usb" in navigator,
  );

  const transportMode = ref<TransportMode>("slcan");

  const connected = ref(false);
  const connecting = ref(false);
  const errorMessage = ref<string | null>(null);
  const rxRows = shallowRef<RxFrameRow[]>([]);
  const logLines = ref<string[]>([]);
  const selectedPort = shallowRef<SerialPort | null>(null);
  const selectedUsb = shallowRef<USBDevice | null>(null);

  const emit = createEmitHandler(rxRows, logLines, errorMessage);
  const slcanSession = new SlcanCanSession(emit);
  const gsUsbSession = new GsUsbCanSession(emit);

  onUnmounted(() => {
    void slcanSession.disconnect().catch(() => undefined);
    void gsUsbSession.disconnect().catch(() => undefined);
  });

  async function pickPort(): Promise<void> {
    errorMessage.value = null;
    try {
      selectedPort.value = await slcanSession.requestPort();
    } catch (e) {
      if (e instanceof CanKitError && e.code === "USER_CANCELLED") {
        return;
      }
      errorMessage.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function pickUsbDevice(): Promise<void> {
    errorMessage.value = null;
    try {
      selectedUsb.value = await requestGsUsbDevice();
    } catch (e) {
      if (e instanceof CanKitError && e.code === "USER_CANCELLED") {
        return;
      }
      errorMessage.value = e instanceof Error ? e.message : String(e);
    }
  }

  async function connect(opts: ConnectOptions): Promise<void> {
    errorMessage.value = null;
    connecting.value = true;
    try {
      if (transportMode.value === "slcan") {
        if (!selectedPort.value) {
          errorMessage.value = "请先选择串口";
          return;
        }
        await slcanSession.connect(selectedPort.value, opts);
      } else {
        if (!selectedUsb.value) {
          errorMessage.value = "请先选择 USB 设备";
          return;
        }
        const br = opts.canBitrate;
        if (br == null) {
          errorMessage.value = "请选择 CAN 比特率";
          return;
        }
        await gsUsbSession.connect(selectedUsb.value, { canBitrate: br });
      }
      connected.value = true;
      logLines.value = [...logLines.value, "[session] connected"];
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e);
      connected.value = false;
    } finally {
      connecting.value = false;
    }
  }

  async function disconnect(): Promise<void> {
    connecting.value = true;
    try {
      if (transportMode.value === "slcan") {
        await slcanSession.disconnect();
      } else {
        await gsUsbSession.disconnect();
      }
      connected.value = false;
      logLines.value = [...logLines.value, "[session] disconnected"];
    } catch (e) {
      errorMessage.value = e instanceof Error ? e.message : String(e);
    } finally {
      connecting.value = false;
    }
  }

  function clearRx(): void {
    rxRows.value = [];
  }

  function clearLogs(): void {
    logLines.value = [];
  }

  async function sendFrame(
    p: Parameters<SlcanCanSession["sendFrame"]>[0],
  ): Promise<void> {
    if (transportMode.value === "slcan") {
      await slcanSession.sendFrame(p);
    } else {
      await gsUsbSession.sendFrame(p);
    }
  }

  return {
    serialSupported,
    usbSupported,
    transportMode,
    connected,
    connecting,
    errorMessage,
    rxRows,
    logLines,
    selectedPort,
    selectedUsb,
    pickPort,
    pickUsbDevice,
    connect,
    disconnect,
    clearRx,
    clearLogs,
    sendFrame,
  };
}
