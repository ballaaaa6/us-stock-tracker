import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, LogOut, Download, Upload, PieChart, X, Eye, Sparkles } from "lucide-react";
import AssetModal from "./AssetModal";
import AssetDetailPanel from "./AssetDetailPanel";

import { fmtUSD, fmtTHB, fmtPct, fmtQty, fmtDate } from "../utils/formatters";

import { getDisplaySymbol, getCurrencyTicker, getCurrencyPriceUSD, getRealizedPnL } from "../utils/assetHelpers";

import DashboardHeader from "./dashboard/DashboardHeader";
import KPIRow from "./dashboard/KPIRow";
import PortfolioSummary from "./dashboard/PortfolioSummary";
import DonutChart from "./dashboard/DonutChart";
import AssetTable from "./dashboard/AssetTable";
import PnLDetailsModal from "./dashboard/PnLDetailsModal";
import PortfolioChart from "./charts/PortfolioChart";

import { useProfile } from "../hooks/useProfile";
import { usePrices } from "../hooks/usePrices";
import { usePortfolio } from "../hooks/usePortfolio";
import { usePortfolioHistory } from "../hooks/usePortfolioHistory";

const CATEGORY_LABELS = { stock: "หุ้น", crypto: "คริปโต", gold: "ทองคำ/น้ำมัน", fiat: "เงินสด" };

const PRESET_AVATARS = [
  {
    id: "bull",
    emoji: "📈",
    bg: "linear-gradient(135deg, #3B82F6 0%, #10B981 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bull-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%233B82F6"/><stop offset="100%" stop-color="%2310B981"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bull-g)"/><text x="50%" y="65%" font-size="50" text-anchor="middle" font-family="sans-serif">📈</text></svg>`
  },
  {
    id: "bear",
    emoji: "🐻",
    bg: "linear-gradient(135deg, #8B5CF6 0%, #EF4444 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bear-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238B5CF6"/><stop offset="100%" stop-color="%23EF4444"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bear-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🐻</text></svg>`
  },
  {
    id: "lion",
    emoji: "🦁",
    bg: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="lion-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23F59E0B"/><stop offset="100%" stop-color="%23EF4444"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23lion-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🦁</text></svg>`
  },
  {
    id: "koala",
    emoji: "🐨",
    bg: "linear-gradient(135deg, #0D9488 0%, #06B6D4 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="koala-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230D9488"/><stop offset="100%" stop-color="%2306B6D4"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23koala-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🐨</text></svg>`
  },
  {
    id: "unicorn",
    emoji: "🦄",
    bg: "linear-gradient(135deg, #6366F1 0%, #EC4899 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="uni-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366F1"/><stop offset="100%" stop-color="%23EC4899"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23uni-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🦄</text></svg>`
  },
  {
    id: "fox",
    emoji: "🦊",
    bg: "linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="fox-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238B5CF6"/><stop offset="100%" stop-color="%23D946EF"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23fox-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🦊</text></svg>`
  }
];

