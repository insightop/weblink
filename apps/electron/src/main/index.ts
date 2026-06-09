import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import * as Sentry from "@sentry/electron/main";

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  debug: is.dev,
  tracesSampleRate: is.dev ? 1.0 : 0.2,
});

Sentry.setTag("platform", "electron-main");

// ─── Bridge (data bridge + MCP server) ────────────────────────────

let bridgeStorage: Awaited<ReturnType<typeof import("@weblink/bridge/main").DataBridgeStorage.create>> | null = null;

async function initBridge(): Promise<void> {
  try {
    const { DataBridgeStorage, registerIpcHandlers } = await import("@weblink/bridge/main");
    const dbPath = join(app.getPath("userData"), "weblink.db");
    bridgeStorage = await DataBridgeStorage.create(dbPath);
    registerIpcHandlers(ipcMain, bridgeStorage);
    console.log("[electron] Bridge initialized:", dbPath);
  } catch (err) {
    console.warn("[electron] Bridge initialization failed:", err);
  }
}

// ─── Window ────────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "Weblink",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ─── App lifecycle ─────────────────────────────────────────────────

app.whenReady().then(async () => {
  await initBridge();
  createWindow();
});

app.on("window-all-closed", () => {
  bridgeStorage?.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
