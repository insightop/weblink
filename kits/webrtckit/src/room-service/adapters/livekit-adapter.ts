/**
 * LiveKit RoomService adapter.
 *
 * Maps the unified RoomService interface to LiveKit's Room + localParticipant API.
 * Requires a TokenProvider to fetch server URL + JWT credentials at join time.
 *
 * ```typescript
 * const adapter = new LiveKitRoomService(new ApiTokenProvider("/api/livekit/token"))
 * const { session } = await adapter.joinRoom({ id: "user1", name: "Alice" }, { roomId: "my-room" })
 * ```
 *
 * @module livekit-adapter
 */

import { Room, RoomEvent, Track, ConnectionState as LkConnectionState } from "livekit-client"

import type { RoomService, RoomSession, ParticipantInfo, JoinOptions, JoinResult, ConnectionState, PublishOptions, RemoteParticipant, RemoteTrack, TrackPublication, TrackKind, TrackSource } from "../types"
import { RoomError, ErrorCode } from "../errors"
import { EventSource, SharedRemoteTrack, SharedTrackPublication, SharedRemoteParticipant } from "../internal-types"

// ---------------------------------------------------------------------------
// Token provider
// ---------------------------------------------------------------------------

/** Abstracts how LiveKit credentials are obtained. */
export interface TokenProvider {
  /** Returns the LiveKit server URL and a JWT token for the given room / identity. */
  getToken(roomId: string, identity: string): Promise<{ serverUrl: string; token: string }>
}

/**
 * Simple TokenProvider that fetches credentials from a REST endpoint.
 *
 * The endpoint receives `?room=<roomId>&identity=<peerId>` query params and
 * is expected to return `{ serverUrl: string; token: string }`.
 */
export class ApiTokenProvider implements TokenProvider {
  constructor(private readonly endpoint: string) {}

  async getToken(roomId: string, identity: string): Promise<{ serverUrl: string; token: string }> {
    const url = `${this.endpoint}?room=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(identity)}`
    const res = await fetch(url)
    if (!res.ok) throw new RoomError(ErrorCode.AuthFailed, `LiveKit token fetch failed: ${res.status}`)
    return res.json() as Promise<{ serverUrl: string; token: string }>
  }
}

// ---------------------------------------------------------------------------
// Type mappers
// ---------------------------------------------------------------------------

function mapKind(kind: Track.Kind): TrackKind {
  return kind === Track.Kind.Audio ? "audio" : "video"
}

function mapSource(source: Track.Source): TrackSource {
  switch (source) {
    case Track.Source.Camera:
      return "camera"
    case Track.Source.Microphone:
      return "microphone"
    case Track.Source.ScreenShare:
    case Track.Source.ScreenShareAudio:
      return "screen"
    default:
      return "unknown"
  }
}

function mapSourceToLk(source: TrackSource): Track.Source | undefined {
  switch (source) {
    case "camera":
      return Track.Source.Camera
    case "microphone":
      return Track.Source.Microphone
    case "screen":
      return Track.Source.ScreenShare
    default:
      return undefined
  }
}

/** Map LiveKit ConnectionState enum to our ConnectionState union. */
function mapConnectionState(lkState: LkConnectionState): ConnectionState {
  switch (lkState) {
    case LkConnectionState.Disconnected:
      return "disconnected"
    case LkConnectionState.Connecting:
      return "connecting"
    case LkConnectionState.Connected:
      return "connected"
    case LkConnectionState.Reconnecting:
      return "reconnecting"
    default:
      return "disconnected"
  }
}

// ---------------------------------------------------------------------------
// Internal RemoteTrack — wraps LiveKit types into shared implementation
// ---------------------------------------------------------------------------

function makeRemoteTrack(trackSid: string, kind: Track.Kind, source: Track.Source, mediaStreamTrack: MediaStreamTrack | null): SharedRemoteTrack {
  return new SharedRemoteTrack(trackSid, mapKind(kind), mapSource(source), mediaStreamTrack)
}

