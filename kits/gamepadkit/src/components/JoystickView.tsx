interface JoystickViewProps {
  label: string;
  x: number;  // -1 ~ 1
  y: number;  // -1 ~ 1
  size?: number;
}

/**
 * JoystickView — 摇杆 2D 可视化。
 *
 * 渲染一个圆形范围，中心点显示摇杆当前位置。
 * - 外圈：摇杆活动范围
 * - 内圈/点：实际位置（x, y 映射到 -1~1）
 * - 十字线：中心参考
 */
export function JoystickView({ label, x, y, size = 120 }: JoystickViewProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const dotX = cx + (x * outerR * 0.7);
  const dotY = cy + (y * outerR * 0.7);

  return (
    <div className="gp-joystick">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="gp-joystick__svg"
      >
        {/* 外圈 */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          fill="none"
          stroke="var(--gp-color-border)"
          strokeWidth={1.5}
        />
        {/* 内圈死区指示 */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR * 0.15}
          fill="none"
          stroke="var(--gp-color-border)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* 十字线 */}
        <line x1={cx - outerR} y1={cy} x2={cx + outerR} y2={cy} stroke="var(--gp-color-border)" strokeWidth={0.5} opacity={0.4} />
        <line x1={cx} y1={cy - outerR} x2={cx} y2={cy + outerR} stroke="var(--gp-color-border)" strokeWidth={0.5} opacity={0.4} />
        {/* 摇杆点 */}
        <circle
          cx={dotX}
          cy={dotY}
          r={8}
          fill="var(--gp-color-active)"
          stroke="var(--gp-color-active-text)"
          strokeWidth={1.5}
        />
      </svg>
      <span className="gp-joystick__label">{label}</span>
      <span className="gp-joystick__value">({x.toFixed(3)}, {y.toFixed(3)})</span>
    </div>
  );
}
