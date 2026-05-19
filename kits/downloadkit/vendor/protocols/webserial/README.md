<!-- SPDX-License-Identifier: Apache-2.0 -->
# STM32 Web Flash

A Web Serial flasher for the STM32 factory UART bootloader, with an optional serial console.

## Quick start (Docker)

1. `docker compose up --build`
2. Open `http://localhost:8080`

## Quick start (local)

1. Serve this folder over HTTPS or `localhost` (Web Serial requires a secure context).
2. Put your STM32 into the system bootloader (BOOT0 high, reset).
3. Connect USB-to-UART (CDC) and click **Connect**.
4. Select a `firmware.bin` and click **Flash firmware**.

## Notes

- Bootloader uses 8 data bits, even parity, 1 stop bit. This is set automatically.
- Serial console uses 8-N-1. You can set its baud rate separately.
- Flash address defaults to `0x08000000`. Adjust if your memory map differs.
- Mass erase uses the bootloader erase command (`0x43`/`0x44`/`0x45`).
- Web Serial is supported in Chromium-based browsers (Chrome/Edge).
- Web assets are served from `docs/` for GitHub Pages compatibility.

## License

Licensed under the Apache License, Version 2.0.  
See the LICENSE file for details.

## Contributing

Contributions are welcome! Please open issues or pull requests on GitHub.

By contributing, you agree that your contributions are licensed under Apache 2.0.
