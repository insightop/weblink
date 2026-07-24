import { useGamepads } from "../hooks/useGamepads";
import { GamepadPanel } from "../components/GamepadPanel";
import { initGamepadDrivers } from "../drivers/registry";
import "./lab.css";

// 确保驱动已注册（幂等）
initGamepadDrivers();

/**
 * GamepadLabPage — 独立实验调试页。
 *
 * 显示所有已连接手柄的实时状态：
 * - 未连接时显示提示
 * - 浏览器不支持时显示警告
 * - 多手柄同时显示
 *
 * 路由挂载点：/gamepadkit
 */
export function GamepadLabPage() {
  const { gamepads, connectedCount, supported } = useGamepads();

  return (
    <div className="gp-page">
      <header className="gp-topbar">
        <h1 className="gp-topbar__title">Gamepad Kit</h1>
        <div className="gp-topbar__meta">
          {!supported && (
            <span className="gp-topbar__warn">当前浏览器不支持 Gamepad API</span>
          )}
          {supported && connectedCount > 0 && (
            <span className="gp-topbar__ok">
              已连接 {connectedCount} 个手柄
            </span>
          )}
          {supported && connectedCount === 0 && (
            <span className="gp-topbar__idle">
              按下手柄任意键开始
            </span>
          )}
        </div>
      </header>

      <div className="gp-body">
        {!supported && (
          <div className="gp-empty">
            <p>Gamepad API 需要 HTTPS 或 localhost 环境。</p>
          </div>
        )}
        {supported && connectedCount === 0 && (
          <div className="gp-empty">
            <p>连接一个手柄后状态将实时显示在此处。</p>
            <p className="gp-empty__hint">
              支持：Xbox、PlayStation、Switch Pro 及标准手柄
            </p>
          </div>
        )}
        <div className="gp-grid">
          {gamepads.map((gp) => (
            <GamepadPanel key={gp.index} index={gp.index} />
          ))}
        </div>
      </div>
    </div>
  );
}
