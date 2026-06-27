import { createApp } from "vue";
import { createPinia } from "pinia";
import * as Sentry from "@sentry/vue";
import posthog from "posthog-js";
import { inject } from "@vercel/analytics";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import { BUILD_VERSION } from "./utils/buildVersion";
import "@weblink/tokens/index.css";
import "./styles/app.css";

const app = createApp(App);

// --- Platform & deploy context (set as Sentry tags once at init) ---
const __platform: "tauri" | "electron" | "web" = window.__TAURI__
  ? "tauri"
  : window.platform?.isDesktop
    ? "electron"
    : "web";

const __host = window.location.hostname;

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
  release: `weblink@${BUILD_VERSION}`,
  environment: import.meta.env.MODE,
  debug: import.meta.env.DEV,

  // --- Performance Tracing ---
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", "127.0.0.1"],

  // --- Session Replay ---
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,

  // --- Integrations ---
  integrations: [
    // Performance: browser tracing (navigation, resource, XHR/fetch, long animation frames)
    Sentry.browserTracingIntegration({ router, enableLongAnimationFrame: true }),

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

    // Vue component tracking (mount / update / unmount spans)
    Sentry.vueIntegration({ trackComponents: true }),

    // Deduplication: don't send the same error twice
    Sentry.dedupeIntegration(),

    // Rewrite stack frames for source map support
    Sentry.rewriteFramesIntegration(),
  ],
});

Sentry.setTag("platform", __platform);
Sentry.setTag("deploy", __deploy);

// --- PostHog ---
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    autocapture: true,
    capture_pageview: "history_change",
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: "",
      compress_events: true,
    },
  });
  posthog.register({ build_version: BUILD_VERSION });
}

// --- PWA: notify user when a new version is available ---
if (import.meta.env.PROD) {
  // Request notification permission (non-blocking)
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // System notification (if permitted)
        if (Notification.permission === "granted") {
          new Notification("Weblink", {
            body: "发现新内容，点击刷新获取最新版本。",
            icon: "/favicon.ico",
          });
        }
        // Web dialog
        if (confirm("发现新版本，是否立即刷新？")) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        if (Notification.permission === "granted") {
          new Notification("Weblink", { body: "应用已可离线使用。" });
        }
      },
      onRegisteredSW(swUrl, reg) {
        // Check for updates every 60 minutes
        reg && setInterval(() => reg.update(), 60 * 60 * 1000);
      },
    });
  });
}

inject();

app.use(createPinia()).use(router).use(i18n).mount("#app");
