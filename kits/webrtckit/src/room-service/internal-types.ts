import type { RemoteParticipant, RemoteTrack, TrackKind, TrackSource, TrackPublication } from "./types"

// ---------------------------------------------------------------------------
// Shared event source
// ---------------------------------------------------------------------------

type EventCallback<T> = (value: T) => void

export class EventSource<T> {
  readonly #cbs = new Set<EventCallback<T>>()

  on(cb: EventCallback<T>): () => void {
    this.#cbs.add(cb)
    return () => this.#cbs.delete(cb)
  }

  emit(value: T): void {
    this.#cbs.forEach((cb) => {
      try {
        cb(value)
      } catch {
        /* consumer handler error — ignore */
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Shared RemoteTrack implementation
// ---------------------------------------------------------------------------

export class SharedRemoteTrack implements RemoteTrack {
  readonly trackId: string
  readonly kind: TrackKind
  readonly source: TrackSource
  readonly track: MediaStreamTrack | null
  #attachedElement: HTMLMediaElement | null = null

  constructor(
    trackId: string,
    kind: TrackKind,
    source: TrackSource,
    track: MediaStreamTrack | null,
  ) {
    this.trackId = trackId
    this.kind = kind
    this.source = source
    this.track = track
  }

  attach(element: HTMLMediaElement): void {
    this.detach()
    this.#attachedElement = element
    element.srcObject = this.track ? new MediaStream([this.track]) : null
  }

  detach(): void {
    if (this.#attachedElement) {
      this.#attachedElement.srcObject = null
      this.#attachedElement = null
    }
  }
}

// ---------------------------------------------------------------------------
// Shared TrackPublication implementation
// ---------------------------------------------------------------------------

export class SharedTrackPublication implements TrackPublication {
  readonly trackId: string
  readonly kind: TrackKind
  readonly source: TrackSource
  readonly track: MediaStreamTrack | null

  constructor(
    trackId: string,
    kind: TrackKind,
    source: TrackSource,
    track: MediaStreamTrack | null,
  ) {
    this.trackId = trackId
    this.kind = kind
    this.source = source
    this.track = track
  }
}

// ---------------------------------------------------------------------------
// Shared RemoteParticipant implementation
// ---------------------------------------------------------------------------

export class SharedRemoteParticipant implements RemoteParticipant {
  readonly id: string
  readonly name: string
  readonly #tracks = new Map<string, RemoteTrack>()

  get tracks(): ReadonlyMap<string, RemoteTrack> {
    return this.#tracks
  }

  addTrack(track: RemoteTrack): void {
    this.#tracks.set(track.trackId, track)
  }

  removeTrack(trackId: string): void {
    this.#tracks.delete(trackId)
  }

  constructor(id: string, name?: string) {
    this.id = id
    this.name = name ?? id
  }
}
