import { GD32_DFU_PROFILES, toUsbFilters } from "@/protocols/stm32/dfu/adapters/dfuDeviceProfiles";

export const GD32_DFU_USB_FILTERS: USBDeviceFilter[] = toUsbFilters(GD32_DFU_PROFILES);

export function resolveGd32DfuChipName(device: USBDevice): string {
  const product = device.productName?.trim();
  if (product) return product;
  return `GD32-DFU ${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
}
