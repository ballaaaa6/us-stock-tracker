import React from "react";
import { fmtUSD, fmtTHB, fmtPct, fmtQty, fmtDateShort, getDynamicDateFormat } from "../../utils/formatters";

export default function ChartTooltip({
  hovered,
  isDiffActive,
  diffStartIdx,
  diffEndIdx,
  candles,
  asset,
  exchangeRate,
  hideValues,
  visibleDurationMs,
  hasMultipleYears,
  transactionsByDate,
  W,
  H,
  getHistoricalRate,
  findClosestPtByTimestamp
}) {
  const isThaiAsset = asset?.symbol?.endsWith(".BK");
  const isCashAsset = asset?.type === "fiat" || asset?.category === "fiat";

  return (
    <>
      {hovered &&
        !isDiffActive &&
        (() => {
          const diff = hovered.cost != null ? hovered.value - hovered.cost : 0;
          const diffPct = hovered.cost != null && hovered.cost > 0 ? (diff / hovered.cost) * 100 : 0;
          const dateStr = hovered.date.split("T")[0];
          const txs = transactionsByDate[dateStr];

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
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>ราคา:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "white" }}>
                    {isThaiAsset ? fmtTHB(hovered.value * exchangeRate, hideValues) : fmtUSD(hovered.value, hideValues)}
                  </span>
                </div>
                {hovered.cost != null && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>ทุนเฉลี่ย:</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#A5B4FC" }}>
                        {isThaiAsset
                          ? fmtTHB(hovered.cost * exchangeRate, hideValues)
                          : fmtUSD(hovered.cost, hideValues)}
                      </span>
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
                        {isThaiAsset ? fmtTHB(diff * exchangeRate, hideValues) : fmtUSD(diff, hideValues)} (
                        {fmtPct(diffPct)})
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
                        • {tx.type === "BUY" ? "ซื้อ" : "ขาย"} {fmtQty(tx.qty, hideValues)}{" "}
                        {isCashAsset ? asset.symbol : "หุ้น"} @{" "}
                        {isThaiAsset ? fmtTHB(tx.price, hideValues) : fmtUSD(tx.price, hideValues)} (ครั้งที่ {tx.num})
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
            const findClosestCandle = (ts) => {
              if (!candles || candles.length === 0) return null;
              let best = candles[0],
                bestDiff = Infinity;
              candles.forEach((c) => {
                const diff = Math.abs(new Date(c.date).getTime() - ts);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  best = c;
                }
              });
              return best;
            };
            const pA = findClosestCandle(diffStartIdx);
            const pB = findClosestCandle(diffEndIdx);
            if (!pA || !pB) return null;

            const isThai = asset?.symbol?.endsWith(".BK");
            const valA = isThai ? pA.close / exchangeRate : pA.close;
            const valB = isThai ? pB.close / exchangeRate : pB.close;
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
                  background: "rgba(30, 41, 59, 0.95)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  color: "white",
                  fontFamily: "Outfit, sans-serif"
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#94A3B8",
                    fontWeight: 800,
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    paddingBottom: 4,
                    marginBottom: 2
                  }}
                >
                  📊 เปรียบเทียบราคาหุ้น
                </div>
                <div style={{ fontSize: 10, color: "#CBD5E1" }}>
                  {fmtDateShort(pA.date)} ➔ {fmtDateShort(pB.date)} ({timeStr})
                </div>

                <div style={{ display: "flex", flexDirection: "column", fontSize: 11, marginTop: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94A3B8" }}>เริ่ม:</span>
                    <span style={{ color: "white", fontWeight: 700 }}>{fmtUSD(valA, hideValues)}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10, color: "#94A3B8" }}>
                    ({fmtTHB(valA * getHistoricalRate(pA.date), hideValues)})
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94A3B8" }}>สิ้นสุด:</span>
                    <span style={{ color: "white", fontWeight: 700 }}>{fmtUSD(valB, hideValues)}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10, color: "#94A3B8" }}>
                    ({fmtTHB(valB * getHistoricalRate(pB.date), hideValues)})
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderTop: "1px dashed rgba(255,255,255,0.15)",
                    paddingTop: 4,
                    marginTop: 2
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#94A3B8" }}>ส่วนต่าง:</span>
                    <span
                      style={{
                        fontWeight: 900,
                        color: diffVal >= 0 ? "#10B981" : "#EF4444"
                      }}
                    >
                      {diffVal >= 0 ? "+" : ""}
                      {fmtUSD(diffVal, hideValues)} ({diffVal >= 0 ? "+" : ""}
                      {diffPct.toFixed(2)}%)
                    </span>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 10,
                      fontWeight: 700,
                      color: diffVal >= 0 ? "#10B981" : "#EF4444"
                    }}
                  >
                    ({diffVal >= 0 ? "+" : ""}
                    {fmtTHB(diffVal * getHistoricalRate(pB.date), hideValues)})
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "#94A3B8", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>
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
