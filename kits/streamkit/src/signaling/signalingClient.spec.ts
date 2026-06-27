import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSignalingClient } from "./signalingClient";
import { SIGNALING_VERSION } from "./messageTypes";
import type { ServerToClientMessage } from "./messageTypes";

// Mock WebSocket
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, handler: (ev: unknown) => void, _options?: unknown): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", { code: 1000, reason: "client" });
  }

  emit(type: string, data?: unknown): void {
    for (const handler of this.listeners[type] ?? []) {
      handler(data);
    }
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open", {});
  }

  simulateMessage(data: ServerToClientMessage): void {
    this.emit("message", { data: JSON.stringify(data) });
  }

  simulateClose(code = 1000, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", { code, reason });
  }
}

/** Create a mock WebSocket subclass that captures the instance */
function createCapturingWS(target: { ws?: MockWebSocket }) {
  return class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      target.ws = this;
    }
  } as unknown as typeof WebSocket;
}

describe("createSignalingClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("should connect successfully", async () => {
    const client = createSignalingClient();
    const cap: { ws?: MockWebSocket } = {};
    vi.stubGlobal("WebSocket", createCapturingWS(cap));

    const connectPromise = client.connect("wss://example.com/ws");
    vi.advanceTimersByTime(0);
    cap.ws!.simulateOpen();

    await connectPromise;
    expect(client.connected).toBe(true);
  });

  it("should handle incoming messages", async () => {
    const client = createSignalingClient();
    const handler = vi.fn();
    client.onMessage(handler);

    const cap: { ws?: MockWebSocket } = {};
    vi.stubGlobal("WebSocket", createCapturingWS(cap));

    const connectPromise = client.connect("wss://example.com/ws");
    vi.advanceTimersByTime(0);
    cap.ws!.simulateOpen();
    await connectPromise;

    const msg: ServerToClientMessage = {
      v: SIGNALING_VERSION,
      type: "welcome",
      peers: [],
      self: "peer-1",
    };
    cap.ws!.simulateMessage(msg);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it("should disconnect cleanly", async () => {
    const client = createSignalingClient();
    const cap: { ws?: MockWebSocket } = {};
    vi.stubGlobal("WebSocket", createCapturingWS(cap));

    const connectPromise = client.connect("wss://example.com/ws");
    vi.advanceTimersByTime(0);
    cap.ws!.simulateOpen();
    await connectPromise;

    client.disconnect();
    expect(client.connected).toBe(false);
  });

  it("should send messages when connected", async () => {
    const client = createSignalingClient();
    const cap: { ws?: MockWebSocket } = {};
    vi.stubGlobal("WebSocket", createCapturingWS(cap));

    const connectPromise = client.connect("wss://example.com/ws");
    vi.advanceTimersByTime(0);
    cap.ws!.simulateOpen();
    await connectPromise;

    client.send({ v: SIGNALING_VERSION, type: "ping" });
    expect(cap.ws!.sent).toHaveLength(1);
    expect(JSON.parse(cap.ws!.sent[0])).toEqual({ v: SIGNALING_VERSION, type: "ping" });
  });

  it("should not send when disconnected", () => {
    const client = createSignalingClient();
    client.send({ v: SIGNALING_VERSION, type: "ping" });
  });

  it("should timeout on connect", async () => {
    const client = createSignalingClient();
    const connectPromise = client.connect("wss://example.com/ws");
    vi.advanceTimersByTime(16000);
    await expect(connectPromise).rejects.toThrow("WebSocket open timeout");
  });

  it("should call close handler on server disconnect", async () => {
    const client = createSignalingClient();
    const closeHandler = vi.fn();
    client.onClose(closeHandler);

    const cap: { ws?: MockWebSocket } = {};
    vi.stubGlobal("WebSocket", createCapturingWS(cap));

    const connectPromise = client.connect("wss://example.com/ws");
    vi.advanceTimersByTime(0);
    cap.ws!.simulateOpen();
    await connectPromise;

    cap.ws!.simulateClose(1006, "abnormal");
    expect(closeHandler).toHaveBeenCalledWith(1006, "abnormal");
  });
});
