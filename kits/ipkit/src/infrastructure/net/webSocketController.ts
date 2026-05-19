import { IpKitError, IpKitErrorCode } from "@/domain/errors/IpKitError";
import { createLogger } from "@/infrastructure/logger/createLogger";

const log = createLogger("webSocket");

export type WsMessageHandler = (event: { data: string | ArrayBuffer; isBinary: boolean }) => void;

export interface WebSocketController {
  connect(
    url: string,
    options: {
      protocols?: string | string[];
      onOpen?: () => void;
      onMessage: WsMessageHandler;
      onClose?: (ev: CloseEvent) => void;
      onError?: (ev: Event) => void;
    },
  ): void;
  sendText(text: string): void;
  sendBinary(data: ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  getReadyState(): number | null;
}

export function createWebSocketController(): WebSocketController {
  let socket: WebSocket | null = null;

  return {
    connect(url, options) {
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        throw new IpKitError(IpKitErrorCode.VALIDATION, "已存在连接，请先断开");
      }
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new IpKitError(IpKitErrorCode.VALIDATION, "WebSocket URL 无效");
      }
      if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
        throw new IpKitError(IpKitErrorCode.VALIDATION, "仅支持 ws: 与 wss:");
      }

      socket = new WebSocket(parsed.href, options.protocols);

      socket.onopen = () => {
        log.info("open", parsed.href);
        options.onOpen?.();
      };

      socket.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          options.onMessage({ data: ev.data, isBinary: false });
        } else {
          options.onMessage({ data: ev.data as ArrayBuffer, isBinary: true });
        }
      };

      socket.onerror = (ev) => {
        log.warn("error event");
        options.onError?.(ev);
      };

      socket.onclose = (ev) => {
        log.info("close", ev.code, ev.reason);
        options.onClose?.(ev);
        socket = null;
      };
    },

    sendText(text: string) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new IpKitError(IpKitErrorCode.WEBSOCKET, "连接未就绪");
      }
      socket.send(text);
    },

    sendBinary(data: ArrayBuffer | ArrayBufferView) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new IpKitError(IpKitErrorCode.WEBSOCKET, "连接未就绪");
      }
      socket.send(data);
    },

    close(code?: number, reason?: string) {
      socket?.close(code, reason);
      socket = null;
    },

    getReadyState() {
      return socket?.readyState ?? null;
    },
  };
}
