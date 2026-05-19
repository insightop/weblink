import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    ignores: ["prettier.config.cjs"],
    globals: {
      BluetoothDevice: "readonly",
      BluetoothRemoteGATTServer: "readonly",
      BluetoothRemoteGATTService: "readonly",
      BluetoothRemoteGATTCharacteristic: "readonly",
      NDEFReader: "readonly",
    },
  }),
];
