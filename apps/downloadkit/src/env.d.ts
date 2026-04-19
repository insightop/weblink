/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

declare module "../../../uart_isp.js";
declare module "../../../../uart_isp.js";
declare module "../../../../../uart_isp.js";
declare module "../legacy/uart_isp.js";
declare module "../../legacy/uart_isp.js";
declare module "../../../vendor/protocols/webstlink/src/webstlink.js";
declare module "../../../vendor/protocols/webstlink/src/lib/package.js";
