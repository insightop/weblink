# Target

Choose the target chip family first.

- `STM32`: Enables STM32-compatible flashers.
- `ESP32`: Enables ESP32-compatible flashers.
- `GD32`: Enables GD32-compatible flashers (`serial` / `usb-dfu`).
- `CH32` (WCH): Enables CH32 **serial ISP (WCH protocol)**. Enter ISP with `BOOT0` high then reset; default baud `115200`. This is **not** the STM32/GD32 AN3155 UART bootloader—pick the correct target.

Changing target updates available flasher options automatically.
