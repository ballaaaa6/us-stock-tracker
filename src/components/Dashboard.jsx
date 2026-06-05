import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart } from "lucide-react";
import AssetModal from "./AssetModal";
import AssetDetailPanel from "./AssetDetailPanel";

import { fmtUSD, fmtTHB, fmtPct, fmtQty, fmtDate } from "../utils/formatters";
import { getCurrencyTicker, getCurrencyPriceUSD, getRealizedPnL } from "../utils/assetHelpers";

import DashboardHeader from "./dashboard/DashboardHeader";
import KPIRow from "./dashboard/KPIRow";
import PortfolioSummary from "./dashboard/PortfolioSummary";
import DonutChart from "./dashboard/DonutChart";
import AssetTable from "./dashboard/AssetTable";
import PnLDetailsModal from "./dashboard/PnLDetailsModal";
import PortfolioChart from "./charts/PortfolioChart";
import SettingsModal from "./dashboard/SettingsModal";

import { useProfile } from "../hooks/useProfile";
import { usePrices } from "../hooks/usePrices";
import { usePortfolio } from "../hooks/usePortfolio";
import { usePortfolioHistory } from "../hooks/usePortfolioHistory";

const CATEGORY_LABELS = { stock: "หุ้น", crypto: "คริปโต", gold: "ทองคำ/น้ำมัน", fiat: "เงินสด" };

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
              if (["CNY", "HKD", "JPY", "KRW", "SGD", "THB", "TWD", "VND"].includes(asset.symbol) === false) {
                // If direct currency (not THB etc)
                if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
                  prevPriceUSD = prevPriceVal;
                } else {
                  prevPriceUSD = 1.0 / prevPriceVal;
                }
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
                  hideValues={hideValues}
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
        <SettingsModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          onLogout={onLogout}
          user={user}
          profilePic={profilePic}
          setProfilePic={setProfilePic}
          avatarPreviewOpen={avatarPreviewOpen}
          setAvatarPreviewOpen={setAvatarPreviewOpen}
          avatarHovered={avatarHovered}
          setAvatarHovered={setAvatarHovered}
          presetModalOpen={presetModalOpen}
          setPresetModalOpen={setPresetModalOpen}
          newNickname={newNickname}
          setNewNickname={setNewNickname}
          oldPassword={oldPassword}
          setOldPassword={setOldPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          handleAvatarUpload={handleAvatarUpload}
          handleSaveProfile={handleSaveProfile}
          handleChangePassword={handleChangePassword}
          handleExport={handleExport}
          handleImport={handleImport}
          handleClearPortfolio={handleClearPortfolio}
          handleClearAllData={handleClearAllData}
        />
      )}
    </>
  );
}
