import { SIGNALING_VERSION } from "./messageTypes";
import type { ClientToServerMessage, ServerToClientMessage } from "./messageTypes";

export function stringifyClientMessage(msg: ClientToServerMessage): string {
  return JSON.stringify(msg);
}

export function parseServerMessage(raw: string): ServerToClientMessage | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const msg = data as Record<string, unknown>;
    if (msg.v !== SIGNALING_VERSION) return null;
    return data as ServerToClientMessage;
  } catch {
    return null;
  }
}
