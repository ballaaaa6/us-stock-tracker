import React, { useState, useEffect, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { fmtUSD as rawFmtUSD, fmtTHB as rawFmtTHB, fmtPct, fmtQty as rawFmtQty } from "../utils/formatters";
import { getDisplaySymbol, getAssetFullName, getCurrencyTicker, getRealizedPnL, getCurrencyPriceUSD, getHistoricalExchangeRate, getRealizedPnLInTHB } from "../utils/assetHelpers";
import AssetLogo from "./common/AssetLogo";
import { AssetChart } from "./charts/AssetChart";
import { AssetTransactionHistory } from "./dashboard/AssetTransactionHistory";
import { registerModal } from "../utils/modalStack";

const TF_OPTIONS = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ตั้งแต่ซื้อ"];

export default function AssetDetailPanel({ asset, price, exchangeRate, historicalRates, onClose, hideValues, onEditLot }) {
  useEffect(() => {
    return registerModal(onClose);
  }, [onClose]);

  const fmtUSD = useCallback((n) => rawFmtUSD(n, false), []);
  const fmtTHB = useCallback((n) => rawFmtTHB(n, 2, false), []);
  const fmtQty = useCallback((n) => rawFmtQty(n, false), []);

  const [tf, setTf] = useState("1D");
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getHistoricalRate = useCallback((dateStr) => {
    return getHistoricalExchangeRate(dateStr, historicalRates, exchangeRate);
  }, [historicalRates, exchangeRate]);

  const isThai = asset?.symbol?.endsWith(".BK");
  const isCashAsset = asset?.type === "fiat" || asset?.category === "fiat";

  /* ── Fetch chart data ── */
  useEffect(() => {
    if (!asset?.symbol) return;
    let cancelled = false;
    setLoading(true); setError(null); setChartData(null);

    if (asset.symbol === "USD") {
      const now = new Date(), prev = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      setChartData({
        symbol: "USD", tf, interval: "1d", currency: "USD", regularMarketPrice: 1.0,
        candles: [
          { ts: Math.floor(prev.getTime() / 1000), date: prev.toISOString(), open: 1, high: 1, low: 1, close: 1, volume: 0 },
          { ts: Math.floor(now.getTime() / 1000), date: now.toISOString(), open: 1, high: 1, low: 1, close: 1, volume: 0 }
        ]
      });
      setLoading(false); return;
    }

    const targetSymbol = isCashAsset ? getCurrencyTicker(asset.symbol) : asset.symbol;
    let fetchTf = tf;
    if (tf === "ตั้งแต่ซื้อ") {
      const sortedLots = asset?.lots && asset.lots.length > 0 ? [...asset.lots].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
      if (sortedLots.length > 0) {
        const diffDays = Math.ceil((new Date() - new Date(sortedLots[0].date + "T00:00:00.000Z")) / 86400000);
        fetchTf = diffDays <= 7 ? "5D" : diffDays <= 30 ? "1M" : diffDays <= 180 ? "6M" : diffDays <= 365 ? "1Y" : diffDays <= 730 ? "2Y" : diffDays <= 1825 ? "5Y" : "MAX";
      } else {
        fetchTf = "MAX";
      }
    }

    fetch(`/api/prices?history=${encodeURIComponent(targetSymbol)}&tf=${fetchTf}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.error) { setError(data.error); setLoading(false); return; }
        setChartData(data); setLoading(false);
      })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });

    return () => { cancelled = true; };
  }, [asset?.symbol, tf, isCashAsset, asset?.lots]);

  if (!asset) return null;

  const pData = price || {};
  let priceUSD = isThai ? (pData.price || 0) / exchangeRate : (pData.price || 0);
  if (isCashAsset) priceUSD = getCurrencyPriceUSD(asset.symbol, pData.price, exchangeRate);

  let changeUSD = 0, changePct = 0;
  if (isCashAsset) {
    if (asset.symbol !== "USD" && pData.price > 0 && pData.prevClose > 0) {
      const prevPriceUSD = ["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol) ? pData.prevClose : 1.0 / pData.prevClose;
      changeUSD = (priceUSD - prevPriceUSD) * asset.qty;
      changePct = prevPriceUSD > 0 ? ((priceUSD - prevPriceUSD) / prevPriceUSD) * 100 : 0;
    }
  } else {
    changeUSD = isThai ? (pData.change || 0) / exchangeRate : (pData.change || 0);
    changePct = pData.changePercent || 0;
  }

  const valueUSD = priceUSD * asset.qty;
  const avgCost = asset.avgCost ?? asset.avgPrice ?? 0;
  const costUSD = isCashAsset ? avgCost * asset.qty : (avgCost * asset.qty / (isThai ? exchangeRate : 1));
  const gainUSD = valueUSD - costUSD;
  const gainPct = costUSD > 0 ? ((valueUSD - costUSD) / costUSD) * 100 : 0;
  const lots = asset.lots || [];

  const processedLots = useMemo(() => {
    if (!lots || !lots.length) return [];
    const sorted = [...lots].sort((a, b) => {
      const d = new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00"));
      if (d !== 0) return d;
      
      const isABuy = a.qty > 0;
      const isBBuy = b.qty > 0;
      if (isABuy !== isBBuy) return isABuy ? -1 : 1;

      const orderA = a.orderId || a.order_id || "";
      const orderB = b.orderId || b.order_id || "";
      return orderA.localeCompare(orderB);
    });

    const activeBuys = [];

    return sorted.map((lot, idx) => {
      const lotQty = lot.qty;
      const lotPriceUSD = isThai ? (lot.price || 0) / exchangeRate : (lot.price || 0);
      let type = "BUY", transactionValueUSD = lotQty * lotPriceUSD, pnl = 0, pnlPct = 0;

      if (lotQty > 0) {
        type = "BUY";
        activeBuys.push({ qty: lotQty, price: lotPriceUSD });
        const runningQty = activeBuys.reduce((sum, b) => sum + b.qty, 0);
        const runningAvgCost = runningQty > 0 ? activeBuys.reduce((sum, b) => sum + b.qty * b.price, 0) / runningQty : 0;
        pnl = (priceUSD - lotPriceUSD) * lotQty;
        pnlPct = lotPriceUSD > 0 ? (pnl / (lotQty * lotPriceUSD)) * 100 : 0;
        return { ...lot, type, lotQty, lotPriceUSD, transactionValueUSD, pnl, pnlPct, runningQty, runningAvgCost };
      } else {
        type = "SELL";
        let remSell = Math.abs(lotQty);
        let costOfSharesSold = 0;
        while (remSell > 0 && activeBuys.length > 0) {
          const oldest = activeBuys[0];
          if (oldest.qty <= remSell) {
            costOfSharesSold += oldest.qty * oldest.price;
            remSell -= oldest.qty;
            activeBuys.shift();
          } else {
            costOfSharesSold += remSell * oldest.price;
            oldest.qty -= remSell;
            remSell = 0;
          }
        }
        const sellValue = Math.abs(lotQty) * lotPriceUSD;
        pnl = sellValue - costOfSharesSold;
        pnlPct = costOfSharesSold > 0 ? (pnl / costOfSharesSold) * 100 : 0;
        const runningQty = activeBuys.reduce((sum, b) => sum + b.qty, 0);
        const runningAvgCost = runningQty > 0 ? activeBuys.reduce((sum, b) => sum + b.qty * b.price, 0) / runningQty : 0;
        return { ...lot, type, lotQty, lotPriceUSD, transactionValueUSD, pnl, pnlPct, runningQty, runningAvgCost };
      }
    });
  }, [lots, priceUSD, exchangeRate, isThai]);

  const avgCostUSD = isCashAsset ? avgCost : (isThai ? avgCost / exchangeRate : avgCost);
  const totalCostUSD = avgCostUSD * asset.qty;

  const realizedUSD = getRealizedPnL(lots, isThai, exchangeRate);
  const realizedTHB = getRealizedPnLInTHB(lots, isThai, historicalRates, exchangeRate);
  const unrealizedUSD = asset.qty > 0 ? (valueUSD - totalCostUSD) : 0;
  const unrealizedTHB = unrealizedUSD * exchangeRate;

  const totalGainUSD = realizedUSD + unrealizedUSD;
  const totalGainTHB = realizedTHB + unrealizedTHB;

  let totalInvested = 0;
  lots.forEach(l => { if (l.qty > 0) totalInvested += l.qty * (isThai ? l.price / exchangeRate : l.price); });
  if (totalInvested === 0 && asset.qty > 0) totalInvested = totalCostUSD;
  const totalGainPct = totalInvested > 0 ? (totalGainUSD / totalInvested) * 100 : 0;

  const isUp = changePct >= 0, gainUp = totalGainUSD >= 0;

  return (
    <div className="asset-detail-panel" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="asset-detail-content">
        {/* Header */}
        <div className="asset-detail-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
            <AssetLogo symbol={asset.symbol} category={asset.category} style={{ width: 48, height: 48, borderRadius: 16, fontSize: 16, flexShrink: 0 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)" }}>{getDisplaySymbol(asset.symbol)}</span>
                <span className={`badge-type ${asset.category || "stock"}`}>
                  {asset.category === "gold" ? (asset.symbol === "CL=F" ? "น้ำมัน" : "ทองคำ") : (asset.category || "stock")}
                </span>
                {asset.broker && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", background: "var(--primary-light)", padding: "2px 8px", borderRadius: 6 }}>{asset.broker}</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getAssetFullName(asset.symbol, asset.name, asset.category)}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginRight: 8, flexShrink: 0 }}>
            {isCashAsset ? (
              <div className={hideValues ? "privacy-blurred" : ""} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)", lineHeight: 1.1 }}>{fmtQty(asset.qty)} {asset.symbol}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>≈ {fmtUSD(valueUSD)} <span style={{ fontSize: 11 }}>({fmtTHB(valueUSD * exchangeRate)})</span></div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className={hideValues ? "privacy-blurred" : ""} style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-main)", lineHeight: 1.1 }}>{fmtUSD(priceUSD)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{fmtTHB(priceUSD * exchangeRate)}</div>
                </div>
                <div style={{ textAlign: "right", background: isUp ? "#DCFCE7" : "#FEE2E2", padding: "4px 8px", borderRadius: 8 }}>
                  <div className={hideValues ? "privacy-blurred" : ""} style={{ fontSize: 13, fontWeight: 800, color: isUp ? "var(--gain)" : "var(--loss)", display: "flex", alignItems: "center", gap: 2 }}>{isUp ? "▲" : "▼"} {fmtPct(changePct)}</div>
                </div>
              </div>
            )}
          </div>
          <button className="btn-close ripple-btn" onClick={onClose} style={{ width: 36, height: 36, flexShrink: 0 }}><X size={18} /></button>
        </div>

        {/* KPI Grid */}
        <div className="asset-detail-kpi-grid" style={{ gridTemplateColumns: isCashAsset ? "repeat(2, 1fr)" : "repeat(4, 1fr)" }}>
          <div className="asset-detail-kpi">
            <div className="asset-detail-kpi-label">จำนวนถือ</div>
            <div className={`asset-detail-kpi-val ${hideValues ? "privacy-blurred" : ""}`}>{fmtQty(asset.qty)}</div>
          </div>
          {!isCashAsset && (
            <div className="asset-detail-kpi">
              <div className="asset-detail-kpi-label">ราคาทุนเฉลี่ย</div>
              <div className={`asset-detail-kpi-val ${hideValues ? "privacy-blurred" : ""}`}>{fmtUSD(avgCostUSD, false, true)}</div>
              <div className={hideValues ? "privacy-blurred" : ""} style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>({fmtTHB(avgCostUSD * exchangeRate, 2, false, true)})</div>
            </div>
          )}
          <div className="asset-detail-kpi">
            <div className="asset-detail-kpi-label">มูลค่าปัจจุบัน</div>
            <div className={`asset-detail-kpi-val ${hideValues ? "privacy-blurred" : ""}`}>{fmtUSD(valueUSD)}</div>
            <div className={hideValues ? "privacy-blurred" : ""} style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>({fmtTHB(valueUSD * exchangeRate)})</div>
          </div>
          {!isCashAsset && (
            <div className={`asset-detail-kpi ${gainUp ? "gain-kpi" : "loss-kpi"}`}>
              <div className="asset-detail-kpi-label">กำไร/ขาดทุนรวม</div>
              <div className={`asset-detail-kpi-val ${hideValues ? "privacy-blurred" : ""}`} style={{ color: gainUp ? "var(--gain)" : "var(--loss)", fontWeight: 900 }}>
                {totalGainUSD >= 0 ? "+" : ""}{fmtUSD(totalGainUSD)}
                <span style={{ fontSize: 11, marginLeft: 4 }}>({fmtPct(totalGainPct)})</span>
              </div>
              <div className={hideValues ? "privacy-blurred" : ""} style={{ fontSize: 11, color: totalGainUSD >= 0 ? "var(--gain)" : "var(--loss)", opacity: 0.8, marginTop: 2 }}>({totalGainTHB >= 0 ? "+" : ""}{fmtTHB(totalGainTHB)})</div>
            </div>
          )}
        </div>

        {/* TF Selector */}
        {!isCashAsset && (
          <div className="asset-detail-tf-bar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="chart-range-tabs">
                {TF_OPTIONS.map(t => (
                  <button key={t} className={`chart-range-tab${tf === t ? " active" : ""} ripple-btn`} onClick={() => setTf(t)}>{t}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>
                {tf === "1D" ? "รายนาที (5m)" : tf === "5D" ? "รายชั่วโมง" : tf === "1W" ? "ราย 30 นาที" : tf === "5Y" ? "รายสัปดาห์" : tf === "ตั้งแต่ซื้อ" ? "ตั้งแต่เริ่มลงทุน" : "รายวัน"}
              </div>
            </div>
            {lots.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", background: "#EEECFF", border: "1px solid #C3C7FA", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 14, height: 2, background: "#5236FF", borderTop: "2px dashed #5236FF" }} />
                  <span className={hideValues ? "privacy-blurred" : ""} style={{ fontWeight: 700, color: "#5236FF" }}>ราคาทุนเฉลี่ย {fmtUSD(avgCostUSD, false, true)}</span>
                </div>
                <span className={hideValues ? "privacy-blurred" : ""} style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 19 }}>({fmtTHB(avgCostUSD * exchangeRate, 2, false, true)})</span>
              </div>
            )}
          </div>
        )}

        {/* Chart */}
        {!isCashAsset && (
          <div className="asset-detail-chart-container">
            {loading ? (
              <div style={{ height: 250, width: "100%", display: "flex", flexDirection: "column", gap: 12, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="skeleton-pulse" style={{ height: 16, width: 80, borderRadius: 4 }} />
                  <div className="skeleton-pulse" style={{ height: 16, width: 140, borderRadius: 4 }} />
                </div>
                <div className="skeleton-pulse" style={{ flex: 1, width: "100%", borderRadius: 12, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: "25%", left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(0,0,0,0.05)" }} />
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(0,0,0,0.05)" }} />
                  <div style={{ position: "absolute", top: "75%", left: 0, right: 0, height: 1, borderTop: "1px dashed rgba(0,0,0,0.05)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px" }}>
                  <div className="skeleton-pulse" style={{ height: 12, width: 40, borderRadius: 3 }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: 40, borderRadius: 3 }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: 40, borderRadius: 3 }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: 40, borderRadius: 3 }} />
                  <div className="skeleton-pulse" style={{ height: 12, width: 40, borderRadius: 3 }} />
                </div>
              </div>
            ) : error ? (
              <div style={{ height: 250, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <span style={{ fontSize: 13 }}>โหลดกราฟไม่สำเร็จ: {error}</span>
                <button className="btn btn-secondary ripple-btn" style={{ height: 36, fontSize: 12 }} onClick={() => setTf(prev => { const t = prev; setTimeout(() => setTf(t), 50); return prev; })}>ลองใหม่</button>
              </div>
            ) : chartData?.candles ? (
              <AssetChart
                candles={(() => {
                  if (tf === "ตั้งแต่ซื้อ") {
                    const sortedLots = lots && lots.length > 0 ? [...lots].sort((a,b) => new Date(a.date) - new Date(b.date)) : [];
                    if (sortedLots.length > 0) {
                      const firstDate = sortedLots[0].date;
                      const filtered = chartData.candles.filter(c => c.date.split("T")[0] >= firstDate);
                      if (filtered.length >= 2) return filtered;
                      if (filtered.length === 1) {
                        const single = filtered[0];
                        return [{ ...single, date: new Date(new Date(single.date) - 86400000).toISOString() }, single];
                      }
                      if (chartData.candles.length > 0) {
                        const lastCandle = chartData.candles[chartData.candles.length - 1];
                        return [{ ...lastCandle, date: new Date(new Date(lastCandle.date) - 86400000).toISOString() }, lastCandle];
                      }
                    }
                  }
                  return chartData.candles;
                })()}
                avgCost={avgCost} lots={lots} tf={tf} isThai={isThai} exchangeRate={exchangeRate} asset={asset} hideValues={hideValues} getHistoricalRate={getHistoricalRate}
              />
            ) : null}
          </div>
        )}

        {/* Transaction History */}
        <AssetTransactionHistory
          lots={lots} processedLots={processedLots} isCashAsset={isCashAsset} asset={asset} exchangeRate={exchangeRate} hideValues={hideValues}
          fmtUSD={fmtUSD} fmtTHB={fmtTHB} fmtQty={fmtQty} fmtPct={fmtPct} avgCostUSD={avgCostUSD} totalCostUSD={totalCostUSD}
          totalGainUSD={totalGainUSD} totalGainTHB={totalGainTHB} totalGainPct={totalGainPct} gainUp={gainUp}
          onEditLot={(lot) => onEditLot && onEditLot(asset, lot)}
        />
      </div>
    </div>
  );
}
