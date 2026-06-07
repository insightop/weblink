// Tauri injects __TAURI__ on the window object when running in a Tauri WebView
// Electron preload exposes window.platform with isDesktop flag
interface Window {
  __TAURI__?: Record<string, unknown>;
  platform?: {
    isDesktop: boolean;
  };
}
