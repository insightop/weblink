import type { RTCIceServer } from "@/domain/rtc/iceTypes";

/** Default public STUN — replace in production if policy requires */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Parse multiline or comma-separated STUN/TURN URLs plus optional JSON array.
 * Lines starting with # are ignored.
 */
export function parseIceServersInput(text: string): RTCIceServer[] | null {
  const trimmed = text.trim();
  if (!trimmed) return DEFAULT_ICE_SERVERS;

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return null;
      const out: RTCIceServer[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") return null;
        const u = (item as { urls?: unknown }).urls;
        if (typeof u === "string") {
          const username = (item as { username?: unknown }).username;
          const credential = (item as { credential?: unknown }).credential;
          if (username !== undefined && typeof username !== "string") return null;
          if (credential !== undefined && typeof credential !== "string") return null;
          out.push(
            username !== undefined && credential !== undefined
              ? { urls: u, username, credential }
              : { urls: u },
          );
          continue;
        }
        if (Array.isArray(u) && u.every((x) => typeof x === "string")) {
          out.push({ urls: u as string[] });
          continue;
        }
        return null;
      }
      return out.length ? out : DEFAULT_ICE_SERVERS;
    } catch {
      return null;
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines.length === 0) return DEFAULT_ICE_SERVERS;

  const urls = lines.flatMap((l) =>
    l.split(",").map((x) => x.trim()).filter(Boolean),
  );
  return urls.map((u) => ({ urls: u }));
}
