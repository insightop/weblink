import { Gd32DfuProtocol } from "@/protocols/gd32/dfu/Gd32DfuProtocol";
import { GD32_DFU_USB_FILTERS } from "@/protocols/gd32/dfu/adapters/gd32DfuDeviceMap";
import { stm32FixedAddressPolicy } from "@/plugins/firmwareInputPresets";
import type { FlasherPlugin } from "@/plugins/types";
import type { UsbTransport } from "@/transports/types";
import { WebUsbTransport } from "@/transports/usb/WebUsbTransport";

export const gd32DfuPlugin: FlasherPlugin = {
  id: "gd32-usb-dfu",
  displayName: "GD32 USB DFU",
  chipFamily: "gd32",
  flasherType: "usb-dfu",
  canSelectConnection: true,
  canFlash: true,
  priority: 100,
  supportedInputs: ["single-bin"],
  firmwareInputPolicy: stm32FixedAddressPolicy,
  featureFlags: ["dfu"],
  supports: ({ chipFamily, flasherType, capabilities }) =>
    chipFamily === "gd32" && flasherType === "usb-dfu" && capabilities.webUsb,
  createTransport: () => new WebUsbTransport(GD32_DFU_USB_FILTERS),
  createProtocol: (transport) => new Gd32DfuProtocol(transport as UsbTransport),
};
