export async function onRequest(context) {
  const upgrade = context.request.headers.get("Upgrade");
  if (upgrade?.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  const { roomId } = context.params;
  const doId = context.env.ROOMS.idFromName(roomId);
  const stub = context.env.ROOMS.get(doId);
  return stub.fetch(context.request);
}
