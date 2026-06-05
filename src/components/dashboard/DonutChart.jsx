import React, { useState, useEffect, useMemo } from "react";

const DONUT_COLORS = ["#5236FF", "#00B98A", "#F59E0B", "#FF4B55", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];
const CATEGORY_LABELS = { stock: "หุ้น", crypto: "คริปโต", gold: "ทองคำ/น้ำมัน", fiat: "เงินสด" };

export default function DonutChart({ segments, activeAssets, hasAssets, drillCategory, setDrillCategory }) {
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Clear hovered slice state when drillCategory changes
  useEffect(() => {
    setHoveredSlice(null);
  }, [drillCategory]);

  const R = 68,
    CX = 80,
    CY = 80,
    SW = 18;
  const circumference = 2 * Math.PI * R;

  // Handle mouse move to update tooltip position
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  // Reset drill-down when active assets are empty
  useEffect(() => {
    if (!activeAssets || activeAssets.length === 0) {
      setDrillCategory(null);
    }
  }, [activeAssets]);

  // If no assets or skeleton state
  if (!segments || segments.length === 0 || !activeAssets) {
    return (
      <div className="donut-card-body">
        <div className="chart-container">
          <div className="donut-wrapper">
            <svg viewBox="0 0 160 160" className="donut-chart-svg">
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={SW} />
            </svg>
            <div className="donut-center-label">
              <div className="donut-center-count" style={{ color: "var(--text-faint)" }}>
                {activeAssets?.length > 0 ? activeAssets.length : "—"}
              </div>
              <div className="donut-center-text">{activeAssets?.length > 0 ? "กำลังโหลด..." : "ว่างเปล่า"}</div>
            </div>
          </div>
          <div className="legend-list">
            {hasAssets ? (
              /* Skeleton rows when assets exist but no prices yet */
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="legend-item">
                  <div className="skeleton skeleton-circle" style={{ width: 10, height: 10, flexShrink: 0 }} />
                  <div className="skeleton skeleton-text" style={{ flex: 1, height: 12 }} />
                  <div className="skeleton skeleton-text" style={{ width: 30, height: 12 }} />
                </div>
              ))
            ) : (
              /* Empty state hint */
              <div
                style={{
                  gridColumn: "1/-1",
                  textAlign: "center",
                  padding: "12px 0",
                  fontSize: 12,
                  color: "var(--text-faint)"
                }}
              >
                เพิ่มสินทรัพย์เพื่อดูสัดส่วน
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Calculate current slices depending on drill Category
  let slices = [];
  let displayCount = 0;
  let centerText = "สินทรัพย์";

  if (!drillCategory) {
    // Top-level View
    displayCount = activeAssets.length;
    centerText = "สินทรัพย์";
    let cumulative = 0;
    slices = segments.map((seg, i) => {
      const dash = (seg.pct / 100) * circumference;
      const gap = circumference - dash;
      const strokeDashoffset = circumference - cumulative;
      cumulative += dash;
      return {
        ...seg,
        dash,
        gap,
        strokeDashoffset,
        color: DONUT_COLORS[i % DONUT_COLORS.length]
      };
    });
  } else {
    // Drilled-down View
    const filtered = activeAssets.filter((a) => (a.category || "stock") === drillCategory);
    const catTotalVal = filtered.reduce((sum, a) => sum + (a.valueUSD || 0), 0);
    const sortedFiltered = [...filtered].sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0));

    displayCount = sortedFiltered.length;
    centerText = CATEGORY_LABELS[drillCategory] || drillCategory;

    let childCumulative = 0;
    slices = sortedFiltered.map((a, i) => {
      const pct = catTotalVal > 0 ? (a.valueUSD / catTotalVal) * 100 : 0;
      const dash = (pct / 100) * circumference;
      const gap = circumference - dash;
      const strokeDashoffset = circumference - childCumulative;
      childCumulative += dash;
      return {
        id: a.symbol,
        label: a.symbol,
        fullName: a.name || a.symbol,
        pct,
        value: a.valueUSD,
        dash,
        gap,
        strokeDashoffset,
        color: DONUT_COLORS[i % DONUT_COLORS.length]
      };
    });
  }

  return (
    <div className="donut-card-body" style={{ position: "relative" }}>
      <div className="chart-container">
        <div className="donut-wrapper" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredSlice(null)}>
          <svg viewBox="0 0 160 160" className="donut-chart-svg">
            {/* Background track */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth={SW} />
            {/* Segments */}
            {slices.map((s, i) => (
              <circle
                key={i}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={hoveredSlice && hoveredSlice.id === s.id ? SW + 3 : SW}
                strokeLinecap="butt"
                strokeDasharray={`${s.dash} ${s.gap}`}
                strokeDashoffset={s.strokeDashoffset}
                onMouseEnter={() => setHoveredSlice(s)}
                onClick={() => {
                  if (!drillCategory) {
                    setDrillCategory(s.id);
                    setHoveredSlice(null);
                  }
                }}
                style={{
                  cursor: !drillCategory ? "pointer" : "default",
                  transition:
                    "stroke-width 0.2s ease, stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)"
                }}
              />
            ))}
            {/* White center hole */}
            <circle cx={CX} cy={CY} r={R - SW / 2 - 2} fill="white" />
          </svg>

          <div className="donut-center-label" style={{ pointerEvents: "none" }}>
            <div className="donut-center-count">{displayCount}</div>
            <div className="donut-center-text">{centerText}</div>
          </div>

          {/* Floating Tooltip */}
          {hoveredSlice && (
            <div
              className="chart-tooltip-box"
              style={{
                position: "absolute",
                top: mousePos.y - 65,
                left: mousePos.x,
                transform: mousePos.x < 80 ? "translateX(15px)" : "translateX(calc(-100% - 15px))",
                zIndex: 1000,
                pointerEvents: "none",
                background: "var(--text-main)",
                color: "white",
                padding: "8px 12px",
                borderRadius: 12,
                boxShadow: "var(--shadow-md)",
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}
            >
              <div style={{ fontWeight: 800, color: "white" }}>{hoveredSlice.label}</div>
              {hoveredSlice.fullName && (
                <div style={{ fontSize: 10, color: "var(--text-faint)", whiteSpace: "normal", maxWidth: 140 }}>
                  {hoveredSlice.fullName}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
                <span style={{ color: "var(--text-faint)" }}>สัดส่วน:</span>
                <span style={{ color: hoveredSlice.color, fontWeight: 800 }}>{hoveredSlice.pct.toFixed(2)}%</span>
              </div>
              {hoveredSlice.value !== undefined && (
                <div style={{ display: "flex", gap: 12, justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "var(--text-faint)" }}>มูลค่า:</span>
                  <span style={{ fontWeight: 800, color: "white" }}>
                    $
                    {hoveredSlice.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="legend-list">
          {slices.map((s, i) => (
            <div
              key={i}
              className="legend-item"
              onMouseEnter={() => setHoveredSlice(s)}
              onMouseLeave={() => setHoveredSlice(null)}
              onClick={() => {
                if (!drillCategory) {
                  setDrillCategory(s.id);
                  setHoveredSlice(null);
                }
              }}
              style={{
                cursor: !drillCategory ? "pointer" : "default",
                opacity: hoveredSlice && hoveredSlice.id !== s.id ? 0.5 : 1,
                transition: "opacity 0.2s ease"
              }}
            >
              <div className="legend-color" style={{ background: s.color }} />
              <span
                className="legend-name"
                style={{ fontWeight: hoveredSlice && hoveredSlice.id === s.id ? 800 : 600 }}
              >
                {s.label}
              </span>
              <span className="legend-pct" style={{ color: s.color, fontWeight: 800 }}>
                {s.pct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export { DONUT_COLORS, CATEGORY_LABELS };
