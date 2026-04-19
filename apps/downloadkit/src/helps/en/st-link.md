# ST-Link (WebUSB)

Programs Flash over SWD using an ST-Link and WebUSB.

## Requirements

- Chromium + WebUSB.
- ST-Link connected; SWD wired (`SWDIO`, `SWCLK`, `GND`).

## Steps

1. Select `st-link`.
2. Pick firmware (`.hex` / `.bin`).
3. Authorize the ST-Link in the browser.
4. If multiple target (SoC) variants are reported, pick the correct one.
5. Wait for progress to finish.

## Troubleshooting

- Device not listed: cable, USB port, permissions.
- Flash errors: lower SWCLK, check SWD wiring and target protection.
