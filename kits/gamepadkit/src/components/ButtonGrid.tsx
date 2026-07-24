import type { ControllerLayout } from "../core/types";

interface ButtonGridProps {
  layout: ControllerLayout;
  buttonValues: Record<string, number>;
}

/**
 * ButtonGrid — 根据 layout 定义的按钮位置，渲染 SVG 网格。
 *
 * 按下时高亮（透明度/颜色变化），同时显示 raw value（0.0~1.0）。
 */
export function ButtonGrid({ layout, buttonValues }: ButtonGridProps) {
  const r = 14;

  return (
    <svg viewBox="0 0 400 300" className="gp-buttonsvg">
      {layout.buttons.map((btn) => {
        const value = buttonValues[btn.name] ?? 0;
        const pressed = btn.kind === "digital" ? value > 0.5 : value > 0;
        return (
          <g key={btn.name} transform={`translate(${btn.x},${btn.y})`}>
            <circle
              cx={0}
              cy={0}
              r={r}
              fill={pressed ? "var(--gp-color-active)" : "var(--gp-color-idle)"}
              stroke="var(--gp-color-border)"
              strokeWidth={1.5}
              opacity={pressed ? 1 : 0.6}
            />
            <text
              x={0}
              y={1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={btn.kind === "analog" ? 9 : 11}
              fill={pressed ? "var(--gp-color-active-text)" : "var(--gp-color-text)"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {btn.kind === "analog" ? value.toFixed(2) : btn.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
