# Serial (UART ISP)

Uses the ROM UART bootloader over Web Serial (STM32 / GD32 families).

## Requirements

- Chromium browser with Web Serial (HTTPS or localhost).
- USB–UART adapter drivers (CH340 / CP2102 / FT232, etc.).
- Put the target in UART bootloader mode (typically `BOOT0=1`, then reset).

## Wiring

Cross `TX`/`RX`, common `GND`. Follow your board’s schematic.

## Steps

1. Select `serial` flasher mode.
2. Choose `.hex` / `.bin` firmware.
3. Authorize the serial port when prompted.
4. Wait for completion.

## Troubleshooting

- No port: drivers, bootloader mode, baud rate.
- Handshake timeout: reset, check wiring and GND.
