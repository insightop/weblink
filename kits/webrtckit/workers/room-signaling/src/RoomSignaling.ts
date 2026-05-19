import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

const V = 1;

type ClientJson =
  | { v: number; type: "signal"; to: string; payload: unknown }
  | { v: number; type: "ping" };

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export class RoomSignaling extends DurableObject<Env> {
  private readonly peerToWs = new Map<string, WebSocket>();
  private readonly wsToPeer = new Map<WebSocket, string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const url = new URL(request.url);
    const peerId = url.searchParams.get("peerId");
    if (!peerId) {
      return new Response("peerId required", { status: 400 });
    }
    if (this.peerToWs.has(peerId)) {
      return new Response("duplicate peerId", { status: 409 });
    }

    const existing = [...this.peerToWs.keys()];
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    this.peerToWs.set(peerId, server);
    this.wsToPeer.set(server, peerId);

    const welcome = JSON.stringify({
      v: V,
      type: "welcome",
      peers: existing,
      self: peerId,
    });
    server.send(welcome);

    const joined = JSON.stringify({ v: V, type: "peer-joined", peerId });
    for (const [pid, ws] of this.peerToWs) {
      if (pid === peerId) continue;
      try {
        ws.send(joined);
      } catch {
        // ignore
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const data = safeJson(raw) as ClientJson | null;
    if (!data || data.v !== V) return;
    if (data.type === "ping") {
      ws.send(JSON.stringify({ v: V, type: "ping" }));
      return;
    }
    if (data.type !== "signal") return;
    const from = this.wsToPeer.get(ws);
    if (!from) return;
    const to = data.to;
    if (typeof to !== "string" || !to) return;
    const target = this.peerToWs.get(to);
    if (!target) {
      ws.send(
        JSON.stringify({
          v: V,
          type: "error",
          message: `peer ${to} not in room`,
        }),
      );
      return;
    }
    const out = JSON.stringify({
      v: V,
      type: "signal",
      from,
      payload: data.payload,
    });
    try {
      target.send(out);
    } catch {
      // ignore
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const peerId = this.wsToPeer.get(ws);
    if (!peerId) return;
    this.wsToPeer.delete(ws);
    this.peerToWs.delete(peerId);
    const left = JSON.stringify({ v: V, type: "peer-left", peerId });
    for (const other of this.peerToWs.values()) {
      try {
        other.send(left);
      } catch {
        // ignore
      }
    }
  }
}
