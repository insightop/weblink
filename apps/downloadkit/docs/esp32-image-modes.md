# ESP32 Image Modes

## Single Bin

- Input shape: `{ kind: "single-bin", data, address? }`
- Default address: `0x10000`
- Use for quick app-only flashing.

## Partition Table + Multi Image

- Input shape: `{ kind: "multi-image", bootloader, partitionTable, app, otaData? }`
- Default addresses:
  - `bootloader`: `0x1000`
  - `partition-table`: `0x8000`
  - `ota-data`: `0xE000`
  - `app`: `0x10000`

## Validation

`Esp32ImagePlanner` validates:

- empty plans
- negative addresses
- segment overlap

All inputs are normalized into one `FlashPlan` for protocol consumption.
