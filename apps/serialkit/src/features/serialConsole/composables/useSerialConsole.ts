import { computed, onUnmounted, ref } from "vue";
import { SerialSession, type ConnectionState } from "@/infrastructure/serial/serialSession";
import type { SerialUserError } from "@/infrastructure/serial/serialErrors";
import { requestSerialPort } from "@/infrastructure/serial/webSerial";
import { createStreamingDecoder, encodeText, type LineEnding } from "@/domain/serial/text";
import { formatHex, parseHex } from "@/domain/serial/hex";
import { ByteLineFramer } from "@/domain/serial/framing";
import { useLogStore } from "@/features/serialConsole/composables/useLogStore";

const MAX_RX_LINES = 2000;

export type RxLine = { ts: number; text: string; hex: string };

export function useSerialConsole() {
  const session = new SerialSession();
  const state = ref<ConnectionState>("idle");
  const lastError = ref<string | null>(null);

  // Connection options
  const baudRate = ref(115200);
  const dataBits = ref<7 | 8>(8);
  const stopBits = ref<1 | 2>(1);
  const parity = ref<SerialParity>("none");
  const flowControl = ref<SerialFlowControl>("none");

  // RX buffers
  const rxLines = ref<RxLine[]>([]);

  const decoder = createStreamingDecoder();
  const byteFramer = new ByteLineFramer({ maxLineBytes: 64 * 1024 });

  // TX
  const txMode = ref<"text" | "hex">("text");
  const txText = ref("");
  const txHex = ref("");
  const txLineEnding = ref<LineEnding>("lf");
  const lastTxTs = ref<number | null>(null);
  const { filtered, levelFilter, keyword, push: pushLog, clear: clearLogs } = useLogStore();

  function setError(e: SerialUserError | Error | unknown, fallback = "操作失败"): void {
    if (typeof e === "object" && e && "message" in e) {
      // @ts-expect-error runtime guard
      lastError.value = e.message || fallback;
    } else {
      lastError.value = fallback;
    }
  }

  function clearRx(): void {
    rxLines.value = [];
    pushLog({ level: "info", scope: "rx", message: "已清空接收区" });
  }

  const rxVm = computed(() => rxLines.value);

  async function selectPort(): Promise<void> {
    lastError.value = null;
    try {
      const port = await requestSerialPort();
      pushLog({ level: "info", scope: "serial", message: "已选择串口", data: port.getInfo() });
      // store port in session via open
      await connect(port);
    } catch (e) {
      setError(e, "选择串口失败");
      pushLog({ level: "error", scope: "serial", message: lastError.value ?? "选择串口失败", data: e });
    }
  }

  async function connect(port: SerialPort): Promise<void> {
    lastError.value = null;
    try {
      await session.open(port, {
        baudRate: baudRate.value,
        dataBits: dataBits.value,
        stopBits: stopBits.value,
        parity: parity.value,
        flowControl: flowControl.value,
      });
      pushLog({ level: "info", scope: "serial", message: "已连接" });
    } catch (e) {
      setError(e, "连接失败");
      pushLog({ level: "error", scope: "serial", message: lastError.value ?? "连接失败", data: e });
      throw e;
    }
  }

  async function disconnect(): Promise<void> {
    lastError.value = null;
    await session.close();
    pushLog({ level: "info", scope: "serial", message: "已断开" });
  }

  async function send(): Promise<void> {
    lastError.value = null;
    try {
      let bytes: Uint8Array;
      if (txMode.value === "text") {
        bytes = encodeText(txText.value, txLineEnding.value);
      } else {
        bytes = parseHex(txHex.value);
      }
      if (bytes.length === 0) return;
      await session.write(bytes);
      lastTxTs.value = Date.now();
      pushLog({ level: "info", scope: "tx", message: `发送 ${bytes.length} bytes` });
    } catch (e) {
      setError(e, "发送失败");
      pushLog({ level: "error", scope: "tx", message: lastError.value ?? "发送失败", data: e });
    }
  }

  const offData = session.onData((chunk) => {
    const ts = Date.now();
    const byteLines = byteFramer.push(chunk);
    if (byteLines.length) {
      const mapped: RxLine[] = byteLines.map((b) => ({
        ts,
        text: decoder.decode(b, { stream: false }),
        hex: formatHex(b),
      }));
      rxLines.value = [...rxLines.value, ...mapped].slice(-MAX_RX_LINES);
    } else {
      // 没有换行时，不追加可视行；但仍维持 decoder 的 streaming 状态
      void decoder.decode(chunk, { stream: true });
    }

    pushLog({ level: "debug", scope: "rx", message: `收到 ${chunk.length} bytes` });
  });

  const offStatus = session.onStatus((s) => {
    state.value = s;
  });

  const offError = session.onError((e) => {
    lastError.value = e.message;
    pushLog({ level: "error", scope: "serial", message: e.message, data: e.cause });
  });

  onUnmounted(() => {
    offData();
    offStatus();
    offError();
    void session.close();
  });

  const canSend = computed(() => state.value === "connected");

  return {
    // connection
    state,
    lastError,
    baudRate,
    dataBits,
    stopBits,
    parity,
    flowControl,
    selectPort,
    disconnect,

    // rx
    rxVm,
    clearRx,

    // tx
    txMode,
    txText,
    txHex,
    txLineEnding,
    lastTxTs,
    canSend,
    send,

    // logs
    logs: filtered,
    logLevel: levelFilter,
    logKeyword: keyword,    pushLog,
    clearLogs,
  };
}
