export interface DfuDeviceProfile {
  vendorId: number;
  productId?: number;
  label: string;
}

export const STM32_DFU_PROFILE: DfuDeviceProfile = {
  vendorId: 0x0483,
  productId: 0xdf11,
  label: "STM32 ROM DFU",
};

export const GD32_DFU_PROFILES: DfuDeviceProfile[] = [
  {
    vendorId: 0x28e9,
    productId: 0x0189,
    label: "GD32 ROM DFU",
  },
];

export function toUsbFilters(profiles: DfuDeviceProfile[]): USBDeviceFilter[] {
  return profiles.map((profile) =>
    profile.productId
      ? { vendorId: profile.vendorId, productId: profile.productId }
      : { vendorId: profile.vendorId },
  );
}
