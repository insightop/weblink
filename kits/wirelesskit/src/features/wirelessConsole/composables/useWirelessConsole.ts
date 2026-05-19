import { computed, ref } from "vue";
import { useLogStore } from "@weblink/ui-vue";
import { BluetoothSession, type CharacteristicId } from "@/infrastructure/bluetooth/bluetoothSession";
import { NfcSession } from "@/infrastructure/nfc/nfcSession";
import { toUserError } from "@/infrastructure/errors/userErrors";
import { encodeText } from "@weblink/utils/codec";
import { formatHex, parseHex } from "@weblink/utils/hex";
import { formatNdefMessage, type NdefMessageVm } from "@/domain/nfc/ndefFormat";
import { pushRing } from "@/shared/utils/ringBuffer";
import { formatTimeMs } from "@weblink/utils/time";

export function useWirelessConsole() {
  const { logs, levelFilter, keyword, filtered, push, clear } = useLogStore();

  const logLevel = computed({
    get: () => levelFilter.value,
    set: (v) => {
      levelFilter.value = v;
    },
  });
  const logKeyword = computed({
    get: () => keyword.value,
    set: (v) => {
      keyword.value = v;
    },
  });

  function clearLogs() {
    clear();
  }

  // ---------------- Bluetooth VM ----------------
  const bt = new BluetoothSession();
  const btDeviceName = ref<string>("");
  const btConnected = ref(false);
  const btBusy = ref(false);
  const btError = ref<string | null>(null);

  const btOptionalServices = ref<string>(""); // comma-separated

  const btServices = ref<BluetoothRemoteGATTService[]>([]);
  const btServiceUuid = ref<string>("");
  const btCharacteristics = ref<BluetoothRemoteGATTCharacteristic[]>([]);
  const btCharUuid = ref<string>("");

  const btTxMode = ref<"text" | "hex">("text");
  const btTxText = ref("");
  const btTxHex = ref("");

  const btLastRead = ref<{ ts: number; text: string; hex: string } | null>(null);
  const btNotifyOn = ref(false);
  let btUnsub: null | (() => Promise<void>) = null;

  const btRx = ref<Array<{ id: string; ts: number; text: string; hex: string }>>([]);
  const MAX_RX = 500;

  function btSelectedId(): CharacteristicId | null {
    const svc = btServiceUuid.value.trim();
    const chr = btCharUuid.value.trim();
    if (!svc || !chr) return null;
    return { serviceUuid: svc, characteristicUuid: chr };
  }

  function decodeDataView(dv: DataView): { text: string; hex: string } {
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const hex = formatHex(bytes);
    let text = "";
    try {
      text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch {
      // ignore
    }
    return { text, hex };
  }

  async function btPickDevice(): Promise<void> {
    btError.value = null;
    btBusy.value = true;
    try {
      const optional = btOptionalServices.value
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: optional,
      });
      btDeviceName.value = device.name ?? device.id;
      push({level: "info", message: `已选择蓝牙设备：${btDeviceName.value}`});
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `选择设备失败：${ue.message}`, data: ue.detail});
    } finally {
      btBusy.value = false;
    }
  }

  async function btConnect(): Promise<void> {
    btError.value = null;
    btBusy.value = true;
    try {
      await bt.connect();
      btConnected.value = true;
      push({level: "info", message: `已连接：${btDeviceName.value || "Bluetooth"}`});
      await btRefreshServices();
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `连接失败：${ue.message}`, data: ue.detail});
    } finally {
      btBusy.value = false;
    }
  }

  async function btDisconnect(): Promise<void> {
    btBusy.value = true;
    try {
      await btStopNotify();
      await bt.disconnect();
      btConnected.value = false;
      btServices.value = [];
      btCharacteristics.value = [];
      btServiceUuid.value = "";
      btCharUuid.value = "";
      push({level: "info", message: "已断开连接"});
    } catch (e) {
      const ue = toUserError(e);
      push({level: "error", message: `断开失败：${ue.message}`, data: ue.detail});
    } finally {
      btBusy.value = false;
    }
  }

  async function btRefreshServices(): Promise<void> {
    try {
      const svcs = await bt.listServices();
      btServices.value = svcs;
      if (!btServiceUuid.value && svcs[0]?.uuid) btServiceUuid.value = svcs[0].uuid;
      push({level: "debug", message: `Services：${svcs.length} 个`});
      await btRefreshCharacteristics();
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `读取 services 失败：${ue.message}`, data: ue.detail});
    }
  }

  async function btRefreshCharacteristics(): Promise<void> {
    const svc = btServiceUuid.value.trim();
    if (!svc) {
      btCharacteristics.value = [];
      return;
    }
    try {
      const chrs = await bt.listCharacteristics(svc);
      btCharacteristics.value = chrs;
      if (!btCharUuid.value && chrs[0]?.uuid) btCharUuid.value = chrs[0].uuid;
      push({level: "debug", message: `Characteristics：${chrs.length} 个`});
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `读取 characteristics 失败：${ue.message}`, data: ue.detail});
    }
  }

  async function btRead(): Promise<void> {
    const id = btSelectedId();
    if (!id) return;
    btBusy.value = true;
    try {
      const dv = await bt.readValue(id);
      const v = decodeDataView(dv);
      btLastRead.value = { ts: Date.now(), ...v };
      push({level: "info", message: `Read：${v.hex}`});
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `Read 失败：${ue.message}`, data: ue.detail});
    } finally {
      btBusy.value = false;
    }
  }

  async function btWrite(): Promise<void> {
    const id = btSelectedId();
    if (!id) return;
    btBusy.value = true;
    try {
      const bytes =
        btTxMode.value === "hex" ? parseHex(btTxHex.value) : encodeText(btTxText.value);
      await bt.writeValue(id, bytes as unknown as BufferSource);
      push({
        level: "info",
        message: `Write（${btTxMode.value}）：${btTxMode.value === "hex" ? formatHex(bytes) : btTxText.value}`,
      });
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `Write 失败：${ue.message}`, data: ue.detail});
    } finally {
      btBusy.value = false;
    }
  }

  async function btStartNotify(): Promise<void> {
    const id = btSelectedId();
    if (!id) return;
    btBusy.value = true;
    try {
      if (btUnsub) await btUnsub();
      btUnsub = await bt.subscribe(id, (dv) => {
        const v = decodeDataView(dv);
        const ts = Date.now();
        btRx.value = pushRing(btRx.value, {
          id: `${ts}_${Math.random().toString(16).slice(2)}`,
          ts,
          ...v,
        }, MAX_RX);
      });
      btNotifyOn.value = true;
      push({level: "info", message: "Notify：已开启"});
    } catch (e) {
      const ue = toUserError(e);
      btError.value = ue.message;
      push({level: "error", message: `Notify 开启失败：${ue.message}`, data: ue.detail});
    } finally {
      btBusy.value = false;
    }
  }

  async function btStopNotify(): Promise<void> {
    try {
      if (btUnsub) await btUnsub();
    } finally {
      btUnsub = null;
      btNotifyOn.value = false;
    }
  }

  function btClearRx() {
    btRx.value = [];
  }

  const bluetooth = {
    deviceName: btDeviceName,
    connected: btConnected,
    busy: btBusy,
    error: btError,
    optionalServices: btOptionalServices,
    services: btServices,
    serviceUuid: btServiceUuid,
    characteristics: btCharacteristics,
    characteristicUuid: btCharUuid,
    txMode: btTxMode,
    txText: btTxText,
    txHex: btTxHex,
    lastRead: btLastRead,
    notifyOn: btNotifyOn,
    rx: btRx,
    pickDevice: btPickDevice,
    connect: btConnect,
    disconnect: btDisconnect,
    refreshServices: btRefreshServices,
    refreshCharacteristics: btRefreshCharacteristics,
    read: btRead,
    write: btWrite,
    startNotify: btStartNotify,
    stopNotify: btStopNotify,
    clearRx: btClearRx,
    formatTimeMs,
  };

  // ---------------- NFC VM ----------------
  const nfc = new NfcSession();
  const nfcScanning = ref(false);
  const nfcBusy = ref(false);
  const nfcError = ref<string | null>(null);
  const nfcMessages = ref<Array<{ id: string; ts: number; serial: string; vm: NdefMessageVm }>>([]);
  const MAX_NFC = 200;

  const nfcWriteMode = ref<"text" | "url">("text");
  const nfcWriteText = ref("");
  const nfcWriteUrl = ref("");

  async function nfcStart(): Promise<void> {
    nfcError.value = null;
    nfcBusy.value = true;
    try {
      await nfc.scan((msg, serial) => {
        const ts = Date.now();
        nfcMessages.value = pushRing(
          nfcMessages.value,
          { id: `${ts}_${Math.random().toString(16).slice(2)}`, ts, serial, vm: formatNdefMessage(msg) },
          MAX_NFC,
        );
      });
      nfcScanning.value = true;
      push({level: "info", message: "NFC：开始扫描"});
    } catch (e) {
      const ue = toUserError(e);
      nfcError.value = ue.message;
      push({level: "error", message: `NFC 扫描失败：${ue.message}`, data: ue.detail});
    } finally {
      nfcBusy.value = false;
    }
  }

  function nfcStop(): void {
    nfc.stop();
    nfcScanning.value = false;
    push({level: "info", message: "NFC：停止扫描"});
  }

  async function nfcWrite(): Promise<void> {
    nfcError.value = null;
    nfcBusy.value = true;
    try {
      if (nfcWriteMode.value === "url") {
        await nfc.writeUrl(nfcWriteUrl.value);
        push({level: "info", message: `NFC 写入 URL：${nfcWriteUrl.value}`});
      } else {
        await nfc.writeText(nfcWriteText.value);
        push({level: "info", message: `NFC 写入 Text：${nfcWriteText.value}`});
      }
    } catch (e) {
      const ue = toUserError(e);
      nfcError.value = ue.message;
      push({level: "error", message: `NFC 写入失败：${ue.message}`, data: ue.detail});
    } finally {
      nfcBusy.value = false;
    }
  }

  function nfcClear() {
    nfcMessages.value = [];
  }

  const nfcVm = {
    scanning: nfcScanning,
    busy: nfcBusy,
    error: nfcError,
    messages: nfcMessages,
    writeMode: nfcWriteMode,
    writeText: nfcWriteText,
    writeUrl: nfcWriteUrl,
    start: nfcStart,
    stop: nfcStop,
    write: nfcWrite,
    clear: nfcClear,
    formatTimeMs,
  };

  return {
    bluetooth,
    nfc: nfcVm,
    logs: filtered,
    logLevel,
    logKeyword,
    clearLogs,
    _pushLog: push,
    _rawLogs: logs,
  };
}

