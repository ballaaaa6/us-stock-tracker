import React, { useState, useRef } from "react";
import { api } from "../../services/api";
import { validateParsedReceipt } from "../../utils/ocrParser.js";

export default function ReceiptScanner({ onScanSuccess, triggerToast, scannerRef }) {
  const [scanning, setScanning] = useState(false);
  const [scanningStatus, setScanningStatus] = useState({ active: false, total: 0, completed: 0, stage: "" });
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (scannerRef) {
      scannerRef.current = {
        triggerSelect: () => fileInputRef.current?.click()
      };
    }
  }, [scannerRef]);

  /* ─── Image compressor: shrink to max 1024px & 75% JPEG ─── */
  const compressImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ base64: reader.result.split(",")[1], mime: "image/jpeg" });
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = () => {
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: reader.result.split(",")[1], mime: file.type || "image/jpeg" });
        reader.readAsDataURL(file);
      };
      img.src = url;
    });

  const processReceiptImages = async (files) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    setScanning(true);
    setScanningStatus({ active: true, total: fileList.length, completed: 0, stage: "กำลังเตรียมไฟล์..." });

    const newScannedItems = [];
    const fileErrors = {};

    setScanningStatus((prev) => ({ ...prev, stage: "📦 กำลังบีบอัดรูปภาพ..." }));
    const imagesToProcess = [];
    for (let idx = 0; idx < fileList.length; idx++) {
      try {
        const { base64, mime } = await compressImage(fileList[idx]);
        imagesToProcess.push({ index: idx, base64, mime });
      } catch (compressErr) {
        fileErrors[idx] = `รูป ${idx + 1} (Compression): ${compressErr.message}`;
      }
    }

    let completedImages = 0;
    const userSession = localStorage.getItem("portfolio_user");
    let token = "";
    if (userSession) {
      try {
        token = JSON.parse(userSession)?.token || "";
      } catch (_) {}
    }

    for (const img of imagesToProcess) {
      const idx = img.index;
      setScanningStatus((prev) => ({
        ...prev,
        stage: `🤖 กำลังสแกนรูปที่ ${completedImages + 1}/${imagesToProcess.length}...`
      }));

      try {
        const data = await api.ocr.scan(token, {
          images: [{ base64: img.base64, mime: img.mime }],
          skipSave: true
        });
        if (data.errors && data.errors.length > 0) {
          throw new Error(data.errors[0].error);
        }

        if (data.results && data.results.length > 0) {
          const resObj = data.results[0];
          console.log(`🤖 [Scan Debug] Image ${idx + 1} — AI Raw:`, resObj.raw_ai);
          const ts = resObj.timestamp || "";
          const date = ts ? ts.split("T")[0] : new Date().toISOString().split("T")[0];
          const time = ts && ts.includes("T") ? ts.split("T")[1].slice(0, 5) : "";

          const validated = validateParsedReceipt(
            {
              symbol: resObj.symbol,
              name: resObj.symbol,
              category: "stock",
              qty: resObj.share_amount,
              price: resObj.actual_price,
              date,
              time,
              transactionType: resObj.action
            },
            idx
          );

          if (validated) {
            if (validated.category === "stock" || validated.category === "gold") {
              try {
                const suggestions = await api.prices.checkPrice(validated.symbol);
                if (suggestions && suggestions.length > 0) {
                  const matched = suggestions.find(
                    (s) =>
                      s.symbol.toUpperCase() === validated.symbol.toUpperCase() ||
                      s.symbol.toUpperCase().startsWith(validated.symbol.toUpperCase() + ".")
                  );
                  if (matched) {
                    validated.symbol = matched.symbol;
                    validated.name = matched.name;
                  }
                }
              } catch (err) {
                console.warn("Failed to auto-map OCR symbol:", err);
              }
            }

            newScannedItems.push({
              id: `${Date.now()}-workers-ai-${idx}`,
              symbol: validated.symbol,
              name: validated.name,
              type: validated.category,
              qty: String(validated.qty),
              avgPrice: String(validated.price),
              date: validated.date,
              time: validated.time,
              broker: "Dime!",
              transactionType: validated.transactionType
            });
            delete fileErrors[idx];
          } else {
            fileErrors[idx] = `รูป ${idx + 1}: AI สแกนผ่านแต่ข้อมูลไม่สมบูรณ์`;
          }
        } else {
          throw new Error("No results returned from server-side scan");
        }
      } catch (scanErr) {
        console.error(`Cloudflare scan failed for image ${idx + 1}:`, scanErr.message);
        fileErrors[idx] = `รูป ${idx + 1}: สแกนไม่สำเร็จ — ${scanErr.message}`;
      }

      completedImages++;
      setScanningStatus((prev) => ({
        ...prev,
        completed: Math.min(fileList.length, completedImages)
      }));
    }

    setScanningStatus((prev) => ({ ...prev, completed: fileList.length }));

    if (newScannedItems.length > 0) {
      newScannedItems.sort((a, b) => {
        const dtA = `${a.date || ""}T${a.time || "00:00"}`;
        const dtB = `${b.date || ""}T${b.time || "00:00"}`;
        return dtA.localeCompare(dtB);
      });
      onScanSuccess(newScannedItems);
    }

    const errors = Object.values(fileErrors);
    if (errors.length > 0) {
      triggerToast(
        `⚠️ สแกนเสร็จ (พบข้อผิดพลาด ${errors.length} รายการ):\n${errors.slice(0, 3).join("\n")}${errors.length > 3 ? `\n...และอีก ${errors.length - 3} รายการ` : ""}`,
        "warning"
      );
    }

    setScanning(false);
    setScanningStatus({ active: false, total: 0, completed: 0, stage: "" });
  };

  const handleDropReceipt = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) processReceiptImages(files);
  };

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) processReceiptImages(files);
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
        border: "2px dashed var(--primary)",
        borderRadius: "16px",
        padding: "16px",
        textAlign: "center",
        marginBottom: 16,
        cursor: "pointer",
        position: "relative",
        transition: "all 0.2s ease"
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropReceipt}
      onClick={() => fileInputRef.current?.click()}
      className="receipt-dropzone"
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        multiple
        onChange={handleFileSelect}
      />
      {scanning ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            className="spinner"
            style={{
              width: 24,
              height: 24,
              borderColor: "var(--primary) transparent var(--primary) transparent"
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", animation: "pulse 1.5s infinite" }}>
            {scanningStatus.active
              ? `🤖 AI กำลังวิเคราะห์ใบเสร็จ (${scanningStatus.completed}/${scanningStatus.total})...`
              : "🤖 AI กำลังวิเคราะห์รูปภาพ..."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 22 }}>📸</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-main)" }}>
            อัปโหลดรูปภาพใบเสร็จเพื่อกรอกออโต้
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            รองรับหลายรูปภาพพร้อมกัน · ลากและวางหรือเลือกไฟล์
          </span>
        </div>
      )}
    </div>
  );
}
