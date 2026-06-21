import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getRealizedPnL, getCurrencyTicker, getDisplaySymbol, getHistoricalExchangeRate, getRealizedPnLInTHB as rawGetRealizedPnLInTHB } from "../utils/assetHelpers";
import { calculatePortfolioHistoryTimeline } from "../utils/portfolioHistoryHelpers";
import { processTransactions, recalculatePortfolioFIFO } from "../utils/portfolioTransactionHelpers";
import { calculatePortfolioValuation } from "../utils/portfolioValuationHelpers";
import { usePortfolioPrices } from "./usePortfolioPrices";
import { autoExpirePortfolioOptions } from "../utils/dimePdfParser";


export function usePortfolioData({ user, showToast, onSessionExpired, askConfirm }) {
  const [assets, setAssets] = useState([]);
  const [dividendData, setDividendData] = useState({});
  const [dividendLoading, setDividendLoading] = useState(false);
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [chartCategory, setChartCategory] = useState("all");

  const [loading, setLoading] = useState(true);
  const [chartRange, setChartRange] = useState("1D");
  const [sortConfig, setSortConfig] = useState({ key: "value", dir: "desc" });
  const [isDirty, setIsDirty] = useState(false);

  const assetsRef = useRef([]);
  assetsRef.current = assets;

  // Use the extracted pricing hook
  const {
    prices,
    sparklines,
    exchangeRate,
    historicalRates,
    refreshing,
    sparklineLoading,
    autoRefresh,
    setAutoRefresh,
    priceFlash,
    fetchPrices,
    fetchSparklines
  } = usePortfolioPrices({ user, chartRange, showToast });

  const getHistoricalRate = useCallback((dateStr) => {
    return getHistoricalExchangeRate(dateStr, historicalRates, exchangeRate);
  }, [historicalRates, exchangeRate]);

  const getRealizedPnLInTHB = useCallback((lots, isThai) => {
    return rawGetRealizedPnLInTHB(lots, isThai, historicalRates, exchangeRate);
  }, [historicalRates, exchangeRate]);

  // Sync / Save Portfolio with Offline/Conflict resolution (dirty flag)
  const savePortfolio = async (updatedAssets) => {
    const recalculated = recalculatePortfolioFIFO(updatedAssets, exchangeRate, historicalRates);
    setAssets(recalculated);
    localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(recalculated));
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(recalculated),
      });
      if (res.status === 401 && onSessionExpired) {
        onSessionExpired();
        return;
      }
      if (!res.ok) throw new Error("HTTP " + res.status);
      localStorage.removeItem(`local_portfolio_${user.username}_dirty`);
      setIsDirty(false);
    } catch (err) {
      console.warn("Server sync failed, saved locally:", err.message);
      localStorage.setItem(`local_portfolio_${user.username}_dirty`, "true");
      setIsDirty(true);
      showToast("บันทึกข้อมูลในอุปกรณ์เครื่องนี้แล้ว (เซิร์ฟเวอร์ออฟไลน์)", "warning");
    }
  };

  const fetchPortfolio = async () => {
    try {
      const isDirtyLocal = localStorage.getItem(`local_portfolio_${user.username}_dirty`) === "true";
      setIsDirty(isDirtyLocal);
      const localData = JSON.parse(localStorage.getItem(`local_portfolio_${user.username}`) || "[]");

      if (isDirtyLocal) {
        // Attempt to sync local unsaved data to server first
        try {
          const syncRes = await fetch("/api/portfolio", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
            body: JSON.stringify(localData),
          });
          if (syncRes.ok) {
            localStorage.removeItem(`local_portfolio_${user.username}_dirty`);
            setIsDirty(false);
            console.log("Successfully synced local changes to server on start");
          }
        } catch (syncErr) {
          console.warn("Start-up sync failed, retaining local dirty data:", syncErr.message);
        }
      }

      if (isDirtyLocal && localStorage.getItem(`local_portfolio_${user.username}_dirty`) === "true") {
        // Still dirty (sync failed), use local data to avoid overwriting
        const recalculated = recalculatePortfolioFIFO(localData, exchangeRate, historicalRates);
        setAssets(recalculated);
        await fetchPrices(recalculated);
        if (recalculated.length > 0) fetchSparklines(recalculated, chartRange);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/portfolio", { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.status === 401 && onSessionExpired) {
        onSessionExpired();
        return;
      }
      if (res.ok) {
        let data = await res.json();
        const { updated, changed } = autoExpirePortfolioOptions(data);
        const finalData = changed ? updated : data;
        const recalculated = recalculatePortfolioFIFO(finalData, exchangeRate, historicalRates);
        if (changed) {
          await savePortfolio(recalculated);
        } else {
          setAssets(recalculated);
          localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(recalculated));
          localStorage.removeItem(`local_portfolio_${user.username}_dirty`);
          setIsDirty(false);
        }
        await fetchPrices(recalculated);
        if (recalculated.length > 0) fetchSparklines(recalculated, chartRange);
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch (err) {
      console.warn("Server load failed, using local:", err.message);
      const localData = JSON.parse(localStorage.getItem(`local_portfolio_${user.username}`) || "[]");
      const { updated, changed } = autoExpirePortfolioOptions(localData);
      const finalLocalData = changed ? updated : localData;
      const recalculated = recalculatePortfolioFIFO(finalLocalData, exchangeRate, historicalRates);
      if (changed) {
        localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(recalculated));
        localStorage.setItem(`local_portfolio_${user.username}_dirty`, "true");
        setIsDirty(true);
      }
      setAssets(recalculated);
      setIsDirty(localStorage.getItem(`local_portfolio_${user.username}_dirty`) === "true" || changed);
      await fetchPrices(recalculated);
      if (recalculated.length > 0) fetchSparklines(recalculated, chartRange);
      showToast("ใช้ข้อมูลพอร์ตที่บันทึกในเครื่องชั่วคราว", "info");
    } finally {
      setLoading(false);
    }
  };

  const fetchDividendEvents = useCallback(async (customAssets = assets) => {
    if (!customAssets.length) return;
    setDividendLoading(true);
    try {
      const symbols = customAssets
        .filter(a => a.category === "stock" || a.type === "stock" || !a.category)
        .map(a => a.symbol)
        .filter(Boolean);

      if (!symbols.length) {
        setDividendData({});
        return;
      }

      const url = `/api/prices?symbols=${encodeURIComponent(symbols.join(","))}&dividends=true`;
      const res = await fetch(url);
      if (res && res.ok) {
        const data = await res.json();
        const divMap = {};
        Object.keys(data.quotes || {}).forEach(sym => {
          if (data.quotes[sym]?.dividends) {
            divMap[sym] = data.quotes[sym].dividends;
          }
        });
        setDividendData(divMap);
      }
    } catch (err) {
      console.error("fetchDividendEvents failed:", err);
    } finally {
      setDividendLoading(false);
    }
  }, [assets]);

  // Compute portfolio history timeline
  useEffect(() => {
    const filteredAssets = chartCategory === "all"
      ? assets
      : assets.filter(a => (a.category || a.type || "stock") === chartCategory);

    const filteredSparklines = {};
    filteredAssets.forEach(a => {
      const ticker = (a.type === "fiat" || a.category === "fiat") ? (a.symbol === "USD" ? null : getCurrencyTicker(a.symbol)) : a.symbol;
      if (ticker && sparklines[ticker]) {
        filteredSparklines[ticker] = sparklines[ticker];
      }
    });

    const history = calculatePortfolioHistoryTimeline(filteredSparklines, filteredAssets, prices, exchangeRate, chartRange);
    setPortfolioHistory(history);
  }, [sparklines, assets, prices, exchangeRate, chartRange, chartCategory]);

  // Initial load
  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Price auto-refresh Polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => fetchPrices(assetsRef.current), 30000);
    return () => clearInterval(iv);
  }, [autoRefresh, fetchPrices]);

  const handleClearAsset = async (assetId) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const displaySym = asset.broker ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})` : getDisplaySymbol(asset.symbol);
    if (!await askConfirm(`คุณแน่ใจหรือไม่ที่จะล้างผลตอบแทนสะสมของ ${displaySym}?`, "ล้างผลตอบแทนสะสม")) return;

    const isThai = asset.symbol.toUpperCase().endsWith(".BK");
    const rawRealized = getRealizedPnL(asset.lots || [], isThai, exchangeRate);
    const rawRealizedTHB = getRealizedPnLInTHB(asset.lots || [], isThai);

    const updated = assets.map(a => a.id === assetId ? { ...a, clearedRealizedUSD: rawRealized, clearedRealizedTHB: rawRealizedTHB } : a);
    await savePortfolio(updated);
    await fetchPrices(updated);
    fetchSparklines(updated, chartRange);
    showToast(`ล้างผลตอบแทนสะสมของ ${displaySym} เรียบร้อย`, "success");
  };

  const handleDeleteAsset = async (param, fromModal = false) => {
    const assetId = typeof param === "string" ? param : param?.id;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const displaySym = asset.broker ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})` : getDisplaySymbol(asset.symbol);
    if (fromModal && asset.qty > 0) {
      await askConfirm(`ไม่สามารถลบ ${displaySym} เนื่องจากยังมีถือหุ้นอยู่\nกรุณาขายหุ้นทั้งหมดออกก่อนทำการลบสินทรัพย์`, "⚠️ ไม่สามารถลบสินทรัพย์ได้");
      return;
    }
    if (!await askConfirm(`คุณแน่ใจหรือไม่ที่จะลบ ${displaySym}?`, "⚠️ ยืนยันการลบสินทรัพย์")) return;
    const updated = assets.filter(a => a.id !== assetId);
    try {
      await savePortfolio(updated);
      await fetchPrices(updated);
      fetchSparklines(updated, chartRange);
      showToast(`ลบสินทรัพย์ ${displaySym} ออกเรียบร้อย`, "success");
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message, "error");
    }
  };

  const handleDeleteLot = async (assetId, lotId) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return false;
    const displaySym = asset.broker ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})` : getDisplaySymbol(asset.symbol);
    if (!await askConfirm(`คุณแน่ใจหรือไม่ที่จะลบรายการธุรกรรมนี้ของ ${displaySym}?`, "⚠️ ยืนยันการลบรายการธุรกรรม")) return false;

    const updatedLots = (asset.lots || []).filter(l => l.id !== lotId);
    let updated = [];
    if (updatedLots.length === 0) {
      updated = assets.filter(a => a.id !== assetId);
    } else {
      updated = assets.map(a => a.id === assetId ? { ...a, lots: updatedLots } : a);
    }

    await savePortfolio(updated);
    await fetchPrices(updated);
    fetchSparklines(updated, chartRange);
    showToast("ลบรายการธุรกรรมเรียบร้อยแล้ว", "success");
    return true;
  };

  const handleEditLot = async (assetId, lotId, updatedLotData) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return false;

    const lotIdx = (asset.lots || []).findIndex(l => l.id === lotId);
    if (lotIdx < 0) return false;

    const originalLot = asset.lots[lotIdx];
    const lotQty = updatedLotData.transactionType === "SELL" ? -Math.abs(updatedLotData.qty) : Math.abs(updatedLotData.qty);

    const newLot = {
      ...originalLot,
      date: updatedLotData.date,
      time: updatedLotData.time,
      qty: lotQty,
      price: updatedLotData.avgPrice,
      broker: updatedLotData.broker
    };

    const updatedLots = asset.lots.map((l, idx) => idx === lotIdx ? newLot : l);
    const updated = assets.map(a => a.id === assetId ? { ...a, lots: updatedLots, broker: updatedLotData.broker } : a);

    await savePortfolio(updated);
    await fetchPrices(updated);
    fetchSparklines(updated, chartRange);
    showToast("แก้ไขรายการธุรกรรมเรียบร้อยแล้ว", "success");
    return true;
  };

  const handleRangeChange = useCallback((r) => {
    setChartRange(r);
    if (assetsRef.current.length > 0) fetchSparklines(assetsRef.current, r);
  }, [fetchSparklines]);

  const handleSort = (key) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  };

  const handleSaveAsset = async (formData) => {
    const isBatch = Array.isArray(formData);
    const { updatedAssets, skippedTxs } = processTransactions({
      formData,
      assets,
      exchangeRate,
      historicalRates
    });

    if (!isBatch && skippedTxs.length > 0) {
      showToast(skippedTxs[0].reason, "error");
      return false;
    }

    if (skippedTxs.length > 0 && isBatch) {
      await askConfirm(`ทำรายการสำเร็จบางส่วน โดยมี ${skippedTxs.length} รายการที่ถูกข้าม:\n\n` + skippedTxs.map(s => `- ${s.tx.symbol}: ${s.reason}`).join("\n"), "⚠️ นำเข้าสำเร็จบางส่วน");
    }

    await savePortfolio(updatedAssets);
    await fetchPrices(updatedAssets);
    fetchSparklines(updatedAssets, chartRange);
    if (!isBatch) showToast("บันทึกธุรกรรมเรียบร้อยแล้ว", "success");
    return true;
  };

  const valuation = useMemo(() => {
    return calculatePortfolioValuation({
      assets,
      prices,
      exchangeRate,
      sortConfig,
      historicalRates
    });
  }, [assets, prices, exchangeRate, sortConfig, historicalRates]);

  return {
    assets,
    setAssets,
    prices,
    sparklines,
    portfolioHistory,
    chartCategory,
    setChartCategory,
    exchangeRate,
    historicalRates,
    loading,
    refreshing,
    sparklineLoading,
    autoRefresh,
    setAutoRefresh,
    chartRange,
    sortConfig,
    priceFlash,
    getHistoricalRate,
    getRealizedPnLInTHB,
    handleClearAsset,
    handleDeleteAsset,
    handleDeleteLot,
    handleEditLot,
    handleRangeChange,
    handleSort,
    handleSaveAsset,
    fetchPrices,
    fetchSparklines,
    fetchPortfolio,
    savePortfolio,
    isDirty,
    dividendData,
    dividendLoading,
    fetchDividendEvents,
    ...valuation
  };
}
