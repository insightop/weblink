import { StreamKit } from "./streamkit";

export { StreamKit };

/**
 * Durable Object 容器的入口 Worker。
 * - 本地开发时：fetch 处理信令 WebSocket 升级，转发到 Durable Object
 * - 生产环境：Pages Function 做同样的事（workers/signaling/src/index.ts
 *   的 fetch 不会被外部访问到，但保留以支持 wrangler dev 本地联调）
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 处理信令 WebSocket 升级
    const match = url.pathname.match(/^\/api\/room\/([^/]+)\/signaling$/);
    if (match) {
      const roomId = match[1];
      const doId = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(doId);
      return stub.fetch(request);
    }

    return new Response(
      JSON.stringify({ error: "This worker only hosts Durable Objects and signal endpoints" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  },
};
