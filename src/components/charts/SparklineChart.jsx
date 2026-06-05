import React from "react";
import { getPoints, smoothPath } from "./chartUtils";

export const SparklineChart = React.memo(function SparklineChart({ closes }) {
  const W = 70,
    H = 32;
  if (!closes || closes.length < 3) {
    return <div className="sparkline-cell skeleton" style={{ borderRadius: 6 }} />;
  }
  const pts = getPoints(closes, W, H, 2, 4);
  const isUp = closes[closes.length - 1] >= closes[0];
  const color = isUp ? "var(--gain)" : "var(--loss)";
  const fill = isUp ? "rgba(0,185,138,0.12)" : "rgba(255,75,85,0.12)";
  const linePath = smoothPath(pts);
  const first = pts[0],
    last = pts[pts.length - 1];
  const fillPath = linePath + ` L ${last.x},${H} L ${first.x},${H} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="sparkline-svg">
      <path d={fillPath} fill={fill} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  );
});
export default SparklineChart;
