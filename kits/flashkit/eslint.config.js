import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    globals: {
      USBDevice: "readonly",
      USBDeviceFilter: "readonly",
      USBInTransferResult: "readonly",
      USBOutTransferResult: "readonly",
      HIDDevice: "readonly",
    },
  }),
];
