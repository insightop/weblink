import type { DfuInterfaceInfo, DfuseMemoryDescriptor, DfuseSector } from "../types/dfu.types";
import { readInterfaceNameMap, type InterfaceNameMap } from "./DfuUsbDescriptorReader";

const PROTOCOL_RUNTIME = 0x01;
const PROTOCOL_DFU = 0x02;
const PROTOCOL_LEGACY_DFU = 0x00;

export function listDfuInterfaces(device: USBDevice): DfuInterfaceInfo[] {
  const interfaces: DfuInterfaceInfo[] = [];
  for (const conf of device.configurations) {
    for (const intf of conf.interfaces) {
      for (const alt of intf.alternates) {
        if (alt.interfaceClass !== 0xfe || alt.interfaceSubclass !== 0x01) continue;
        // Some ROM bootloaders (including certain GD32 variants) report DFU alt settings as protocol 0x00.
        if (
          alt.interfaceProtocol !== PROTOCOL_RUNTIME &&
          alt.interfaceProtocol !== PROTOCOL_DFU &&
          alt.interfaceProtocol !== PROTOCOL_LEGACY_DFU
        ) {
          continue;
        }
        interfaces.push({
          configurationValue: conf.configurationValue,
          interfaceNumber: intf.interfaceNumber,
          alternateSetting: alt.alternateSetting,
          interfaceProtocol: alt.interfaceProtocol,
          interfaceName: alt.interfaceName ?? null,
        });
      }
    }
  }
  return interfaces;
}

export function pickBestDfuInterface(candidates: DfuInterfaceInfo[]): DfuInterfaceInfo | null {
  if (candidates.length === 0) return null;
  const dfuMode = candidates.find((c) => c.interfaceProtocol === PROTOCOL_DFU);
  if (dfuMode) return dfuMode;
  const legacyDfuMode = candidates.find((c) => c.interfaceProtocol === PROTOCOL_LEGACY_DFU);
  return legacyDfuMode ?? candidates[0];
}

function applyInterfaceNameMap(
  interfaces: DfuInterfaceInfo[],
  mapping: InterfaceNameMap,
): DfuInterfaceInfo[] {
  return interfaces.map((item) => {
    if (item.interfaceName) return item;
    const name =
      mapping[item.configurationValue]?.[item.interfaceNumber]?.[item.alternateSetting] ?? null;
    return { ...item, interfaceName: name };
  });
}

export async function hydrateMissingInterfaceNames(device: USBDevice, interfaces: DfuInterfaceInfo[]): Promise<DfuInterfaceInfo[]> {
  if (!interfaces.some((item) => item.interfaceName === null)) return interfaces;
  const shouldClose = !device.opened;
  if (shouldClose) {
    await device.open();
  }
  try {
    const mapping = await readInterfaceNameMap(device);
    return applyInterfaceNameMap(interfaces, mapping);
  } finally {
    if (shouldClose) {
      await device.close().catch(() => undefined);
    }
  }
}

/** Ported from webdfu dfuse.parseMemoryDescriptor with strict typing. */
export function parseDfuseMemoryDescriptor(desc: string): DfuseMemoryDescriptor {
  const nameEndIndex = desc.indexOf("/");
  if (!desc.startsWith("@") || nameEndIndex === -1) {
    throw new Error(`Not a DfuSe memory descriptor: "${desc}"`);
  }

  const name = desc.substring(1, nameEndIndex).trim();
  const segmentString = desc.substring(nameEndIndex);
  const segments: DfuseSector[] = [];

  const sectorMultipliers: Record<string, number> = {
    " ": 1,
    B: 1,
    K: 1024,
    M: 1024 * 1024,
  };

  const contiguousSegmentRegex = /\/\s*(0x[0-9a-fA-F]{1,8})\s*\/(\s*[0-9]+\s*\*\s*[0-9]+\s?[ BKM]\s*[abcdefg]\s*,?\s*)+/g;
  let contiguousMatch: RegExpExecArray | null = contiguousSegmentRegex.exec(segmentString);
  while (contiguousMatch) {
    const segmentRegex = /([0-9]+)\s*\*\s*([0-9]+)\s?([ BKM])\s*([abcdefg])\s*,?\s*/g;
    let startAddress = Number.parseInt(contiguousMatch[1], 16);
    let segmentMatch: RegExpExecArray | null = segmentRegex.exec(contiguousMatch[0]);
    while (segmentMatch) {
      const sectorCount = Number.parseInt(segmentMatch[1], 10);
      const sectorSize = Number.parseInt(segmentMatch[2], 10) * sectorMultipliers[segmentMatch[3]];
      const properties = segmentMatch[4].charCodeAt(0) - "a".charCodeAt(0) + 1;
      segments.push({
        start: startAddress,
        sectorSize,
        end: startAddress + sectorSize * sectorCount,
        readable: (properties & 0x1) !== 0,
        erasable: (properties & 0x2) !== 0,
        writable: (properties & 0x4) !== 0,
      });
      startAddress += sectorSize * sectorCount;
      segmentMatch = segmentRegex.exec(contiguousMatch[0]);
    }
    contiguousMatch = contiguousSegmentRegex.exec(segmentString);
  }

  return { name, segments };
}

export function getSegmentForAddress(
  memory: DfuseMemoryDescriptor,
  address: number,
): DfuseSector | null {
  return memory.segments.find((s) => s.start <= address && address < s.end) ?? null;
}
