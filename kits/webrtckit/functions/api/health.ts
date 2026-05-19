export async function onRequest(): Promise<Response> {
  return Response.json({ ok: true, service: "webrtckit" });
}
