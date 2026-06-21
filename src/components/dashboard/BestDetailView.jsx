import React, { useMemo } from "react";
import { getDisplaySymbol, getAssetFullName } from "../../utils/assetHelpers";

export default function BestDetailView({ sortedAssets, bestAsset, totalGainUSD, fmt }) {
  const bestFullAsset = useMemo(() => {
    if (!bestAsset) return null;
    return sortedAssets.find(a => a.symbol === bestAsset.symbol);
  }, [bestAsset, sortedAssets]);

  const topAssets = useMemo(() => {
    return [...sortedAssets]
      .filter(a => a.qty > 0.00001 && (a.avgCost > 0 || a.avgPrice > 0))
      .sort((a, b) => b.gainPct - a.gainPct)
      .slice(0, 3);
  }, [sortedAssets]);

  const contributionRatio = useMemo(() => {
    if (!bestFullAsset || !totalGainUSD || totalGainUSD <= 0) return null;
    const championPnL = bestFullAsset.totalPnL || bestFullAsset.unrealizedPnL || 0;
    if (championPnL <= 0) return null;
    return (championPnL / totalGainUSD) * 100;
  }, [bestFullAsset, totalGainUSD]);

  if (!bestFullAsset) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 14.5 }}>
        ยังไม่มีข้อมูลสถิติผลตอบแทนที่ดีที่สุด
      </div>
    );
  }

  const isThai = bestFullAsset.symbol.endsWith(".BK");

  const podiumEmojis = ["🥇 เหรียญทอง", "🥈 เหรียญเงิน", "🥉 เหรียญทองแดง"];
  const podiumColors = ["#D97706", "#475569", "#B45309"];
  const podiumBgColors = ["rgba(245, 158, 11, 0.15)", "rgba(100, 116, 139, 0.15)", "rgba(180, 83, 9, 0.15)"];

  return (
    <div>
      {/* Champion Spotlight Card */}
      <div className="spotlight-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "inline-flex", padding: "5px 12px", background: "rgba(245, 158, 11, 0.15)", color: "#D97706", borderRadius: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          🌟 CHAMPION OF THE PORTFOLIO
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: "var(--text-main)", letterSpacing: -0.5 }}>
          {getDisplaySymbol(bestFullAsset.symbol)}
        </div>
        <div style={{ fontSize: 14.5, color: "var(--text-muted)", marginTop: 2, fontWeight: 500 }}>
          {getAssetFullName(bestFullAsset.symbol, bestFullAsset.name, bestFullAsset.category)}
        </div>
        
        {/* Big profit percent */}
        <div style={{ fontSize: 36, fontWeight: 900, color: "var(--gain)", marginTop: 12 }}>
          +{bestFullAsset.gainPct.toFixed(2)}%
        </div>

        {contributionRatio != null && (
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, fontWeight: 600 }}>
            🔥 คิดเป็น <span style={{ color: "var(--gain)", fontWeight: 700 }}>{contributionRatio.toFixed(1)}%</span> ของกำไรทั้งพอร์ตโฟลิโอ
          </div>
        )}

        {/* Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 18,
          background: "rgba(255, 255, 255, 0.05)",
          padding: 14,
          borderRadius: 10,
          border: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: 13.5
        }}>
          <div style={{ textAlign: "left" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>ต้นทุนเฉลี่ย:</span>
            <div style={{ fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
              {isThai ? fmt.thb(bestFullAsset.avgCost) : fmt.usd(bestFullAsset.avgCost)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>ราคาปัจจุบัน:</span>
            <div style={{ fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
              {isThai ? fmt.thb(bestFullAsset.price) : fmt.usd(bestFullAsset.price)}
            </div>
          </div>
          <div style={{ textAlign: "left", marginTop: 4 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>มูลค่าปัจจุบัน:</span>
            <div style={{ fontWeight: 800, color: "var(--text-main)", marginTop: 2 }}>
              {fmt.usd(bestFullAsset.valueUSD)}
            </div>
          </div>
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>กำไรที่ยังไม่รับรู้:</span>
            <div style={{ fontWeight: 800, color: "var(--gain)", marginTop: 2 }}>
              +{fmt.usd(bestFullAsset.unrealizedPnL)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", marginBottom: 12 }}>🏆 สินทรัพย์ที่ทำเปอร์เซ็นต์กำไรสูงสุด 3 อันดับแรก</div>
      
      <div style={{ border: "1px solid var(--border)", borderRadius: 12 }}>
        {topAssets.map((item, idx) => (
          <div key={item.id} className="kpi-detail-list-item" style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: podiumBgColors[idx] || "rgba(255, 255, 255, 0.08)",
                color: podiumColors[idx] || "var(--text-main)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800
              }}>
                {podiumEmojis[idx] || `${idx + 1}`}
              </span>
              <span style={{ fontWeight: 800, fontSize: 14.5 }}>{getDisplaySymbol(item.symbol)}</span>
            </div>
            
            <div style={{ fontWeight: 800, color: "var(--gain)", fontSize: 14.5 }}>
              +{item.gainPct.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
