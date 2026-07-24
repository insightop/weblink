/**
 * Standard Gamepad 的标准按钮索引映射表。
 *
 * W3C Gamepad API Standard Mapping 规范：
 * https://w3c.github.io/gamepad/#remapping
 *
 * Xbox 手柄（Windows/macOS/ChromeOS）遵循此标准。
 */
export const STANDARD_BUTTON_INDICES: Record<number, { name: string; label: string }> = {
  0: { name: "a", label: "A" },
  1: { name: "b", label: "B" },
  2: { name: "x", label: "X" },
  3: { name: "y", label: "Y" },
  4: { name: "leftShoulder", label: "LB" },
  5: { name: "rightShoulder", label: "RB" },
  6: { name: "leftTrigger", label: "LT" },
  7: { name: "rightTrigger", label: "RT" },
  8: { name: "select", label: "Select" },
  9: { name: "start", label: "Start" },
  10: { name: "leftStick", label: "LS" },
  11: { name: "rightStick", label: "RS" },
  12: { name: "dpadUp", label: "DPad ↑" },
  13: { name: "dpadDown", label: "DPad ↓" },
  14: { name: "dpadLeft", label: "DPad ←" },
  15: { name: "dpadRight", label: "DPad →" },
  16: { name: "home", label: "Home" },
};

/** Standard Gamepad 的标准摇杆索引映射表 */
export const STANDARD_AXIS_INDICES: Record<number, { name: string; label: string }> = {
  0: { name: "leftStickX", label: "左摇杆 X" },
  1: { name: "leftStickY", label: "左摇杆 Y" },
  2: { name: "rightStickX", label: "右摇杆 X" },
  3: { name: "rightStickY", label: "右摇杆 Y" },
};

/** 常见手柄型号识别关键词（从 gamepad.id 中匹配） */
export const VENDOR_KEYWORDS = {
  xbox: ["xbox", "x-box", "xinput", "microsoft", "xbox 360", "xbox one", "xbox series"],
  playstation: ["playstation", "dualshock", "dualsense", "ps4", "ps5", "sony"],
  switch: ["switch", "nintendo", "pro controller", "joy-con"],
} as const;
