import { buildSignalingWsUrl } from "../../signaling/url"
import { createSignalingClient } from "../../signaling/client"
import type { SignalingTransport } from "../../signaling/transport"
import type { ServerToClientMessage, SignalPayload } from "../../signaling/types"
import { createPeerConnection } from "../../rtc/peerConnection"
import { PeerSession } from "../../rtc/peerSession"
import type { RTCIceServer } from "../../rtc/ice"
import { DEFAULT_ICE_SERVERS } from "../../rtc/ice"
import { captureUserMedia, captureDisplayMedia } from "../../rtc/mediaCapture"

import type { RoomService, RoomSession, ParticipantInfo, JoinOptions, JoinResult, ConnectionState, RemoteParticipant, RemoteTrack, TrackPublication, TrackKind, TrackSource } from "../types"
import { RoomError, ErrorCode } from "../errors"
import { EventSource, SharedRemoteTrack, SharedTrackPublication, SharedRemoteParticipant } from "../internal-types"

// ---------------------------------------------------------------------------
// DoRoomSession
// ---------------------------------------------------------------------------

class DoRoomSession implements RoomSession {
  readonly localParticipant: { id: string; name: string }
  readonly remoteParticipants = new Map<string, RemoteParticipant>()
  #connectionState: ConnectionState = "disconnected"

