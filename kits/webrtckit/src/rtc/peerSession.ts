import type { IceCandidatePayload, SignalPayload } from "../signaling/types";
import { isPolitePeer } from "../signaling/roomPolicy";

/**
 * One RTCPeerConnection per remote peer, with perfect-negotiation-style SDP sequencing.
 */
export class PeerSession {
  readonly remotePeerId: string;
  readonly localPeerId: string;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private readonly pc: RTCPeerConnection;
  private readonly emitSignal: (payload: SignalPayload) => void;
  private readonly emitIce: (payload: IceCandidatePayload) => void;
  private readonly log: (msg: string, detail?: unknown) => void;

  constructor(
    remotePeerId: string,
    localPeerId: string,
    pc: RTCPeerConnection,
    emitSignal: (payload: SignalPayload) => void,
    emitIce: (payload: IceCandidatePayload) => void,
    log: (msg: string, detail?: unknown) => void,
  ) {
    this.remotePeerId = remotePeerId;
    this.localPeerId = localPeerId;
    this.pc = pc;
    this.emitSignal = emitSignal;
    this.emitIce = emitIce;
    this.log = log;
    this.polite = isPolitePeer(localPeerId, remotePeerId);
    this.pc.addEventListener("negotiationneeded", () => {
      void this.enqueue(() => this.runNegotiationNeeded());
    });
    this.pc.addEventListener("icecandidate", (ev) => {
      const c = ev.candidate;
      if (!c || this.disposed) return;
      this.emitIce({
        candidate: c.candidate,
        sdpMid: c.sdpMid,
        sdpMLineIndex: c.sdpMLineIndex,
      });
    });
    this.pc.addEventListener("connectionstatechange", () => {
      this.log(`pc[${remotePeerId}] connectionState=${this.pc.connectionState}`, {
        ice: this.pc.iceConnectionState,
      });
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    const next = this.queue
      .then(() => fn())
      .catch((e: unknown) => {
        this.log("peer async error", e);
      });
    this.queue = next.then(() => undefined);
    return next;
  }

  private async runNegotiationNeeded(): Promise<void> {
    if (this.disposed) return;
    try {
      this.makingOffer = true;
      await this.pc.setLocalDescription(await this.pc.createOffer());
      const d = this.pc.localDescription;
      if (d?.type === "offer") {
        this.emitSignal({ kind: "offer", sdp: d.sdp ?? "" });
      }
    } catch (e) {
      this.log(`negotiationneeded failed`, e);
    } finally {
      this.makingOffer = false;
    }
  }

  async handleRemoteSignal(payload: SignalPayload): Promise<void> {
    if (this.disposed) return;
    if (payload.kind === "candidate") {
      if (!payload.ice.candidate) return;
      try {
        await this.pc.addIceCandidate({
          candidate: payload.ice.candidate,
          sdpMid: payload.ice.sdpMid,
          sdpMLineIndex: payload.ice.sdpMLineIndex ?? undefined,
        });
      } catch (e) {
        this.log(`addIceCandidate failed`, e);
      }
      return;
    }

    await this.enqueue(async () => {
      if (payload.kind === "offer") {
        const offerCollision =
          this.pc.signalingState === "have-local-offer" ||
          (this.pc.signalingState === "stable" && this.makingOffer);
        if (offerCollision) {
          if (!this.polite) {
            this.ignoreOffer = true;
            return;
          }
          this.log(`rollback glare with ${this.remotePeerId}`);
          try {
            await this.pc.setLocalDescription({ type: "rollback" });
          } catch (e) {
            this.log("rollback failed", e);
          }
        }
        this.ignoreOffer = false;
        await this.pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        await this.pc.setLocalDescription(await this.pc.createAnswer());
        const loc = this.pc.localDescription;
        if (loc?.type === "answer") {
          this.emitSignal({ kind: "answer", sdp: loc.sdp ?? "" });
        }
        return;
      }
      if (payload.kind === "answer") {
        if (this.ignoreOffer) return;
        await this.pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
      }
    });
  }

  getPeerConnection(): RTCPeerConnection {
    return this.pc;
  }

  dispose(): void {
    this.disposed = true;
    this.pc.close();
  }
}