// ---------------------------------------------------------------------------
// Internal TrackPublication — wraps LiveKit types into shared implementation
// ---------------------------------------------------------------------------

function makePublication(trackSid: string, kind: Track.Kind, source: Track.Source, mediaStreamTrack: MediaStreamTrack | null): SharedTrackPublication {
  return new SharedTrackPublication(trackSid, mapKind(kind), mapSource(source), mediaStreamTrack)
}

// ---------------------------------------------------------------------------
// LiveKitRoomSession
// ---------------------------------------------------------------------------

class LiveKitRoomSession implements RoomSession {
  readonly localParticipant: { id: string; name: string }
  readonly remoteParticipants = new Map<string, RemoteParticipant>()
  #connectionState: ConnectionState = "disconnected"

  readonly #onParticipantJoined = new EventSource<RemoteParticipant>()
  readonly #onParticipantLeft = new EventSource<RemoteParticipant>()
  readonly #onTrackSubscribed = new EventSource<{ track: RemoteTrack; participant: RemoteParticipant }>()
  readonly #onTrackUnsubscribed = new EventSource<{ track: RemoteTrack; participant: RemoteParticipant }>()
  readonly #onConnectionStateChanged = new EventSource<ConnectionState>()
  readonly #onDataReceived = new EventSource<{ data: unknown; from: string }>()

  readonly #room: Room
  #roomSubs: (() => void)[] = []
  #disposed = false

  constructor(room: Room, participant: ParticipantInfo) {
    this.#room = room
    this.localParticipant = { id: participant.id, name: participant.name }
  }

  /** Subscribe to LiveKit room events. Must be called before room.connect(). */
  wireRoomEvents(): void {
    const r = this.#room

    r.on(RoomEvent.ParticipantConnected, (lkP) => {
      const rp = new SharedRemoteParticipant(lkP.identity, lkP.name)
      this.remoteParticipants.set(lkP.identity, rp)
      this.#onParticipantJoined.emit(rp)
    })

    r.on(RoomEvent.ParticipantDisconnected, (lkP) => {
      const rp = this.remoteParticipants.get(lkP.identity)
      if (rp) {
        this.remoteParticipants.delete(lkP.identity)
        this.#onParticipantLeft.emit(rp)
      }
    })

    r.on(RoomEvent.TrackSubscribed, (_lkTrack, _pub, lkP) => {
      const rp = this.remoteParticipants.get(lkP.identity)
      if (!rp) return
      const track = makeRemoteTrack(
        _pub.trackSid,
        _pub.kind,
        _pub.source,
        _lkTrack.mediaStreamTrack ?? null,
      )
      ;(rp as SharedRemoteParticipant).addTrack(track)
      this.#onTrackSubscribed.emit({ track, participant: rp })
    })

    r.on(RoomEvent.TrackUnsubscribed, (_lkTrack, pub, lkP) => {
      const rp = this.remoteParticipants.get(lkP.identity)
      if (!rp) return
      ;(rp as SharedRemoteParticipant).removeTrack(pub.trackSid)
      const track = makeRemoteTrack(
        pub.trackSid,
        pub.kind,
        pub.source,
        _lkTrack.mediaStreamTrack ?? null,
      )
      this.#onTrackUnsubscribed.emit({ track, participant: rp })
    })

    r.on(RoomEvent.ConnectionStateChanged, (lkState: LkConnectionState) => {
      const state = mapConnectionState(lkState)
      this.#connectionState = state
      this.#onConnectionStateChanged.emit(state)
    })

    r.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: unknown, _kind: unknown) => {
      if (!participant) return // skip self-sent
      try {
        const data = JSON.parse(new TextDecoder().decode(payload))
        const from = (participant as { identity: string }).identity
        this.#onDataReceived.emit({ data, from })
      } catch {
        /* ignore malformed data */
      }
    })

    this.#roomSubs = []
  }

  get connectionState(): ConnectionState {
    return this.#connectionState
  }

  onParticipantJoined(cb: (p: RemoteParticipant) => void): () => void {
    return this.#onParticipantJoined.on(cb)
  }

  onParticipantLeft(cb: (p: RemoteParticipant) => void): () => void {
    return this.#onParticipantLeft.on(cb)
  }

  onTrackSubscribed(cb: (track: RemoteTrack, participant: RemoteParticipant) => void): () => void {
    return this.#onTrackSubscribed.on(({ track, participant }) => cb(track, participant))
  }

  onTrackUnsubscribed(cb: (track: RemoteTrack, participant: RemoteParticipant) => void): () => void {
    return this.#onTrackUnsubscribed.on(({ track, participant }) => cb(track, participant))
  }

  onConnectionStateChanged(cb: (state: ConnectionState) => void): () => void {
    return this.#onConnectionStateChanged.on(cb)
  }

  async publishTrack(track: MediaStreamTrack, _options?: PublishOptions): Promise<TrackPublication> {
    const pub = await this.#room.localParticipant.publishTrack(track, {
      ...(_options?.source ? { source: mapSourceToLk(_options.source) } : {}),
    })
    return makePublication(pub.trackSid, pub.kind, pub.source, pub.track?.mediaStreamTrack ?? null)
  }

  unpublishTrack(publication: TrackPublication): void {
    if (!publication.track) return
    this.#room.localParticipant.unpublishTrack(publication.track).catch(() => {
      /* already unpublished */
    })
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    await this.#room.localParticipant.setCameraEnabled(enabled)
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    await this.#room.localParticipant.setMicrophoneEnabled(enabled)
  }

  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    await this.#room.localParticipant.setScreenShareEnabled(enabled)
  }

  // ---- data channel ----

  sendData(data: unknown): void {
    const raw = new TextEncoder().encode(JSON.stringify(data))
    this.#room.localParticipant.publishData(raw).catch(() => {
      /* send best-effort */
    })
  }

  onDataReceived(cb: (data: unknown, from: string) => void): () => void {
    return this.#onDataReceived.on(({ data, from }) => cb(data, from))
  }

  disconnect(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#roomSubs.forEach((fn) => fn())
    this.#roomSubs = []
    this.#room.disconnect()
    this.#connectionState = "disconnected"
  }
}

