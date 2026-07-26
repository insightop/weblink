export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting"
export type TrackKind = "audio" | "video"
export type TrackSource = "camera" | "microphone" | "screen" | "unknown"

export interface ParticipantInfo {
  id: string
  name: string
  metadata?: Record<string, string>
}

export interface PublishOptions {
  source?: TrackSource
  simulcast?: boolean
  videoEncoding?: { maxBitrate: number; maxFramerate: number }
}

export interface JoinOptions {
  roomId?: string
  iceServers?: RTCIceServer[]
}

export interface JoinResult {
  roomId: string
  session: RoomSession
}

export interface RoomService {
  joinRoom(participant: ParticipantInfo, options?: JoinOptions): Promise<JoinResult>
}

export interface RoomSession {
  readonly localParticipant: { id: string; name: string }
  readonly remoteParticipants: Map<string, RemoteParticipant>
  readonly connectionState: ConnectionState

  onParticipantJoined(cb: (p: RemoteParticipant) => void): () => void
  onParticipantLeft(cb: (p: RemoteParticipant) => void): () => void
  onTrackSubscribed(
    cb: (track: RemoteTrack, participant: RemoteParticipant) => void,
  ): () => void
  onTrackUnsubscribed(
    cb: (track: RemoteTrack, participant: RemoteParticipant) => void,
  ): () => void
  onConnectionStateChanged(cb: (state: ConnectionState) => void): () => void

  publishTrack(
    track: MediaStreamTrack,
    options?: PublishOptions,
  ): Promise<TrackPublication>
  unpublishTrack(publication: TrackPublication): void
  setCameraEnabled(enabled: boolean): Promise<void>
  setMicrophoneEnabled(enabled: boolean): Promise<void>
  setScreenShareEnabled(enabled: boolean): Promise<void>

  /** Send application-level data to remote peers via the session's data channel. */
  sendData(data: unknown): void
  /** Listen for application-level data received from remote peers. */
  onDataReceived(cb: (data: unknown, from: string) => void): () => void

  disconnect(): void
}

export interface RemoteParticipant {
  readonly id: string
  readonly name: string
  readonly tracks: ReadonlyMap<string, RemoteTrack>
}

export interface TrackPublication {
  readonly trackId: string
  readonly kind: TrackKind
  readonly source: TrackSource
  readonly track: MediaStreamTrack | null
}

export interface RemoteTrack {
  readonly trackId: string
  readonly kind: TrackKind
  readonly source: TrackSource
  readonly track: MediaStreamTrack | null
  attach(element: HTMLMediaElement): void
  detach(): void
}
