import { BrowserWindow, app, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
// -- CommonJS Shims --
import __cjs_mod__ from "node:module";
import.meta.filename;
const __dirname = import.meta.dirname;
__cjs_mod__.createRequire(import.meta.url);
//#region src/main/index.ts
function createWindow() {
	const win = new BrowserWindow({
		width: 1280,
		height: 860,
		minWidth: 800,
		minHeight: 600,
		title: "Weblink",
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false
		}
	});
	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	if (is.dev && process.env["ELECTRON_RENDERER_URL"]) win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
	else win.loadFile(join(__dirname, "../renderer/index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
//#endregion
export {};
