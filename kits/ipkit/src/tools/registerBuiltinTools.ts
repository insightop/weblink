import { globalIpToolRegistry } from "@/tools/registry";
import type { IpToolDefinition } from "@/tools/types";

const builtin: IpToolDefinition[] = [
  {
    id: "home",
    label: "概览",
    path: "/",
    order: 0,
    showInMenu: true,
    isSupported: () => true,
  },
  {
    id: "http-lab",
    label: "HTTP",
    path: "/http",
    order: 10,
    showInMenu: true,
    isSupported: (c) => c.fetch,
  },
  {
    id: "websocket-lab",
    label: "WebSocket",
    path: "/websocket",
    order: 20,
    showInMenu: true,
    isSupported: (c) => c.webSocket,
  },
  {
    id: "doh-lab",
    label: "DoH (dns-json)",
    path: "/doh",
    order: 30,
    showInMenu: true,
    isSupported: (c) => c.fetch,
  },
  {
    id: "webtransport-lab",
    label: "WebTransport",
    path: "/webtransport",
    order: 40,
    showInMenu: true,
    isSupported: (c) => c.webTransport,
  },
];

export function registerBuiltinTools(): void {
  for (const t of builtin) {
    globalIpToolRegistry.register(t);
  }
}
