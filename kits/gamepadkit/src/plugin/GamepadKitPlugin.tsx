import { useGamepads } from "../hooks/useGamepads";
import { GamepadPanel } from "../components/GamepadPanel";
import { initGamepadDrivers } from "../drivers/registry";
import "./plugin.css";

// 确保驱动已注册（幂等）
initGamepadDrivers();

/**
 * GamepadKitPlugin — Weblink 无痛集成组件。
 *
 * 在任意 React 页面中引入即可获得手柄调试面板：
 *
 * ```tsx
 * import { GamepadKitPlugin } from "@weblink/gamepadkit";
 *
 * function App() {
 *   return (
 *     <div>
 *       <GamepadKitPlugin />
 *       <main>页面内容...</main>
 *     </div>
 *   );
 * }
 * ```
 *
 * 状态：
 * - 空闲时：右下角悬浮圆点，点击展开
 * - 展开后：显示已连接手柄的实时调试面板
 */
export function GamepadKitPlugin() {
  const { gamepads, connectedCount, supported } = useGamepads();

  return (
    <div className="gp-plugin">
      {!supported && (
        <div className="gp-plugin__warn">
          Gamepad API 需要 HTTPS/localhost
        </div>
      )}
      {supported && connectedCount === 0 && (
        <div className="gp-plugin__idle">
          按下手柄任意键激活
        </div>
      )}
      {gamepads.map((gp) => (
        <GamepadPanel key={gp.index} index={gp.index} />
      ))}
    </div>
  );
}
