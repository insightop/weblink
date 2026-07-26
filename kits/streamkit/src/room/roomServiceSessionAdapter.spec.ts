import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest"
import { RoomServiceSessionAdapter } from "./roomServiceSessionAdapter"

// Inline mocks for types that are not constructable via @weblink/webrtckit exports
class MockRemoteTrack {
  readonly trackId: string
  readonly kind: "audio" | "video"
  readonly source: "camera" | "microphone" | "screen" | "unknown"
  readonly track: MediaStreamTrack | null
  constructor(id: string, kind: "audio" | "video", source: "camera" | "microphone" | "screen" | "unknown", track: MediaStreamTrack | null) {
    this.trackId = id; this.kind = kind; this.source = source; this.track = track
  }
  attach() {}
  detach() {}
}

class MockRemoteParticipant {
  readonly id: string
  readonly name: string
  readonly #tracks = new Map<string, MockRemoteTrack>()
  get tracks(): ReadonlyMap<string, MockRemoteTrack> { return this.#tracks }
  addTrack(t: MockRemoteTrack) { this.#tracks.set(t.trackId, t) }
  constructor(id: string, name?: string) { this.id = id; this.name = name ?? id }
}

/** A mock MediaStreamTrack that can be constructed in happy-dom. */
class FakeTrack {
  kind = "video"
  id = "track"
  enabled = true
  muted = false
  readonly = false
  readyState: "live" | "ended" = "live"
  onended: (() => void) | null = null
  stop() {}
  addEventListener() {}
  removeEventListener() {}
  getCapabilities() { return {} }
  getConstraints() { return {} }
  getSettings() { return {} }
  applyConstraints() { return Promise.resolve() }
  clone() { return Object.assign(Object.create(FakeTrack.prototype), this) as unknown as MediaStreamTrack }
}

/** Minimal MediaStream mock that supports getTracks / removeTrack / addTrack. */
class FakeStream {
  readonly #tracks: MediaStreamTrack[] = []
  constructor(tracks?: MediaStreamTrack[]) { if (tracks) this.#tracks.push(...tracks) }
  getTracks() { return this.#tracks }
  getVideoTracks() { return this.#tracks.filter(t => t.kind === "video") }
  getAudioTracks() { return this.#tracks.filter(t => t.kind === "audio") }
  addTrack(t: MediaStreamTrack) { if (!this.#tracks.includes(t)) this.#tracks.push(t) }
  removeTrack(t: MediaStreamTrack) { const i = this.#tracks.indexOf(t); if (i >= 0) this.#tracks.splice(i, 1) }
  get id() { return "stream-1" }
  get active() { return true }
  clone() { return new FakeStream([...this.#tracks]) as unknown as MediaStream }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true }
}

/** Stub global MediaStream so the adapter can construct streams in tests. */
beforeAll(() => {
  vi.stubGlobal("MediaStream", FakeStream)
})
afterAll(() => {
  vi.unstubAllGlobals()
})

/**
 * Build a mock RoomSession that captures event subscriptions so the
 * test can simulate incoming events by calling the stored callbacks.
 */
function mockSession(): {
  session: Parameters<ConstructorParameters<typeof RoomServiceSessionAdapter>[2]>[0]
  connectionState: string
  emitState: (s: string) => void
  emitJoin: (p: { id: string }) => void
  emitLeft: (p: { id: string }) => void
  emitTrackSub: (track: { trackId: string; kind: string; source: string; track: MediaStreamTrack | null }, p: { id: string }) => void
  emitTrackUnsub: (track: { trackId: string; kind: string; source: string; track: MediaStreamTrack | null }, p: { id: string }) => void
  emitData: (data: unknown, from: string) => void
} {
  const callbacks: Record<string, ((...args: unknown[]) => void) | null> = {
    state: null, join: null, left: null, trackSub: null, trackUnsub: null, data: null,
  }
  const cs = { current: "disconnected" }

  const session = {
    localParticipant: { id: "local", name: "local" },
    remoteParticipants: new Map(),
    get connectionState() { return cs.current },
    onParticipantJoined: vi.fn((cb: (...args: unknown[]) => void) => { callbacks.join = cb; return () => { callbacks.join = null } }),
    onParticipantLeft: vi.fn((cb: (...args: unknown[]) => void) => { callbacks.left = cb; return () => { callbacks.left = null } }),
    onTrackSubscribed: vi.fn((cb: (...args: unknown[]) => void) => { callbacks.trackSub = cb; return () => { callbacks.trackSub = null } }),
    onTrackUnsubscribed: vi.fn((cb: (...args: unknown[]) => void) => { callbacks.trackUnsub = cb; return () => { callbacks.trackUnsub = null } }),
    onConnectionStateChanged: vi.fn((cb: (...args: unknown[]) => void) => { callbacks.state = cb; return () => { callbacks.state = null } }),
    publishTrack: vi.fn().mockResolvedValue({}),
    unpublishTrack: vi.fn(),
    setCameraEnabled: vi.fn(),
    setMicrophoneEnabled: vi.fn(),
    setScreenShareEnabled: vi.fn(),
    sendData: vi.fn(),
    onDataReceived: vi.fn((cb: (...args: unknown[]) => void) => { callbacks.data = cb; return () => { callbacks.data = null } }),
    disconnect: vi.fn(),
  }

  return {
    session,
    get connectionState() { return cs.current },
    emitState: (s: string) => { cs.current = s; callbacks.state?.(s) },
    emitJoin: (p) => callbacks.join?.(p),
    emitLeft: (p) => callbacks.left?.(p),
    emitTrackSub: (track, p) => callbacks.trackSub?.(track, p),
    emitTrackUnsub: (track, p) => callbacks.trackUnsub?.(track, p),
    emitData: (data, from) => callbacks.data?.(data, from),
  }
}

describe("RoomServiceSessionAdapter", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let m: ReturnType<typeof mockSession>
  let adapter: RoomServiceSessionAdapter

  beforeEach(() => {
    m = mockSession()
    adapter = new RoomServiceSessionAdapter("room-1", "local", m.session as Parameters<typeof RoomServiceSessionAdapter.prototype.constructor>[2])
  })

  describe("initial state", () => {
    it("should expose roomId and peerId", () => {
      expect(adapter.roomId).toBe("room-1")
      expect(adapter.peerId).toBe("local")
    })

    it("should start disconnected", () => {
      expect(adapter.state).toBe("disconnected")
    })
  })

  describe("state mapping", () => {
    it("should map connected", () => {
      m.emitState("connected")
      expect(adapter.state).toBe("connected")
    })

    it("should map reconnecting", () => {
      m.emitState("reconnecting")
      expect(adapter.state).toBe("reconnecting")
    })

    it("should emit state-change event", () => {
      const handler = vi.fn()
      adapter.on("state-change", handler)
      m.emitState("connected")
      expect(handler).toHaveBeenCalledWith("connected")
    })

    it("should be disconnected after dispose", () => {
      adapter.dispose()
      expect(adapter.state).toBe("disconnected")
    })
  })

  describe("participant events", () => {
    it("should emit peer-joined with id", () => {
      const handler = vi.fn()
      adapter.on("peer-joined", handler)
      m.emitJoin(new MockRemoteParticipant("peer-1", "Peer 1"))
      expect(handler).toHaveBeenCalledWith("peer-1")
    })

    it("should emit peer-left with id", () => {
      const handler = vi.fn()
      adapter.on("peer-left", handler)
      m.emitLeft(new MockRemoteParticipant("peer-1", "Peer 1"))
      expect(handler).toHaveBeenCalledWith("peer-1")
    })
  })

  describe("track subscription", () => {
    it("should add track to participant's stream", () => {
      const handler = vi.fn()
      adapter.on("remote-stream", handler)
      const track = new FakeTrack() as unknown as MediaStreamTrack
      const rt = new MockRemoteTrack("t1", "video", "unknown", track)
      const p = new MockRemoteParticipant("peer-1", "Peer 1")
      m.emitTrackSub(rt, p)
      expect(handler).toHaveBeenCalledWith("peer-1", expect.any(Object))
    })

    it("should emit camera-stream for camera-source tracks", () => {
      const handler = vi.fn()
      adapter.on("camera-stream", handler)
      const track = new FakeTrack() as unknown as MediaStreamTrack
      const rt = new MockRemoteTrack("t1", "video", "camera", track)
      m.emitTrackSub(rt, new MockRemoteParticipant("peer-1"))
      expect(handler).toHaveBeenCalled()
    })

    it("should emit remote-track-removed on unsubscribed", () => {
      const track = new FakeTrack() as unknown as MediaStreamTrack
      const rt = new MockRemoteTrack("t1", "video", "unknown", track)
      const p = new MockRemoteParticipant("peer-1")
      m.emitTrackSub(rt, p)
      const handler = vi.fn()
      adapter.on("remote-track-removed", handler)
      m.emitTrackUnsub(rt, p)
      expect(handler).toHaveBeenCalledWith("peer-1", track)
    })
  })

  describe("data channel forwarding", () => {
    it("should send mic request via session.sendData", () => {
      adapter.requestMic()
      expect(m.session.sendData).toHaveBeenCalledWith({ kind: "request-mic" })
    })

    it("should send camera request via session.sendData", () => {
      adapter.requestCamera()
      expect(m.session.sendData).toHaveBeenCalledWith({ kind: "request-camera" })
    })

    it("should send encoding strategy via session.sendData", () => {
      adapter.setEncodingStrategy("speed")
      expect(m.session.sendData).toHaveBeenCalledWith({ kind: "encoding-strategy", strategy: "speed" })
    })

    it("should emit mic-request on incoming data", () => {
      const handler = vi.fn()
      adapter.on("mic-request", handler)
      m.emitData({ kind: "request-mic" }, "peer-1")
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should emit camera-request on incoming data", () => {
      const handler = vi.fn()
      adapter.on("camera-request", handler)
      m.emitData({ kind: "request-camera" }, "peer-1")
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should emit strategy-change on incoming data", () => {
      const handler = vi.fn()
      adapter.on("strategy-change", handler)
      m.emitData({ kind: "encoding-strategy", strategy: "quality" }, "peer-1")
      expect(handler).toHaveBeenCalledWith("quality")
    })

    it("should ignore non-object data", () => {
      const handler = vi.fn()
      adapter.on("mic-request", handler)
      m.emitData("raw-string", "peer-1")
      expect(handler).not.toHaveBeenCalled()
    })

    it("should ignore null data", () => {
      const handler = vi.fn()
      adapter.on("mic-request", handler)
      m.emitData(null, "peer-1")
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("media track management", () => {
    it("should publish track via session", () => {
      const track = new FakeTrack() as unknown as MediaStreamTrack
      const stream = { getTracks: () => [track] } as unknown as MediaStream
      adapter.addTrack(track, stream)
      expect(m.session.publishTrack).toHaveBeenCalledWith(track)
    })

    it("should unpublish track via session", async () => {
      const track = new FakeTrack() as unknown as MediaStreamTrack
      const stream = { getTracks: () => [track] } as unknown as MediaStream
      const sender = adapter.addTrack(track, stream)
      // Yield to the microtask queue so publishTrack.then(...) populates #publications
      await new Promise(resolve => setTimeout(resolve, 0))
      adapter.removeTrack(sender)
      expect(m.session.unpublishTrack).toHaveBeenCalled()
    })
  })

  describe("lifecycle", () => {
    it("should disconnect session on dispose", () => {
      adapter.dispose()
      expect(m.session.disconnect).toHaveBeenCalledTimes(1)
    })

    it("should be idempotent on double dispose", () => {
      adapter.dispose()
      adapter.dispose()
      expect(m.session.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})
