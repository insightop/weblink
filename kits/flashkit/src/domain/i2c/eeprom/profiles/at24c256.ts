import type { I2cEepromProfile } from "../I2cEepromProfile";

export const at24c256: I2cEepromProfile = {
  id: "atmel-at24c256",
  name: "AT24C256 (256kbit / 32KiB)",
  baseAddr7: 0x50,
  sizeBytes: 32 * 1024,
  pageSize: 64,
  addrBytes: 2,
};
