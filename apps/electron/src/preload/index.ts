import { contextBridge } from "electron";
import * as Sentry from "@sentry/electron/preload";

Sentry.preload();

contextBridge.exposeInMainWorld("platform", {
  isDesktop: true,
  isWeb: false,
  isTauri: false,
});
