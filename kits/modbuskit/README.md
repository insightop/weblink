# modbus-webui (beta)

Single-file Modbus workbench — profiles, name tables, shortcuts.

[![Mentioned in Awesome](https://awesome.re/mentioned-badge.svg)](https://github.com/louisfoster/awesome-web-serial#applications)
[![npm](https://img.shields.io/npm/v/modbus-webui)](https://www.npmjs.com/package/modbus-webui)

## What it is

A browser-based UI for Modbus devices. Runs fully client-side via the [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API) and [modbus-webserial](https://www.npmjs.com/package/modbus-webserial). No install required to use the app; optional CLI for quick start. \
Built with [Svelte](https://svelte.dev) and [shadcn](https://www.shadcn-svelte.com/). 

---

## Quick start

### Directly from Github Pages
### --> [modbus-webUI](https://modbuswebui.dev/) <--
### or with npx

```bash
# serve the packaged HTML immediately
npx modbus-webui start

# or write the HTML to your cwd, then serve it
npx modbus-webui init
npx modbus-webui serve
# options:
#   --port=5173
#   init [filename] [--force]
#   serve [filename] [--port=...]
```

You can also download the single `modbus-webui.html` file and open it directly in a supported browser.

---

## Features

* **Read / write** coils and registers
* **Profiles**: per-device settings + saved write shortcuts
* **Name tables**: global sets covering coils, discrete inputs, holding and input registers
* **Shortcuts**: one-click saved writes
* **Local persistence**: everything stored in your browser

---

## Basic usage

1. Click **Connect** and choose your serial port.
2. Set port parameters (baud, parity, etc.) and click **Open**.
3. Use **Read** / **Write** panels to operate coils and registers.
4. Save frequent actions as **Shortcuts** and run them from the Shortcuts panel.
5. Use **Name Tables** to label addresses; **Profiles** keep device-specific setup.

---

## Concepts

### Profiles

* Hold your selected name-table set, connection settings, and write shortcuts.
* Changes apply immediately to the active profile. Switching profiles does **not** disconnect the port.

### Name tables

* Stored **globally**; any profile can select a set to use.
* Cover all four areas: coils, discrete inputs, holding registers, input registers.
* Names are linked to addresses (enter as decimal or hex). Edit via the Name Tables modal or copy/paste a full set as JSON.

### Storage & versioning

* All data is kept as a single **library** and saved to `localStorage` (auto or manual save).
* The stored data is versioned to allow future migrations.

---

## Browser support

* Requires **Chromium-based desktop** browsers with Web Serial enabled.
* You grant port access per session; after reload you may need to select the port again.
* The app will show a notice if Web Serial isn’t available.

---

## Development

```bash
# install
npm i

# dev
npm run dev

# build (emits dist/modbus-webui.html)
npm run build
```

---
