// Tauri injects __TAURI__ on the window object when running in a Tauri WebView
interface Window {
  __TAURI__?: Record<string, unknown>;
  platform?: {
    isDesktop: boolean;
    isWeb: boolean;
    isTauri: boolean;
  };
}
