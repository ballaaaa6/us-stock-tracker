import React, { useState } from "react";
import { History, ShoppingCart, ChevronUp, ChevronDown, Settings } from "lucide-react";
import { fmtDateShort } from "../../utils/formatters";
import BrokerBadge from "../common/BrokerBadge";

export function AssetTransactionHistory({
  lots,
  processedLots,
  isCashAsset,
  asset,
  exchangeRate,
  hideValues,
  fmtUSD,
  fmtTHB,
  fmtQty,
  fmtPct,
  avgCostUSD,
  totalCostUSD,
  totalGainUSD,
  totalGainTHB,
  totalGainPct,
  gainUp,
  onEditLot
}) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [expandedLotId, setExpandedLotId] = useState(null);

  const toggleExpandLot = (lotId) => {
    setExpandedLotId(expandedLotId === lotId ? null : lotId);
  };

  if (!lots || lots.length === 0) return null;

  return (
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
        {historyExpanded ? <ChevronUp size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
      </div>

      {historyExpanded && (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflowY: "auto",
          maxHeight: "340px"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", position: "sticky", top: 0, zIndex: 1, boxShadow: "0 1px 0 var(--border)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}>ครั้ง</th>
                {!isCashAsset && <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}>ประเภท</th>}
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}>วันที่ทำรายการ</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>{isCashAsset ? "จำนวนเงิน" : "จำนวน"}</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>{isCashAsset ? "อัตราแลกเปลี่ยน" : "ราคาทำรายการ"}</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>{isCashAsset ? "มูลค่ารวม (USD)" : "มูลค่าธุรกรรม (USD)"}</th>
                {!isCashAsset && <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>P&L (USD)</th>}
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "var(--text-muted)", width: 50 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {[...processedLots].reverse().map((lot, i) => {
                const isBuy = lot.type === "BUY";
                const rowRate = isBuy ? exchangeRate : (lot.txRate || exchangeRate);
                const isExpanded = expandedLotId === (lot.id || i);
                return (
                  <React.Fragment key={lot.id || i}>
                    <tr
                      onClick={() => toggleExpandLot(lot.id || i)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer", background: isExpanded ? "var(--primary-light)" : "transparent" }}
                      className="transaction-row"
                    >
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%", background: "#F59E0B",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          color: "white", fontWeight: 900, fontSize: 10
                        }}>{processedLots.length - i}</div>
                      </td>
                    {!isCashAsset && (
                      <td style={{ padding: "9px 12px" }}>
                        {isBuy ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#16A34A", background: "#DCFCE7", padding: "2px 6px", borderRadius: 4 }}>ซื้อ (BUY)</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#DC2626", background: "#FEE2E2", padding: "2px 6px", borderRadius: 4 }}>ขาย (SELL)</span>
                        )}
                      </td>
                    )}
                    <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>
                      <div>{fmtDateShort(lot.date)} {lot.time ? `· ${lot.time} น.` : ""}</div>
                      {lot.broker && (
                        <div style={{ marginTop: 3 }}>
                          <BrokerBadge broker={lot.broker} />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>
                      <div className={hideValues ? "privacy-blurred" : ""}>
                        {isBuy ? "+" : "-"}{fmtQty(Math.abs(lot.lotQty))} {isCashAsset ? asset.symbol : ""}
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>
                      <div className={hideValues ? "privacy-blurred" : ""}>
                        <div>{fmtUSD(lot.lotPriceUSD)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                          ({fmtTHB(lot.lotPriceUSD * rowRate)})
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                      <div className={hideValues ? "privacy-blurred" : ""}>
                        <div>{fmtUSD(Math.abs(lot.transactionValueUSD))}</div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                          ({fmtTHB(Math.abs(lot.transactionValueUSD) * rowRate)})
                        </div>
                      </div>
                    </td>
                    {!isCashAsset && (
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: lot.pnl >= 0 ? "var(--gain)" : "var(--loss)" }}>
                        <div className={hideValues ? "privacy-blurred" : ""}>
                          <div>
                            {lot.pnl >= 0 ? "+" : ""}{fmtUSD(lot.pnl)}
                          </div>
                          <div style={{ fontSize: 10, color: lot.pnl >= 0 ? "var(--gain)" : "var(--loss)", opacity: 0.8, fontWeight: "normal" }}>
                            ({lot.pnl >= 0 ? "+" : ""}{fmtTHB(lot.pnl * rowRate)})
                          </div>
                          <div style={{ fontSize: 10, opacity: 0.85 }}>
                            ({lot.pnl >= 0 ? "▲" : "▼"}{fmtPct(lot.pnlPct)})
                            <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4, fontWeight: "normal" }}>
                              {isBuy ? "ยังไม่รับรู้" : "รับรู้แล้ว"}
                            </span>
                          </div>
                        </div>
                      </td>
                    )}
                    <td style={{ padding: "9px 12px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onEditLot && onEditLot(lot)}
                        style={{
                          background: "transparent",
                          color: "var(--text-muted)",
                          border: "none",
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "var(--transition)"
                        }}
                        className="ripple-btn transaction-settings-btn"
                        title="แก้ไข/ลบ"
                      >
                        <Settings size={16} />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: "#F8FAFC", borderTop: "none" }}>
                      <td colSpan={isCashAsset ? 6 : 8} style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 11, borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "center" }}>
                          {lot.orderId && (
                            <div>
                              <span style={{ fontWeight: 700, color: "var(--text-main)" }}>Order ID:</span> <code style={{ background: "white", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 10 }}>{lot.orderId}</code>
                            </div>
                          )}
                          {lot.gross_usd != null ? (
                            <>
                              <div>
                                <span style={{ fontWeight: 700, color: "var(--text-main)" }}>มูลค่าธุรกรรม (Gross):</span> {fmtUSD(lot.gross_usd)}
                              </div>
                              {lot.fee_usd != null && lot.fee_usd > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ค่าธรรมเนียม (USD):</span> {fmtUSD(lot.fee_usd)}
                                </div>
                              )}
                              {lot.fee_thb != null && lot.fee_thb > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ค่าธรรมเนียม (THB):</span> {fmtTHB(lot.fee_thb)}
                                </div>
                              )}
                              {lot.vat_thb != null && lot.vat_thb > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ภาษี (VAT THB):</span> {fmtTHB(lot.vat_thb)}
                                </div>
                              )}
                              {lot.discount_thb != null && lot.discount_thb > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ส่วนลด (THB):</span> {fmtTHB(lot.discount_thb)}
                                </div>
                              )}
                              {lot.total_usd != null && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ราคาสุทธิ (USD):</span> {fmtUSD(lot.total_usd)}
                                </div>
                              )}
                              {lot.total_thb != null && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ราคาสุทธิ (THB):</span> {fmtTHB(lot.total_thb)}
                                </div>
                              )}
                              {lot.total_thb_disc != null && Math.abs(lot.total_thb_disc - (lot.total_thb || 0)) > 0.01 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ราคาสุทธิหลังส่วนลด (THB):</span> {fmtTHB(lot.total_thb_disc)}
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {lot.fee != null && lot.fee > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ค่าธรรมเนียม (Fee):</span> {lot.ccy === "USD" ? fmtUSD(lot.fee) : fmtTHB(lot.fee)}
                                </div>
                              )}
                              {lot.vat != null && lot.vat > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ภาษี (VAT):</span> {fmtTHB(lot.vat)}
                                </div>
                              )}
                              {lot.discount != null && lot.discount > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ส่วนลด:</span> {fmtTHB(lot.discount)}
                                </div>
                              )}
                              {lot.netAmount != null && lot.netAmount > 0 && (
                                <div>
                                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>ราคาสุทธิ (Net):</span> {lot.ccy === "USD" ? fmtUSD(lot.netAmount) : fmtTHB(lot.netAmount)}
                                </div>
                              )}
                            </>
                          )}
                          {lot.isAutoExpired && (
                            <div style={{ color: "var(--loss)", fontWeight: 800 }}>
                              ⚠️ สัญญาหมดอายุสะสม (Expired Worthless)
                            </div>
                          )}
                          {lot.file && (
                            <div style={{ flexBasis: "100%", marginTop: 4 }}>
                              <span style={{ fontWeight: 700, color: "var(--text-main)" }}>เลขอ้างอิง:</span> <span style={{ color: "var(--text-muted)", fontStyle: "italic", background: "white", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 10 }}>{(() => {
                                const match = lot.file.match(/(DIMEOS\d+)/i);
                                return match ? match[1] : lot.file;
                              })()}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", background: "var(--primary-light)", position: "sticky", bottom: 0, zIndex: 1, boxShadow: "0 -2px 0 var(--border)" }}>
                <td colSpan={isCashAsset ? 2 : 3} style={{ padding: "9px 12px", fontWeight: 800, color: "var(--primary)" }}>ถือครองปัจจุบัน</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                  <div className={hideValues ? "privacy-blurred" : ""}>
                    {fmtQty(asset.qty)} {isCashAsset ? asset.symbol : ""}
                  </div>
                </td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
                  {isCashAsset ? "—" : (
                    <div className={hideValues ? "privacy-blurred" : ""}>
                      <div>avg {fmtUSD(avgCostUSD)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
                        ({fmtTHB(avgCostUSD * exchangeRate)})
                      </div>
                    </div>
                  )}
                </td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: "var(--primary)" }}>
                  <div className={hideValues ? "privacy-blurred" : ""}>
                    <div>{fmtUSD(totalCostUSD)}</div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: "normal" }}>
                      ({fmtTHB(totalCostUSD * exchangeRate)})
                    </div>
                  </div>
                </td>
                {!isCashAsset && (
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 900, color: gainUp ? "var(--gain)" : "var(--loss)" }}>
                    <div className={hideValues ? "privacy-blurred" : ""}>
                      <div>{totalGainUSD >= 0 ? "+" : ""}{fmtUSD(totalGainUSD)}</div>
                      <div style={{ fontSize: 10, color: totalGainUSD >= 0 ? "var(--gain)" : "var(--loss)", opacity: 0.8, fontWeight: "normal" }}>
                        ({totalGainTHB >= 0 ? "+" : ""}{fmtTHB(totalGainTHB)})
                      </div>
                      <div style={{ fontSize: 10 }}>{fmtPct(totalGainPct)}</div>
                    </div>
                  </td>
                )}
                <td style={{ padding: "9px 12px" }}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
