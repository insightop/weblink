/**
 * 独立 Worker：仅注册 RoomSignaling Durable Object。
 * Pages Functions 通过 script_name 绑定调用 env.ROOMS。
 */
export { RoomSignaling } from "./RoomSignaling";

export default {
  fetch(): Response {
    return new Response("webrtckit-room-worker: use Pages /api/room/*", { status: 404 });
  },
};
