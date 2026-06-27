import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaTracks } from "./useMediaTracks";
import type { Session } from "../room/roomTypes";

vi.mock("../webrtc/mediaTrack", () => ({
  captureMicrophone: vi.fn(),
  captureCamera: vi.fn(),
}));

import { captureMicrophone, captureCamera } from "../webrtc/mediaTrack";

// ── Helpers ──

function createMockTrack(overrides: Partial<MediaStreamTrack> = {}): MediaStreamTrack {
  return { stop: vi.fn(), kind: "audio", enabled: true, ...overrides } as unknown as MediaStreamTrack;
}

function createMockLocalMedia(tracks: MediaStreamTrack[]) {
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  return { stream, stop: vi.fn(() => tracks.forEach((t) => t.stop())) };
}

function createMockSession(): Session {
  return {
    roomId: "test",
    peerId: "test",
    state: "connected",
    remoteStreams: new Map(),
    cameraStream: null,
    on: vi.fn(),
    off: vi.fn(),
    addTrack: vi.fn(() => ({}) as RTCRtpSender),
    removeTrack: vi.fn(),
    setEncodingStrategy: vi.fn(),
    requestMic: vi.fn(),
    requestCamera: vi.fn(),
    dispose: vi.fn(),
  };
}

// ── Tests ──

describe("useMediaTracks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("初始状态 micOn=false, cameraOn=false, error=null", () => {
    const { result } = renderHook(() => useMediaTracks());

    expect(result.current.micOn).toBe(false);
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.micError).toBeNull();
    expect(result.current.cameraError).toBeNull();
  });

  it("toggleMic(null) 不做任何操作", async () => {
    const { result } = renderHook(() => useMediaTracks());

    await act(() => result.current.toggleMic(null));

    expect(result.current.micOn).toBe(false);
  });

  it("toggleMic 开启麦克风", async () => {
    const track = createMockTrack();
    const localMedia = createMockLocalMedia([track]);
    vi.mocked(captureMicrophone).mockResolvedValue(localMedia);

    const session = createMockSession();
    const { result } = renderHook(() => useMediaTracks());

    await act(() => result.current.toggleMic(session));

    expect(captureMicrophone).toHaveBeenCalled();
    expect(session.addTrack).toHaveBeenCalledWith(track, localMedia.stream);
    expect(result.current.micOn).toBe(true);
  });

  it("toggleMic 再次调用关闭麦克风", async () => {
    const track = createMockTrack();
    const localMedia = createMockLocalMedia([track]);
    vi.mocked(captureMicrophone).mockResolvedValue(localMedia);

    const session = createMockSession();
    const { result } = renderHook(() => useMediaTracks());

    await act(() => result.current.toggleMic(session)); // open
    expect(result.current.micOn).toBe(true);

    await act(() => result.current.toggleMic(session)); // close

    expect(session.removeTrack).toHaveBeenCalled();
    expect(localMedia.stop).toHaveBeenCalled();
    expect(result.current.micOn).toBe(false);
  });

  it("toggleMic 异常时设置 micError", async () => {
    vi.mocked(captureMicrophone).mockRejectedValue(new Error("麦克风被拒绝"));

    const session = createMockSession();
    const { result } = renderHook(() => useMediaTracks());

    await act(() => result.current.toggleMic(session));

    expect(result.current.micOn).toBe(false);
    expect(result.current.micError).toBe("麦克风被拒绝");
  });

  it("toggleCamera 开启和关闭摄像头", async () => {
    const track = createMockTrack();
    const localMedia = createMockLocalMedia([track]);
    vi.mocked(captureCamera).mockResolvedValue(localMedia);

    const session = createMockSession();
    const { result } = renderHook(() => useMediaTracks());

    // Open
    await act(() => result.current.toggleCamera(session));
    expect(captureCamera).toHaveBeenCalled();
    expect(session.addTrack).toHaveBeenCalledWith(track, localMedia.stream);
    expect(result.current.cameraOn).toBe(true);

    // Close
    await act(() => result.current.toggleCamera(session));
    expect(session.removeTrack).toHaveBeenCalled();
    expect(localMedia.stop).toHaveBeenCalled();
    expect(result.current.cameraOn).toBe(false);
  });

  it("toggleCamera 异常时设置 cameraError", async () => {
    vi.mocked(captureCamera).mockRejectedValue(new Error("摄像头被拒绝"));

    const session = createMockSession();
    const { result } = renderHook(() => useMediaTracks());

    await act(() => result.current.toggleCamera(session));

    expect(result.current.cameraOn).toBe(false);
    expect(result.current.cameraError).toBe("摄像头被拒绝");
  });

  it("cleanup 释放所有媒体资源并重置状态", async () => {
    const micTrack = createMockTrack();
    const micMedia = createMockLocalMedia([micTrack]);
    vi.mocked(captureMicrophone).mockResolvedValue(micMedia);

    const camTrack = createMockTrack();
    const camMedia = createMockLocalMedia([camTrack]);
    vi.mocked(captureCamera).mockResolvedValue(camMedia);

    const session = createMockSession();
    const { result } = renderHook(() => useMediaTracks());

    await act(() => result.current.toggleMic(session));
    await act(() => result.current.toggleCamera(session));
    expect(result.current.micOn).toBe(true);
    expect(result.current.cameraOn).toBe(true);

    act(() => result.current.cleanup());

    expect(micMedia.stop).toHaveBeenCalled();
    expect(camMedia.stop).toHaveBeenCalled();
    expect(result.current.micOn).toBe(false);
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.micError).toBeNull();
    expect(result.current.cameraError).toBeNull();
  });
});
