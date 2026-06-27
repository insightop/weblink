interface Env {
  ROOMS: DurableObjectNamespace;
}

/**
 * WebSocket 信令端点
 * GET /api/room/:roomId/signaling?peerId=xxx&password=xxx
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const roomId = context.params.roomId as string;
  const url = new URL(context.request.url);
  const peerId = url.searchParams.get("peerId");
  const password = url.searchParams.get("password");

  if (!peerId) {
    return new Response("peerId required", { status: 400 });
  }

  const doId = context.env.ROOMS.idFromName(roomId);
  const stub = context.env.ROOMS.get(doId);

  // 转发到 Durable Object，保留 query params
  const doUrl = new URL(context.request.url);
  doUrl.searchParams.set("peerId", peerId);
  if (password) doUrl.searchParams.set("password", password);

  return stub.fetch(new Request(doUrl.toString(), context.request));
};
