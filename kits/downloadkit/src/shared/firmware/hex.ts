export interface ParsedHexFirmware {
  baseAddr: number;
  bytes: Uint8Array;
}

export function parseIntelHex(hexText: string): ParsedHexFirmware {
  const lines = hexText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(":"));

  const dataMap = new Map<number, number>();
  let minAddress = Number.MAX_SAFE_INTEGER;
  let maxAddress = 0;
  let extendedLinearAddress = 0;
  let extendedSegmentAddress = 0;

  for (const line of lines) {
    if (line.length < 11) continue;
    const length = parseInt(line.slice(1, 3), 16);
    const offset = parseInt(line.slice(3, 7), 16);
    const recordType = parseInt(line.slice(7, 9), 16);

    if (recordType === 0x00) {
      const baseAddress = (extendedLinearAddress << 16) + (extendedSegmentAddress << 4);
      for (let i = 0; i < length; i += 1) {
        const byteValue = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16);
        const address = baseAddress + offset + i;
        dataMap.set(address, byteValue);
        minAddress = Math.min(minAddress, address);
        maxAddress = Math.max(maxAddress, address);
      }
      continue;
    }

    if (recordType === 0x02 && length === 2) {
      extendedSegmentAddress = parseInt(line.slice(9, 13), 16);
      continue;
    }

    if (recordType === 0x04 && length === 2) {
      extendedLinearAddress = parseInt(line.slice(9, 13), 16);
    }
  }

  if (dataMap.size === 0 || minAddress === Number.MAX_SAFE_INTEGER) {
    throw new Error("HEX firmware has no data records");
  }

  const totalSize = maxAddress - minAddress + 1;
  const bytes = new Uint8Array(totalSize);
  bytes.fill(0xff);
  for (const [address, value] of dataMap) {
    bytes[address - minAddress] = value;
  }

  return { baseAddr: minAddress, bytes };
}
