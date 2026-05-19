import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("platform", {
  isDesktop: true,
  isWeb: false,
  isTauri: false,
});
