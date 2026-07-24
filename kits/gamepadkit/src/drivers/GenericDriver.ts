import type { GamepadDriver } from "./types";
import type { ButtonMeta, AxisMeta, ControllerLayout } from "../core/types";
import { STANDARD_BUTTON_INDICES, STANDARD_AXIS_INDICES } from "../core/constants";

import type { ButtonMeta as BM } from "../core/types";

const BUTTON_GROUP: Record<string, BM["group"]> = {
  a: "action",
  b: "action",
  x: "action",
  y: "action",
  leftShoulder: "shoulder",
  rightShoulder: "shoulder",
  leftTrigger: "trigger",
  rightTrigger: "trigger",
  select: "menu",
  start: "menu",
  leftStick: "stick",
  rightStick: "stick",
  dpadUp: "dpad",
  dpadDown: "dpad",
  dpadLeft: "dpad",
  dpadRight: "dpad",
  home: "menu",
};

/**
 * GenericDriver — 通用兜底驱动。
 *
 * 基于 W3C Standard Mapping 的默认映射方案：
 * - buttons: 索引 0-16 按标准定义（A/B/X/Y/LB/RB/LT/RT/Select/Start/LS/RS/DPad）
 * - axes: 索引 0-3 为左摇杆 XY + 右摇杆 XY
 *
 * 对手柄 id 中不包含已知厂商关键词的手柄，或 mapping !== "standard" 的手柄生效。
 */
export class GenericDriver implements GamepadDriver {
  readonly id = "generic";
  readonly displayName = "标准手柄";

  detect(_gamepad: Gamepad): boolean {
    return true; // 始终作为兜底
  }

  mapButton(index: number): ButtonMeta | undefined {
    const def = STANDARD_BUTTON_INDICES[index];
    if (!def) return undefined;
    const isAnalog = def.name === "leftTrigger" || def.name === "rightTrigger";
    return {
      name: def.name,
      label: def.label,
      group: BUTTON_GROUP[def.name] ?? "action",
      kind: isAnalog ? "analog" : "digital",
    };
  }

  mapAxis(index: number): AxisMeta | undefined {
    const def = STANDARD_AXIS_INDICES[index];
    if (!def) return undefined;
    return { name: def.name, label: def.label };
  }

  getLayout(): ControllerLayout {
    return {
      type: "generic",
      buttons: [
        { x: 220, y: 120, name: "a", label: "A", group: "action", kind: "digital" },
        { x: 180, y: 160, name: "b", label: "B", group: "action", kind: "digital" },
        { x: 260, y: 160, name: "x", label: "X", group: "action", kind: "digital" },
        { x: 220, y: 200, name: "y", label: "Y", group: "action", kind: "digital" },
        { x: 80, y: 80, name: "leftShoulder", label: "LB", group: "shoulder", kind: "digital" },
        { x: 320, y: 80, name: "rightShoulder", label: "RB", group: "shoulder", kind: "digital" },
        { x: 40, y: 120, name: "leftTrigger", label: "LT", group: "trigger", kind: "analog" },
        { x: 360, y: 120, name: "rightTrigger", label: "RT", group: "trigger", kind: "analog" },
        { x: 120, y: 240, name: "select", label: "Select", group: "menu", kind: "digital" },
        { x: 280, y: 240, name: "start", label: "Start", group: "menu", kind: "digital" },
        { x: 80, y: 200, name: "leftStick", label: "LS", group: "stick", kind: "digital" },
        { x: 320, y: 200, name: "rightStick", label: "RS", group: "stick", kind: "digital" },
        { x: 140, y: 100, name: "dpadUp", label: "DP↑", group: "dpad", kind: "digital" },
        { x: 140, y: 140, name: "dpadDown", label: "DP↓", group: "dpad", kind: "digital" },
        { x: 120, y: 120, name: "dpadLeft", label: "DP←", group: "dpad", kind: "digital" },
        { x: 160, y: 120, name: "dpadRight", label: "DP→", group: "dpad", kind: "digital" },
        { x: 200, y: 60, name: "home", label: "Home", group: "menu", kind: "digital" },
      ],
      axes: [
        { x: 80, y: 200, name: "leftStickX", label: "左摇杆 X" },
        { x: 80, y: 200, name: "leftStickY", label: "左摇杆 Y" },
        { x: 320, y: 200, name: "rightStickX", label: "右摇杆 X" },
        { x: 320, y: 200, name: "rightStickY", label: "右摇杆 Y" },
      ],
    };
  }
}
