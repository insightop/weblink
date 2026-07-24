import { weblinkReactTsConfig } from "@weblink/eslint-config/react";

export default [
  ...weblinkReactTsConfig({
    files: "src/**/*.{ts,tsx}",
    globals: {
      Gamepad: "readonly",
      GamepadButton: "readonly",
      GamepadEvent: "readonly",
      GamepadHapticActuator: "readonly",
      GamepadMappingType: "readonly",
    },
  }),
];
