import React, { useState, useCallback, useMemo } from "react";
import { fmtUSD as rawFmtUSD, fmtTHB as rawFmtTHB, fmtPct, fmtQty as rawFmtQty } from "../utils/formatters";
import { getRealizedPnL } from "../utils/assetHelpers";
import { AssetChart } from "./charts/AssetChart";
import AssetTransactionHistory from "./dashboard/AssetTransactionHistory";
import AssetDetailHeader from "./dashboard/AssetDetailHeader";
import AssetDetailKPIGrid from "./dashboard/AssetDetailKPIGrid";
import { useAssetChartData } from "../hooks/useAssetChartData";

/* ══════════════════════════════════════════════════════
   ASSET DETAIL PANEL
══════════════════════════════════════════════════════ */
const TF_OPTIONS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ตั้งแต่ซื้อ"];

export default function AssetDetailPanel({ asset, price, exchangeRate, historicalRates, onClose, hideValues }) {
  const fmtUSD = useCallback((n) => rawFmtUSD(n, hideValues), [hideValues]);
  const fmtTHB = useCallback((n) => rawFmtTHB(n, 2, hideValues), [hideValues]);
  const fmtQty = useCallback((n) => rawFmtQty(n, hideValues), [hideValues]);

  const isThai = asset?.symbol?.endsWith(".BK");
  const isCashAsset = asset?.type === "fiat" || asset?.category === "fiat";

  const { tf, setTf, chartData, loading, error } = useAssetChartData(asset, isCashAsset);

  const getHistoricalRate = useCallback(
    (dateStr) => {
      if (!dateStr) return exchangeRate;
      const targetDate = dateStr.split("T")[0];
      if (historicalRates && historicalRates[targetDate]) {
        return historicalRates[targetDate];
      }
      const dates = Object.keys(historicalRates || {}).sort();
      if (dates.length === 0) return exchangeRate;
      let bestRate = exchangeRate;
      for (const d of dates) {
        if (d <= targetDate) {
          bestRate = historicalRates[d];
        } else {
          break;
        }
      }
      return bestRate;
    },
    [historicalRates, exchangeRate]
  );

  const getRealizedPnLInTHB = useCallback(
    (lots, isThai) => {
      if (!lots || !lots.length) return 0;
      const sortedLots = [...lots].sort((a, b) => new Date(a.date) - new Date(b.date));
      let realizedTHB = 0;
      let currentQty = 0;
      let currentAvgCostUSD = 0;
      for (const lot of sortedLots) {
        const lotQty = lot.qty;
        let lotPriceUSD = lot.price || 0;
        const txRate = getHistoricalRate(lot.date);
        if (isThai && txRate) {
          lotPriceUSD = lotPriceUSD / txRate;
        }
        if (lotQty > 0) {
          const newQty = currentQty + lotQty;
          const newCost = currentQty * currentAvgCostUSD + lotQty * lotPriceUSD;
          currentAvgCostUSD = newQty > 0 ? newCost / newQty : 0;
          currentQty = newQty;
        } else if (lotQty < 0) {
          const sellQty = Math.abs(lotQty);
          const gainUSD = (lotPriceUSD - currentAvgCostUSD) * sellQty;
          const gainTHB = gainUSD * txRate;
          realizedTHB += gainTHB;
          currentQty = Math.max(0, currentQty - sellQty);
        }
      }
      return realizedTHB;
    },
    [getHistoricalRate]
  );

  const getCurrencyPriceUSD = (symbol, priceVal, exchangeRate) => {
    if (symbol === "USD") return 1.0;
    if (priceVal != null && priceVal > 0) {
      if (["EUR", "GBP", "AUD", "NZD"].includes(symbol)) {
        return priceVal;
      }
      return 1.0 / priceVal;
    }
    if (symbol === "THB") return 1.0 / (exchangeRate || 35.0);
    return 1.0;
  };

  if (!asset) return null;

  const pData = price || {};

  let priceUSD = isThai ? (pData.price || 0) / exchangeRate : pData.price || 0;
  if (isCashAsset) {
    priceUSD = getCurrencyPriceUSD(asset.symbol, pData.price, exchangeRate);
  }

  // Calculate day change for cash
  let changeUSD = 0;
  let changePct = 0;
  if (isCashAsset) {
    if (asset.symbol !== "USD" && pData.price > 0 && pData.previousClose > 0) {
      let prevPriceUSD = 0;
      if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
        prevPriceUSD = pData.previousClose;
      } else {
        prevPriceUSD = 1.0 / pData.previousClose;
      }
      changeUSD = (priceUSD - prevPriceUSD) * asset.qty;
      changePct = prevPriceUSD > 0 ? ((priceUSD - prevPriceUSD) / prevPriceUSD) * 100 : 0;
    }
  } else {
    changeUSD = isThai ? (pData.change || 0) / exchangeRate : pData.change || 0;
    changePct = pData.changePercent || 0;
  }

  const valueUSD = priceUSD * asset.qty;

  // Robustly handle avgCost vs avgPrice for backward compatibility
  const avgCost = asset.avgCost ?? asset.avgPrice ?? 0;

  const costUSD = isCashAsset ? avgCost * asset.qty : (avgCost * asset.qty) / (isThai ? exchangeRate : 1);

  const gainUSD = valueUSD - costUSD;
  const gainPct = costUSD > 0 ? ((valueUSD - costUSD) / costUSD) * 100 : 0;
  const lots = asset.lots || [];

  const avgCostUSD = isCashAsset ? avgCost : isThai ? avgCost / exchangeRate : avgCost;
  const totalCostUSD = avgCostUSD * asset.qty;

  const realizedUSD = getRealizedPnL(lots, isThai, exchangeRate);
  const realizedTHB = getRealizedPnLInTHB(lots, isThai);
  const unrealizedUSD = asset.qty > 0 ? valueUSD - totalCostUSD : 0;
  const unrealizedTHB = unrealizedUSD * exchangeRate;

  const totalGainUSD = realizedUSD + unrealizedUSD;
  const totalGainTHB = realizedTHB + unrealizedTHB;

  let totalInvested = 0;
  lots.forEach((l) => {
    if (l.qty > 0) {
      const pUSD = isThai ? l.price / exchangeRate : l.price;
      totalInvested += l.qty * pUSD;
    }
  });
  if (totalInvested === 0 && asset.qty > 0) {
    totalInvested = totalCostUSD;
  }
  const totalGainPct = totalInvested > 0 ? (totalGainUSD / totalInvested) * 100 : 0;

  const isUp = changePct >= 0;
  const gainUp = totalGainUSD >= 0;

  return (
    <div
      className="asset-detail-panel"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="asset-detail-content">
        {/* ── Header ── */}
        <AssetDetailHeader
          asset={asset}
          isCashAsset={isCashAsset}
          priceUSD={priceUSD}
          valueUSD={valueUSD}
          exchangeRate={exchangeRate}
          isUp={isUp}
          changePct={changePct}
          onClose={onClose}
          fmtQty={fmtQty}
          fmtUSD={fmtUSD}
          fmtTHB={fmtTHB}
          fmtPct={fmtPct}
        />

        {/* ── KPI Mini Grid ── */}
        <AssetDetailKPIGrid
          asset={asset}
          isCashAsset={isCashAsset}
          avgCostUSD={avgCostUSD}
          exchangeRate={exchangeRate}
          valueUSD={valueUSD}
          gainUp={gainUp}
          totalGainUSD={totalGainUSD}
          totalGainPct={totalGainPct}
          totalGainTHB={totalGainTHB}
          fmtQty={fmtQty}
          fmtUSD={fmtUSD}
          fmtTHB={fmtTHB}
          fmtPct={fmtPct}
        />

        {/* ── TF Selector ── */}
        {!isCashAsset && (
          <div className="asset-detail-tf-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="chart-range-tabs">
                {TF_OPTIONS.map((t) => (
                  <button
                    key={t}
                    className={`chart-range-tab${tf === t ? " active" : ""} ripple-btn`}
                    onClick={() => setTf(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>
                {tf === "1D"
                  ? "รายนาที (5m)"
                  : tf === "5D"
                    ? "รายชั่วโมง"
                    : tf === "1W"
                      ? "ราย 30 นาที"
                      : tf === "5Y"
                        ? "รายสัปดาห์"
                        : tf === "ตั้งแต่ซื้อ"
                          ? "ตั้งแต่เริ่มลงทุน"
                          : "รายวัน"}
              </div>
            </div>
            {lots.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  background: "#EEECFF",
                  border: "1px solid #C3C7FA",
                  borderRadius: 8,
                  padding: "4px 8px",
                  fontSize: 11
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 14, height: 2, background: "#5236FF", borderTop: "2px dashed #5236FF" }} />
                  <span style={{ fontWeight: 700, color: "#5236FF" }}>ราคาทุนเฉลี่ย {fmtUSD(avgCostUSD)}</span>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 19 }}>
                  ({fmtTHB(avgCostUSD * exchangeRate)})
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Chart ── */}
        {!isCashAsset && (
          <div className="asset-detail-chart-container">
            {loading ? (
              <div
                style={{
                  height: 250,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  color: "var(--text-muted)"
                }}
              >
                <div className="spinner sm" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>กำลังโหลดกราฟ {tf}...</span>
              </div>
            ) : error ? (
              <div
                style={{
                  height: 250,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "var(--text-muted)"
                }}
              >
                <span style={{ fontSize: 28 }}>⚠️</span>
                <span style={{ fontSize: 13 }}>โหลดกราฟไม่สำเร็จ: {error}</span>
                <button
                  className="btn btn-secondary ripple-btn"
                  style={{ height: 36, fontSize: 12 }}
                  onClick={() =>
                    setTf((prev) => {
                      const t = prev;
                      setTimeout(() => setTf(t), 50);
                      return prev;
                    })
                  }
                >
                  ลองใหม่
                </button>
              </div>
            ) : chartData?.candles ? (
              <AssetChart
                candles={(() => {
                  if (tf === "ตั้งแต่ซื้อ") {
                    const sortedLots =
                      lots && lots.length > 0 ? [...lots].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
                    if (sortedLots.length > 0) {
                      const firstDate = sortedLots[0].date;
                      const filtered = chartData.candles.filter((c) => c.date.split("T")[0] >= firstDate);
                      if (filtered.length >= 2) {
                        return filtered;
                      } else if (filtered.length === 1) {
                        const single = filtered[0];
                        const prevDate = new Date(new Date(single.date) - 86400000).toISOString();
                        return [{ ...single, date: prevDate }, single];
                      } else {
                        if (chartData.candles.length > 0) {
                          const lastCandle = chartData.candles[chartData.candles.length - 1];
                          const prevDate = new Date(new Date(lastCandle.date) - 86400000).toISOString();
                          return [{ ...lastCandle, date: prevDate }, lastCandle];
                        }
                      }
                    }
                  }
                  return chartData.candles;
                })()}
                avgCost={avgCost}
                lots={lots}
                tf={tf}
                isThai={isThai}
                exchangeRate={exchangeRate}
                asset={asset}
                hideValues={hideValues}
                getHistoricalRate={getHistoricalRate}
              />
            ) : null}
          </div>
        )}

        {/* ── Purchase History Table ── */}
        <AssetTransactionHistory
          asset={asset}
          lots={lots}
          priceUSD={priceUSD}
          exchangeRate={exchangeRate}
          isCashAsset={isCashAsset}
          avgCostUSD={avgCostUSD}
          totalCostUSD={totalCostUSD}
          gainUp={gainUp}
          totalGainUSD={totalGainUSD}
          totalGainTHB={totalGainTHB}
          totalGainPct={totalGainPct}
          fmtUSD={fmtUSD}
          fmtTHB={fmtTHB}
          fmtQty={fmtQty}
        />
      </div>
    </div>
  );
}
