# Legacy Behavior Baseline

This document freezes the current `html+js` behavior before the Vue migration.

## Runtime Environment

- Browser requirement: Chromium-based browser with Web Serial/WebUSB support.
- Current entrypoint: `index.html` + `src/legacy/main.js` (legacy reference only).
- Progress/log UI is directly DOM-driven.

## Mode Behavior Matrix

### serial

- Trigger path: `src/legacy/main.js` mode `serial`.
- Workflow:
  - Select firmware (`.hex` or `.bin`).
  - Request serial port via `navigator.serial.requestPort()`.
  - Open port with selected baud rate.
  - Execute handshake/getChipId/erase/download via `UARTISP`.
  - Update progress and ETA while writing.
  - Close `UARTISP` + port and reset UI state.
- Error handling:
  - On exception, log error, attempt close, restore UI.
  - Supports user cancel during burn.

### usb-dfu

- Trigger path: `src/legacy/main.js` mode `usb-dfu`.
- Current behavior:
  - No integrated root-page DFU flow.
  - Opens `./vendor/protocols/webdfu/dfu-util/index.html` in new tab.
- DFU implementation exists in `vendor/protocols/webdfu/dfu-util/*`.

### st-link

- Trigger path: `src/legacy/main.js` mode `st-link`.
- Workflow:
  - Request USB device using ST vendor filter.
  - Attach via `WebStlink`.
  - Detect target CPU and optional variant picker dialog.
  - Flash with verify/erase provided by underlying driver.
  - Try target reset and then detach.
- Progress:
  - UI logger maps STLink write callbacks to progress bar.

### dap-link

- Trigger path: `src/legacy/main.js` mode `dap-link`.
- Current behavior:
  - No integrated root-page flash flow.
  - Opens `./vendor/protocols/webdap/examples/index.html`.
- DAPLink implementation exists in `vendor/protocols/webdap/src/daplink/index.ts`.

## Firmware Input Behavior

- Supported extensions: `.hex`, `.bin`.
- `.hex`:
  - Converted to binary using `parseIntelHex()` in `src/shared/firmware/hex.ts`.
  - Base address inferred from HEX records.
- `.bin`:
  - Base address defaults to `0x08000000`.

## Legacy Side Effects to Preserve or Replace

- `window.open` dispatch for `usb-dfu` and `dap-link`.
- Target (SoC) selection dialog callback for ST-Link variants.
- Direct DOM toggling for:
  - burn button state
  - mode-dependent controls
  - log/progress/ETA

## Regression Checklist for Migration

- `serial`: complete handshake + erase + write + close path.
- `serial`: cancel path returns UI to idle and closes resources.
- `st-link`: attach/detect/flash/reset/detach path works.
- `usb-dfu`: registry-based mode still reaches DFU flashing capability.
- `dap-link`: registry-based mode reaches flashing capability (not just docs page).
- `.hex` parsing still derives correct base address and image size.
- `.bin` default address remains configurable and deterministic.

## Migrated Vue App Note (DAP-Link)

The baseline above describes legacy `html+js` behavior. In the migrated app, **DAP-Link flashing** is implemented with the npm package **`dapjs`** (same upstream as the `vendor/protocols/webdap` submodule) over **WebUSB**, matching the official `daplink-flash` browser example. Application TypeScript must **not** import from `vendor/protocols/webdap/src`; keep the submodule for examples and API cross-check only.

