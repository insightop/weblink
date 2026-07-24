/**
 * 增强手柄状态——同时保留 raw 原始数据与 driver 转换后的 mapped 视图。
 *
 * - raw：直接从 Gamepad API 读取的 buttons/axes，供调试查看
 * - mapped：经当前 driver 映射后的语义化名称（如 button "a"、axis "leftStickX"）
 */
export interface EnhancedGamepadState {
  index: number;
  id: string;
  mapping: GamepadMappingType;
  connected: boolean;
  timestamp: number;
  driverId: string;

  raw: {
    buttons: readonly GamepadButton[];
    axes: readonly number[];
  };

  mapped: {
    buttons: Record<string, number>;
    axes: Record<string, number>;
  };
}

/** 按钮元信息 */
export interface ButtonMeta {
  name: string;
  label: string;
  group: "action" | "shoulder" | "trigger" | "menu" | "dpad" | "stick";
  kind: "digital" | "analog";
}

/** 摇杆元信息 */
export interface AxisMeta {
  name: string;
  label: string;
}

/** 手柄布局描述——供可视化组件渲染使用 */
export interface ControllerLayout {
  type: string;
  buttons: ButtonPosition[];
  axes: AxisPosition[];
}

export interface ButtonPosition {
  x: number;
  y: number;
  name: string;
  label: string;
  group: string;
  kind: "digital" | "analog";
}

export interface AxisPosition {
  x: number;
  y: number;
  name: string;
  label: string;
}
