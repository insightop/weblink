import type { EncodingStrategy } from "../signaling/messageTypes";

/**
 * RTCPeerConnection wrapper — manages a single peer connection lifecycle.
 *
 * This is an internal module used by roomManager. It does NOT handle signaling;
 * it only manages the WebRTC connection state and media tracks.
 */

export interface PeerConnectionManager {
  createOffer(): Promise<RTCSessionDescriptionInit>;
  handleOffer(sdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
  handleAnswer(sdp: RTCSessionDescriptionInit): Promise<void>;
  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
  removeTrack(sender: RTCRtpSender): void;
  close(): void;

  /** Called when a remote track is received */
  onTrack: ((track: MediaStreamTrack, stream: MediaStream) => void) | null;
  /** Called when a local ICE candidate is generated (should be sent via signaling) */
  onIceCandidate: ((candidate: RTCIceCandidate) => void) | null;
  /** Called when the connection state changes */
  onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null;
  /** Called when negotiation is needed (e.g. new tracks added to an established connection) */
  onNegotiationNeeded: (() => Promise<void>) | null;

  /** Adjust video encoding strategy (bitrate, resolution) */
  setEncodingStrategy(strategy: EncodingStrategy): Promise<void>;
}

export function createPeerConnection(config: RTCConfiguration): PeerConnectionManager {
  const pc = new RTCPeerConnection(config);

  let onTrackHandler: ((track: MediaStreamTrack, stream: MediaStream) => void) | null = null;
  let onIceCandidateHandler: ((candidate: RTCIceCandidate) => void) | null = null;
  let onConnectionStateChangeHandler: ((state: RTCPeerConnectionState) => void) | null = null;
  let onNegotiationNeededHandler: (() => Promise<void>) | null = null;

  // Wire up RTCPeerConnection events
  pc.onicecandidate = (ev) => {
    if (ev.candidate && onIceCandidateHandler) {
      onIceCandidateHandler(ev.candidate);
    }
  };

  pc.ontrack = (ev) => {
    if (onTrackHandler && ev.streams[0]) {
      onTrackHandler(ev.track, ev.streams[0]);
    }
  };

  pc.addEventListener("connectionstatechange", () => {
    if (onConnectionStateChangeHandler) {
      onConnectionStateChangeHandler(pc.connectionState);
    }
  });

  pc.onnegotiationneeded = () => {
    if (onNegotiationNeededHandler) {
      void onNegotiationNeededHandler();
    }
  };

  return {
    async createOffer() {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      return offer;
    },

    async handleOffer(sdp) {
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      return answer;
    },

    async handleAnswer(sdp) {
      await pc.setRemoteDescription(sdp);
    },

    async addIceCandidate(candidate) {
      await pc.addIceCandidate(candidate);
    },

    addTrack(track, stream) {
      return pc.addTrack(track, stream);
    },

    removeTrack(sender) {
      pc.removeTrack(sender);
    },

    close() {
      pc.close();
    },

    async setEncodingStrategy(strategy) {
      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track?.kind !== "video") continue;
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];

        switch (strategy) {
          case "auto":
            delete params.encodings[0].maxBitrate;
            delete params.encodings[0].scaleResolutionDownBy;
            break;
          case "speed":
            params.encodings[0].maxBitrate = 200000;
            params.encodings[0].scaleResolutionDownBy = 2.0;
            break;
          case "quality":
            params.encodings[0].maxBitrate = 4_000_000;
            delete params.encodings[0].scaleResolutionDownBy;
            break;
        }

        try {
          await sender.setParameters(params);
        } catch {
          // Browser may not support setParameters
        }
      }
    },

    get onTrack() {
      return onTrackHandler;
    },
    set onTrack(handler) {
      onTrackHandler = handler;
    },

    get onIceCandidate() {
      return onIceCandidateHandler;
    },
    set onIceCandidate(handler) {
      onIceCandidateHandler = handler;
    },

    get onConnectionStateChange() {
      return onConnectionStateChangeHandler;
    },
    set onConnectionStateChange(handler) {
      onConnectionStateChangeHandler = handler;
    },

    get onNegotiationNeeded() {
      return onNegotiationNeededHandler;
    },
    set onNegotiationNeeded(handler) {
      onNegotiationNeededHandler = handler;
    },
  };
}
