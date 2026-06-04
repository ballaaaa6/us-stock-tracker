import React, { useMemo } from "react";
import { Eye, EyeOff, RefreshCw, Plus, Trash2 } from "lucide-react";
import AssetLogo from "../common/AssetLogo";
import SparklineChart from "../charts/SparklineChart";
import { fmtUSD, fmtTHB, fmtPct, fmtQty } from "../../utils/formatters";
import { getDisplaySymbol, getAssetFullName } from "../../utils/assetHelpers";

const CATEGORY_LABELS = { stock: "หุ้น", crypto: "คริปโต", gold: "ทองคำ/น้ำมัน", fiat: "เงินสด" };

const MarketBadge = ({ state }) => {
  if (!state || state === "REGULAR") return null;
  const map = {
    PRE: { label: "PRE", cls: "pre" },
    POST: { label: "POST", cls: "post" },
    CLOSED: { label: "CLOSED", cls: "post" }
  };
  const info = map[state] || { label: state, cls: "post" };
  return (
    <span className={`badge-market ${info.cls}`} style={{ fontSize: 9, fontWeight: 800 }}>
      {info.label}
    </span>
  );
};

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
  sparklines
}) {
  const fmt = useMemo(() => ({
    usd: (n) => fmtUSD(n, hideValues),
    thb: (n, decimals = 2) => fmtTHB(n, decimals, hideValues),
    pct: fmtPct,
    qty: (n) => fmtQty(n, hideValues),
  }), [hideValues]);

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
            onClick={() => fetchPrices(assets)}
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedAssets.map((asset, idx) => {
                  const pData = prices[asset.symbol];
                  const flash = priceFlash[asset.symbol];
                  const weightPct = totalUSD > 0 ? (asset.valueUSD / totalUSD) * 100 : 0;
                  const isBest = bestAsset?.symbol === asset.symbol;
                  const isCashAsset = asset.type === "fiat" || asset.category === "fiat";
                  const isSelected = selectedAsset?.id === asset.id;

                  return (
                    <tr key={asset.id || asset.symbol}
                      className={`asset-row-clickable ${isSelected ? "selected" : ""} ${flash ? `price-flash-${flash}` : ""}`}
                      onClick={(e) => {
                        if (e.target.closest("button") || e.target.closest("td:last-child")) return;
                        setSelectedAsset(asset);
                      }}
                      style={{ animationDelay: `${idx * 0.04}s` }}>

                      <td>
                        <div className="asset-name-col">
                          <AssetLogo symbol={asset.symbol} category={asset.category} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                              <span className="asset-symbol">{getDisplaySymbol(asset.symbol)}</span>
                              <span className={`badge-type ${asset.category || "stock"}`}>
                                {asset.category === "gold" ? (asset.symbol === "CL=F" ? "น้ำมัน" : "ทองคำ") : (CATEGORY_LABELS[asset.category] || asset.category || "stock")}
                              </span>
                              {asset.broker && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: "var(--primary)",
                                  background: "var(--primary-light)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  border: "1px solid rgba(82,54,255,0.15)",
                                  whiteSpace: "nowrap"
                                }}>
                                  {asset.broker}
                                </span>
                              )}
                              {!isCashAsset && isBest && (
                                <span className="best-badge">🏆 Best</span>
                              )}
                            </div>
                            <div className="asset-fullname">{getAssetFullName(asset.symbol, asset.name, asset.category)}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                              <MarketBadge state={pData?.marketState} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                                {weightPct.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        {!hasPrices ? (
                          <div className="skeleton skeleton-text" style={{ width: 70, height: 16, marginLeft: "auto" }} />
                        ) : isCashAsset ? (
                          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>—</span>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                            <div>
                              <div className="num-tick" style={{ fontWeight: 700, fontSize: 14 }}>
                                {fmt.usd(asset.regPriceUSD)}
                              </div>
                              <div className="price-thb">{fmt.thb(asset.regPriceUSD * exchangeRate)}</div>
                              {asset.extPrice != null && (
                                <div style={{ fontSize: 10, fontWeight: 700, color: asset.extChangePct >= 0 ? "var(--gain)" : "var(--loss)", marginTop: 2 }}>
                                  {asset.extType}: {fmt.usd(asset.extPriceUSD)} ({fmt.pct(asset.extChangePct)})
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        {!hasPrices ? (
                          <div className="skeleton skeleton-text" style={{ width: 80, height: 16, marginLeft: "auto" }} />
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>
                              {fmt.usd(isCashAsset ? asset.valueUSD : asset.regValueUSD)}
                            </div>
                            <div className="price-thb">
                              {isCashAsset ? (
                                `${fmt.qty(asset.qty)} ${asset.symbol}`
                              ) : (
                                fmt.thb(asset.regValueTHB)
                              )}
                            </div>
                            {!isCashAsset && asset.extPrice != null && (
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                                {asset.extType}: {fmt.usd(asset.extValueUSD)} ({fmt.thb(asset.extValueTHB)})
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        {!hasPrices || asset.costUSD === 0 || isCashAsset ? (
                          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>—</span>
                        ) : (
                          <div>
                            <div className={`pnl-cell ${asset.regGainUSD >= 0 ? "positive" : "negative"}`}>
                              <div>{asset.regGainUSD >= 0 ? "+" : ""}{fmt.usd(asset.regGainUSD)}</div>
                              <div style={{ fontSize: 12 }}>{fmt.pct(asset.regGainPct)}</div>
                            </div>
                            {asset.extPrice != null && (
                              <div className={`pnl-cell ${asset.extGainUSD >= 0 ? "positive" : "negative"}`} style={{ fontSize: 10, marginTop: 2 }}>
                                <div>{asset.extType}: {asset.extGainUSD >= 0 ? "+" : ""}{fmt.usd(asset.extGainUSD)} ({fmt.pct(asset.extGainPct)})</div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        {!hasPrices || isCashAsset ? (
                          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>—</span>
                        ) : (
                          <div>
                            <div className={`pnl-cell ${asset.regTodayPct >= 0 ? "positive" : "negative"}`}>
                              <div style={{ fontSize: 13 }}>{fmt.pct(asset.regTodayPct)}</div>
                            </div>
                            {asset.extPrice != null && (
                              <div className={`pnl-cell ${asset.extChangePct >= 0 ? "positive" : "negative"}`} style={{ fontSize: 10, marginTop: 2 }}>
                                <div>{asset.extType}: {fmt.pct(asset.extChangePct)}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn-delete" title={asset.category === "fiat" || asset.type === "fiat" ? "ฝากเงินสด / ถอนเงินสด" : "ซื้อ / ขายสินทรัพย์"} style={{ color: "var(--primary)" }}
                            onClick={() => { setEditingAsset(asset); setModalOpen(true); }}>
                            <Plus size={14} />
                          </button>
                          <button className="btn-delete" title="ลบออกจากพอร์ต" onClick={() => handleDeleteAsset(asset)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="mobile-assets-list">
            {sortedAssets.map((asset, idx) => {
              const pData = prices[asset.symbol];
              const flash = priceFlash[asset.symbol];
              const sp = (asset.symbol === "THB" || asset.symbol === "USD") ? [1.0, 1.0, 1.0] : sparklines[asset.symbol]?.closes;
              const isBest = bestAsset?.symbol === asset.symbol;
              const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

              return (
                <div key={asset.id || asset.symbol}
                  className={`mobile-asset-card${flash ? ` price-flash-${flash}` : ""}`}
                  onClick={(e) => {
                    if (e.target.closest("button")) return;
                    setSelectedAsset(asset);
                  }}
                  style={{ animationDelay: `${idx * 0.06}s`, cursor: "pointer" }}>

                  <div className="mobile-card-top">
                    <div className="mobile-card-left">
                      <AssetLogo symbol={asset.symbol} category={asset.category} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          <span className="asset-symbol">{getDisplaySymbol(asset.symbol)}</span>
                          <span className={`badge-type ${asset.category || "stock"}`}>
                            {asset.category === "gold" ? (asset.symbol === "CL=F" ? "น้ำมัน" : "ทองคำ") : (CATEGORY_LABELS[asset.category] || asset.category || "stock")}
                          </span>
                          {asset.broker && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: "var(--primary)",
                              background: "var(--primary-light)",
                              padding: "1px 6px",
                              borderRadius: 4,
                              border: "1px solid rgba(82,54,255,0.15)",
                              whiteSpace: "nowrap"
                            }}>
                              {asset.broker}
                            </span>
                          )}
                          {!isCashAsset && isBest && <span className="best-badge" style={{ padding: "1px 6px", borderRadius: 4 }}>🏆 Best</span>}
                        </div>
                        <div className="asset-fullname">{getAssetFullName(asset.symbol, asset.name, asset.category)}</div>
                        <MarketBadge state={pData?.marketState} />
                      </div>
                    </div>
                    <div className="mobile-card-right">
                      {hasPrices ? (
                        isCashAsset ? (
                          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>—</span>
                        ) : (
                          <>
                            <div className="mobile-card-price">{fmt.usd(asset.regPriceUSD)}</div>
                            <div className="price-thb">{fmt.thb(asset.regPriceUSD * exchangeRate)}</div>
                            {!isCashAsset && asset.extPrice != null && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: asset.extChangePct >= 0 ? "var(--gain)" : "var(--loss)", marginTop: 2 }}>
                                {asset.extType}: {fmt.usd(asset.extPriceUSD)} ({fmt.pct(asset.extChangePct)})
                              </div>
                            )}
                          </>
                        )
                      ) : (
                        <div className="skeleton skeleton-text" style={{ width: 80, height: 18 }} />
                      )}
                    </div>
                  </div>

                  <div className="mobile-card-stats">
                    <div className="mobile-stat">
                      <span className="mobile-stat-label">มูลค่า</span>
                      <span className="mobile-stat-value">
                        {hasPrices ? (
                          isCashAsset ? (
                            `${fmt.qty(asset.qty)} ${asset.symbol} (≈ ${fmt.usd(asset.valueUSD)})`
                          ) : (
                            fmt.usd(asset.valueUSD)
                          )
                        ) : "—"}
                      </span>
                    </div>
                    <div className="mobile-stat">
                      <span className="mobile-stat-label">กำไร/ขาดทุน</span>
                      <span className="mobile-stat-value" style={{ color: isCashAsset ? "var(--text-faint)" : (asset.gainUSD >= 0 ? "var(--gain)" : "var(--loss)") }}>
                        {isCashAsset ? "—" : (hasPrices && asset.costUSD > 0 ? fmt.pct(asset.gainPct) : "—")}
                      </span>
                    </div>
                    <div className="mobile-stat">
                      <span className="mobile-stat-label">วันนี้</span>
                      <span className="mobile-stat-value" style={{ color: isCashAsset ? "var(--text-faint)" : (asset.todayPct >= 0 ? "var(--gain)" : "var(--loss)") }}>
                        {isCashAsset ? "—" : (hasPrices ? fmt.pct(asset.todayPct) : "—")}
                      </span>
                    </div>
                  </div>

                  {sp && sp.length > 2 && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                      <SparklineChart closes={sp} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="btn btn-secondary ripple-btn"
                      style={{ height: 38, fontSize: 12, flex: 1 }}
                      onClick={() => { setEditingAsset(asset); setModalOpen(true); }}>
                      {isCashAsset ? "📥 ฝาก / 📤 ถอน" : "🛒 ซื้อ / ขาย"}
                    </button>
                    <button className="btn-icon ripple-btn" style={{ flex: "0 0 38px" }}
                      onClick={() => handleDeleteAsset(asset)} title="ลบ">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
export { MarketBadge };
