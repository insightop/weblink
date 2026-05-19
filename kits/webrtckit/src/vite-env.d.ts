/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选：信令基址（含协议与 host），用于本地 UI 连到远程 Pages */
  readonly VITE_SIGNALING_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
