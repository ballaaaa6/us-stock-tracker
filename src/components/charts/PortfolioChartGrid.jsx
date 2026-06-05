import React from "react";
import { getDynamicDateFormat } from "../../utils/formatters";

export default function PortfolioChartGrid({
  yTicks,
  dateLabels,
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
          stroke="#F1F5F9"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}
      {/* Vertical grid lines */}
      {dateLabels.map(({ x }, i) => (
        <line key={`x-grid-${i}`} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#F8FAFC" strokeWidth="1" />
      ))}

      {/* Y-axis tick labels */}
      {yTicks.map(({ v, y }, i) => (
        <text
          key={`y-label-${i}`}
          x={PAD_L - 8}
          y={y + 4}
          textAnchor="end"
          fontSize="12"
          fill="var(--text-muted)"
          fontFamily="var(--font-family)"
          fontWeight="700"
        >
          {v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(v >= 100 ? 0 : 2)}
        </text>
      ))}

      {/* X-axis tick labels */}
      {dateLabels.map(({ x, date }, i) => (
        <text
          key={`x-label-${i}`}
          x={x}
          y={H - PAD_B + 18}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-muted)"
          fontFamily="var(--font-family)"
          fontWeight="700"
        >
          {getDynamicDateFormat(date, visibleDurationMs, hasMultipleYears)}
        </text>
      ))}
    </>
  );
}
