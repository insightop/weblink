#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGED_HTML = path.resolve(__dirname, "../dist/modbus-webui.html");

function openBrowser(url) {
  const opener = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "cmd"
    : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(opener, args, { stdio: "ignore", detached: true }).unref(); } catch {}
}

function parseArgs(argv) {
  const [,, rawCmd, ...rest] = argv;
  const cmd = (rawCmd ?? "help").replace(/^-+/, "").toLowerCase(); // handles --help/-h
  const positional = rest.filter(a => !a.startsWith("--"));
  const flags = Object.fromEntries(
    rest.filter(a => a.startsWith("--")).map(a => {
      const [k, v = "true"] = a.slice(2).split("=");
      return [k, v];
    })
  );
  return { cmd, positional, flags };
}

async function copyPackagedHtml(destFile, force) {
  if (!fs.existsSync(PACKAGED_HTML)) {
    console.error("Packaged HTML not found. Did you build before publishing?");
    process.exit(1);
  }
  if (fs.existsSync(destFile) && !force) {
    console.error(`Refusing to overwrite ${path.basename(destFile)} (use --force).`);
    process.exit(1);
  }
  await fsp.mkdir(path.dirname(destFile), { recursive: true });
  await fsp.copyFile(PACKAGED_HTML, destFile);
  console.log(`Wrote ${path.relative(process.cwd(), destFile)}`);
}

function serveHtml(htmlSource, port) {
  const server = http.createServer((req, res) => {
    if (typeof htmlSource === "string" && fs.existsSync(htmlSource)) {
      fs.createReadStream(htmlSource).pipe(res);
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlSource);
    }
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Serving at ${url}`);
    openBrowser(url);
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

function usage(exitCode = 0) {
  console.log(`modbus-webui

Usage:
  npx modbus-webui init [filename] [--force]
  npx modbus-webui serve [filename] [--port=5173]
  npx modbus-webui start [--port=5173]
  npx modbus-webui --help

Examples:
  npx modbus-webui init
  npx modbus-webui serve            # serves ./modbus-webui.html
  npx modbus-webui start            # serves the packaged HTML directly
`);
  process.exit(exitCode);
}

async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv);

  if (cmd === "help" || cmd === "h") usage(0);

  if (cmd === "init") {
    const filename = positional[0] || "modbus-webui.html";
    const force = "force" in flags;
    const dest = path.resolve(process.cwd(), filename);
    await copyPackagedHtml(dest, force);
    return; // OK inside a function
  }

  if (cmd === "serve") {
    const filename = positional[0] || "modbus-webui.html";
    const file = path.resolve(process.cwd(), filename);
    const port = Number(flags.port ?? "5173");
    if (!fs.existsSync(file)) {
      console.error(`Not found: ${path.relative(process.cwd(), file)}. Try: npx modbus-webui init`);
      process.exit(1);
    }
    serveHtml(file, port);
    return;
  }

  if (cmd === "start") {
    const port = Number(flags.port ?? "5173");
    if (!fs.existsSync(PACKAGED_HTML)) {
      console.error("Packaged HTML not found. Did you build before publishing?");
      process.exit(1);
    }
    const html = await fsp.readFile(PACKAGED_HTML, "utf8");
    serveHtml(html, port);
    return;
  }

  // unknown command or no command
  usage(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});