import React, { useState, useEffect, useRef } from "react";
import { X, Save } from "lucide-react";
import { fmtQty } from "../utils/formatters";
import ReceiptScanner from "./dashboard/ReceiptScanner";
import BatchImportQueue from "./dashboard/BatchImportQueue";
import ManualTransactionForm from "./dashboard/ManualTransactionForm";
import AssetPurchaseHistory from "./dashboard/AssetPurchaseHistory";

export default function AssetModal({ isOpen, onClose, onSave, editingAsset, exchangeRate, showToast }) {
  const [type, setType] = useState("stock");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [broker, setBroker] = useState("");
  const [txType, setTxType] = useState("BUY"); // BUY or SELL
  const [scannedQueue, setScannedQueue] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const qtyInputRef = useRef(null);
  const scannerRef = useRef(null);

  const triggerToast = (msg, toastType = "success") => {
    if (showToast) {
      showToast(msg, toastType);
    } else {
      alert(msg);
    }
  };

  /* ─── Reset on open ─── */
  useEffect(() => {
    if (!isOpen) return;

    if (editingAsset) {
      const cat = editingAsset.category || editingAsset.type || "stock";
      setType(cat);
      setSymbol(editingAsset.symbol || "");
      setName(editingAsset.name || "");
      setQty("");
      setPrice("");
      setDate(new Date().toISOString().split("T")[0]);
      setTime("");
      setBroker(editingAsset.broker || "");
      setTxType("BUY");
    } else {
      setType("stock");
      setSymbol("");
      setName("");
      setQty("");
      setPrice("");
      setDate(new Date().toISOString().split("T")[0]);
      setTime("");
      setBroker("");
      setTxType("BUY");
    }
    setShowHistory(false);
    setScannedQueue([]);
  }, [isOpen, editingAsset]);

  if (!isOpen) return null;

  const onScanSuccess = (newScannedItems) => {
    if (newScannedItems.length === 1 && scannedQueue.length === 0) {
      const item = newScannedItems[0];
      setSymbol(item.symbol);
      setName(item.name);
      setType(item.type);
      setQty(item.qty ? item.qty.toString() : "");
      setPrice(item.avgPrice ? item.avgPrice.toString() : "");
      setDate(item.date);
      setTime(item.time || "");
      setBroker(item.broker || "Dime!");
      setTxType(item.transactionType);
      triggerToast(
        `🤖 สแกนใบเสร็จสำเร็จ!\nดึงข้อมูล: ${item.symbol} (${item.transactionType === "BUY" ? "ซื้อ/ฝาก" : "ขาย/ถอน"} · ${item.qty} หน่วย @ $${item.avgPrice})`,
        "success"
      );
    } else {
      setScannedQueue((prev) => {
        const combined = [...prev, ...newScannedItems];
        combined.sort((a, b) => {
          const dtA = `${a.date || ""}T${a.time || "00:00"}`;
          const dtB = `${b.date || ""}T${b.time || "00:00"}`;
          return dtA.localeCompare(dtB);
        });
        return combined;
      });
      triggerToast(`🤖 สแกนสำเร็จ ${newScannedItems.length} รายการ! ตรวจสอบและยืนยันด้านล่าง`, "success");
    }
  };

  /* ─── Submit single transaction ─── */
  const handleSubmit = (e) => {
    e.preventDefault();
    const pQty = parseFloat(qty);
    if (!symbol.trim()) {
      triggerToast("เลือกสินทรัพย์ก่อนนะครับ", "error");
      return;
    }
    if (isNaN(pQty) || pQty <= 0) {
      triggerToast("ใส่จำนวนให้ถูกต้อง (มากกว่า 0)", "error");
      return;
    }

    let pPrice = parseFloat(price);
    if (isNaN(pPrice) || pPrice < 0) {
      triggerToast("ใส่ราคาทุนให้ถูกต้อง", "error");
      return;
    }

    const getTodayLocalDate = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    let finalDate = date ? date.trim() : "";
    if (!finalDate) {
      finalDate = getTodayLocalDate();
    }
    let finalTime = time ? time.trim() : "";
    if (!finalTime) {
      finalTime = "00:00";
    }

    onSave({
      symbol: symbol.trim().toUpperCase(),
      name: name.trim() || symbol.trim().toUpperCase(),
      type,
      qty: pQty,
      avgPrice: pPrice,
      date: finalDate,
      time: finalTime,
      broker: broker.trim(),
      transactionType: txType
    });
  };

  /* ─── Batch Submit ─── */
  const handleBatchSubmit = (e) => {
    e.preventDefault();
    if (scannedQueue.length === 0) return;

    const getTodayLocalDate = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const cleanedQueue = [];

    for (const item of scannedQueue) {
      if (!item.symbol.trim()) {
        triggerToast("กรุณากรอกสัญลักษณ์สินทรัพย์ให้ครบถ้วน", "error");
        return;
      }
      const pQty = parseFloat(item.qty);
      if (isNaN(pQty) || pQty <= 0) {
        triggerToast(`กรุณากรอกจำนวนของ ${item.symbol} ให้ถูกต้อง (มากกว่า 0)`, "error");
        return;
      }
      const pPrice = parseFloat(item.avgPrice);
      if (item.type !== "fiat" && (isNaN(pPrice) || pPrice < 0)) {
        triggerToast(`กรุณากรอกราคาทุนต่อหน่วยของ ${item.symbol} ให้ถูกต้อง`, "error");
        return;
      }

      let itemDate = item.date ? item.date.trim() : "";
      if (!itemDate) {
        itemDate = getTodayLocalDate();
      }
      let itemTime = item.time ? item.time.trim() : "";
      if (!itemTime) {
        itemTime = "00:00";
      }

      cleanedQueue.push({
        ...item,
        symbol: item.symbol.trim().toUpperCase(),
        name: item.name ? item.name.trim() : item.symbol.trim().toUpperCase(),
        qty: pQty,
        avgPrice: pPrice,
        date: itemDate,
        time: itemTime,
        broker: item.broker ? item.broker.trim() : "Dime!"
      });
    }

    onSave(cleanedQueue);
  };

  const lots = editingAsset?.lots || [];

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: 500 }}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            {editingAsset
              ? txType === "SELL"
                ? type === "fiat"
                  ? `📤 ถอนเงินสด ${editingAsset.symbol}`
                  : `🔴 ขายสินทรัพย์ ${editingAsset.symbol}`
                : type === "fiat"
                  ? `📥 ฝากเงินสด ${editingAsset.symbol}`
                  : `🟢 ซื้อสินทรัพย์ ${editingAsset.symbol}`
              : scannedQueue.length > 0
                ? `📋 ตรวจสอบคิวสแกน (${scannedQueue.length} รายการ)`
                : "เพิ่มสินทรัพย์ใหม่"}
          </h2>
          <button onClick={onClose} className="btn-close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={scannedQueue.length > 0 ? handleBatchSubmit : handleSubmit}>
          <div className="modal-body">
            {/* Receipt Scan Zone */}
            <ReceiptScanner scannerRef={scannerRef} onScanSuccess={onScanSuccess} triggerToast={triggerToast} />

            {scannedQueue.length > 0 ? (
              <BatchImportQueue
                scannedQueue={scannedQueue}
                setScannedQueue={setScannedQueue}
                onTriggerMoreFiles={() => scannerRef.current?.triggerSelect()}
              />
            ) : (
              <ManualTransactionForm
                editingAsset={editingAsset}
                exchangeRate={exchangeRate}
                qtyInputRef={qtyInputRef}
                type={type}
                setType={setType}
                symbol={symbol}
                setSymbol={setSymbol}
                name={name}
                setName={setName}
                qty={qty}
                setQty={setQty}
                price={price}
                setPrice={setPrice}
                date={date}
                setDate={setDate}
                time={time}
                setTime={setTime}
                broker={broker}
                setBroker={setBroker}
                txType={txType}
                setTxType={setTxType}
              />
            )}

            {/* Purchase History */}
            <AssetPurchaseHistory
              editingAsset={editingAsset}
              lots={lots}
              showHistory={showHistory}
              setShowHistory={setShowHistory}
            />

            {/* Tip box */}
            {!editingAsset && scannedQueue.length === 0 && (
              <div
                style={{
                  marginTop: 14,
                  background: "#FFFBEB",
                  border: "1px solid #FEF3C7",
                  borderRadius: 14,
                  padding: "10px 14px",
                  fontSize: 11,
                  color: "#92400E",
                  lineHeight: 1.6,
                  display: "flex",
                  gap: 8
                }}
              >
                <span>💡</span>
                <span>
                  {type === "stock" && "พิมพ์ชื่อหุ้นที่ต้องการค้นหาแล้วเลือกจากรายการได้เลย · หุ้นไทยราคาหน่วยเป็นบาท"}
                  {type === "crypto" && "ต่อท้ายด้วย -USD เช่น BTC-USD · ราคาทุนใส่เป็น USD"}
                  {type === "gold" && "GC=F คือ Spot Gold, CL=F คือ Crude Oil ตลาดโลก (USD)"}
                  {type === "fiat" && "กรอกจำนวนเงินสดที่คุณถือครองและเลือกสกุลเงินสดได้เลย"}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary ripple-btn"
              onClick={onClose}
              style={{ height: 48, flex: "0 0 100px" }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-primary ripple-btn"
              style={{ height: 48, flex: 1 }}
              disabled={scannedQueue.length === 0 && !symbol}
            >
              <Save size={16} />
              {editingAsset
                ? txType === "SELL"
                  ? type === "fiat"
                    ? `ถอนเงินสด -${qty ? fmtQty(parseFloat(qty) || 0) : "?"} THB`
                    : `ขายออก -${qty ? fmtQty(parseFloat(qty) || 0) : "?"} หน่วย`
                  : type === "fiat"
                    ? `ฝากเงินสด +${qty ? fmtQty(parseFloat(qty) || 0) : "?"} THB`
                    : `ซื้อเพิ่ม +${qty ? fmtQty(parseFloat(qty) || 0) : "?"} หน่วย`
                : scannedQueue.length > 0
                  ? `ยืนยันและนำเข้าทั้งหมด (${scannedQueue.length} รายการ)`
                  : "เพิ่มเข้าพอร์ต"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
