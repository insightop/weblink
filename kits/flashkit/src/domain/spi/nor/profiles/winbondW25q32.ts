import type { SpiNorProfile } from "../SpiNorProfile";

/** Winbond W25Q32JV（常见 4MB SPI NOR，指令与多数 Winbond 25Q 系列一致） */
export const winbondW25q32: SpiNorProfile = {
  id: "winbond-w25q32",
  name: "Winbond W25Q32 (4MB)",
  jedec: { manufacturerId: 0xef, deviceIdHigh: 0x40, deviceIdLow: 0x16 },
  sizeBytes: 4 * 1024 * 1024,
  pageSize: 256,
  sectorSize: 4 * 1024,
  addressBytes: 3,
  cmd: {
    read: 0x03,
    pageProgram: 0x02,
    sectorErase: 0x20,
    writeEnable: 0x06,
    readStatus: 0x05,
    readJedecId: 0x9f,
  },
  statusWipMask: 0x01,
};
