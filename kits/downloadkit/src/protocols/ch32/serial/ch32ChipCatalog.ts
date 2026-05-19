/**
 * 已知 CH32 变体表（deviceType + chipId），数据来自 ch32-rs/wchisp devices/*.yaml 子集。
 * 未收录的芯片会在 probe 阶段给出明确错误，避免错误擦写。
 */
export interface Ch32ChipVariant {
  chipId: number;
  deviceType: number;
  mcuType: number;
  familyName: string;
  name: string;
  flashSizeBytes: number;
}

const VARIANTS: Ch32ChipVariant[] = [
  { chipId: 0x32, deviceType: 0x14, mcuType: 4, familyName: "CH32F103", name: "CH32F103C6T6", flashSizeBytes: 32 * 1024 },
  { chipId: 0x33, deviceType: 0x14, mcuType: 4, familyName: "CH32F103", name: "CH32F103 (64K)", flashSizeBytes: 64 * 1024 },
  { chipId: 0x50, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V305RBT6", flashSizeBytes: 128 * 1024 },
  { chipId: 0x70, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V307VCT6", flashSizeBytes: 256 * 1024 },
  { chipId: 0x71, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V307RCT6", flashSizeBytes: 256 * 1024 },
  { chipId: 0x73, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V307WCU6", flashSizeBytes: 256 * 1024 },
  { chipId: 0x30, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V303VCT6", flashSizeBytes: 256 * 1024 },
  { chipId: 0x31, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V303RCT6", flashSizeBytes: 256 * 1024 },
  { chipId: 0x32, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V303RBT6", flashSizeBytes: 128 * 1024 },
  { chipId: 0x33, deviceType: 0x17, mcuType: 7, familyName: "CH32V30x", name: "CH32V303CBT6", flashSizeBytes: 128 * 1024 },
];

export function findCh32Variant(chipId: number, deviceType: number): Ch32ChipVariant | undefined {
  return VARIANTS.find((v) => v.chipId === chipId && v.deviceType === deviceType);
}

/** wchisp Chip::min_erase_sector_number */
export function ch32MinEraseSectorCount(deviceType: number): number {
  return deviceType === 0x10 ? 4 : 8;
}

/** wchisp Chip::uid_size */
export function ch32UidByteCount(deviceType: number): number {
  return deviceType === 0x11 ? 4 : 8;
}
