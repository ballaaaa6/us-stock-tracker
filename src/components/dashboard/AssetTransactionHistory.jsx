import React, { useState, useMemo } from "react";
import { History, ShoppingCart, ChevronUp, ChevronDown } from "lucide-react";
import { fmtDateShort, fmtPct } from "../../utils/formatters";

export default function AssetTransactionHistory({
  asset,
  lots,
  priceUSD,
  exchangeRate,
  isCashAsset,
  avgCostUSD,
  totalCostUSD,
  gainUp,
  totalGainUSD,
  totalGainTHB,
  totalGainPct,
  fmtUSD,
  fmtTHB,
  fmtQty
}) {
  const [historyExpanded, setHistoryExpanded] = useState(false);

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
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}>
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
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)" }}>
                  วันที่ทำรายการ
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>
                  {isCashAsset ? "จำนวนเงิน" : "จำนวน"}
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>
                  {isCashAsset ? "อัตราแลกเปลี่ยน" : "ราคาทำรายการ"}
                </th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "var(--text-muted)" }}>
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
  );
}
