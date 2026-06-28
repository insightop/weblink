import { createSignalingClient as createBaseClient } from "@weblink/webrtckit";
import type { SignalingTransport } from "./signalingTransport";

/**
 * Create a signaling client typed with streamkit's extended message types.
 * Delegates to @weblink/webrtckit's implementation which has identical runtime behavior.
 */
export function createSignalingClient(): SignalingTransport {
  return createBaseClient() as unknown as SignalingTransport;
}
