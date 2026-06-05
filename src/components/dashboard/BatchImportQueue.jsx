import React from "react";
import { Trash2 } from "lucide-react";

export default function BatchImportQueue({ scannedQueue, setScannedQueue, onTriggerMoreFiles }) {
  const handleRemove = (id) => {
    setScannedQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const handleUpdateField = (idx, field, value) => {
    const updated = [...scannedQueue];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "symbol") {
      updated[idx].name = value.toUpperCase();
    }
    setScannedQueue(updated);
  };

  return (
    <>
      <div
        style={{
          background: "#F8FAFC",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxHeight: "380px",
          overflowY: "auto"
        }}
      >
        {scannedQueue.map((item, idx) => (
          <div
            key={item.id}
            style={{
              background: "#FFFFFF",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "12px",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 10
            }}
          >
            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                border: "none",
                background: "transparent",
                color: "var(--loss)",
                cursor: "pointer"
              }}
            >
              <Trash2 size={16} />
            </button>

            {/* Header Row: Symbol & Category & TxType */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingRight: 24 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  Ticker/สัญลักษณ์
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ height: 32, padding: "0 8px", fontSize: 12, textTransform: "uppercase" }}
                  value={item.symbol}
                  onChange={(e) => handleUpdateField(idx, "symbol", e.target.value.toUpperCase())}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  ประเภทสินทรัพย์
                </label>
                <select
                  className="form-input"
                  style={{ height: 32, padding: "0 4px", fontSize: 12, background: "transparent" }}
                  value={item.type}
                  onChange={(e) => handleUpdateField(idx, "type", e.target.value)}
                >
                  <option value="stock">หุ้น (Stock)</option>
                  <option value="crypto">คริปโต (Crypto)</option>
                  <option value="gold">ทองคำ (Gold)</option>
                  <option value="fiat">เงินสด (Fiat)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  ประเภทรายการ
                </label>
                <select
                  className="form-input"
                  style={{
                    height: 32,
                    padding: "0 4px",
                    fontSize: 12,
                    color: item.transactionType === "BUY" ? "var(--gain)" : "var(--loss)",
                    backgroundColor: item.transactionType === "BUY" ? "var(--gain-light)" : "var(--loss-light)",
                    borderColor: item.transactionType === "BUY" ? "var(--gain)" : "var(--loss)",
                    fontWeight: "800",
                    borderRadius: "8px"
                  }}
                  value={item.transactionType}
                  onChange={(e) => handleUpdateField(idx, "transactionType", e.target.value)}
                >
                  <option value="BUY">{item.type === "fiat" ? "ฝากเงินสด" : "ซื้อ (BUY)"}</option>
                  <option value="SELL">{item.type === "fiat" ? "ถอนเงินสด" : "ขาย (SELL)"}</option>
                </select>
              </div>
            </div>

            {/* Body Row: Qty & Price & Date & Time & Broker */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1.4fr 0.9fr 1.2fr", gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  จำนวน
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  style={{ height: 32, padding: "0 8px", fontSize: 12 }}
                  value={item.qty}
                  onChange={(e) => handleUpdateField(idx, "qty", e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  {item.type === "fiat" ? "เรทแลกเปลี่ยน" : "ราคาทุนต่อหน่วย"}
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  style={{ height: 32, padding: "0 8px", fontSize: 12 }}
                  disabled={item.type === "fiat" && item.symbol === "THB"}
                  value={item.avgPrice}
                  onChange={(e) => handleUpdateField(idx, "avgPrice", e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  วันที่สั่งซื้อ
                </label>
                <input
                  type="date"
                  className="form-input"
                  style={{ height: 32, padding: "0 4px", fontSize: 12 }}
                  value={item.date}
                  onChange={(e) => handleUpdateField(idx, "date", e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  เวลา
                </label>
                <input
                  type="time"
                  className="form-input"
                  style={{ height: 32, padding: "0 4px", fontSize: 12 }}
                  value={item.time || ""}
                  onChange={(e) => handleUpdateField(idx, "time", e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 3
                  }}
                >
                  {item.type === "fiat" ? "ธนาคาร" : "โบรกเกอร์"}
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ height: 32, padding: "0 8px", fontSize: 12 }}
                  value={item.broker || ""}
                  onChange={(e) => handleUpdateField(idx, "broker", e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
          border: "1px dashed var(--primary)",
          borderRadius: "12px",
          padding: "10px",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
          marginTop: 12
        }}
        onClick={onTriggerMoreFiles}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>➕ อัปโหลดรูปภาพใบเสร็จเพิ่ม...</span>
      </div>
    </>
  );
}
