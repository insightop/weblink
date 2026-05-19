import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    globals: {
      SerialPort: "readonly",
      USBDevice: "readonly",
      USBDeviceFilter: "readonly",
      HIDDevice: "readonly",
      HIDDeviceFilter: "readonly",
    },
  }),
];
