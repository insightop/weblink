import type { ButtonMeta, AxisMeta, ControllerLayout } from "../core/types";

/**
 * GamepadDriver — 手柄驱动接口。
 *
 * 每种手柄型号实现一份 Driver，负责：
 * - 自动检测（通过 gamepad.id / gamepad.mapping 判断）
 * - raw 索引 → 语义化名称的映射
 * - 布局信息供可视化渲染
 */
export interface GamepadDriver {
  /** 驱动标识，如 "xbox"、"playstation"、"generic" */
  readonly id: string;
  /** 显示名称，如 "Xbox 手柄" */
  readonly displayName: string;
  /** 是否匹配该手柄 */
  detect(gamepad: Gamepad): boolean;
  /** raw button index → ButtonMeta */
  mapButton(index: number): ButtonMeta | undefined;
  /** raw axis index → AxisMeta */
  mapAxis(index: number): AxisMeta | undefined;
  /** 手柄视觉布局 */
  getLayout(): ControllerLayout;
}
