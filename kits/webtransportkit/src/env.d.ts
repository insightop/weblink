/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 可选：信令基址 */
  readonly VITE_SIGNALING_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
