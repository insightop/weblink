interface TriggerViewProps {
  label: string;
  value: number;  // 0 ~ 1
  width?: number;
  height?: number;
}

/**
 * TriggerView — 扳机力度条。
 *
 * 纵向进度条，填充比例对应扳机按压深度。
 * 同时数值显示精确的 value。
 */
export function TriggerView({ label, value, width = 40, height = 100 }: TriggerViewProps) {
  const barH = height - 20;

  return (
    <div className="gp-trigger" style={{ width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        {/* 背景条 */}
        <rect
          x={width * 0.2}
          y={10}
          width={width * 0.6}
          height={barH}
          rx={4}
          fill="var(--gp-color-idle)"
          stroke="var(--gp-color-border)"
          strokeWidth={1}
        />
        {/* 填充 */}
        <rect
          x={width * 0.2}
          y={10 + barH - barH * value}
          width={width * 0.6}
          height={barH * value}
          rx={4}
          fill="var(--gp-color-active)"
          opacity={0.9}
        />
        {/* 数值 */}
        <text
          x={width / 2}
          y={height - 2}
          textAnchor="middle"
          fontSize={9}
          fill="var(--gp-color-text)"
        >
          {value.toFixed(2)}
        </text>
      </svg>
      <span className="gp-trigger__label">{label}</span>
    </div>
  );
}
