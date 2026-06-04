import React, { useMemo } from "react";
import { fmtUSD, fmtTHB, fmtPct } from "../../utils/formatters";

export default function KPIRow({
  totalUSD,
  totalTHB,
  todayChange,
  todayChangeTHB,
  todayChangePct,
  totalGain,
  totalGainTHB,
  totalGainPct,
  bestAsset,
  loading,
  hideValues
}) {
  const fmt = useMemo(() => ({
    usd: (n) => fmtUSD(n, hideValues),
    thb: (n, decimals = 2) => fmtTHB(n, decimals, hideValues),
    pct: fmtPct,
  }), [hideValues]);

  if (loading) {
    return (
      <div className="kpi-row stagger-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="kpi-card">
            <div className="skeleton skeleton-text" style={{ width: "60%", marginBottom: 10 }} />
            <div className="skeleton skeleton-text xl" style={{ width: "80%", marginBottom: 8 }} />
            <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          </div>
        ))}
      </div>
    );
  }

  const todayUp = todayChange >= 0;
  const totalUp = totalGain >= 0;

  return (
    <div className="kpi-row stagger-1">
      <div className="kpi-card primary">
        <div className="kpi-label">💰 มูลค่ารวม</div>
        <div className="kpi-value">{fmt.usd(totalUSD)}</div>
        <div className="kpi-sub">{fmt.thb(totalTHB)}</div>
      </div>

      <div className={`kpi-card ${todayUp ? "gain-card" : "loss-card"}`}>
        <div className="kpi-label">📅 วันนี้</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div className="kpi-value" style={{ color: todayUp ? "var(--gain)" : "var(--loss)", margin: 0, whiteSpace: "nowrap" }}>
            {todayChange !== 0 ? (todayUp ? "+" : "-") + fmt.usd(Math.abs(todayChange)) : "—"}
          </div>
          {todayChange !== 0 && (
            <span className={`kpi-badge ${todayUp ? "up" : "down"}`} style={{ margin: 0, whiteSpace: "nowrap" }}>
              {todayUp ? "▲" : "▼"} {fmt.pct(todayChangePct)}
            </span>
          )}
        </div>
        {todayChange !== 0 && (
          <div className="kpi-sub" style={{ marginTop: 2 }}>{todayUp ? "+" : "-"}{fmt.thb(Math.abs(todayChangeTHB))}</div>
        )}
      </div>

      <div className={`kpi-card ${totalUp ? "gain-card" : "loss-card"}`}>
        <div className="kpi-label">📊 กำไร/ขาดทุนรวม</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div className="kpi-value" style={{ color: totalUp ? "var(--gain)" : "var(--loss)", margin: 0, whiteSpace: "nowrap" }}>
            {totalGain !== 0 ? (totalUp ? "+" : "-") + fmt.usd(Math.abs(totalGain)) : "—"}
          </div>
          {totalGain !== 0 && (
            <span className={`kpi-badge ${totalUp ? "up" : "down"}`} style={{ margin: 0, whiteSpace: "nowrap" }}>
              {totalUp ? "▲" : "▼"} {fmt.pct(totalGainPct)}
            </span>
          )}
        </div>
        {totalGain !== 0 && (
          <div className="kpi-sub" style={{ marginTop: 2 }}>{totalUp ? "+" : "-"}{fmt.thb(Math.abs(totalGainTHB))}</div>
        )}
      </div>

      <div className="kpi-card gold-card">
        <div className="kpi-label">🏆 ดีที่สุด</div>
        {bestAsset ? (
          <>
            <div className="kpi-value small">{bestAsset.symbol}</div>
            <div className="kpi-sub" style={{ color: "var(--gain)", fontWeight: 700 }}>
              {fmt.pct(bestAsset.pct)}
            </div>
          </>
        ) : (
          <div className="kpi-value small" style={{ color: "var(--text-muted)" }}>—</div>
        )}
      </div>
    </div>
  );
}
