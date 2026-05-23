import { Stm32DaplinkProtocol } from "../../protocols/stm32/daplink/Stm32DaplinkProtocol";
import { WebUsbTransport } from "../../transports/usb/WebUsbTransport";
import { stm32UserAddressPolicy } from "../firmwareInputPresets";
import type { FlasherPlugin } from "../types";
import type { Transport, UsbTransport } from "../../transports/types";

/** ARM mbed / DAPLink CMSIS-DAP：与 dapjs 官方 WebUSB 示例一致（vendorId 0x0d28）。 */
const DAPLINK_USB_FILTERS: USBDeviceFilter[] = [{ vendorId: 0x0d28 }];

export const stm32DaplinkPlugin: FlasherPlugin = {
  id: "stm32-dap-link",
  displayName: "STM32 DAP-Link",
  chipFamily: "stm32",
  flasherType: "dap-link",
  canSelectConnection: true,
  canFlash: true,
  priority: 100,
  supportedInputs: ["single-bin"],
  firmwareInputPolicy: stm32UserAddressPolicy,
  featureFlags: ["cmsis-dap"],
  supports: ({ chipFamily, flasherType, capabilities }) =>
    chipFamily === "stm32" && flasherType === "dap-link" && capabilities.webUsb,
  createTransport: () => new WebUsbTransport(DAPLINK_USB_FILTERS),
  createProtocol: (transport: Transport) => new Stm32DaplinkProtocol(transport as UsbTransport),
};
