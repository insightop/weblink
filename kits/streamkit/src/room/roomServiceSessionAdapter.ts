import type { RoomSession, RemoteParticipant, RemoteTrack, TrackPublication } from "@weblink/webrtckit"
import type { Session, SessionEventMap, SessionState } from "./roomTypes"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (...args: any[]) => void

/** Map RoomService ConnectionState to streamkit SessionState. */
function mapState(state: string): SessionState {
  if (state === "reconnecting") return "reconnecting"
  if (state === "connected") return "connected"
  if (state === "connecting") return "connecting"
  if (state === "disconnected") return "disconnected"
  return "error"
}

/**
 * Wraps a RoomService RoomSession into the streamkit Session interface.
 *
 * Allows streamkit components (AdminApp, TopControlBar, useSessionManager,
 * useMediaTracks) to work transparently with any RoomService backend without
 * changing their code.
 */
export class RoomServiceSessionAdapter implements Session {
  readonly roomId: string
  readonly peerId: string
  readonly #session: RoomSession
  readonly #handlers = new Map<string, AnyEventHandler[]>()
  /** Map mock-sender → TrackPublication for {add,unpublish}Track bridging. */
  readonly #publications = new Map<object, TrackPublication>()
  /** Per-participant MediaStream rebuilt from their RemoteTrack list. */
  readonly #streams = new Map<string, MediaStream>()
  #cameraStream: MediaStream | null = null
  #unsubs: (() => void)[] = []
  #disposed = false

  constructor(roomId: string, peerId: string, session: RoomSession) {
    this.roomId = roomId
    this.peerId = peerId
    this.#session = session
    this.#wireEvents()
    // Build streams from any participants already in the room
    for (const [, p] of session.remoteParticipants) {
      for (const [, t] of p.tracks) {
        this.#handleTrack(t, p)
      }
    }
  }

  // -----------------------------------------------------------------------
  // Session read-only state
  // -----------------------------------------------------------------------

  get state(): SessionState {
    if (this.#disposed) return "disconnected"
    return mapState(this.#session.connectionState)
  }

  get remoteStreams(): ReadonlyMap<string, MediaStream> {
    return this.#streams
  }

  get cameraStream(): MediaStream | null {
    return this.#cameraStream
  }

  // -----------------------------------------------------------------------
  // Event system
  // -----------------------------------------------------------------------

  on<K extends keyof SessionEventMap>(event: K, handler: SessionEventMap[K]): void {
    const list = this.#handlers.get(event) ?? []
    list.push(handler as AnyEventHandler)
    this.#handlers.set(event, list)
  }

  off<K extends keyof SessionEventMap>(event: K, handler: SessionEventMap[K]): void {
    const list = this.#handlers.get(event) ?? []
    this.#handlers.set(event, list.filter((x) => x !== handler) as SessionEventMap[K][])
  }

  #emit(event: string, ...args: unknown[]): void {
    this.#handlers.get(event)?.forEach((h) => h(...args))
  }

  // -----------------------------------------------------------------------
  // Media track management
  // -----------------------------------------------------------------------

  addTrack(track: MediaStreamTrack, _stream: MediaStream): RTCRtpSender {
    // Return a lightweight object identity that removeTrack uses for lookup.
    const sender = { track } as unknown as RTCRtpSender
    this.#session.publishTrack(track).then((pub) => {
      this.#publications.set(sender, pub)
    }).catch(() => {
      this.#publications.delete(sender)
    })
    return sender
  }

  removeTrack(sender: RTCRtpSender): void {
    const pub = this.#publications.get(sender)
    if (pub) this.#session.unpublishTrack(pub)
    this.#publications.delete(sender)
  }

  // -----------------------------------------------------------------------
  // Data channel — sends app-level messages via RoomSession.sendData
  // -----------------------------------------------------------------------

  async setEncodingStrategy(strategy: string): Promise<void> {
    this.#session.sendData({ kind: "encoding-strategy", strategy })
  }

  requestMic(): void {
    this.#session.sendData({ kind: "request-mic" })
  }

  requestCamera(): void {
    this.#session.sendData({ kind: "request-camera" })
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#unsubs.forEach((fn) => fn())
    this.#unsubs = []
    this.#session.disconnect()
    this.#cameraStream = null
    this.#streams.clear()
    this.#handlers.clear()
  }

  // -----------------------------------------------------------------------
  // Internal: RoomSession event wiring
  // -----------------------------------------------------------------------

  #wireEvents(): void {
    this.#unsubs.push(
      this.#session.onConnectionStateChanged((s) => {
        this.#emit("state-change", mapState(s))
      }),
      this.#session.onParticipantJoined((p) => {
        this.#emit("peer-joined", p.id)
        for (const [, t] of p.tracks) {
          this.#handleTrack(t, p)
        }
      }),
      this.#session.onParticipantLeft((p) => {
        this.#emit("peer-left", p.id)
        this.#streams.delete(p.id)
        this.#emit("remote-stream", p.id, this.#streams)
      }),
      this.#session.onTrackSubscribed((track, p) => {
        this.#handleTrack(track, p)
      }),
      this.#session.onTrackUnsubscribed((track, p) => {
        this.#removeTrack(track, p)
      }),
      this.#session.onDataReceived((data, _from) => {
        if (typeof data !== "object" || data === null) return
        const msg = data as Record<string, unknown>
        if (msg.kind === "request-mic") this.#emit("mic-request")
        if (msg.kind === "request-camera") this.#emit("camera-request")
        if (msg.kind === "encoding-strategy") this.#emit("strategy-change", msg.strategy)
      }),
    )
  }

  #handleTrack(track: RemoteTrack, participant: RemoteParticipant): void {
    if (!track.track) return

    const streamId = participant.id
    let stream = this.#streams.get(streamId)

    if (stream) {
      if (!stream.getTracks().includes(track.track)) {
        stream.addTrack(track.track)
      }
    } else {
      stream = new MediaStream([track.track])
      this.#streams.set(streamId, stream)
    }

    if (track.source === "camera") {
      this.#cameraStream = stream
      this.#emit("camera-stream", stream)
    }

    this.#emit("remote-stream", streamId, stream)
  }

  #removeTrack(track: RemoteTrack, participant: RemoteParticipant): void {
    if (!track.track) return

    const stream = this.#streams.get(participant.id)
    if (stream) {
      stream.removeTrack(track.track)
      if (stream.getTracks().length === 0) {
        this.#streams.delete(participant.id)
      }
    }

    if (track.source === "camera") {
      this.#cameraStream = null
      this.#emit("camera-stream", null)
    }

    this.#emit("remote-track-removed", participant.id, track.track)
  }
}
