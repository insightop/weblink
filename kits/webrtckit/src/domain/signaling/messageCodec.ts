import type { ClientToServerMessage, ServerToClientMessage } from "@/domain/signaling/messageTypes";
import { SIGNALING_VERSION } from "@/domain/signaling/messageTypes";

export function parseServerMessage(raw: string): ServerToClientMessage | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const v = (data as { v?: unknown }).v;
    if (v !== SIGNALING_VERSION) return null;
    const type = (data as { type?: unknown }).type;
    if (type === "welcome") {
      const peers = (data as { peers?: unknown }).peers;
      const self = (data as { self?: unknown }).self;
      if (!Array.isArray(peers) || typeof self !== "string") return null;
      if (!peers.every((p) => typeof p === "string")) return null;
      return { v: SIGNALING_VERSION, type: "welcome", peers, self };
    }
    if (type === "peer-joined" || type === "peer-left") {
      const peerId = (data as { peerId?: unknown }).peerId;
      if (typeof peerId !== "string") return null;
      return { v: SIGNALING_VERSION, type, peerId };
    }
    if (type === "signal") {
      const from = (data as { from?: unknown }).from;
      const payload = (data as { payload?: unknown }).payload;
      if (typeof from !== "string" || !payload || typeof payload !== "object") return null;
      const p = payload as { kind?: unknown };
      if (p.kind === "offer" || p.kind === "answer") {
        const sdp = (payload as { sdp?: unknown }).sdp;
        if (typeof sdp !== "string") return null;
        return {
          v: SIGNALING_VERSION,
          type: "signal",
          from,
          payload: { kind: p.kind, sdp },
        };
      }
      if (p.kind === "candidate") {
        const ice = (payload as { ice?: unknown }).ice;
        if (!ice || typeof ice !== "object") return null;
        const candidate = (ice as { candidate?: unknown }).candidate;
        const sdpMid = (ice as { sdpMid?: unknown }).sdpMid;
        const sdpMLineIndex = (ice as { sdpMLineIndex?: unknown }).sdpMLineIndex;
        if (typeof candidate !== "string") return null;
        if (sdpMid !== null && sdpMid !== undefined && typeof sdpMid !== "string") return null;
        if (typeof sdpMLineIndex !== "number" && sdpMLineIndex !== null) return null;
        return {
          v: SIGNALING_VERSION,
          type: "signal",
          from,
          payload: {
            kind: "candidate",
            ice: {
              candidate,
              sdpMid: sdpMid ?? null,
              sdpMLineIndex: sdpMLineIndex ?? null,
            },
          },
        };
      }
      return null;
    }
    if (type === "error") {
      const message = (data as { message?: unknown }).message;
      if (typeof message !== "string") return null;
      return { v: SIGNALING_VERSION, type: "error", message };
    }
    return null;
  } catch {
    return null;
  }
}

export function stringifyClientMessage(msg: ClientToServerMessage): string {
  return JSON.stringify(msg);
}
