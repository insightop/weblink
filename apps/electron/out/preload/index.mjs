import { contextBridge } from "electron";
//#region src/preload/index.ts
contextBridge.exposeInMainWorld("platform", {
	isDesktop: true,
	isWeb: false,
	isTauri: false
});
//#endregion
export {};