// ---------------------------------------------------------------------------
// RoomService options for LiveKit
// ---------------------------------------------------------------------------

export interface LiveKitJoinOptions extends JoinOptions {
  /** LiveKit Room constructor options (adaptiveStream, dynacast, etc.). */
  roomOptions?: {
    adaptiveStream?: boolean
    dynacast?: boolean
  }
}

// ---------------------------------------------------------------------------
// LiveKitRoomService
// ---------------------------------------------------------------------------

export class LiveKitRoomService implements RoomService {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async joinRoom(participant: ParticipantInfo, options?: LiveKitJoinOptions): Promise<JoinResult> {
    const roomId = options?.roomId ?? ""
    if (!roomId) throw new RoomError(ErrorCode.InvalidOperation, "roomId is required for LiveKit")

    const { serverUrl, token } = await this.tokenProvider.getToken(roomId, participant.id)

    const room = new Room({
      adaptiveStream: options?.roomOptions?.adaptiveStream ?? true,
      dynacast: options?.roomOptions?.dynacast ?? true,
    })

    const session = new LiveKitRoomSession(room, participant)
    session.wireRoomEvents()

    try {
      await room.connect(serverUrl, token)
    } catch (e) {
      throw new RoomError(ErrorCode.ConnectionFailed, "LiveKit connection failed", { cause: e })
    }

    // Populate existing participants
    for (const [, lkP] of room.remoteParticipants) {
      const rp = new SharedRemoteParticipant(lkP.identity, lkP.name)
      session.remoteParticipants.set(lkP.identity, rp)
      for (const [, pub] of lkP.trackPublications) {
        if (pub.track) {
          const rt = makeRemoteTrack(pub.trackSid, pub.kind, pub.source, pub.track.mediaStreamTrack ?? null)
          ;(rp as SharedRemoteParticipant).addTrack(rt)
        }
      }
    }

    return { roomId, session }
  }
}
