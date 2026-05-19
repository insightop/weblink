import { weblinkVueTsConfig } from "@weblink/eslint-config";

export default [
  ...weblinkVueTsConfig({
    ignores: ["prettier.config.cjs"],
    globals: {
      SerialPort: "readonly",
      SerialOptions: "readonly",
      SerialParity: "readonly",
      SerialFlowControl: "readonly",
    },
  }),
];
