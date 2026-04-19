import { parseServerMessage, stringifyClientMessage } from "@/domain/signaling/messageCodec";
import type { ClientToServerMessage, ServerToClientMessage } from "@/domain/signaling/messageTypes";
import type { SignalingTransport } from "@/infrastructure/signaling/signalingTransport";

const RECONNECT_MAX = 5;
const RECONNECT_BASE_MS = 800;

export function createSignalingClient(): SignalingTransport {
  let ws: WebSocket | null = null;
  let messageHandler: ((msg: ServerToClientMessage) => void) | null = null;
  let closeHandler: ((code: number, reason: string) => void) | null = null;
  let errorHandler: ((err: unknown) => void) | null = null;
  let reconnectAttempt = 0;
  let lastUrl: string | null = null;
  let closedByUser = false;

  function attach(socket: WebSocket): void {
    socket.addEventListener("message", (ev) => {
      const raw = typeof ev.data === "string" ? ev.data : "";
      const msg = parseServerMessage(raw);
      if (msg && messageHandler) messageHandler(msg);
    });
    socket.addEventListener("close", (ev) => {
      ws = null;
      if (closeHandler) closeHandler(ev.code, ev.reason);
      if (!closedByUser && lastUrl && reconnectAttempt < RECONNECT_MAX) {
        reconnectAttempt += 1;
        const delay = RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt - 1);
        window.setTimeout(() => {
          if (lastUrl && !closedByUser) void connectInner(lastUrl);
        }, delay);
      }
    });
    socket.addEventListener("error", (ev) => {
      if (errorHandler) errorHandler(ev);
    });
  }

  async function connectInner(url: string): Promise<void> {
    closedByUser = false;
    lastUrl = url;
    const socket = new WebSocket(url);
    ws = socket;
    attach(socket);
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error("WebSocket open timeout")), 15000);
      socket.addEventListener(
        "open",
        () => {
          window.clearTimeout(t);
          reconnectAttempt = 0;
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          window.clearTimeout(t);
          reject(new Error("WebSocket error"));
        },
        { once: true },
      );
    });
  }

  return {
    async connect(url: string): Promise<void> {
      await connectInner(url);
    },
    disconnect(): void {
      closedByUser = true;
      lastUrl = null;
      if (ws) {
        ws.close(1000, "client");
        ws = null;
      }
    },
    send(msg: ClientToServerMessage): void {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(stringifyClientMessage(msg));
    },
    onMessage(handler: (msg: ServerToClientMessage) => void): void {
      messageHandler = handler;
    },
    onClose(handler: (code: number, reason: string) => void): void {
      closeHandler = handler;
    },
    onError(handler: (err: unknown) => void): void {
      errorHandler = handler;
    },
    get connected(): boolean {
      return ws !== null && ws.readyState === WebSocket.OPEN;
    },
  };
}
