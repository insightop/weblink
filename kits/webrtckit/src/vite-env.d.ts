/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>;
  export default component;
}

interface ImportMetaEnv {
  /** 可选：信令基址（含协议与 host），用于本地 UI 连到远程 Pages */
  readonly VITE_SIGNALING_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
