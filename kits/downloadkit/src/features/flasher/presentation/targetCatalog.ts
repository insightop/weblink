import type { ChipFamily } from "../../../plugins/types";

export interface TargetMeta {
  id: ChipFamily;
  label: string;
  supportedSeries: string[];
}

export const TARGET_CATALOG: TargetMeta[] = [
  {
    id: "stm32",
    label: "STM32",
    supportedSeries: [
      "F0",
      "F1",
      "F3",
      "F4",
      "F7",
      "G0",
      "G4",
      "H7",
      "L0",
      "L4",
      "L5",
      "WB",
      "WL",
    ],
  },
  {
    id: "esp32",
    label: "ESP32",
    supportedSeries: ["S2", "S3", "C2", "C3", "C6", "H2"],
  },
  {
    id: "gd32",
    label: "GD32",
    supportedSeries: ["F1", "F3", "F4", "E2", "E5", "W5x"],
  },
  {
    id: "ch32",
    label: "CH32",
    supportedSeries: ["F103", "F203", "V003", "V20x", "V30x", "X03x"],
  },
];
