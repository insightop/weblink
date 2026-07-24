import type { GamepadDriver } from "./types";
import type { ButtonMeta, AxisMeta, ControllerLayout } from "../core/types";
import { STANDARD_BUTTON_INDICES, STANDARD_AXIS_INDICES, VENDOR_KEYWORDS } from "../core/constants";

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

/** Xbox 手柄在 Chrome 上多出的两个额外按钮 */
const XBOX_EXTRA_BUTTON: Record<number, { name: string; label: string }> = {
  16: { name: "home", label: "Home" },
};

/**
 * XboxDriver — Xbox 手柄驱动。
 *
 * 通过 gamepad.id 中的关键词匹配：
 * - "xbox" / "xbox 360" / "xbox one" / "xbox series" / "xinput"
 * - "microsoft"
 *
 * 映射方案基于 Standard Mapping（Xbox 手柄在主流浏览器上均支持标准映射）。
 * 16 号索引作为 Home/Guide 键。
 */
export class XboxDriver implements GamepadDriver {
  readonly id = "xbox";
  readonly displayName = "Xbox 手柄";

  detect(gamepad: Gamepad): boolean {
    const id = gamepad.id.toLowerCase();
    return VENDOR_KEYWORDS.xbox.some((kw) => id.includes(kw));
  }

  mapButton(index: number): ButtonMeta | undefined {
    const std = STANDARD_BUTTON_INDICES[index];
    const extra = XBOX_EXTRA_BUTTON[index];
    const def = std ?? extra;
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
      type: "xbox",
      buttons: [
        { x: 220, y: 120, name: "a", label: "A", group: "action", kind: "digital" },
        { x: 180, y: 160, name: "b", label: "B", group: "action", kind: "digital" },
        { x: 260, y: 160, name: "x", label: "X", group: "action", kind: "digital" },
        { x: 220, y: 200, name: "y", label: "Y", group: "action", kind: "digital" },
        { x: 80, y: 80, name: "leftShoulder", label: "LB", group: "shoulder", kind: "digital" },
        { x: 320, y: 80, name: "rightShoulder", label: "RB", group: "shoulder", kind: "digital" },
        { x: 40, y: 120, name: "leftTrigger", label: "LT", group: "trigger", kind: "analog" },
        { x: 360, y: 120, name: "rightTrigger", label: "RT", group: "trigger", kind: "analog" },
        { x: 120, y: 240, name: "select", label: "...", group: "menu", kind: "digital" },
        { x: 280, y: 240, name: "start", label: "☰", group: "menu", kind: "digital" },
        { x: 80, y: 200, name: "leftStick", label: "LS", group: "stick", kind: "digital" },
        { x: 320, y: 200, name: "rightStick", label: "RS", group: "stick", kind: "digital" },
        { x: 140, y: 100, name: "dpadUp", label: "▲", group: "dpad", kind: "digital" },
        { x: 140, y: 140, name: "dpadDown", label: "▼", group: "dpad", kind: "digital" },
        { x: 120, y: 120, name: "dpadLeft", label: "◄", group: "dpad", kind: "digital" },
        { x: 160, y: 120, name: "dpadRight", label: "►", group: "dpad", kind: "digital" },
        { x: 200, y: 48, name: "home", label: "●", group: "menu", kind: "digital" },
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
