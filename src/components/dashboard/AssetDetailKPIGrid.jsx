import React from "react";

export default function AssetDetailKPIGrid({
  asset,
  isCashAsset,
  avgCostUSD,
  exchangeRate,
  valueUSD,
  gainUp,
  totalGainUSD,
  totalGainPct,
  totalGainTHB,
  fmtQty,
  fmtUSD,
  fmtTHB,
  fmtPct
}) {
  return (
    <div
      className="asset-detail-kpi-grid"
      style={{ gridTemplateColumns: isCashAsset ? "repeat(2, 1fr)" : "repeat(4, 1fr)" }}
    >
      <div className="asset-detail-kpi">
        <div className="asset-detail-kpi-label">จำนวนถือ</div>
        <div className="asset-detail-kpi-val">{fmtQty(asset.qty)}</div>
      </div>
      {!isCashAsset && (
        <div className="asset-detail-kpi">
          <div className="asset-detail-kpi-label">ราคาทุนเฉลี่ย</div>
          <div className="asset-detail-kpi-val">{fmtUSD(avgCostUSD)}</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
            ({fmtTHB(avgCostUSD * exchangeRate)})
          </div>
        </div>
      )}
      <div className="asset-detail-kpi">
        <div className="asset-detail-kpi-label">มูลค่าปัจจุบัน</div>
        <div className="asset-detail-kpi-val">{fmtUSD(valueUSD)}</div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
          ({fmtTHB(valueUSD * exchangeRate)})
        </div>
      </div>
      {!isCashAsset && (
        <div className={`asset-detail-kpi ${gainUp ? "gain-kpi" : "loss-kpi"}`}>
          <div className="asset-detail-kpi-label">กำไร/ขาดทุนรวม</div>
          <div
            className="asset-detail-kpi-val"
            style={{ color: gainUp ? "var(--gain)" : "var(--loss)", fontWeight: 900 }}
          >
            {totalGainUSD >= 0 ? "+" : ""}
            {fmtUSD(totalGainUSD)}
            <span style={{ fontSize: 11, marginLeft: 4 }}>({fmtPct(totalGainPct)})</span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: totalGainUSD >= 0 ? "var(--gain)" : "var(--loss)",
              opacity: 0.8,
              marginTop: 2
            }}
          >
            ({totalGainTHB >= 0 ? "+" : ""}
            {fmtTHB(totalGainTHB)})
          </div>
        </div>
      )}
    </div>
  );
}
