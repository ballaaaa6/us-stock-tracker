import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { getDisplaySymbol, getRealizedPnL } from "../utils/assetHelpers";
import { fmtQty } from "../utils/formatters";

/**
 * Custom hook to manage portfolio loading, saving, transaction lots, and CRUD operations.
 * @param {Object} params
 * @param {Object} params.user
 * @param {Function} params.showToast
 * @param {Function} params.fetchPrices
 * @param {Function} params.fetchSparklines
 * @param {string} params.chartRange
 * @param {number} params.exchangeRate
 * @param {Function} params.getRealizedPnLInTHB
 * @param {boolean} params.hideValues
 * @returns {Object} Portfolio state and handlers.
 */
export function usePortfolio({
  user,
  showToast,
  fetchPrices,
  fetchSparklines,
  chartRange,
  exchangeRate,
  getRealizedPnLInTHB,
  hideValues
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const savePortfolio = useCallback(
    async (updatedAssets) => {
      setAssets(updatedAssets);
      localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(updatedAssets));

      try {
        await api.portfolio.update(user.token, updatedAssets);
      } catch (err) {
        console.warn("ไม่สามารถเซฟข้อมูลลง Cloudflare ได้ ใช้ Local Storage แทน:", err.message);
        showToast("บันทึกข้อมูลในอุปกรณ์เครื่องนี้แล้ว (เซิร์ฟเวอร์ออฟไลน์)", "warning");
      }
    },
    [user.token, user.username, showToast]
  );

  const fetchPortfolio = useCallback(async () => {
    try {
      const data = await api.portfolio.get(user.token);
      setAssets(data);
      localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(data));
      await fetchPrices(data);
      if (data.length > 0) fetchSparklines(data, chartRange);
    } catch (err) {
      console.warn("โหลดพอร์ตจากเซิร์ฟเวอร์ไม่สำเร็จ ใช้ข้อมูล Local แทน:", err.message);
      const localData = JSON.parse(localStorage.getItem(`local_portfolio_${user.username}`) || "[]");
      setAssets(localData);
      await fetchPrices(localData);
      if (localData.length > 0) fetchSparklines(localData, chartRange);
      showToast("ใช้ข้อมูลพอร์ตที่บันทึกในเครื่องชั่วคราว", "info");
    } finally {
      setLoading(false);
    }
  }, [user.token, user.username, chartRange, fetchPrices, fetchSparklines, showToast]);

  const handleClearAsset = useCallback(
    async (assetId) => {
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const displaySym = asset.broker
        ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})`
        : getDisplaySymbol(asset.symbol);
      const confirmMsg = `คุณแน่ใจหรือไม่ที่จะล้างผลตอบแทนสะสมที่รับรู้แล้ว (Realized P&L) ของ ${displaySym} ให้กลับไปเป็น 0? \n\nการดำเนินการนี้จะล้างเฉพาะค่าผลตอบแทนสะสมในอดีต โดยจะไม่ส่งผลกระทบใดๆ ต่อรายการประวัติการซื้อขายดั้งเดิม หรือจำนวนหุ้นที่คุณถืออยู่ปัจจุบัน`;
      if (!window.confirm(confirmMsg)) return;

      const isThai = asset.symbol.toUpperCase().endsWith(".BK");
      const rawRealized = getRealizedPnL(asset.lots || [], isThai, exchangeRate);
      const rawRealizedTHB = getRealizedPnLInTHB(asset.lots || [], isThai);

      const updatedAssets = assets.map((a) => {
        if (a.id === assetId) {
          return {
            ...a,
            clearedRealizedUSD: rawRealized,
            clearedRealizedTHB: rawRealizedTHB
          };
        }
        return a;
      });

      await savePortfolio(updatedAssets);
      await fetchPrices(updatedAssets);
      fetchSparklines(updatedAssets, chartRange);
      showToast(`ล้างผลตอบแทนสะสมที่รับรู้แล้วของ ${displaySym} เรียบร้อย`, "success");
    },
    [assets, exchangeRate, getRealizedPnLInTHB, savePortfolio, fetchPrices, fetchSparklines, chartRange, showToast]
  );

  const handleDeleteAsset = useCallback(
    async (param, fromModal = false) => {
      const assetId = typeof param === "string" ? param : param?.id;
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const displaySym = asset.broker
        ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})`
        : getDisplaySymbol(asset.symbol);

      if (fromModal) {
        if (asset.qty > 0) {
          window.alert(
            `❌ ไม่สามารถลบ ${displaySym} จากหน้ากำไร/ขาดทุนรายตัวได้เนื่องจากยังมีหุ้นเหลืออยู่บนหน้าหลัก (${asset.qty} หน่วย)\n\nกรุณาลบจากหน้ากระดานหลัก หรือทำธุรกรรมขายออกให้หมดก่อน`
          );
          return;
        }
      }

      const confirmMsg = `คุณแน่ใจหรือไม่ที่จะลบสินทรัพย์ ${displaySym} และประวัติธุรกรรมทั้งหมดออกอย่างถาวร?`;
      if (!window.confirm(confirmMsg)) return;

      const updatedAssets = assets.filter((a) => a.id !== assetId);
      try {
        await savePortfolio(updatedAssets);
        await fetchPrices(updatedAssets);
        fetchSparklines(updatedAssets, chartRange);
        showToast(`ลบสินทรัพย์ ${displaySym} ออกเรียบร้อย`, "success");
      } catch (err) {
        showToast("ลบไม่สำเร็จ: " + err.message, "error");
      }
    },
    [assets, savePortfolio, fetchPrices, fetchSparklines, chartRange, showToast]
  );

  const handleSaveAsset = useCallback(
    async (formData, setModalOpen, setEditingAsset) => {
      const isBatch = Array.isArray(formData);
      const transactions = isBatch ? formData : [formData];

      const sortedTx = [...transactions].sort((a, b) => {
        const isABuy = a.transactionType === "BUY";
        const isBBuy = b.transactionType === "BUY";
        if (isABuy !== isBBuy) {
          return isABuy ? -1 : 1;
        }
        const dtA = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`);
        const dtB = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`);
        return dtA - dtB;
      });

      const skippedTxs = [];

      try {
        let updatedAssets = [...assets];

        const getTodayLocalDate = () => {
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };

        for (const tx of sortedTx) {
          const sym = (tx.symbol || "").trim().toUpperCase();
          const name = (tx.name || sym).trim();
          const newQty = parseFloat(tx.qty);
          const newPrice = parseFloat(tx.avgPrice ?? tx.price ?? 0);
          const category = tx.type ?? tx.category ?? "stock";
          const broker = (tx.broker || "").trim();

          let buyDate = tx.date ? tx.date.trim() : "";
          if (!buyDate) {
            buyDate = getTodayLocalDate();
          }
          let buyTime = tx.time ? tx.time.trim() : "";
          if (!buyTime) {
            buyTime = "00:00";
          }

          if (!sym) {
            if (!isBatch) showToast("เลือกสินทรัพย์ก่อนนะครับ", "error");
            else skippedTxs.push({ tx, reason: "ไม่พบสัญลักษณ์สินทรัพย์" });
            continue;
          }
          if (isNaN(newQty) || newQty <= 0) {
            if (!isBatch) showToast("ใส่จำนวนให้ถูกต้อง", "error");
            else skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: "จำนวนหุ้นไม่ถูกต้อง" });
            continue;
          }
          if (isNaN(newPrice) || newPrice < 0) {
            if (!isBatch) showToast("ใส่ราคาทุนให้ถูกต้อง", "error");
            else skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: "ราคาทุนไม่ถูกต้อง" });
            continue;
          }

          const isSell = tx.transactionType === "SELL";
          const displaySym = broker ? `${sym} (${broker})` : sym;

          const existingIdx = updatedAssets.findIndex(
            (a) => a.symbol === sym && (a.broker || "").trim().toLowerCase() === broker.toLowerCase()
          );

          if (isSell) {
            if (existingIdx < 0) {
              if (!isBatch) {
                showToast(
                  `❌ ไม่สามารถขาย ${displaySym} ได้ เพราะไม่มีในพอร์ตโฟลิโอ\nกรุณาเพิ่มรายการซื้อก่อน`,
                  "error"
                );
                return;
              } else {
                skippedTxs.push({
                  tx: { symbol: sym, ...tx },
                  reason: `ไม่มีสินทรัพย์ ${displaySym} นี้ในพอร์ตโฟลิโอ`
                });
                continue;
              }
            } else {
              const existing = updatedAssets[existingIdx];
              if (newQty > existing.qty) {
                if (!isBatch) {
                  showToast(
                    `❌ ขาย ${displaySym} ไม่ได้ — จำนวนที่ขาย (${fmtQty(newQty, hideValues)}) มากกว่าที่ถืออยู่ (${fmtQty(existing.qty, hideValues)} หน่วย)`,
                    "error"
                  );
                  return;
                } else {
                  skippedTxs.push({
                    tx: { symbol: sym, ...tx },
                    reason: `จำนวนหุ้นไม่เพียงพอ (ขาย ${fmtQty(newQty, hideValues)} แต่ในพอร์ตมี ${fmtQty(existing.qty, hideValues)})`
                  });
                  continue;
                }
              }
            }
          }

          if (existingIdx >= 0) {
            const existingAsset = updatedAssets[existingIdx];
            const duplicateLot = (existingAsset.lots || []).find((l) => {
              const sameDate = l.date === buyDate;
              const sameTime = (l.time || "") === buyTime;
              const sameQty = Math.abs(l.qty - (isSell ? -newQty : newQty)) < 0.00001;
              const samePrice = Math.abs(l.price - newPrice) < 0.00001;
              const sameBroker = (l.broker || "").trim().toLowerCase() === broker.toLowerCase();
              return sameDate && sameTime && sameQty && samePrice && sameBroker;
            });
            if (duplicateLot) {
              const confirmMsg = `⚠️ ตรวจพบธุรกรรมที่อาจซ้ำซ้อน:\nมีรายการ ${isSell ? "ขาย" : "ซื้อ"} ${displaySym} จำนวน ${newQty} หุ้น @ $${newPrice} วันที่ ${buyDate} ${buyTime ? "เวลา " + buyTime + " น." : ""} อยู่ในระบบแล้ว\n\nคุณต้องการบันทึกธุรกรรมนี้เพิ่มอีกรายการใช่หรือไม่?`;
              if (!window.confirm(confirmMsg)) {
                if (isBatch) {
                  skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: "ผู้ใช้ยกเลิกเนื่องจากพบธุรกรรมซ้ำซ้อน" });
                }
                continue;
              }
            }
          }

          const newLot = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            date: buyDate,
            time: buyTime,
            qty: isSell ? -newQty : newQty,
            price: newPrice,
            broker: broker
          };

          if (existingIdx >= 0) {
            const existing = updatedAssets[existingIdx];
            const oldLots = existing.lots || [];
            const allLots = [...oldLots, newLot];
            const totalQty = allLots.reduce((s, l) => s + l.qty, 0);

            const buyLots = allLots.filter((l) => l.qty > 0);
            const buyQty = buyLots.reduce((s, l) => s + l.qty, 0);
            const buyCost = buyLots.reduce((s, l) => s + l.qty * l.price, 0);
            const avgCost = buyQty > 0 ? buyCost / buyQty : 0;

            updatedAssets[existingIdx] = {
              ...existing,
              lots: allLots,
              qty: totalQty,
              avgCost: avgCost
            };

            if (!isBatch) {
              const isCash = category === "fiat";
              showToast(
                isSell
                  ? `✅ ${isCash ? "ถอนเงินสด" : "ขายออก"} ${displaySym} ${fmtQty(newQty, hideValues)} หน่วยสำเร็จ`
                  : `✅ ${isCash ? "ฝากเพิ่ม" : "ซื้อเพิ่ม"} ${displaySym} ${fmtQty(newQty, hideValues)} หน่วยสำเร็จ`,
                "success"
              );
            }
          } else {
            updatedAssets.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              symbol: sym,
              name,
              category,
              broker,
              lots: [newLot],
              qty: isSell ? -newQty : newQty,
              avgCost: newPrice
            });
            if (!isBatch) {
              const isCash = category === "fiat";
              showToast(`✅ เพิ่ม ${isCash ? "เงินสด" : "สินทรัพย์"} ${displaySym} เข้าพอร์ตแล้ว`, "success");
            }
          }
        }

        await savePortfolio(updatedAssets);

        if (setModalOpen) setModalOpen(false);
        if (setEditingAsset) setEditingAsset(null);
        await fetchPrices(updatedAssets);
        fetchSparklines(updatedAssets, chartRange);

        if (isBatch) {
          if (skippedTxs.length > 0) {
            const successCount = sortedTx.length - skippedTxs.length;
            const errorDetails = skippedTxs
              .map(
                (s) =>
                  `- ${s.tx.symbol} (${s.tx.transactionType === "BUY" ? "ซื้อ" : "ขาย"} · ${s.tx.qty} หน่วย): ${s.reason}`
              )
              .join("\n");
            window.alert(
              `⚠️ นำเข้าธุรกรรมสำเร็จ ${successCount}/${sortedTx.length} รายการ\n\nรายการที่ถูกข้ามเนื่องจากข้อผิดพลาด:\n${errorDetails}`
            );
          } else {
            showToast(`✅ นำเข้าธุรกรรมทั้งหมด ${sortedTx.length} รายการสำเร็จ!`, "success");
          }
        }
      } catch (err) {
        showToast("บันทึกไม่สำเร็จ: " + err.message, "error");
      }
    },
    [assets, savePortfolio, fetchPrices, fetchSparklines, chartRange, hideValues, showToast]
  );

  const handleClearPortfolio = useCallback(async () => {
    if (
      !window.confirm(
        "⚠️ คุณต้องการล้างข้อมูลหุ้นและธุรกรรมทั้งหมดในพอร์ตใช่หรือไม่? (ชื่อเล่นและรูปโปรไฟล์ของคุณจะไม่ถูกลบ)"
      )
    )
      return;
    try {
      await savePortfolio([]);
      showToast("🗑️ ล้างข้อมูลพอร์ตหุ้นเรียบร้อยแล้ว!", "success");
    } catch (err) {
      showToast("ล้างข้อมูลไม่สำเร็จ: " + err.message, "error");
    }
  }, [savePortfolio, showToast]);

  // Load portfolio on mount
  useEffect(() => {
    fetchPortfolio();
  }, []); // Run once on startup

  return {
    assets,
    setAssets,
    loading,
    setLoading,
    savePortfolio,
    fetchPortfolio,
    handleClearAsset,
    handleDeleteAsset,
    handleSaveAsset,
    handleClearPortfolio
  };
}
