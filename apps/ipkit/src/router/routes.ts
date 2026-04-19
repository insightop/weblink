import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("@/features/home/pages/HomePage.vue"),
    meta: { title: "概览" },
  },
  {
    path: "/http",
    name: "http-lab",
    component: () => import("@/features/http-lab/pages/HttpLabPage.vue"),
    meta: { title: "HTTP" },
  },
  {
    path: "/websocket",
    name: "websocket-lab",
    component: () => import("@/features/websocket-lab/pages/WebSocketLabPage.vue"),
    meta: { title: "WebSocket" },
  },
  {
    path: "/doh",
    name: "doh-lab",
    component: () => import("@/features/doh-lab/pages/DohLabPage.vue"),
    meta: { title: "DoH" },
  },
  {
    path: "/webtransport",
    name: "webtransport-lab",
    component: () => import("@/features/webtransport-lab/pages/WebTransportLabPage.vue"),
    meta: { title: "WebTransport" },
  },
];
