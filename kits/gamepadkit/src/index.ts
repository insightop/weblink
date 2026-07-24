/**
 * @weblink/gamepadkit
 *
 * Gamepad Kit — 手柄调试测试工具包。
 * 提供基于 React + Gamepad API 的手柄调试能力。
 *
 * 使用方式：
 *
 * ```tsx
 * // 独立实验页（EmbeddedPage）
 * import { GamepadLabPage } from "@weblink/gamepadkit";
 *
 * // 集成插件
 * import { GamepadKitPlugin } from "@weblink/gamepadkit";
 *
 * // Hooks
 * import { useGamepads, useGamepadState } from "@weblink/gamepadkit";
 *
 * // 驱动注册
 * import { globalDriverRegistry } from "@weblink/gamepadkit";
 * ```
 */

export { GamepadLabPage } from "./lab/GamepadLabPage";
export { GamepadKitPlugin } from "./plugin/GamepadKitPlugin";
export { useGamepads } from "./hooks/useGamepads";
export { useGamepadState } from "./hooks/useGamepadState";
export { useGamepadDriver } from "./hooks/useGamepadDriver";
export { globalDriverRegistry, initGamepadDrivers } from "./drivers/registry";
export type { EnhancedGamepadState, ButtonMeta, AxisMeta, ControllerLayout } from "./core/types";
export type { GamepadDriver } from "./drivers/types";

/* ── Weblink KitWrapper expects EmbeddedPage or App ── */
export { GamepadLabPage as EmbeddedPage } from "./lab/GamepadLabPage";
