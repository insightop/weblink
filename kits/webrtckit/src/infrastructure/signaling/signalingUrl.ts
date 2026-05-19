/**
 * Build WebSocket URL for signaling. Uses VITE_SIGNALING_BASE when set (e.g. prod Pages URL),
 * otherwise same host as the SPA (with Vite dev + wrangler proxy, use /api on dev server).
 */
export function buildSignalingWsUrl(roomId: string, peerId: string): string {
  const base = import.meta.env.VITE_SIGNALING_BASE as string | undefined;
  if (base) {
    const u = new URL(`/api/room/${encodeURIComponent(roomId)}`, base);
    u.searchParams.set("peerId", peerId);
    if (u.protocol === "https:") u.protocol = "wss:";
    else if (u.protocol === "http:") u.protocol = "ws:";
    return u.toString();
  }
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/api/room/${encodeURIComponent(roomId)}?peerId=${encodeURIComponent(peerId)}`;
}
