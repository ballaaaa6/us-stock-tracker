import React from "react";
import { getDynamicDateFormat } from "../../utils/formatters";

export default function ChartGridAndAxes({
  yTicks,
  xTicks,
  PAD_L,
  PAD_R,
  PAD_T,
  PAD_B,
  W,
  H,
  visibleDurationMs,
  hasMultipleYears
}) {
  return (
    <>
      {/* Horizontal grid lines */}
      {yTicks.map(({ y }, i) => (
        <line
          key={`y-grid-${i}`}
          x1={PAD_L}
          y1={y}
          x2={W - PAD_R}
          y2={y}
          stroke="#E8EBF2"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}
      {/* Vertical grid lines */}
      {xTicks.map(({ x }, i) => (
        <line key={`x-grid-${i}`} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#F1F5F9" strokeWidth="1" />
      ))}

      {/* Y-axis tick labels */}
      {yTicks.map(({ v, y }, i) => (
        <text
          key={`y-label-${i}`}
          x={PAD_L - 6}
          y={y + 4}
          textAnchor="end"
          fontSize="10"
          fill="#94A3B8"
          fontFamily="Outfit,sans-serif"
          fontWeight="600"
        >
          {v >= 1000 ? (v / 1000).toFixed(1) + "k" : v < 1 ? v.toFixed(4) : v.toFixed(v >= 100 ? 0 : 2)}
        </text>
      ))}

      {/* X-axis tick labels */}
      {xTicks.map(({ x, date }, i) => (
        <text
          key={`x-label-${i}`}
          x={x}
          y={H - PAD_B + 16}
          textAnchor="middle"
          fontSize="10"
          fill="#94A3B8"
          fontFamily="Outfit,sans-serif"
          fontWeight="600"
        >
          {getDynamicDateFormat(date, visibleDurationMs, hasMultipleYears)}
        </text>
      ))}
    </>
  );
}
