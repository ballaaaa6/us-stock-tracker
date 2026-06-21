import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getDisplaySymbol, getAssetFullName } from "../../utils/assetHelpers";
import { computeAssetMetrics } from "../../utils/pnlHelpers";
import { fmtUSD, fmtTHB, fmtPct, fmtQty } from "../../utils/formatters";
import BrokerBadge from "../common/BrokerBadge";
import { registerModal } from "../../utils/modalStack";

const CATEGORY_LABELS = { stock: "หุ้น", crypto: "คริปโต", gold: "ทองคำ/น้ำมัน", fiat: "เงินสด" };

export default function PnLDetailsModal({
  isOpen,
  onClose,
  assets,
  prices,
  exchangeRate,
  historicalRates,
  totalUSD,
  totalCostUSD,
  totalRealizedUSD,
  totalUnrealizedUSD,
  totalGainUSD,
  totalGainPct,
  initialCapitalUSD,
  onClearAsset,
  onDeleteAsset
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("default");

  useEffect(() => {
    if (!isOpen) return;
    return registerModal(onClose);
  }, [isOpen, onClose]);

  const fmt = useMemo(() => ({
    usd: (n) => fmtUSD(n, false), // Always show value inside PnLDetailsModal
    thb: (n, decimals = 2) => fmtTHB(n, decimals, false),
    pct: fmtPct,
    qty: (n) => fmtQty(n, false)
  }), []);

  const breakdown = useMemo(() => {
    return assets.map(a => {
      const metrics = computeAssetMetrics(a, prices, exchangeRate, historicalRates);
      return {
        ...a,
        ...metrics
      };
    });
  }, [assets, prices, exchangeRate, historicalRates]);

  // Sum up THB values realistically
  const { totalRealizedTHB_Modal, totalUnrealizedTHB_Modal } = useMemo(() => {
    let relTHB = 0;
    let unrelTHB = 0;
    breakdown.forEach(b => {
      relTHB += b.realizedTHB || 0;
      unrelTHB += (b.unrealized || 0) * exchangeRate;
    });
    return {
      totalRealizedTHB_Modal: relTHB,
      totalUnrealizedTHB_Modal: unrelTHB
    };
  }, [breakdown, exchangeRate]);

  const totalGainTHB_Modal = totalRealizedTHB_Modal + totalUnrealizedTHB_Modal;

  const sortedAndFiltered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let result = breakdown;
    if (q) {
      result = breakdown.filter(b =>
        b.symbol.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === "default") {
        if (b.realized !== a.realized) {
          return b.realized - a.realized;
        }
        return b.totalPnL - a.totalPnL;
      }
      if (sortBy === "total_desc") {
        return b.totalPnL - a.totalPnL;
      }
      if (sortBy === "total_asc") {
        return a.totalPnL - b.totalPnL;
      }
      if (sortBy === "realized_desc") {
        return b.realized - a.realized;
      }
      if (sortBy === "realized_asc") {
        return a.realized - b.realized;
      }
      if (sortBy === "unrealized_desc") {
        return b.unrealized - a.unrealized;
      }
      if (sortBy === "unrealized_asc") {
        return a.unrealized - b.unrealized;
      }
      return 0;
    });
  }, [breakdown, searchTerm, sortBy]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 840, width: "95%" }}>
        <div className="modal-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
          <span className="modal-title" style={{ fontSize: 16, fontWeight: 800 }}>📊 รายละเอียดกำไร/ขาดทุนรายสินทรัพย์ (P&L Breakdown)</span>
          <button className="btn-close" onClick={onClose} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>

        {/* Overview Row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 12,
          marginTop: 14,
          marginBottom: 16,
          background: "#F8FAFC",
          padding: 16,
          borderRadius: 14,
          border: "1px solid var(--border)"
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>ทุนสะสมสะสมทั้งหมด</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>{fmt.usd(initialCapitalUSD)}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{fmt.thb(initialCapitalUSD * exchangeRate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>มูลค่าสินทรัพย์ปัจจุบัน</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-main)" }}>{fmt.usd(totalUSD)}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{fmt.thb(totalUSD * exchangeRate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>รับรู้แล้ว (Realized)</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: totalRealizedUSD >= 0 ? "var(--gain)" : "var(--loss)" }}>
              {totalRealizedUSD >= 0 ? "+" : ""}{fmt.usd(totalRealizedUSD)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {totalRealizedTHB_Modal >= 0 ? "+" : ""}{fmt.thb(totalRealizedTHB_Modal)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>ยังไม่รับรู้ (Unrealized)</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: totalUnrealizedUSD >= 0 ? "var(--gain)" : "var(--loss)" }}>
              {totalUnrealizedUSD >= 0 ? "+" : ""}{fmt.usd(totalUnrealizedUSD)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {totalUnrealizedTHB_Modal >= 0 ? "+" : ""}{fmt.thb(totalUnrealizedTHB_Modal)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>ผลตอบแทนสะสมสุทธิ</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: totalGainUSD >= 0 ? "var(--gain)" : "var(--loss)" }}>
              {totalGainUSD >= 0 ? "+" : ""}{fmt.usd(totalGainUSD)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
              <div>{totalGainTHB_Modal >= 0 ? "+" : ""}{fmt.thb(totalGainTHB_Modal)}</div>
              <div style={{ opacity: 0.8, fontSize: 10 }}>({totalGainUSD >= 0 ? "▲" : "▼"} {fmt.pct(totalGainPct)})</div>
            </div>
          </div>
        </div>

        {/* Search Bar & Sort Dropdown */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 ค้นหาตามสัญลักษณ์หรือชื่อ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ height: 38, borderRadius: 10, flex: 1, minWidth: 200, padding: "0 12px", border: "1px solid var(--border)", fontSize: 13 }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              height: 38,
              borderRadius: 10,
              padding: "0 12px",
              border: "1px solid var(--border)",
              background: "white",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-main)",
              cursor: "pointer",
              minWidth: 220
            }}
          >
            <option value="default">🏆 ผลตอบแทน (รับรู้แล้วก่อน)</option>
            <option value="total_desc">📈 ผลตอบแทนรวม (มาก ไป น้อย)</option>
            <option value="total_asc">📉 ผลตอบแทนรวม (น้อย ไป มาก)</option>
            <option value="realized_desc">💰 กำไรที่รับรู้แล้ว (มาก ไป น้อย)</option>
            <option value="realized_asc">📉 กำไรที่รับรู้แล้ว (น้อย ไป มาก)</option>
            <option value="unrealized_desc">💸 กำไรที่ยังไม่รับรู้ (มาก ไป น้อย)</option>
            <option value="unrealized_asc">📉 กำไรที่ยังไม่รับรู้ (น้อย ไป มาก)</option>
          </select>
        </div>

        {/* Breakdown Table */}
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12, maxHeight: 320, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F1F5F9", position: "sticky", top: 0, zIndex: 1 }}>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", width: "16%" }}>สินทรัพย์</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", width: "12%", minWidth: "90px" }}>สถานะ</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "right", width: "10%" }}>จำนวนถือ</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "right", width: "14%" }}>ทุนสะสมสะสม (USD)</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "right", width: "14%" }}>รับรู้แล้ว (Realized)</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "right", width: "14%" }}>ยังไม่รับรู้ (Unrealized)</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "right", width: "14%" }}>ผลตอบแทนรวม (USD)</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-muted)", textAlign: "center", width: "6%" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFiltered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                    ไม่พบรายการสินทรัพย์
                  </td>
                </tr>
              ) : (
                sortedAndFiltered.map((item, idx) => {
                  const isSoldOut = item.qty <= 0.00001;
                  const isCash = item.type === "fiat" || item.category === "fiat";
                  const totalPnLTHB = (item.realizedTHB || 0) + (item.unrealized || 0) * exchangeRate;
                  return (
                    <tr key={item.id || item.symbol} style={{ borderTop: "1px solid var(--border)", background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{getDisplaySymbol(item.symbol)}</span>
                          <span className={`badge-type ${item.category || "stock"}`} style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4 }}>
                            {item.category === "gold" ? (item.symbol === "CL=F" ? "น้ำมัน" : "ทองคำ") : (CATEGORY_LABELS[item.category] || item.category || "stock")}
                          </span>
                          <BrokerBadge broker={item.broker} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginTop: 2 }}>{getAssetFullName(item.symbol, item.name, item.category)}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {isSoldOut ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#64748B", background: "#E2E8F0", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>ขายหมดแล้ว</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", background: "#DCFCE7", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>กำลังถือ</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                        {isCash ? "—" : fmt.qty(item.qty)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>
                        <div>{fmt.usd(item.totalInvested)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                          ({fmt.thb(item.totalInvested * exchangeRate)})
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: item.realized >= 0 ? "var(--gain)" : "var(--loss)" }}>
                        <div>{item.realized !== 0 ? (item.realized >= 0 ? "+" : "") + fmt.usd(item.realized) : "—"}</div>
                        {item.realized !== 0 && (
                          <div style={{ fontSize: 10, color: item.realizedTHB >= 0 ? "var(--gain)" : "var(--loss)", fontWeight: "normal" }}>
                            ({item.realizedTHB >= 0 ? "+" : ""}{fmt.thb(item.realizedTHB)})
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: item.unrealized >= 0 ? "var(--gain)" : "var(--loss)" }}>
                        <div>{item.unrealized !== 0 && !isSoldOut ? (item.unrealized >= 0 ? "+" : "") + fmt.usd(item.unrealized) : "—"}</div>
                        {item.unrealized !== 0 && !isSoldOut && (
                          <div style={{ fontSize: 10, color: item.unrealized >= 0 ? "var(--gain)" : "var(--loss)", fontWeight: "normal" }}>
                            ({item.unrealized >= 0 ? "+" : ""}{fmt.thb(item.unrealized * exchangeRate)})
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: item.totalPnL >= 0 ? "var(--gain)" : "var(--loss)" }}>
                        <div>{item.totalPnL >= 0 ? "+" : ""} {fmt.usd(item.totalPnL)}</div>
                        <div style={{ fontSize: 10, color: totalPnLTHB >= 0 ? "var(--gain)" : "var(--loss)", fontWeight: "bold" }}>
                          ({totalPnLTHB >= 0 ? "+" : ""}{fmt.thb(totalPnLTHB)})
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>({item.totalPnL >= 0 ? "▲" : "▼"}{fmt.pct(item.totalPnLPct)})</div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            onClick={() => onClearAsset(item.id)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#D97706",
                              background: "#FEF3C7",
                              border: "1.5px solid #F59E0B",
                              borderRadius: 6,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                            title="ล้างกำไรสะสมในอดีต (คงจำนวนหุ้นปัจจุบัน)"
                          >
                            ล้าง
                          </button>
                          <button
                            onClick={() => onDeleteAsset(item.id, true)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#DC2626",
                              background: "#FEE2E2",
                              border: "1.5px solid #EF4444",
                              borderRadius: 6,
                              cursor: isSoldOut ? "pointer" : "not-allowed",
                              opacity: isSoldOut ? 1 : 0.4,
                              transition: "all 0.2s ease"
                            }}
                            title={isSoldOut ? "ลบสินทรัพย์ออกจากพอร์ต" : "ไม่สามารถลบได้เนื่องจากยังมีหุ้นเหลืออยู่"}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}
