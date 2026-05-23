import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import {
  createWebSocketController,
  type WebSocketController,
} from "../../../infrastructure/net/webSocketController";
import { IpKitError } from "../../../domain/errors/IpKitError";

const MAX_MESSAGES = 500;

export interface WsLogEntry {
  id: string;
  t: number;
  direction: "in" | "out" | "sys";
  text: string;
}

export const useWsLabStore = defineStore("wsLab", () => {
  const url = ref("wss://echo.websocket.events/");
  const connected = ref(false);
  const messages = ref<WsLogEntry[]>([]);
  const lastError = ref<string | null>(null);

  const controller = shallowRef<WebSocketController | null>(null);

  function pushSys(text: string): void {
    pushEntry("sys", text);
  }

  function pushEntry(direction: WsLogEntry["direction"], text: string): void {
    messages.value = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        t: Date.now(),
        direction,
        text,
      },
      ...messages.value,
    ].slice(0, MAX_MESSAGES);
  }

  function connect(): void {
    lastError.value = null;
    if (controller.value) {
      controller.value.close();
      controller.value = null;
    }
    const c = createWebSocketController();
    controller.value = c;
    try {
      c.connect(url.value, {
        onOpen: () => {
          connected.value = true;
          pushSys("已连接");
        },
        onMessage: ({ data, isBinary }) => {
          if (isBinary) {
            const buf = data as ArrayBuffer;
            pushEntry("in", `[binary ${buf.byteLength} bytes]`);
          } else {
            pushEntry("in", data as string);
          }
        },
        onClose: () => {
          connected.value = false;
          pushSys("连接已关闭");
          controller.value = null;
        },
        onError: () => {
          lastError.value = "WebSocket 发生错误（详见控制台）";
        },
      });
    } catch (e) {
      const msg =
        e instanceof IpKitError ? e.toUserMessage() : e instanceof Error ? e.message : String(e);
      lastError.value = msg;
      connected.value = false;
      controller.value = null;
    }
  }

  function disconnect(): void {
    controller.value?.close();
    connected.value = false;
    controller.value = null;
  }

  function sendText(text: string): void {
    if (!text) {
      return;
    }
    try {
      controller.value?.sendText(text);
      pushEntry("out", text);
    } catch (e) {
      const msg =
        e instanceof IpKitError ? e.toUserMessage() : e instanceof Error ? e.message : String(e);
      lastError.value = msg;
    }
  }

  function clearLog(): void {
    messages.value = [];
  }

  return {
    url,
    connected,
    messages,
    lastError,
    connect,
    disconnect,
    sendText,
    clearLog,
  };
});
