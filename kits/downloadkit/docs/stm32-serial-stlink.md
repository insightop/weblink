# STM32 Serial + ST-Link Integration

## Scope

This document describes the current production flow for STM32:

- `serial` via `src/protocols/stm32/serial/UartIsp.ts`
- `st-link` via `webstlink`

`usb-dfu` currently supports device selection only; flashing is intentionally not implemented. **`dap-link`** flashes over **WebUSB** using npm **`dapjs`** (`src/integrations/dapjs/dapLinkFlash.ts` and related adapter/protocol).

## Target + Flasher Flow

1. User selects `target` first, then one `flasher` from plugin-driven options.
2. App immediately prompts flasher connection selection for that flasher type.
3. `Download` becomes enabled only after:
   - flasher connection selection succeeds
   - firmware file is selected
4. For `usb-dfu`, clicking `Download` returns a clear `not implemented` message. For `dap-link`, `Download` runs connect + erase/write via `dapjs` when WebUSB is available.

## Unified Firmware Input

Firmware input is normalized in `FirmwareInputPanel` into:

- `mode`
- `flasherType`
- `chipFamily`
- `firmware.kind = "single-bin"`
- `firmware.items[0] = { address, data, label }`

Rules:

- `.bin`: default address `0x08000000`
- `.hex`: parse Intel HEX and use computed base address
- `.elf`: selection is allowed, current parser returns explicit `not implemented` message
- Firmware uploader keeps only the latest selected file entry (re-entrant selection safe)

## Serial Flow

Implementation file: `src/protocols/stm32/serial/Stm32UartProtocol.ts`

Sequence:

1. Transport opens and provides `SerialPort`.
2. Protocol creates `UARTISP` and opens it with port handle.
3. Probe performs handshake + chip id read.
4. Erase uses `eraseAll()`.
5. Write uses `downloadBin(...)` and maps callback to `StageProgress`.
6. Reset closes UARTISP instance.

## ST-Link Flow

Implementation files:

- `src/transports/adapters/stlink.adapter.ts`
- `src/protocols/stm32/stlink/Stm32StlinkProtocol.ts`

Sequence:

1. Transport pre-selects and then opens `USBDevice`.
2. Adapter attaches `WebStlink`.
3. `detect_cpu([], pickCpu)` invokes picker callback when variants exist.
4. Adapter maps logger bargraph updates to progress bytes.
5. Flash uses `stlink.flash(address, data)`.
6. Reset/detach handled in protocol reset stage.

## ST-Link Target Variant Picker

UI component: `src/features/flasher/components/TargetVariantDialog.vue`

Runtime wiring:

- `startFlash(input, { pickStlinkTarget })` injects callback into plugin protocol construction.
- Store keeps picker open state and candidates.
- User selection resolves a promise that returns the selected target (SoC) type string.

## Download UI State

Download zone now uses a single smart action button:

- idle/ready: `Download`
- running: `<percent> | <speed> | <eta>`
- success: `Completed`
- error: `Failed`

Only running state shows speed/eta. After success or failure, user can trigger next round directly.
