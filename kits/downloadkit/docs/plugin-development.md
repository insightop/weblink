# Plugin Development

Each plugin implements `FlasherPlugin` from `src/plugins/types.ts`.

## Required Fields

- `id`, `displayName`, `chipFamily`, `flasherType`
- `canSelectConnection`: whether flasher supports connection pre-selection
- `canFlash`: whether mode supports flashing execution
- `priority`
- `supportedInputs`: `single-bin` or `multi-image`
- `featureFlags`
- `supports(criteria)` capability gate
- `createTransport()`
- `createProtocol(transport, deps?)`

## Runtime Deps

`createProtocol` can receive optional runtime dependencies from UI/services.

- `pickStlinkTarget(candidates)`: async callback for ST-Link target (SoC) variant selection.

This keeps protocol and UI decoupled while still supporting interactive flows.

## Flasher-First Connection Selection

UI now pre-selects flasher connection on selection change:

- `prepareFlasherForCurrentSelection()` calls `transport.selectDevice()` before download.
- `startFlash` should consume a prepared transport session instead of triggering device picker.
- For partial flashers (`canSelectConnection=true` and `canFlash=false`), UI can collect connection/file state but must return a `not implemented` message on download action.

## Registering

Add plugin to `src/plugins/builtin/registerBuiltinPlugins.ts`.

## Compatibility Guidance

- Keep capability detection strict (`webSerial`, `webUsb`, `webHid`). Example: STM32 DAP-Link gates on **`webUsb`** (not WebHID), aligned with npm `dapjs` browser usage.
- Do not access DOM in protocol/transport.
- Report progress through `write(plan, onProgress)`.
- Keep firmware parsing in shared utils, not inside protocol classes.
- Expose target-aware options through registry/facade rather than hardcoded UI lists.
- Use `flasherLogger` (`src/features/flasher/services/flasherLogger.ts`) for UI/service logs; it delegates to `pino` and structured store logs. Do not write directly to store logs from plugins/services.
