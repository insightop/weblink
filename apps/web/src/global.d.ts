// Tauri injects __TAURI__ on the window object when running in a Tauri WebView
// Electron preload exposes window.platform with isDesktop flag
interface Window {
  __TAURI__?: Record<string, unknown>;
  platform?: {
    isDesktop: boolean;
  };
}

// vite-plugin-pwa virtual module
declare module "virtual:pwa-register" {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}
