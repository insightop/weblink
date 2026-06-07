import { createApp } from "vue";
import { createPinia } from "pinia";
import * as Sentry from "@sentry/vue";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import "@weblink/tokens/index.css";
import "./styles/app.css";

declare const __BUILD_TIME__: string;
{
  const dt = new Date(__BUILD_TIME__);
  const y = String(dt.getFullYear()).slice(2);
  const M = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const h = String(dt.getHours()).padStart(2, "0");
  const m = String(dt.getMinutes()).padStart(2, "0");
  document.title = `Weblink(${y}${M}${d}${h}${m})`;
}

const app = createApp(App);

// --- Platform & deploy context (computed once, reused by Sentry beforeSend) ---
const __platform: "tauri" | "electron" | "web" = window.__TAURI__
  ? "tauri"
  : window.platform?.isDesktop
    ? "electron"
    : "web";

const __host = (() => {
  try { return window.location.hostname; } catch { return "unknown"; }
})();

const __deploy =
  __host.includes("pages.dev") ? "cloudflare" :
  __host.includes("github.io") ? "github" :
  __host.includes("vercel.app") ? "vercel" :
  __host.includes("netlify.app") ? "netlify" :
  __host === "localhost" || __host === "127.0.0.1" ? "local" :
  "self-hosted";

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
  environment: import.meta.env.MODE,
  debug: import.meta.env.DEV,

  beforeSend(event) {
    event.tags = { ...event.tags, platform: __platform, deploy: __deploy };
    return event;
  },

  // --- Performance Tracing ---
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,
  tracePropagationTargets: ["localhost", "127.0.0.1"],

  // --- Session Replay ---
  replaysSessionSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,

  // --- Integrations ---
  integrations: [
    // Performance: browser tracing (navigation, resource, XHR/fetch spans)
    Sentry.browserTracingIntegration({ router }),

    // Replay: full session recording + error replay
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),

    // User Feedback: floating widget for bug reports
    Sentry.feedbackIntegration({
      autoInject: true,
    }),

    // Console: capture console.log/warn/error/info as breadcrumbs + events
    Sentry.captureConsoleIntegration({
      levels: ["log", "info", "warn", "error"],
    }),

    // Browser API errors (TypeError, etc.)
    Sentry.browserApiErrorsIntegration(),

    // Global handlers: unhandledrejection, window.onerror
    Sentry.globalHandlersIntegration({
      onerror: true,
      onunhandledrejection: true,
    }),

    // Deduplication: don't send the same error twice
    Sentry.dedupeIntegration(),

    // Rewrite stack frames for source map support
    Sentry.rewriteFramesIntegration(),
  ],
});

app.use(createPinia()).use(router).use(i18n).mount("#app");