export default function Dashboard({ user, onLogout, showToast }) {
  const [hideValues, setHideValues] = useState(() => {
    return localStorage.getItem("hide_portfolio_values") === "true";
  });

  useEffect(() => {
    localStorage.setItem("hide_portfolio_values", hideValues ? "true" : "false");
  }, [hideValues]);

  const [sortConfig, setSortConfig] = useState({ key: "value", dir: "desc" });
  const [chartRange, setChartRange] = useState("1D");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showPnLDetailsModal, setShowPnLDetailsModal] = useState(false);
  const [donutDrillCategory, setDonutDrillCategory] = useState(null);

  const assetsRef = useRef([]);

  const fmt = useMemo(
    () => ({
      usd: (n) => fmtUSD(n, hideValues),
      thb: (n, decimals = 2) => fmtTHB(n, decimals, hideValues),
      pct: fmtPct,
      qty: (n) => fmtQty(n, hideValues),
      date: fmtDate
    }),
    [hideValues]
  );

  // Initialize custom hooks
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
    fetchSparklines,
    getRealizedPnLInTHB,
    getHistoricalRate
  } = usePrices({ user, showToast, assetsRef });

  const { assets, loading, savePortfolio, handleClearAsset, handleDeleteAsset, handleSaveAsset, handleClearPortfolio } =
    usePortfolio({
      user,
      showToast,
      fetchPrices,
      fetchSparklines,
      chartRange,
      exchangeRate,
      getRealizedPnLInTHB,
      hideValues
    });

  // Keep assetsRef in sync for usePrices's interval
  assetsRef.current = assets;

  const {
    portfolioName,
    isEditingName,
    setIsEditingName,
    tempName,
    setTempName,
    profileModalOpen,
    setProfileModalOpen,
    profilePic,
    setProfilePic,
    avatarPreviewOpen,
    setAvatarPreviewOpen,
    avatarHovered,
    setAvatarHovered,
    presetModalOpen,
    setPresetModalOpen,
    nickname,
    newNickname,
    setNewNickname,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    handleSaveName,
    handleAvatarUpload,
    handleSaveProfile,
    handleChangePassword,
    resetProfile
  } = useProfile({ user, showToast });

  const { portfolioHistory } = usePortfolioHistory({
    assets,
    prices,
    sparklines,
    exchangeRate,
    chartRange
  });

  const handleClearAllData = async () => {
    if (
      !window.confirm(
        "⚠️ คำเตือน: คุณต้องการล้างข้อมูลทุกอย่างทั้งหมด (ทั้งข้อมูลหุ้น, ชื่อเล่น, และรูปโปรไฟล์) กลับเป็นค่าเริ่มต้นใช่หรือไม่?"
      )
    )
      return;
    try {
      await savePortfolio([]);
      await resetProfile();
      showToast("🗑️ ล้างข้อมูลทั้งหมดในระบบเรียบร้อยแล้ว!", "success");
      setProfileModalOpen(false);
    } catch (err) {
      showToast("ล้างข้อมูลไม่สำเร็จ: " + err.message, "error");
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ assets, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 ส่งออกข้อมูลสำเร็จ", "success");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const imported = parsed.assets || parsed;
        if (!Array.isArray(imported)) {
          showToast("ไฟล์ไม่ถูกต้อง", "error");
          return;
        }
        await savePortfolio(imported);
        showToast(`✅ นำเข้า ${imported.length} รายการสำเร็จ`, "success");
        fetchPrices(imported);
        fetchSparklines(imported, chartRange);
      } catch {
        showToast("ไฟล์ไม่ถูกต้อง", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRangeChange = useCallback(
    (r) => {
      setChartRange(r);
      if (assetsRef.current.length > 0) fetchSparklines(assetsRef.current, r);
    },
    [fetchSparklines]
  );

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  /* ── COMPUTE PER-ASSET VALUATION ── */
  const computeAsset = useCallback(
    (asset) => {
      const isThai = asset.symbol.endsWith(".BK");
      const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

      if (isCashAsset) {
        const price = 1.0;
        const priceUSD = getCurrencyPriceUSD(asset.symbol, prices, exchangeRate);
        const valueUSD = priceUSD * asset.qty;
        const valueTHB = valueUSD * exchangeRate;

        const avgCost = asset.avgCost ?? asset.avgPrice ?? priceUSD;
        const costUSD = avgCost * asset.qty;
        const gainUSD = valueUSD - costUSD;
        const gainPct = costUSD > 0 ? (gainUSD / costUSD) * 100 : 0;

        let todayChg = 0;
        let todayPct = 0;
        if (asset.symbol !== "USD") {
          const ticker = getCurrencyTicker(asset.symbol);
          const pData = prices[ticker];
          if (pData) {
            const prevPriceVal = pData.previousClose || pData.price;
            if (prevPriceVal > 0) {
              let prevPriceUSD = 0;
              if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
                prevPriceUSD = prevPriceVal;
              } else {
                prevPriceUSD = 1.0 / prevPriceVal;
              }
              todayChg = (priceUSD - prevPriceUSD) * asset.qty;
              todayPct = prevPriceUSD > 0 ? ((priceUSD - prevPriceUSD) / prevPriceUSD) * 100 : 0;
            }
          }
        }

        return {
          price,
          priceUSD,
          valueUSD,
          valueTHB,
          costUSD,
          gainUSD,
          gainPct,
          todayChg,
          todayPct,
          extPrice: null,
          extChangePct: null,
          extType: null
        };
      }

      const pData = prices[asset.symbol];
      const regPrice = pData?.price ?? 0;

      const isPre = pData?.marketState === "PRE" || pData?.marketState === "PREPRE";
      const isPost = pData?.marketState === "POST" || pData?.marketState === "POSTPOST";

      let extPrice = null;
      let extChangePct = null;
      let extType = null;

      if (isPre && pData.prePrice != null && pData.prePrice > 0) {
        extPrice = pData.prePrice;
        extChangePct = regPrice > 0 ? ((pData.prePrice - regPrice) / regPrice) * 100 : 0;
        extType = "Pre";
      } else if (isPost && pData.postPrice != null && pData.postPrice > 0) {
        extPrice = pData.postPrice;
        extChangePct = regPrice > 0 ? ((pData.postPrice - regPrice) / regPrice) * 100 : 0;
        extType = "After";
      }

      const price = extPrice ?? regPrice;
      const priceUSD = isThai ? price / exchangeRate : price;
      const valueUSD = priceUSD * asset.qty;
      const valueTHB = valueUSD * exchangeRate;

      const avgCost = asset.avgCost ?? asset.avgPrice ?? 0;
      const costUSD = avgCost * asset.qty;
      const gainUSD = valueUSD - costUSD;
      const gainPct = costUSD > 0 ? (gainUSD / costUSD) * 100 : 0;

      const activePrice = price;
      const prevClose = pData?.previousClose ?? activePrice;
      const todayChg = (activePrice - prevClose) * asset.qty;
      const todayPct = prevClose > 0 ? ((activePrice - prevClose) / prevClose) * 100 : 0;

      const regPriceUSD = isThai ? regPrice / exchangeRate : regPrice;
      const regValueUSD = regPriceUSD * asset.qty;
      const regValueTHB = regValueUSD * exchangeRate;
      const regGainUSD = regValueUSD - costUSD;
      const regGainPct = costUSD > 0 ? (regGainUSD / costUSD) * 100 : 0;
      const regTodayChg = pData?.change ? (isThai ? pData.change / exchangeRate : pData.change) * asset.qty : 0;
      const regTodayPct = pData?.changePercent ?? 0;

      let extPriceUSD = null,
        extValueUSD = null,
        extValueTHB = null,
        extGainUSD = null,
        extGainPct = null,
        extTodayPct = null;

      if (extPrice != null) {
        extPriceUSD = isThai ? extPrice / exchangeRate : extPrice;
        extValueUSD = extPriceUSD * asset.qty;
        extValueTHB = extValueUSD * exchangeRate;
        extGainUSD = extValueUSD - costUSD;
        extGainPct = costUSD > 0 ? (extGainUSD / costUSD) * 100 : 0;
        extTodayPct = extChangePct ?? 0;
      }

      return {
        price,
        priceUSD,
        valueUSD,
        valueTHB,
        costUSD,
        gainUSD,
        gainPct,
        todayChg,
        todayPct,
        extPrice,
        extChangePct,
        extType,
        regPrice,
        regPriceUSD,
        regValueUSD,
        regValueTHB,
        regGainUSD,
        regGainPct,
        regTodayChg,
        regTodayPct,
        extPriceUSD,
        extValueUSD,
        extValueTHB,
        extGainUSD,
        extGainPct,
        extTodayPct
      };
    },
    [prices, exchangeRate]
  );

  /* ── COMPUTED PORTFOLIO TOTALS ── */
  const {
    totalUSD,
    totalCostUSD,
    todayChangeUSD,
    totalRealizedUSD,
    totalRealizedTHB,
    bestAsset,
    sortedAssets,
    donutSegments
  } = useMemo(() => {
    if (!assets.length)
      return {
        totalUSD: 0,
        totalCostUSD: 0,
        todayChangeUSD: 0,
        totalRealizedUSD: 0,
        totalRealizedTHB: 0,
        bestAsset: null,
        sortedAssets: [],
        donutSegments: []
      };

    let totVal = 0,
      totCost = 0,
      totToday = 0;
    let totRealized = 0;
    let totRealizedTHB = 0;
    let bestSym = null,
      bestPct = -Infinity;

    const computed = assets.map((a) => {
      const c = computeAsset(a);
      totVal += c.valueUSD;
      totCost += c.costUSD;
      totToday += c.todayChg;

      const isThai = a.symbol.toUpperCase().endsWith(".BK");
      const rawRealized = getRealizedPnL(a.lots || [], isThai, exchangeRate);
      const realized = rawRealized - (a.clearedRealizedUSD || 0);
      totRealized += realized;

      const rawRealizedTHB = getRealizedPnLInTHB(a.lots || [], isThai);
      const realizedTHB = rawRealizedTHB - (a.clearedRealizedTHB || 0);
      totRealizedTHB += realizedTHB;

      const assetWithPnL = {
        ...a,
        ...c,
        realizedPnL: realized,
        realizedPnLTHB: realizedTHB,
        unrealizedPnL: a.qty > 0 ? c.valueUSD - c.costUSD : 0,
        totalPnL: realized + (a.qty > 0 ? c.valueUSD - c.costUSD : 0)
      };

      if (c.gainPct > bestPct && a.qty > 0 && (a.avgCost > 0 || a.avgPrice > 0)) {
        bestPct = c.gainPct;
        bestSym = a;
      }
      return assetWithPnL;
    });

    const activeAssets = computed.filter((a) => a.qty > 0.00001);

    const sorted = [...activeAssets].sort((a, b) => {
      if (!sortConfig.key) return b.valueUSD - a.valueUSD;
      const dir = sortConfig.dir === "asc" ? 1 : -1;
      switch (sortConfig.key) {
        case "value":
          return dir * (a.valueUSD - b.valueUSD);
        case "gain":
          return dir * (a.gainPct - b.gainPct);
        case "today":
          return dir * (a.todayPct - b.todayPct);
        case "symbol":
          return dir * a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });

    const catMap = {};
    activeAssets.forEach((a) => {
      const cat = a.category || "stock";
      if (!catMap[cat]) catMap[cat] = 0;
      catMap[cat] += a.valueUSD;
    });
    const donut = Object.entries(catMap)
      .map(([cat, val]) => ({
        id: cat,
        label: CATEGORY_LABELS[cat] || cat,
        pct: totVal > 0 ? (val / totVal) * 100 : 0,
        value: val
      }))
      .filter((s) => s.pct > 0)
      .sort((a, b) => b.pct - a.pct);

    return {
      totalUSD: totVal,
      totalCostUSD: totCost,
      todayChangeUSD: totToday,
      totalRealizedUSD: totRealized,
      totalRealizedTHB: totRealizedTHB,
      bestAsset: bestSym ? { symbol: bestSym.symbol, pct: bestPct } : null,
      sortedAssets: sorted,
      donutSegments: donut
    };
  }, [assets, prices, exchangeRate, sortConfig, computeAsset, getRealizedPnLInTHB]);

  const initialCapitalUSD = useMemo(() => {
    let sumBuys = 0;
    let hasBuys = false;
    assets.forEach((a) => {
      const isCashAsset = a.type === "fiat" || a.category === "fiat";
      if (!isCashAsset) {
        const isThai = a.symbol.toUpperCase().endsWith(".BK");
        (a.lots || []).forEach((l) => {
          if (l.qty > 0) {
            const priceUSD = isThai ? l.price / exchangeRate : l.price;
            sumBuys += l.qty * priceUSD;
            hasBuys = true;
          }
        });
      }
    });
    if (hasBuys && sumBuys > 0) return sumBuys;
    return totalCostUSD;
  }, [assets, exchangeRate, totalCostUSD]);

  const totalUnrealizedUSD = totalUSD - totalCostUSD;
  const totalUnrealizedTHB = totalUnrealizedUSD * exchangeRate;
  const totalGainTHB = totalUnrealizedTHB + totalRealizedTHB;
  const totalGainUSD = totalUnrealizedUSD + totalRealizedUSD;
  const totalGainPct = initialCapitalUSD > 0 ? (totalGainUSD / initialCapitalUSD) * 100 : 0;
  const todayChangePct = totalCostUSD > 0 ? (todayChangeUSD / (totalUSD - todayChangeUSD)) * 100 : 0;

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <p style={{ fontWeight: 600, color: "var(--text-muted)" }}>กำลังโหลดพอร์ตโฟลิโอ...</p>
      </div>
    );
  }

  const hasPrices = Object.keys(prices).length > 0;

  return (
    <>
      <div className="fade-in">
        <DashboardHeader
          portfolioName={portfolioName}
          isEditingName={isEditingName}
          setIsEditingName={setIsEditingName}
          tempName={tempName}
          setTempName={setTempName}
          handleSaveName={handleSaveName}
          nickname={nickname}
          user={user}
          profilePic={profilePic}
          setProfileModalOpen={setProfileModalOpen}
        />

        <div className="app-container">
          <KPIRow
            totalUSD={hasPrices ? totalUSD : null}
            totalTHB={hasPrices ? totalUSD * exchangeRate : null}
            totalCostUSD={totalCostUSD}
            todayChange={hasPrices ? todayChangeUSD : 0}
            todayChangeTHB={hasPrices ? todayChangeUSD * exchangeRate : 0}
            todayChangePct={hasPrices ? todayChangePct : 0}
            totalGain={hasPrices ? totalGainUSD : 0}
            totalGainTHB={hasPrices ? totalGainTHB : 0}
            totalGainPct={hasPrices ? totalGainPct : 0}
            bestAsset={hasPrices ? bestAsset : null}
            loading={!hasPrices && assets.length > 0}
          />

          <div className="dashboard-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PortfolioSummary
                hasPrices={hasPrices}
                totalUSD={totalUSD}
                exchangeRate={exchangeRate}
                totalCostUSD={totalCostUSD}
                totalGainUSD={totalGainUSD}
                totalGainPct={totalGainPct}
                totalGainTHB={totalGainTHB}
                assets={assets}
                totalRealizedUSD={totalRealizedUSD}
                totalUnrealizedUSD={totalUnrealizedUSD}
                initialCapitalUSD={initialCapitalUSD}
                todayChangeUSD={todayChangeUSD}
                setShowPnLDetailsModal={setShowPnLDetailsModal}
                hideValues={hideValues}
              />

              <div className="card stagger-3">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    minHeight: 28
                  }}
                >
                  <div className="card-section-title">
                    <PieChart size={16} /> สัดส่วนสินทรัพย์
                  </div>
                  {donutDrillCategory && (
                    <button
                      onClick={() => setDonutDrillCategory(null)}
                      style={{
                        background: "var(--primary-light)",
                        color: "var(--primary)",
                        border: "none",
                        borderRadius: 10,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "var(--transition)",
                        boxShadow: "var(--shadow-xs)"
                      }}
                      className="ripple-btn"
                    >
                      ← ย้อนกลับ
                    </button>
                  )}
                </div>
                <DonutChart
                  segments={hasPrices && donutSegments.length > 0 ? donutSegments : []}
                  activeAssets={sortedAssets}
                  hasAssets={sortedAssets.length > 0}
                  drillCategory={donutDrillCategory}
                  setDrillCategory={setDonutDrillCategory}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card stagger-2" style={{ padding: "16px 14px 10px" }}>
                <PortfolioChart
                  history={portfolioHistory}
                  range={chartRange}
                  onRangeChange={handleRangeChange}
                  assets={assets}
                  exchangeRate={exchangeRate}
                  prices={prices}
                />
              </div>

              <AssetTable
                sortedAssets={sortedAssets}
                prices={prices}
                priceFlash={priceFlash}
                bestAsset={bestAsset}
                totalUSD={totalUSD}
                exchangeRate={exchangeRate}
                setSelectedAsset={setSelectedAsset}
                selectedAsset={selectedAsset}
                refreshing={refreshing}
                fetchPrices={fetchPrices}
                assets={assets}
                setHideValues={setHideValues}
                hideValues={hideValues}
                setEditingAsset={setEditingAsset}
                setModalOpen={setModalOpen}
                sortConfig={sortConfig}
                handleSort={handleSort}
                handleDeleteAsset={handleDeleteAsset}
                hasPrices={hasPrices}
                sparklines={sparklines}
              />
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <AssetModal
          isOpen={modalOpen}
          editingAsset={editingAsset}
          onClose={() => {
            setModalOpen(false);
            setEditingAsset(null);
          }}
          onSave={(formData) => handleSaveAsset(formData, setModalOpen, setEditingAsset)}
          exchangeRate={exchangeRate}
          showToast={showToast}
        />
      )}

      {showPnLDetailsModal && (
        <PnLDetailsModal
          isOpen={showPnLDetailsModal}
          onClose={() => setShowPnLDetailsModal(false)}
          assets={assets}
          prices={prices}
          exchangeRate={exchangeRate}
          historicalRates={historicalRates}
          totalUSD={totalUSD}
          totalCostUSD={totalCostUSD}
          totalRealizedUSD={totalRealizedUSD}
          totalUnrealizedUSD={totalUnrealizedUSD}
          totalGainUSD={totalGainUSD}
          totalGainPct={totalGainPct}
          initialCapitalUSD={initialCapitalUSD}
          onClearAsset={handleClearAsset}
          onDeleteAsset={handleDeleteAsset}
        />
      )}

      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          price={
            selectedAsset.type === "fiat" || selectedAsset.category === "fiat"
              ? prices[getCurrencyTicker(selectedAsset.symbol)]
              : prices[selectedAsset.symbol]
          }
          exchangeRate={exchangeRate}
          historicalRates={historicalRates}
          onClose={() => setSelectedAsset(null)}
          hideValues={hideValues}
        />
      )}

      {profileModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">⚙️ ตั้งค่าระบบ (Settings)</span>
              <button className="btn-close" onClick={() => setProfileModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* SECTION 1: PROFILE INFO */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    borderBottom: "1.5px solid var(--primary-light)",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  👤 ข้อมูลส่วนตัว (Profile Info)
                </span>

                {/* Avatar Upload */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setAvatarHovered(true)}
                    onMouseLeave={() => setAvatarHovered(false)}
                  >
                    <img
                      src={
                        profilePic ||
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 80 80'><rect width='80' height='80' fill='%23F1F5F9'/><text x='50%' y='55%' font-family='sans-serif' font-size='32' text-anchor='middle' fill='%2394A3B8'>👤</text></svg>"
                      }
                      alt="profile avatar"
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "3px solid var(--primary)",
                        boxShadow: "var(--shadow-md)",
                        display: "block"
                      }}
                    />

                    {/* Hover Tint Overlay with View Button */}
                    {profilePic && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: 90,
                          height: 90,
                          borderRadius: "50%",
                          background: "rgba(0, 0, 0, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: avatarHovered ? 1 : 0,
                          transition: "opacity 0.2s ease-in-out",
                          pointerEvents: avatarHovered ? "auto" : "none",
                          zIndex: 4
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setAvatarPreviewOpen(true)}
                          style={{
                            background: "rgba(255, 255, 255, 0.25)",
                            border: "none",
                            color: "white",
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "background 0.2s, transform 0.2s",
                            backdropFilter: "blur(4px)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)";
                            e.currentTarget.style.transform = "scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          title="ดูรูปภาพโปรไฟล์"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    )}

                    {/* Red Delete Button */}
                    {profilePic && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("คุณต้องการลบรูปโปรไฟล์นี้ใช่หรือไม่?")) {
                            setProfilePic("");
                          }
                        }}
                        style={{
                          position: "absolute",
                          top: "-4px",
                          right: "-4px",
                          background: "#EF4444",
                          color: "white",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                          border: "2px solid white",
                          zIndex: 10,
                          transition: "transform 0.2s, background 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.15)";
                          e.currentTarget.style.background = "#DC2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.background = "#EF4444";
                        }}
                        title="ลบรูปโปรไฟล์"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    )}

                    {/* Bottom-Left Sparkles Button (to open Presets Grid Modal) - only visible if avatar is empty */}
                    {!profilePic && (
                      <button
                        type="button"
                        onClick={() => setPresetModalOpen(true)}
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
                          color: "white",
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "var(--shadow-md)",
                          border: "2px solid white",
                          zIndex: 8,
                          padding: 0,
                          transition: "transform 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title="เลือกรูปภาพสำเร็จรูป (Presets)"
                      >
                        <Sparkles size={14} />
                      </button>
                    )}

                    {/* Bottom-Right Plus Button (to upload file) */}
                    <label
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        background: "var(--primary)",
                        color: "white",
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "var(--shadow-md)",
                        border: "2px solid white",
                        zIndex: 8
                      }}
                      title="เปลี่ยนรูปโปรไฟล์"
                    >
                      <Plus size={16} />
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                    </label>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textAlign: "center" }}>
                    รองรับไฟล์รูปภาพ JPG, PNG, WebP (ไม่เกิน 10MB)
                  </span>
                </div>

                {/* Nickname Input */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ชื่อเล่น / ชื่อเรียก</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="กรอกชื่อเล่นเพื่อแสดงแทนชื่อผู้ใช้"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary ripple-btn"
                  onClick={handleSaveProfile}
                  style={{ height: 44, fontSize: 13 }}
                >
                  บันทึกข้อมูลส่วนตัว
                </button>
              </div>

              {/* SECTION 2: CHANGE PASSWORD */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    borderBottom: "1.5px solid var(--loss-light)",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  🔑 เปลี่ยนรหัสผ่านใหม่ (Change Password)
                </span>

                {/* Password Inputs */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">รหัสผ่านเดิม</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="ตั้งรหัสผ่านใหม่"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <button
                  className="btn ripple-btn"
                  onClick={handleChangePassword}
                  style={{
                    height: 44,
                    fontSize: 13,
                    background: "var(--loss)",
                    color: "white",
                    boxShadow: "0 4px 12px var(--loss-glow)",
                    border: "none"
                  }}
                >
                  ยืนยันเปลี่ยนรหัสผ่าน
                </button>
              </div>

              {/* SECTION 3: BACKUP & RESTORE */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    borderBottom: "1.5px solid var(--primary-light)",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  💾 สำรองข้อมูล (Backup & Restore)
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary ripple-btn"
                    style={{ height: 44, fontSize: 13, flex: 1 }}
                    onClick={handleExport}
                  >
                    <Download size={15} /> ส่งออก JSON
                  </button>
                  <label
                    className="btn btn-secondary ripple-btn"
                    style={{
                      height: 44,
                      fontSize: 13,
                      flex: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    <Upload size={15} /> นำเข้า JSON
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
                  </label>
                </div>
              </div>

              {/* SECTION 5: DATA MANAGEMENT */}
              <div
                style={{
                  background: "#FFF5F5",
                  border: "1px solid #FEE2E2",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#EF4444",
                    borderBottom: "1.5px solid #FCA5A5",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  ⚠️ การจัดการข้อมูล (Data Management)
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    className="btn ripple-btn"
                    onClick={handleClearPortfolio}
                    style={{
                      height: 40,
                      fontSize: 12,
                      background: "white",
                      color: "#EF4444",
                      border: "1.5px solid #EF4444",
                      fontWeight: 700,
                      borderRadius: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    🗑️ ล้างเฉพาะข้อมูลพอร์ตหุ้น
                  </button>
                  <button
                    className="btn ripple-btn"
                    onClick={handleClearAllData}
                    style={{
                      height: 40,
                      fontSize: 12,
                      background: "#EF4444",
                      color: "white",
                      border: "none",
                      fontWeight: 700,
                      borderRadius: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)"
                    }}
                  >
                    🔥 ล้างข้อมูลทั้งหมดในระบบ (ลบทุกอย่าง)
                  </button>
                </div>
              </div>

              {/* SECTION 6: USER ACCOUNT & LOGOUT */}
              <div
                style={{
                  background: "#FFF5F5",
                  border: "1px solid #FEE2E2",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#EF4444",
                    borderBottom: "1.5px solid #FCA5A5",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  🚪 บัญชีผู้ใช้งาน (User Account)
                </span>
                <button
                  className="btn ripple-btn"
                  onClick={onLogout}
                  style={{
                    height: 44,
                    fontSize: 13,
                    background: "#EF4444",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
                    border: "none",
                    fontWeight: 700,
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <LogOut size={16} /> ออกจากระบบ (Logout)
                </button>
              </div>
            </div>

            {/* Close modal */}
            <div className="modal-footer" style={{ padding: "8px 24px 16px" }}>
              <button
                className="btn btn-secondary ripple-btn"
                onClick={() => setProfileModalOpen(false)}
                style={{ height: 44, fontSize: 13 }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {avatarPreviewOpen && profilePic && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeInOverlay 0.3s ease-out"
          }}
          onClick={() => setAvatarPreviewOpen(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "scaleInModal 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAvatarPreviewOpen(false)}
              style={{
                position: "absolute",
                top: -48,
                right: 0,
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                color: "white",
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s, transform 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "scale(1)";
              }}
              title="ปิดการแสดงรูปภาพ"
            >
              <X size={20} />
            </button>
            <img
              src={profilePic}
              alt="Avatar Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                borderRadius: "16px",
                objectFit: "contain",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                border: "4px solid rgba(255, 255, 255, 0.2)"
              }}
            />
          </div>
        </div>
      )}

      {presetModalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
            animation: "fadeInOverlay 0.3s ease-out"
          }}
          onClick={() => setPresetModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: 380,
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              animation: "scaleInModal 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: "none", padding: 0 }}>
              <span className="modal-title" style={{ fontSize: 16, fontWeight: 800 }}>
                🎨 เลือกรูปประจำตัว (Presets)
              </span>
              <button
                type="button"
                className="btn-close"
                onClick={() => setPresetModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                justifyItems: "center",
                padding: "8px 0"
              }}
            >
              {PRESET_AVATARS.map((preset) => {
                const isSelected = profilePic === preset.svg;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setProfilePic(preset.svg);
                      setPresetModalOpen(false);
                    }}
                    style={{
                      background: preset.bg,
                      border: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 32,
                      cursor: "pointer",
                      padding: 0,
                      boxShadow: isSelected ? "0 0 16px rgba(82, 54, 255, 0.5)" : "var(--shadow-md)",
                      transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                    title={`เลือกรูปประจำตัว ${preset.id}`}
                  >
                    {preset.emoji}
                  </button>
                );
              })}
            </div>

            <div className="modal-footer" style={{ borderTop: "none", padding: 0 }}>
              <button
                type="button"
                className="btn btn-secondary ripple-btn"
                onClick={() => setPresetModalOpen(false)}
                style={{ height: 40, fontSize: 13, borderRadius: "12px" }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
