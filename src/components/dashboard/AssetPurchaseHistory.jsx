import React from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";

const fmtDate = (s) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "—";

const fmtUSD = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: n < 1 ? 4 : 2
      }).format(n);

const fmtQty = (n) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 6 }).format(n);

export default function AssetPurchaseHistory({ editingAsset, lots, showHistory, setShowHistory }) {
  if (!editingAsset || !lots || lots.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <button
        type="button"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-muted)",
          fontFamily: "inherit",
          width: "100%"
        }}
        onClick={() => setShowHistory((p) => !p)}
      >
        <History size={14} />
        ประวัติการซื้อ ({lots.length} รายการ)
        {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showHistory && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
            marginTop: 6,
            animation: "fadeIn 0.2s ease-out"
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "var(--text-muted)"
                  }}
                >
                  วันที่
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--text-muted)"
                  }}
                >
                  จำนวน
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--text-muted)"
                  }}
                >
                  ราคาทุน
                </th>
                <th
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--text-muted)"
                  }}
                >
                  มูลค่า
                </th>
              </tr>
            </thead>
            <tbody>
              {[...lots].reverse().map((lot, i) => (
                <tr key={lot.id || i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>
                    <div>
                      {fmtDate(lot.date)} {lot.time ? `· ${lot.time} น.` : ""}
                    </div>
                    {lot.broker && (
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--primary)",
                          background: "var(--primary-light)",
                          padding: "1px 4px",
                          borderRadius: 4,
                          display: "inline-block",
                          marginTop: 2
                        }}
                      >
                        {lot.broker}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{fmtQty(lot.qty)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{fmtUSD(lot.price)}</td>
                  <td
                    style={{
                      padding: "9px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "var(--primary)"
                    }}
                  >
                    {fmtUSD(lot.qty * lot.price)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1.5px solid var(--border)", background: "var(--primary-light)" }}>
                <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700, color: "var(--primary)" }}>
                  รวม
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--primary)",
                    fontSize: 11
                  }}
                >
                  avg {fmtUSD(editingAsset.avgCost)}
                </td>
                <td
                  style={{
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "var(--primary)"
                  }}
                >
                  {fmtUSD(lots.reduce((s, l) => s + l.qty * l.price, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
