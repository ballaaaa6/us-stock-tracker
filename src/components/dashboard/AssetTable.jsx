import React, { useMemo } from "react";
import { Eye, EyeOff, RefreshCw, Plus } from "lucide-react";
import AssetTableRow from "./AssetTableRow";
import AssetCardMobile from "./AssetCardMobile";
import MarketBadge from "./MarketBadge";
import { fmtUSD, fmtTHB, fmtPct, fmtQty } from "../../utils/formatters";

export default function AssetTable({
  sortedAssets,
  prices,
  priceFlash,
  bestAsset,
  totalUSD,
  exchangeRate,
  setSelectedAsset,
  selectedAsset,
  refreshing,
  fetchPrices,
  assets,
  setHideValues,
  hideValues,
  setEditingAsset,
  setModalOpen,
  sortConfig,
  handleSort,
  handleDeleteAsset,
  hasPrices,
  sparklines,
  hoveredSymbol,
  setHoveredSymbol,
  hoveredCategory,
  setHoveredCategory
}) {
  const fmt = useMemo(() => ({
    usd: (n, exact = false) => fmtUSD(n, false, exact),
    thb: (n, decimals = 2, exact = false) => fmtTHB(n, decimals, false, exact),
    pct: fmtPct,
    qty: (n) => fmtQty(n, false),
  }), []);

  const SortTh = ({ sortKey, children, align = "left" }) => {
    const isActive = sortConfig.key === sortKey;
    const isDesc = isActive && sortConfig.dir === "desc";
    return (
      <th style={{ textAlign: align }}>
        <span className="sort-header" onClick={() => handleSort(sortKey)}>
          {children}
          <span className={`sort-icon ${isActive ? "active" : ""} ${isDesc ? "desc" : "asc"}`}>
            {isActive ? (isDesc ? "▼" : "▲") : "⇅"}
          </span>
        </span>
      </th>
    );
  };

  return (
    <div className="card stagger-3">
      <div className="control-bar">
        <div className="section-title" style={{ flexWrap: "wrap", gap: 10 }}>
          📋 สินทรัพย์ของฉัน
          {sortedAssets.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", background: "#F1F5F9", padding: "2px 10px", borderRadius: 8 }}>
              {sortedAssets.length} รายการ
            </span>
          )}
          <div className="exchange-badge" style={{ fontSize: 12, height: "fit-content", padding: "4px 10px", margin: 0 }}>
            💱 1 USD = <strong>{exchangeRate.toFixed(2)}</strong> THB
          </div>
        </div>
        <div className="action-buttons">
          <button
            className="btn-icon ripple-btn"
            onClick={() => setHideValues(prev => !prev)}
            title={hideValues ? "แสดงข้อมูลเงิน" : "ซ่อนข้อมูลเงิน"}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className={`btn-icon ripple-btn${refreshing ? " spin" : ""}`}
            onClick={() => fetchPrices(assets, true)}
            title="รีเฟรชราคา"
          >
            <RefreshCw size={16} />
          </button>
          <button className="btn-action ripple-btn" onClick={() => { setEditingAsset(null); setModalOpen(true); }}>
            <Plus size={16} /> เพิ่มสินทรัพย์
          </button>
        </div>
      </div>

      {sortedAssets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">พอร์ตยังว่างอยู่</div>
          <div className="empty-subtitle">กด "เพิ่มสินทรัพย์" เพื่อเริ่มติดตามการลงทุน</div>
          <button className="btn btn-primary ripple-btn" style={{ width: "auto", marginTop: 8, paddingInline: 28, height: 48 }}
            onClick={() => { setEditingAsset(null); setModalOpen(true); }}>
            <Plus size={18} /> เพิ่มสินทรัพย์แรก
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="table-wrapper">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>
                    <span className="sort-header" onClick={() => handleSort("symbol")}>
                      สินทรัพย์
                      <span className={`sort-icon${sortConfig.key === "symbol" ? " active" : ""}`}>
                        {sortConfig.key === "symbol" ? (sortConfig.dir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </span>
                  </th>
                  <th style={{ textAlign: "right" }}>ราคา</th>
                  <SortTh sortKey="value" align="right">มูลค่า</SortTh>
                  <SortTh sortKey="gain" align="right">กำไร/ขาดทุน</SortTh>
                  <SortTh sortKey="today" align="right">วันนี้</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortedAssets.map((asset, idx) => (
                  <AssetTableRow
                    key={asset.id || asset.symbol}
                    asset={asset}
                    idx={idx}
                    prices={prices}
                    priceFlash={priceFlash}
                    totalUSD={totalUSD}
                    bestAsset={bestAsset}
                    exchangeRate={exchangeRate}
                    selectedAsset={selectedAsset}
                    setSelectedAsset={setSelectedAsset}
                    setEditingAsset={setEditingAsset}
                    setModalOpen={setModalOpen}
                    handleDeleteAsset={handleDeleteAsset}
                    hasPrices={hasPrices}
                    fmt={fmt}
                    hideValues={hideValues}
                    hoveredSymbol={hoveredSymbol}
                    setHoveredSymbol={setHoveredSymbol}
                    hoveredCategory={hoveredCategory}
                    setHoveredCategory={setHoveredCategory}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="mobile-assets-list">
            {sortedAssets.map((asset, idx) => (
              <AssetCardMobile
                key={asset.id || asset.symbol}
                asset={asset}
                idx={idx}
                prices={prices}
                priceFlash={priceFlash}
                bestAsset={bestAsset}
                exchangeRate={exchangeRate}
                setSelectedAsset={setSelectedAsset}
                setEditingAsset={setEditingAsset}
                setModalOpen={setModalOpen}
                handleDeleteAsset={handleDeleteAsset}
                hasPrices={hasPrices}
                sparklines={sparklines}
                fmt={fmt}
                hideValues={hideValues}
                hoveredSymbol={hoveredSymbol}
                setHoveredSymbol={setHoveredSymbol}
                hoveredCategory={hoveredCategory}
                setHoveredCategory={setHoveredCategory}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export { MarketBadge };
