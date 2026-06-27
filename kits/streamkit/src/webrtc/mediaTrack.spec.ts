import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureScreen, captureMicrophone } from "./mediaTrack";

function createMockTrack() {
  return { stop: vi.fn(), kind: "video" } as unknown as MediaStreamTrack;
}

function createMockStream(tracks: MediaStreamTrack[]) {
  return {
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

describe("captureScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call getDisplayMedia and return LocalMedia", async () => {
    const track = createMockTrack();
    const stream = createMockStream([track]);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const result = await captureScreen();

    expect(result.stream).toBe(stream);
    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
  });

  it("should stop all tracks when stop() is called", async () => {
    const track1 = createMockTrack();
    const track2 = createMockTrack();
    const stream = createMockStream([track1, track2]);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const result = await captureScreen();
    result.stop();

    expect(track1.stop).toHaveBeenCalled();
    expect(track2.stop).toHaveBeenCalled();
  });

  it("should throw when user denies permission", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });

    await expect(captureScreen()).rejects.toThrow("Permission denied");
  });
});

describe("captureMicrophone", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call getUserMedia and return LocalMedia", async () => {
    const track = createMockTrack();
    const stream = createMockStream([track]);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const result = await captureMicrophone();

    expect(result.stream).toBe(stream);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });

  it("should throw when user denies microphone permission", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
    });

    await expect(captureMicrophone()).rejects.toThrow("NotAllowedError");
  });
});
