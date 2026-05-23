import { CanKitError } from "../../domain/errors/can-kit-error.js";

/** 常见 gs_usb（candleLight / OpenMoko 等），与内核 gs_usb 列举一致 */
export const GS_USB_DEFAULT_FILTERS: USBDeviceFilter[] = [
  { vendorId: 0x1d50, productId: 0x606f },
  { vendorId: 0x1209, productId: 0x2323 },
];

export function assertWebUsbSupported(): void {
  if (typeof navigator === "undefined" || !("usb" in navigator)) {
    throw new CanKitError(
      "WEBUSB_UNSUPPORTED",
      "当前浏览器不支持 WebUSB（请使用 Chromium 内核，并确保 HTTPS 或 localhost）。",
    );
  }
}

export async function requestGsUsbDevice(
  filters: USBDeviceFilter[] = GS_USB_DEFAULT_FILTERS,
): Promise<USBDevice> {
  assertWebUsbSupported();
  try {
    const dev = await navigator.usb.requestDevice({ filters });
    return dev;
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") {
      throw new CanKitError("USER_CANCELLED", "未选择 USB 设备", { cause: e });
    }
    throw new CanKitError("PORT_OPEN_FAILED", "选择 USB 设备失败", { cause: e });
  }
}
