import React from "react";
import { fmtUSD, fmtPct, getDynamicDateFormat } from "../../utils/formatters";

const localFmtDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

export default function PortfolioTooltip({
  hovered,
  isDiffActive,
  diffStartIdx,
  diffEndIdx,
  history,
  visibleDurationMs,
  hasMultipleYears,
  transactionsByIdx,
  W,
  H,
  hideValues,
  findClosestPtByTimestamp
}) {
  const formatUSD = (n) => fmtUSD(n, hideValues);
  const formatPct = fmtPct;

  return (
    <>
      {hovered &&
        !isDiffActive &&
        (() => {
          const diff = hovered.value - hovered.cost;
          const diffPct = hovered.cost > 0 ? (diff / hovered.cost) * 100 : 0;
          const txs = transactionsByIdx[hovered.originalIdx];
          return (
            <div
              className="chart-tooltip-box"
              style={{
                top: Math.max(10, Math.min(H - 180, hovered.y - 45)) + "px",
                left: (hovered.x / W) * 100 + "%",
                opacity: 1,
                transform: hovered.x < W / 2 ? "translateX(15px)" : "translateX(calc(-100% - 15px))",
                zIndex: 100,
                pointerEvents: "none"
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 2 }}>
                {getDynamicDateFormat(hovered.date, visibleDurationMs, hasMultipleYears, true)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>มูลค่า:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "white" }}>{formatUSD(hovered.value)}</span>
                </div>
                {hovered.cost > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>ต้นทุน:</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#A5B4FC" }}>{formatUSD(hovered.cost)}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        paddingTop: 2,
                        marginTop: 2
                      }}
                    >
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>P&L:</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: diff >= 0 ? "#6EE7B7" : "#FCA5A5" }}>
                        {diff >= 0 ? "+" : ""}
                        {formatUSD(diff)} ({formatPct(diffPct)})
                      </span>
                    </div>
                  </>
                )}
                {txs && txs.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      borderTop: "1px dashed rgba(255,255,255,0.2)",
                      paddingTop: 6,
                      display: "flex",
                      flexDirection: "column",
                      gap: 3
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "#F59E0B",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      🛒 ธุรกรรมในวันนี้:
                    </span>
                    {txs.map((tx, idx) => (
                      <span key={idx} style={{ fontSize: 10, color: "#FFF", opacity: 0.9 }}>
                        • {tx.type === "BUY" ? "ซื้อ" : "ขาย"} {tx.symbol} {tx.qty.toLocaleString()} หุ้น @{" "}
                        {formatUSD(tx.price)}
                        {tx.time ? ` · ${tx.time} น.` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {isDiffActive &&
        diffStartIdx !== null &&
        diffEndIdx !== null &&
        diffStartIdx !== diffEndIdx &&
        (() => {
          const ptA = findClosestPtByTimestamp(diffStartIdx);
          const ptB = findClosestPtByTimestamp(diffEndIdx);

          if (ptA && ptB) {
            const findClosestHistoryPoint = (ts) => {
              if (!history || history.length === 0) return null;
              let best = history[0],
                bestDiff = Infinity;
              history.forEach((h) => {
                const diff = Math.abs(new Date(h.date).getTime() - ts);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  best = h;
                }
              });
              return best;
            };
            const pA = findClosestHistoryPoint(diffStartIdx);
            const pB = findClosestHistoryPoint(diffEndIdx);
            if (!pA || !pB) return null;

            const valA = pA.value;
            const valB = pB.value;
            const diffVal = valB - valA;
            const diffPct = valA > 0 ? (diffVal / valA) * 100 : 0;

            const dateA = new Date(pA.date);
            const dateB = new Date(pB.date);
            const diffDays = Math.round(Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24));
            let timeStr = `${diffDays} วัน`;
            if (diffDays >= 365) {
              timeStr = `${(diffDays / 365).toFixed(1)} ปี`;
            } else if (diffDays >= 30) {
              timeStr = `${(diffDays / 30.4).toFixed(1)} เดือน`;
            }

            const xA = ptA.x;
            const xB = ptB.x;
            const centerPct = ((xA + xB) / 2 / W) * 100;

            return (
              <div
                className="chart-tooltip-box"
                style={{
                  position: "absolute",
                  top: "10px",
                  left: centerPct >= 50 ? "52px" : "auto",
                  right: centerPct < 50 ? "12px" : "auto",
                  opacity: 1,
                  transform: "none",
                  zIndex: 101,
                  pointerEvents: "none",
                  width: "220px",
                  padding: "10px 14px",
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#94A3B8",
                    fontWeight: 800,
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    paddingBottom: 4,
                    marginBottom: 2,
                    fontFamily: "var(--font-family)"
                  }}
                >
                  📊 เปรียบเทียบค่าส่วนต่าง
                </div>
                <div style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "var(--font-family)" }}>
                  {localFmtDate(pA.date)} ➔ {localFmtDate(pB.date)} ({timeStr})
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    marginTop: 2,
                    fontFamily: "var(--font-family)"
                  }}
                >
                  <span style={{ color: "#94A3B8" }}>เริ่ม:</span>
                  <span style={{ color: "white", fontWeight: 700 }}>{formatUSD(valA)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    fontFamily: "var(--font-family)"
                  }}
                >
                  <span style={{ color: "#94A3B8" }}>สิ้นสุด:</span>
                  <span style={{ color: "white", fontWeight: 700 }}>{formatUSD(valB)}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    borderTop: "1px dashed rgba(255,255,255,0.15)",
                    paddingTop: 4,
                    marginTop: 2,
                    fontFamily: "var(--font-family)"
                  }}
                >
                  <span style={{ color: "#94A3B8" }}>ส่วนต่าง:</span>
                  <span
                    style={{
                      fontWeight: 900,
                      color: diffVal >= 0 ? "#10B981" : "#EF4444"
                    }}
                  >
                    {diffVal >= 0 ? "+" : ""}
                    {formatUSD(diffVal)} ({diffVal >= 0 ? "+" : ""}
                    {diffPct.toFixed(2)}%)
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "#94A3B8",
                    textAlign: "center",
                    marginTop: 4,
                    fontStyle: "italic",
                    fontFamily: "var(--font-family)"
                  }}
                >
                  คลิก 1 ครั้งบนกราฟเพื่อล้างข้อมูลเปรียบเทียบ
                </div>
              </div>
            );
          }
          return null;
        })()}
    </>
  );
}
