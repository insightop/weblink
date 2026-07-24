import type { EnhancedGamepadState } from "../core/types";

interface ConnectionPanelProps {
  state: EnhancedGamepadState;
  driverLabel: string;
}

/**
 * ConnectionPanel — 显示手柄的连接信息与技术参数。
 *
 * 展示：型号（id）、连接索引、驱动类型、Mapping、按钮/摇杆数量、时间戳。
 */
export function ConnectionPanel({ state, driverLabel }: ConnectionPanelProps) {
  return (
    <div className="gp-panel">
      <table className="gp-info">
        <tbody>
          <tr>
            <td className="gp-info__label">驱动</td>
            <td className="gp-info__value">{driverLabel}</td>
          </tr>
          <tr>
            <td className="gp-info__label">ID</td>
            <td className="gp-info__value gp-info__value--mono">{state.id}</td>
          </tr>
          <tr>
            <td className="gp-info__label">索引</td>
            <td className="gp-info__value">#{state.index}</td>
          </tr>
          <tr>
            <td className="gp-info__label">Mapping</td>
            <td className="gp-info__value">{state.mapping || "(none)"}</td>
          </tr>
          <tr>
            <td className="gp-info__label">按钮数</td>
            <td className="gp-info__value">{state.raw.buttons.length}</td>
          </tr>
          <tr>
            <td className="gp-info__label">摇杆轴数</td>
            <td className="gp-info__value">{state.raw.axes.length}</td>
          </tr>
          <tr>
            <td className="gp-info__label">时间戳</td>
            <td className="gp-info__value gp-info__value--mono">{state.timestamp}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
