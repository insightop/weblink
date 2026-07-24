import { useGamepadState } from "../hooks/useGamepadState";
import { useGamepadDriver } from "../hooks/useGamepadDriver";
import { ConnectionPanel } from "./ConnectionPanel";
import { ButtonGrid } from "./ButtonGrid";
import { JoystickView } from "./JoystickView";
import { TriggerView } from "./TriggerView";

interface GamepadPanelProps {
  index: number;
}

/**
 * GamepadPanel — 单个手柄的完整面板。
 *
 * 组合 ConnectionPanel + ButtonGrid + JoystickView × 2 + TriggerView × 2。
 * 借助 useGamepadState / useGamepadDriver 自动订阅和检测。
 */
export function GamepadPanel({ index }: GamepadPanelProps) {
  const state = useGamepadState(index);
  const driver = useGamepadDriver(index);

  if (!state) return null;

  const layout = driver?.getLayout();

  return (
    <div className="gp-card">
      {/* 信息面板 */}
      <ConnectionPanel state={state} driverLabel={driver?.displayName ?? "未知"} />

      {/* 可视化区域 */}
      <div className="gp-viz">
        {/* 扳机 */}
        <div className="gp-triggers">
          <TriggerView
            label="LT"
            value={state.mapped.buttons.leftTrigger ?? 0}
          />
          <TriggerView
            label="RT"
            value={state.mapped.buttons.rightTrigger ?? 0}
          />
        </div>

        {/* 按键网格 */}
        {layout && (
          <ButtonGrid
            layout={layout}
            buttonValues={state.mapped.buttons}
          />
        )}

        {/* 摇杆 */}
        <div className="gp-sticks">
          <JoystickView
            label="左摇杆"
            x={state.mapped.axes.leftStickX ?? 0}
            y={-(state.mapped.axes.leftStickY ?? 0)}
          />
          <JoystickView
            label="右摇杆"
            x={state.mapped.axes.rightStickX ?? 0}
            y={-(state.mapped.axes.rightStickY ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}
