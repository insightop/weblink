import type { Env } from "../../env";

export const onRequest: PagesFunction<Env> = async (context) => {
  const roomId = context.params.roomId as string;
  if (!roomId) {
    return new Response("room required", { status: 400 });
  }
  const id = context.env.ROOMS.idFromName(roomId);
  const stub = context.env.ROOMS.get(id);
  return stub.fetch(context.request);
};