  // Event emitters
  readonly #onParticipantJoined = new EventSource<RemoteParticipant>()
  readonly #onParticipantLeft = new EventSource<RemoteParticipant>()
  readonly #onTrackSubscribed = new EventSource<{
    track: RemoteTrack
    participant: RemoteParticipant
  }>()
  readonly #onTrackUnsubscribed = new EventSource<{
    track: RemoteTrack
    participant: RemoteParticipant
  }>()
  readonly #onConnectionStateChanged = new EventSource<ConnectionState>()
  readonly #onDataReceived = new EventSource<{ data: unknown; from: string }>()

  // Internal state
  #signaling: SignalingTransport | null = null
  #sessions = new Map<string, PeerSession>()
  #publishedTracks = new Map<string, MediaStreamTrack>()
  #localMedia: { stream: MediaStream; stop: () => void } | null = null
  #screenCapture: { stream: MediaStream; stop: () => void } | null = null
  #disposed = false

  constructor(
    participant: ParticipantInfo,
    private readonly options: JoinOptions | undefined,
  ) {
    this.localParticipant = { id: participant.id, name: participant.name }
  }

  // ---- connection state ----

  get connectionState(): ConnectionState {
    return this.#connectionState
  }

  #setConnectionState(s: ConnectionState): void {
    this.#connectionState = s
    this.#onConnectionStateChanged.emit(s)
  }

  // ---- event listeners (subscribe → returns unsubscribe fn) ----

  onParticipantJoined(cb: (p: RemoteParticipant) => void): () => void {
    return this.#onParticipantJoined.on(cb)
  }
  onParticipantLeft(cb: (p: RemoteParticipant) => void): () => void {
    return this.#onParticipantLeft.on(cb)
  }
  onTrackSubscribed(
    cb: (track: RemoteTrack, participant: RemoteParticipant) => void,
  ): () => void {
    return this.#onTrackSubscribed.on(({ track, participant }) =>
      cb(track, participant),
    )
  }
  onTrackUnsubscribed(
    cb: (track: RemoteTrack, participant: RemoteParticipant) => void,
  ): () => void {
    return this.#onTrackUnsubscribed.on(({ track, participant }) =>
      cb(track, participant),
    )
  }
  onConnectionStateChanged(cb: (state: ConnectionState) => void): () => void {
    return this.#onConnectionStateChanged.on(cb)
  }

  // ---- media publish / unpublish ----

  async publishTrack(
    track: MediaStreamTrack,
    _options?: import("../types").PublishOptions,
  ): Promise<TrackPublication> {
    const tid = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const kind: TrackKind = track.kind === "audio" ? "audio" : "video"
    const source: TrackSource = kind === "video" ? "camera" : "microphone"
    this.#publishedTracks.set(tid, track)
    for (const sess of this.#sessions.values()) {
      const pc = sess.getPeerConnection()
      if (!pc.getSenders().some((s) => s.track === track)) {
        pc.addTrack(track, new MediaStream([track]))
      }
    }
    return new SharedTrackPublication(tid, kind, source, track)
  }

  unpublishTrack(publication: TrackPublication): void {
    this.#publishedTracks.delete(publication.trackId)
    for (const sess of this.#sessions.values()) {
      const pc = sess.getPeerConnection()
      const sender = pc.getSenders().find((s) => s.track === publication.track)
      if (sender) {
        try {
          pc.removeTrack(sender)
        } catch {
          /* already gone */
        }
      }
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.#localMedia) {
      const m = await captureUserMedia(true, true)
      this.#localMedia = m
      for (const t of m.stream.getTracks()) {
        await this.publishTrack(t)
      }
    } else if (!enabled && this.#localMedia) {
      for (const t of this.#localMedia.stream.getVideoTracks()) {
        this.#publishedTracks.forEach((pt, id) => {
          if (pt === t) this.#publishedTracks.delete(id)
        })
      }
      this.#localMedia.stop()
      this.#localMedia = null
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.#localMedia) {
      const m = await captureUserMedia(true, false)
      this.#localMedia = m
      for (const t of m.stream.getTracks()) {
        await this.publishTrack(t)
      }
    } else if (this.#localMedia) {
      // toggle the audio track directly
      this.#localMedia.stream.getAudioTracks().forEach((t) => {
        t.enabled = enabled
      })
    }
  }

  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      const cap = await captureDisplayMedia(true)
      this.#screenCapture = cap
      const vt = cap.stream.getVideoTracks()[0]
      if (vt) {
        await this.publishTrack(vt)
        vt.addEventListener("ended", () => {
          // browser UI stopped the share
          this.#screenCapture?.stop()
          this.#screenCapture = null
        })
      }
    } else if (this.#screenCapture) {
      this.#screenCapture.stop()
      this.#screenCapture = null
    }
  }

  // ---- internal: connect ----

  async connect(): Promise<void> {
    this.#connectionState
    const roomId = this.options?.roomId ?? ""
    if (!roomId) throw new RoomError(ErrorCode.InvalidOperation, "roomId is required")

    this.#setConnectionState("connecting")
    const signaling = createSignalingClient()
    this.#signaling = signaling

    const iceServers: RTCIceServer[] =
      (this.options?.iceServers as RTCIceServer[]) ?? DEFAULT_ICE_SERVERS

    signaling.onClose(() => {
      this.#setConnectionState("disconnected")
    })

    signaling.onMessage((msg) => {
      this.#handleSignalingMessage(msg, iceServers)
    })

    const wsUrl = buildSignalingWsUrl(roomId, this.localParticipant.id)
    try {
      await signaling.connect(wsUrl)
    } catch (e) {
      throw new RoomError(ErrorCode.ConnectionFailed, "failed to connect", { cause: e })
    }

    this.#setConnectionState("connected")
  }

  // ---- internal: signaling message handling ----

  #handleSignalingMessage(
    msg: ServerToClientMessage,
    iceServers: RTCIceServer[],
  ): void {
    if (msg.type === "welcome") {
      for (const p of msg.peers) {
        this.#ensurePeer(p, iceServers)
      }
      return
    }

    if (msg.type === "peer-joined") {
      this.#ensurePeer(msg.peerId, iceServers)
      return
    }

    if (msg.type === "peer-left") {
      this.#removePeer(msg.peerId)
      return
    }

    if (msg.type === "error") {
      return
    }

    if (msg.type === "signal") {
      // Intercept app-data payloads for the data channel
      if ((msg.payload as Record<string, unknown>).kind === "app-data") {
        this.#onDataReceived.emit({ data: (msg.payload as Record<string, unknown>).data, from: msg.from })
        return
      }
      const payload = msg.payload as SignalPayload
      const s = this.#sessions.get(msg.from)
      if (s) {
        s.handleRemoteSignal(payload).catch(() => undefined)
      }
    }
  }

  #ensurePeer(peerId: string, iceServers: RTCIceServer[]): void {
    if (this.#sessions.has(peerId)) return

    // Build the internal RemoteParticipant
    let rp = this.remoteParticipants.get(peerId) as SharedRemoteParticipant | undefined
    if (!rp) {
      rp = new SharedRemoteParticipant(peerId)
      this.remoteParticipants.set(peerId, rp)
    }

    // Create PeerSession
    const pc = createPeerConnection(iceServers)
    const session = new PeerSession(
      peerId,
      this.localParticipant.id,
      pc,
      (payload) => {
        this.#signaling?.send({
          v: 1,
          type: "signal",
          to: peerId,
          payload,
        })
      },
      (ice) => {
        this.#signaling?.send({
          v: 1,
          type: "signal",
          to: peerId,
          payload: { kind: "candidate", ice },
        })
      },
      () => undefined,
    )

    // Wire up remote track events
    pc.addEventListener("track", (ev) => {
      const stream = ev.streams[0]
      if (!stream) return
      const remoteTrack = new SharedRemoteTrack(
        `remote_${peerId}_${Math.random().toString(36).slice(2, 6)}`,
        ev.track.kind === "audio" ? "audio" : "video",
        "unknown",
        ev.track,
      )
      rp.addTrack(remoteTrack)
      this.#onTrackSubscribed.emit({ track: remoteTrack, participant: rp })
    })

    // Add already-published tracks
    for (const t of this.#publishedTracks.values()) {
      pc.addTrack(t, new MediaStream([t]))
    }

    this.#sessions.set(peerId, session)
    this.#onParticipantJoined.emit(rp)
  }

  #removePeer(peerId: string): void {
    const session = this.#sessions.get(peerId)
    if (session) {
      session.dispose()
      this.#sessions.delete(peerId)
    }
    const rp = this.remoteParticipants.get(peerId) as SharedRemoteParticipant | undefined
    if (rp) {
      this.remoteParticipants.delete(peerId)
      this.#onParticipantLeft.emit(rp)
    }
  }

  // ---- data channel ----

  sendData(data: unknown): void {
    if (this.#disposed || !this.#signaling) return
    for (const peerId of this.#sessions.keys()) {
      this.#signaling.send({
        v: 1,
        type: "signal",
        to: peerId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: { kind: "app-data", data } as any,
      })
    }
  }

  onDataReceived(cb: (data: unknown, from: string) => void): () => void {
    return this.#onDataReceived.on(({ data, from }) => cb(data, from))
  }

  // ---- disconnect / dispose ----

  disconnect(): void {
    if (this.#disposed) return
    this.#disposed = true

    this.#signaling?.disconnect()
    this.#signaling = null

    for (const s of this.#sessions.values()) s.dispose()
    this.#sessions.clear()
    this.remoteParticipants.clear()

    this.#localMedia?.stop()
    this.#localMedia = null

    this.#screenCapture?.stop()
    this.#screenCapture = null

    this.#publishedTracks.clear()
    this.#setConnectionState("disconnected")
  }
}

// ---------------------------------------------------------------------------
// DoRoomService — public factory
// ---------------------------------------------------------------------------

export class DoRoomService implements RoomService {
  async joinRoom(
    participant: ParticipantInfo,
    options?: JoinOptions,
  ): Promise<JoinResult> {
    const session = new DoRoomSession(participant, options)
    await session.connect()
    const roomId = options?.roomId ?? ""
    return { roomId, session }
  }
}

/** Convenience factory */
export function createDoRoomService(): RoomService {
  return new DoRoomService()
}
