import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionManager } from "./useSessionManager";
import type { Session, SessionEventMap, SessionState } from "../room/roomTypes";
import type { EncodingStrategy } from "../signaling/messageTypes";

vi.mock("../room/roomManager", () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

import { createRoom, joinRoom } from "../room/roomManager";

// ── Helper: create a minimal mock Session ──

function createMockSession(overrides: Partial<Session> = {}): Session {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  let state: SessionState = "connecting";

  return {
    roomId: overrides.roomId ?? "test-room",
    peerId: overrides.peerId ?? "test-peer",
    state: overrides.state ?? state,
    remoteStreams: overrides.remoteStreams ?? new Map(),
    cameraStream: overrides.cameraStream ?? null,
    on: vi.fn((event, handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler as (...args: unknown[]) => void);
      handlers.set(event, list);
    }),
    off: vi.fn(),
    addTrack: vi.fn(() => ({}) as RTCRtpSender),
    removeTrack: vi.fn(),
    setEncodingStrategy: vi.fn(async () => {}),
    requestMic: vi.fn(),
    requestCamera: vi.fn(),
    dispose: vi.fn(() => {
      state = "disconnected";
      handlers.get("state-change")?.forEach((h) => h("disconnected"));
    }),
    /** Test helper: trigger an event */
    _trigger<K extends keyof SessionEventMap>(event: K, ...args: Parameters<SessionEventMap[K]>) {
      handlers.get(event)?.forEach((h) => h(...(args as unknown[])));
    },
  } as Session & { _trigger: <K extends keyof SessionEventMap>(event: K, ...args: Parameters<SessionEventMap[K]>) => void };
}

const mockStream = { getTracks: () => [] as MediaStreamTrack[] } as unknown as MediaStream;

// ── Tests ──

