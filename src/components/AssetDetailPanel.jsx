import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ShoppingCart,
  Calendar,
  History,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { api } from "../services/api";
import {
  fmtUSD as rawFmtUSD,
  fmtTHB as rawFmtTHB,
  fmtPct,
  fmtQty as rawFmtQty,
  fmtDateShort
} from "../utils/formatters";
import { getDisplaySymbol, getAssetFullName, getCurrencyTicker, getRealizedPnL } from "../utils/assetHelpers";
import AssetLogo from "./common/AssetLogo";
import { AssetChart } from "./charts/AssetChart";

/* ══════════════════════════════════════════════════════
   ASSET DETAIL PANEL
══════════════════════════════════════════════════════ */
const TF_OPTIONS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ตั้งแต่ซื้อ"];

export default function AssetDetailPanel({ asset, price, exchangeRate, historicalRates, onClose, hideValues }) {
  const fmtUSD = useCallback((n) => rawFmtUSD(n, hideValues), [hideValues]);
  const fmtTHB = useCallback((n) => rawFmtTHB(n, 2, hideValues), [hideValues]);
  const fmtQty = useCallback((n) => rawFmtQty(n, hideValues), [hideValues]);

  const [tf, setTf] = useState("1D");
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);

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

  const isThai = asset?.symbol?.endsWith(".BK");
  const isCashAsset = asset?.type === "fiat" || asset?.category === "fiat";

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

  /* ── Fetch chart data ── */
  useEffect(() => {
    if (!asset?.symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChartData(null);

    // Only USD uses completely flat mock data! Other currencies fetch actual rates.
    const isUSDOnly = asset.symbol === "USD";
    if (isUSDOnly) {
      const priceVal = 1.0;
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const mockData = {
        symbol: asset.symbol,
        tf: tf,
        interval: "1d",
        currency: asset.symbol,
        regularMarketPrice: priceVal,
        candles: [
          {
            ts: Math.floor(thirtyDaysAgo.getTime() / 1000),
            date: thirtyDaysAgo.toISOString(),
            open: priceVal,
            high: priceVal,
            low: priceVal,
            close: priceVal,
            volume: 0
          },
          {
            ts: Math.floor(now.getTime() / 1000),
            date: now.toISOString(),
            open: priceVal,
            high: priceVal,
            low: priceVal,
            close: priceVal,
            volume: 0
          }
        ]
      };
      setChartData(mockData);
      setLoading(false);
      return;
    }

    const targetSymbol = isCashAsset ? getCurrencyTicker(asset.symbol) : asset.symbol;

    let fetchTf = tf;
    if (tf === "ตั้งแต่ซื้อ") {
      const sortedLots =
        asset?.lots && asset.lots.length > 0 ? [...asset.lots].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
      if (sortedLots.length > 0) {
        const firstPurchaseDate = new Date(sortedLots[0].date + "T00:00:00.000Z");
        const today = new Date();
        const diffDays = Math.ceil((today - firstPurchaseDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) fetchTf = "5D";
        else if (diffDays <= 30) fetchTf = "1M";
        else if (diffDays <= 180) fetchTf = "6M";
        else if (diffDays <= 365) fetchTf = "1Y";
        else if (diffDays <= 730) fetchTf = "2Y";
        else if (diffDays <= 1825) fetchTf = "5Y";
        else fetchTf = "MAX";
      } else {
        fetchTf = "MAX";
      }
    }

    api.prices
      .getHistory(targetSymbol, fetchTf)
      .then((data) => {
        if (cancelled) return;
        setChartData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset?.symbol, tf, isCashAsset, asset?.lots]);

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

  // Running average cost & P&L calculation chronologically
  const processedLots = useMemo(() => {
    if (!lots || !lots.length) return [];
    const sorted = [...lots].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningQty = 0;
    let runningAvgCost = 0;

    return sorted.map((lot, idx) => {
      const lotQty = lot.qty;
      const isThai = asset?.symbol?.toUpperCase().endsWith(".BK");
      const lotPriceUSD = isThai ? (lot.price || 0) / exchangeRate : lot.price || 0;

      let type = "BUY";
      let transactionValueUSD = lotQty * lotPriceUSD;
      let pnl = 0;
      let pnlPct = 0;

      if (lotQty > 0) {
        type = "BUY";
        const oldCost = runningQty * runningAvgCost;
        const newCost = oldCost + lotQty * lotPriceUSD;
        runningQty += lotQty;
        runningAvgCost = runningQty > 0 ? newCost / runningQty : 0;
        pnl = (priceUSD - lotPriceUSD) * lotQty;
        pnlPct = lotPriceUSD > 0 ? (pnl / (lotQty * lotPriceUSD)) * 100 : 0;
      } else if (lotQty < 0) {
        type = "SELL";
        const sellQty = Math.abs(lotQty);
        pnl = (lotPriceUSD - runningAvgCost) * sellQty;
        pnlPct = runningAvgCost > 0 ? (pnl / (sellQty * runningAvgCost)) * 100 : 0;
        runningQty = Math.max(0, runningQty - sellQty);
      }

      return {
        ...lot,
        type,
        lotQty,
        lotPriceUSD,
        transactionValueUSD,
        pnl,
        pnlPct,
        runningQty,
        runningAvgCost
      };
    });
  }, [lots, priceUSD, exchangeRate, asset?.symbol]);

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
                  {asset.category === "gold"
                    ? asset.symbol === "CL=F"
                      ? "น้ำมัน"
                      : "ทองคำ"
                    : asset.category || "stock"}
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

        {/* ── KPI Mini Grid ── */}
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
        {lots.length > 0 && (
          <div className="asset-detail-lots" style={{ paddingBottom: 24 }}>
            <div
              onClick={() => setHistoryExpanded(!historyExpanded)}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--text-main)",
                marginBottom: historyExpanded ? 12 : 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                padding: "10px 14px",
                background: "#F8FAFC",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                userSelect: "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isCashAsset ? <History size={14} /> : <ShoppingCart size={14} />}
                {isCashAsset ? "ประวัติการฝาก/ถอนเงินสด" : "ประวัติธุรกรรมซื้อ/ขาย"} ({lots.length} รายการ)
              </div>
              {historyExpanded ? (
                <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
              ) : (
                <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
              )}
            </div>

            {historyExpanded && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  overflowY: "auto",
                  maxHeight: "340px"
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr
                      style={{
                        background: "#F8FAFC",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        boxShadow: "0 1px 0 var(--border)"
                      }}
                    >
                      <th
                        style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}
                      >
                        ครั้ง
                      </th>
                      {!isCashAsset && (
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "var(--text-muted)"
                          }}
                        >
                          ประเภท
                        </th>
                      )}
                      <th
                        style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}
                      >
                        วันที่ทำรายการ
                      </th>
                      <th
                        style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}
                      >
                        {isCashAsset ? "จำนวนเงิน" : "จำนวน"}
                      </th>
                      <th
                        style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}
                      >
                        {isCashAsset ? "อัตราแลกเปลี่ยน" : "ราคาทำรายการ"}
                      </th>
                      <th
                        style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}
                      >
                        {isCashAsset ? "มูลค่ารวม (USD)" : "มูลค่าธุรกรรม (USD)"}
                      </th>
                      {!isCashAsset && (
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "var(--text-muted)"
                          }}
                        >
                          P&L (USD)
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...processedLots].reverse().map((lot, i) => {
                      const isBuy = lot.type === "BUY";
                      const rowRate = isBuy ? exchangeRate : lot.txRate || exchangeRate;
                      return (
                        <tr key={lot.id || i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "9px 12px" }}>
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                background: "#F59E0B",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: 900,
                                fontSize: 10
                              }}
                            >
                              {processedLots.length - i}
                            </div>
                          </td>
                          {!isCashAsset && (
                            <td style={{ padding: "9px 12px" }}>
                              {isBuy ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#16A34A",
                                    background: "#DCFCE7",
                                    padding: "2px 6px",
                                    borderRadius: 4
                                  }}
                                >
                                  ซื้อ (BUY)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#DC2626",
                                    background: "#FEE2E2",
                                    padding: "2px 6px",
                                    borderRadius: 4
                                  }}
                                >
                                  ขาย (SELL)
                                </span>
                              )}
                            </td>
                          )}
                          <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>
                            <div>
                              {fmtDateShort(lot.date)} {lot.time ? `· ${lot.time} น.` : ""}
                            </div>
                            {lot.broker && (
                              <div
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "var(--primary)",
                                  background: "var(--primary-light)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  display: "inline-block",
                                  marginTop: 3
                                }}
                              >
                                {lot.broker}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>
                            {isBuy ? "+" : "-"}
                            {fmtQty(Math.abs(lot.lotQty))} {isCashAsset ? asset.symbol : ""}
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>
                            <div>{fmtUSD(lot.lotPriceUSD)}</div>
                            <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                              ({fmtTHB(lot.lotPriceUSD * rowRate)})
                            </div>
                          </td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                            <div>{fmtUSD(Math.abs(lot.transactionValueUSD))}</div>
                            <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                              ({fmtTHB(Math.abs(lot.transactionValueUSD) * rowRate)})
                            </div>
                          </td>
                          {!isCashAsset && (
                            <td
                              style={{
                                padding: "9px 12px",
                                textAlign: "right",
                                fontWeight: 800,
                                color: lot.pnl >= 0 ? "var(--gain)" : "var(--loss)"
                              }}
                            >
                              <div>
                                {lot.pnl >= 0 ? "+" : ""}
                                {fmtUSD(lot.pnl)}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: lot.pnl >= 0 ? "var(--gain)" : "var(--loss)",
                                  opacity: 0.8,
                                  fontWeight: "normal"
                                }}
                              >
                                ({lot.pnl >= 0 ? "+" : ""}
                                {fmtTHB(lot.pnl * rowRate)})
                              </div>
                              <div style={{ fontSize: 10, opacity: 0.85 }}>
                                ({lot.pnl >= 0 ? "▲" : "▼"}
                                {fmtPct(lot.pnlPct)})
                                <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4, fontWeight: "normal" }}>
                                  {isBuy ? "ยังไม่รับรู้" : "รับรู้แล้ว"}
                                </span>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr
                      style={{
                        borderTop: "2px solid var(--border)",
                        background: "var(--primary-light)",
                        position: "sticky",
                        bottom: 0,
                        zIndex: 1,
                        boxShadow: "0 -2px 0 var(--border)"
                      }}
                    >
                      <td
                        colSpan={isCashAsset ? 2 : 3}
                        style={{ padding: "9px 12px", fontWeight: 800, color: "var(--primary)" }}
                      >
                        ถือครองปัจจุบัน
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                        {fmtQty(asset.qty)} {isCashAsset ? asset.symbol : ""}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
                        {isCashAsset ? (
                          "—"
                        ) : (
                          <>
                            <div>avg {fmtUSD(avgCostUSD)}</div>
                            <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
                              ({fmtTHB(avgCostUSD * exchangeRate)})
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                        <div>{fmtUSD(totalCostUSD)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                          ({fmtTHB(totalCostUSD * exchangeRate)})
                        </div>
                      </td>
                      {!isCashAsset && (
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            fontWeight: 900,
                            color: gainUp ? "var(--gain)" : "var(--loss)"
                          }}
                        >
                          <div>
                            {totalGainUSD >= 0 ? "+" : ""}
                            {fmtUSD(totalGainUSD)}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: totalGainUSD >= 0 ? "var(--gain)" : "var(--loss)",
                              opacity: 0.8,
                              fontWeight: "normal"
                            }}
                          >
                            ({totalGainTHB >= 0 ? "+" : ""}
                            {fmtTHB(totalGainTHB)})
                          </div>
                          <div style={{ fontSize: 10 }}>{fmtPct(totalGainPct)}</div>
                        </td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
