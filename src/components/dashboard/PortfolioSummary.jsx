import React, { useMemo } from "react";
import { fmtUSD, fmtTHB, fmtPct } from "../../utils/formatters";

export default function PortfolioSummary({
  hasPrices,
  totalUSD,
  exchangeRate,
  totalCostUSD,
  totalGainUSD,
  totalGainPct,
  totalGainTHB,
  assets,
  totalRealizedUSD,
  totalUnrealizedUSD,
  initialCapitalUSD,
  todayChangeUSD,
  setShowPnLDetailsModal,
  hideValues
}) {
  const fmt = useMemo(() => ({
    usd: (n) => fmtUSD(n, hideValues),
    thb: (n, decimals = 2) => fmtTHB(n, decimals, hideValues),
    pct: fmtPct,
  }), [hideValues]);

  return (
    <div className="hero-card stagger-2">
      <div className="hero-label">🏦 มูลค่าพอร์ตโฟลิโอรวม</div>
      {hasPrices ? (
        <>
          <div className="hero-usd" style={{ marginBottom: 4 }}>
            {fmt.usd(totalUSD)}
          </div>
          <div className="hero-thb" style={{ fontSize: "25px", color: "#FFFFFF", opacity: 0.95, fontWeight: "800", marginTop: 4, marginBottom: 16 }}>
            {fmt.thb(totalUSD * exchangeRate)}
          </div>
          {(totalCostUSD > 0 || initialCapitalUSD > 0 || totalRealizedUSD !== 0) && (
            <div className={`hero-pnl ${totalGainUSD >= 0 ? "up" : "down"}`}
              onClick={() => setShowPnLDetailsModal(true)}
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                gap: "4px 8px",
                alignItems: "center",
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.12)",
                padding: "6px 12px",
                borderRadius: "10px",
                transition: "background 0.2s, transform 0.2s",
                border: "1px solid rgba(255, 255, 255, 0.15)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
              title="คลิกเพื่อดูรายละเอียดกำไร/ขาดทุนรายสินทรัพย์">
              <span>
                {totalGainUSD >= 0 ? "▲" : "▼"} {fmt.usd(Math.abs(totalGainUSD))}
              </span>
              <span style={{ opacity: 0.8, fontSize: 12 }}>({fmt.pct(totalGainPct)})</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span>
                {totalGainTHB >= 0 ? "▲" : "▼"} {fmt.thb(Math.abs(totalGainTHB), 2)}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="skeleton skeleton-text xl" style={{ width: "80%", marginBottom: 10 }} />
          <div className="skeleton skeleton-text" style={{ width: "60%", marginBottom: 16 }} />
          <div className="skeleton skeleton-block" style={{ width: 140, height: 32, borderRadius: 12 }} />
        </>
      )}
      <div className="hero-divider" />
      <div className="hero-meta">
        <div className="hero-meta-item">
          <span className="hero-meta-label">สินทรัพย์ที่ถืออยู่</span>
          <span className="hero-meta-value">{assets.filter(a => a.qty > 0.00001).length} รายการ</span>
        </div>
        <div className="hero-meta-item" style={{ textAlign: "right" }}>
          <span className="hero-meta-label">ต้นทุนรวม</span>
          <span className="hero-meta-value" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span>{fmt.usd(totalCostUSD)}</span>
            <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 }}>({fmt.thb(totalCostUSD * exchangeRate, 0)})</span>
          </span>
        </div>
      </div>
      <div className="hero-meta" style={{ marginTop: 10, borderTop: "1px dashed rgba(255,255,255,0.2)", paddingTop: 10 }}>
        <div className="hero-meta-item">
          <span className="hero-meta-label">รับรู้แล้ว (Realized)</span>
          <span className="hero-meta-value" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span style={{ color: totalRealizedUSD >= 0 ? "#6EE7B7" : "#FCA5A5", fontWeight: 700 }}>
              {totalRealizedUSD >= 0 ? "+" : ""}{fmt.usd(totalRealizedUSD)}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 }}>
              ({totalRealizedUSD >= 0 ? "+" : ""}{fmt.thb(totalRealizedUSD * exchangeRate)})
            </span>
          </span>
        </div>
        <div className="hero-meta-item" style={{ textAlign: "right" }}>
          <span className="hero-meta-label">ยังไม่รับรู้ (Unrealized)</span>
          <span className="hero-meta-value" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span style={{ color: totalUnrealizedUSD >= 0 ? "#6EE7B7" : "#FCA5A5", fontWeight: 700 }}>
              {totalUnrealizedUSD >= 0 ? "+" : ""}{fmt.usd(totalUnrealizedUSD)}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 }}>
              ({totalUnrealizedUSD >= 0 ? "+" : ""}{fmt.thb(totalUnrealizedUSD * exchangeRate)})
            </span>
          </span>
        </div>
      </div>
      <div className="hero-meta" style={{ marginTop: 10, borderTop: "1px dashed rgba(255,255,255,0.2)", paddingTop: 10 }}>
        <div className="hero-meta-item">
          <span className="hero-meta-label">ทุนสะสมทั้งหมด</span>
          <span className="hero-meta-value" style={{ fontWeight: 700 }}>
            {fmt.usd(initialCapitalUSD)}
          </span>
        </div>
        <div className="hero-meta-item" style={{ textAlign: "right" }}>
          <span className="hero-meta-label">มูลค่าทุนสะสม (THB)</span>
          <span className="hero-meta-value" style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 }}>
            ({fmt.thb(initialCapitalUSD * exchangeRate)})
          </span>
        </div>
      </div>
      {hasPrices && todayChangeUSD !== 0 && (
        <div style={{
          marginTop: 14,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: "8px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 600 }}>กำไร/ขาดทุนวันนี้</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: todayChangeUSD >= 0 ? "#6EE7B7" : "#FCA5A5" }}>
            {todayChangeUSD >= 0 ? "+" : ""}{fmt.usd(todayChangeUSD)}{" "}
            <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>
              ({todayChangeUSD >= 0 ? "+" : ""}{fmt.thb(todayChangeUSD * exchangeRate, 0)})
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