describe("useSessionManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("初始状态为 disconnected，roomCode 和 error 为 null", () => {
    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    expect(result.current.state).toBe("disconnected");
    expect(result.current.roomCode).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("startSharing 成功后状态流转并设置 roomCode", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.startSharing(mockStream));

    expect(createRoom).toHaveBeenCalledWith({ signalingUrl: "ws://test" });
    expect(result.current.roomCode).toBe("12345678");
    expect(result.current.state).toBe("connecting");

    // Simulate connected via event
    act(() => mockSess._trigger("state-change", "connected"));
    expect(result.current.state).toBe("connected");
  });

  it("startSharing 异常时回退到 disconnected 并设置 error", async () => {
    vi.mocked(createRoom).mockRejectedValue(new Error("网络错误"));

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.startSharing(mockStream));

    expect(result.current.state).toBe("disconnected");
    expect(result.current.error).toBe("网络错误");
  });

  it("stopSharing 重置状态", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.startSharing(mockStream));
    act(() => result.current.stopSharing());

    expect(result.current.state).toBe("disconnected");
    expect(result.current.roomCode).toBeNull();
    expect(mockSess.dispose).toHaveBeenCalled();
  });

  it("joinByCode 通过分享码加入房间", async () => {
    const mockSess = createMockSession({ roomId: "87654321" });
    vi.mocked(joinRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.joinByCode("87654321"));

    expect(joinRoom).toHaveBeenCalledWith({ signalingUrl: "ws://test", roomId: "87654321" });
    expect(result.current.roomCode).toBe("87654321");
  });

  it("joinByCode 异常时回退到 disconnected", async () => {
    vi.mocked(joinRoom).mockRejectedValue(new Error("房间不存在"));

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.joinByCode("99999999"));

    expect(result.current.state).toBe("disconnected");
    expect(result.current.error).toBe("房间不存在");
  });

  it("endSession 清理会话并通知 onRemoteStream/onCameraStream", async () => {
    const onRemoteStream = vi.fn();
    const onCameraStream = vi.fn();
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test", onRemoteStream, onCameraStream }),
    );

    await act(() => result.current.startSharing(mockStream));
    expect(result.current.roomCode).toBe("12345678");

    act(() => result.current.endSession());

    expect(mockSess.dispose).toHaveBeenCalled();
    expect(onRemoteStream).toHaveBeenCalledWith(null);
    expect(onCameraStream).toHaveBeenCalledWith(null);
    expect(result.current.state).toBe("disconnected");
    expect(result.current.roomCode).toBeNull();
  });

  it("requestMic / requestCamera 委托给 session", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.startSharing(mockStream));

    act(() => result.current.requestMic());
    expect(mockSess.requestMic).toHaveBeenCalled();

    act(() => result.current.requestCamera());
    expect(mockSess.requestCamera).toHaveBeenCalled();
  });

  it("getSession 返回当前 session", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    expect(result.current.getSession()).toBeNull();

    await act(() => result.current.startSharing(mockStream));
    expect(result.current.getSession()).toBe(mockSess);
  });

  it("setEncodingStrategy 更新 state 并委托给 session", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);
    const { result } = renderHook(() => useSessionManager({ signalingUrl: "ws://test" }));

    await act(() => result.current.startSharing(mockStream));
    await act(() => result.current.setEncodingStrategy("speed"));

    expect(result.current.strategy).toBe("speed");
    expect(mockSess.setEncodingStrategy).toHaveBeenCalledWith("speed");
  });

  it("addMediaTrack / removeMediaTrack 委托给 session", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);
    const { result } = renderHook(() => useSessionManager({ signalingUrl: "ws://test" }));
    await act(() => result.current.startSharing(mockStream));

    const track = { kind: "video" } as MediaStreamTrack;
    const sender = result.current.addMediaTrack(track, mockStream);
    expect(mockSess.addTrack).toHaveBeenCalledWith(track, mockStream);

    if (sender) {
      result.current.removeMediaTrack(sender);
      expect(mockSess.removeTrack).toHaveBeenCalledWith(sender);
    }
  });

  it("事件回调通过 ref 获取最新值", async () => {
    const onMicRequest = vi.fn();
    const onCameraRequest = vi.fn();
    const onPeerLeft = vi.fn();
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test", onMicRequest, onCameraRequest, onPeerLeft }),
    );

    // setupSessionEvents 在 startSharing 中被调用
    await act(() => result.current.startSharing(mockStream));

    act(() => mockSess._trigger("mic-request"));
    expect(onMicRequest).toHaveBeenCalled();

    act(() => mockSess._trigger("camera-request"));
    expect(onCameraRequest).toHaveBeenCalled();

    act(() => mockSess._trigger("peer-left", "admin-xyz"));
    expect(onPeerLeft).toHaveBeenCalled();
  });

  it("error 事件设置错误信息", async () => {
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test" }),
    );

    await act(() => result.current.startSharing(mockStream));

    act(() => mockSess._trigger("error", new Error("连接超时")));
    expect(result.current.error).toBe("连接超时");
  });

  it("remote-stream 事件触发 onRemoteStream", async () => {
    const onRemoteStream = vi.fn();
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test", onRemoteStream }),
    );

    // setupSessionEvents 在 startSharing 中被调用
    await act(() => result.current.startSharing(mockStream));

    act(() => mockSess._trigger("remote-stream"));
    expect(onRemoteStream).toHaveBeenCalled();
  });

  it("camera-stream 事件触发 onCameraStream", async () => {
    const onCameraStream = vi.fn();
    const mockSess = createMockSession({ roomId: "12345678" });
    vi.mocked(createRoom).mockResolvedValue(mockSess);

    const { result } = renderHook(() =>
      useSessionManager({ signalingUrl: "ws://test", onCameraStream }),
    );

    // setupSessionEvents 在 startSharing 中被调用
    await act(() => result.current.startSharing(mockStream));

    const camStream = { id: "cam" } as MediaStream;
    act(() => mockSess._trigger("camera-stream", camStream));
    expect(onCameraStream).toHaveBeenCalledWith(camStream);
  });
});
