import React from "react";
import { X } from "lucide-react";
import AssetLogo from "../common/AssetLogo";
import { getDisplaySymbol, getAssetFullName } from "../../utils/assetHelpers";

export default function AssetDetailHeader({
  asset,
  isCashAsset,
  priceUSD,
  valueUSD,
  exchangeRate,
  isUp,
  changePct,
  onClose,
  fmtQty,
  fmtUSD,
  fmtTHB,
  fmtPct
}) {
  return (
    <div className="asset-detail-header">
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <AssetLogo
          symbol={asset.symbol}
          category={asset.category}
          style={{ width: 48, height: 48, borderRadius: 16, fontSize: 16, flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)" }}>
              {getDisplaySymbol(asset.symbol)}
            </span>
            <span className={`badge-type ${asset.category || "stock"}`}>
              {asset.category === "gold" ? (asset.symbol === "CL=F" ? "น้ำมัน" : "ทองคำ") : asset.category || "stock"}
            </span>
            {asset.broker && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--primary)",
                  background: "var(--primary-light)",
                  padding: "2px 8px",
                  borderRadius: 6
                }}
              >
                {asset.broker}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {getAssetFullName(asset.symbol, asset.name, asset.category)}
          </div>
        </div>
      </div>

      {/* Price/Change info */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginRight: 8, flexShrink: 0 }}>
        {isCashAsset ? (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)", lineHeight: 1.1 }}>
              {fmtQty(asset.qty)} {asset.symbol}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
              ≈ {fmtUSD(valueUSD)} <span style={{ fontSize: 11 }}>({fmtTHB(valueUSD * exchangeRate)})</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)", lineHeight: 1.1 }}>
                {fmtUSD(priceUSD)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                {fmtTHB(priceUSD * exchangeRate)}
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                background: isUp ? "#DCFCE7" : "#FEE2E2",
                padding: "4px 8px",
                borderRadius: 8
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: isUp ? "var(--gain)" : "var(--loss)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2
                }}
              >
                {isUp ? "▲" : "▼"} {fmtPct(changePct)}
              </div>
            </div>
          </div>
        )}
      </div>

      <button className="btn-close ripple-btn" onClick={onClose} style={{ width: 36, height: 36, flexShrink: 0 }}>
        <X size={18} />
      </button>
    </div>
  );
}
