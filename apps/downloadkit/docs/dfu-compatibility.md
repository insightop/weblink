# DFU Compatibility Notes

This document records WebUSB DFU compatibility for currently supported targets.

## Known Device Profiles

- STM32 ROM DFU: `0483:df11`
- GD32 ROM DFU: `28e9:0189`

These profiles are centralized in `src/protocols/stm32/dfu/adapters/dfuDeviceProfiles.ts`.

## Interface Name Fallback

Some browsers/devices expose `alternate.interfaceName` as `null` in WebUSB.  
When this happens, DfuSe memory descriptor parsing fails and flashing cannot proceed.

The adapter now follows an upstream-compatible fallback:

1. Enumerate DFU interfaces from the active USB device.
2. Detect missing `interfaceName`.
3. Read USB interface string descriptors manually.
4. Hydrate names back into interface candidates.
5. Parse DfuSe memory map from hydrated names.

## Troubleshooting

- If flashing fails with `DfuSe memory map is unavailable`, collect:
  - Browser version
  - `vendorId:productId`
  - DFU interface summary from debug logs
- Verify target is in DFU mode and selected interface exposes `@Internal Flash ...`.
- On Windows, ensure WinUSB/libusb driver is installed for DFU interface.
