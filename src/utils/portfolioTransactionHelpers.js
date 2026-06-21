/**
 * portfolioTransactionHelpers.js
 * Logic for processing and validating transactions in the portfolio.
 */

import { getHistoricalExchangeRate } from "./assetHelpers.js";

export function processTransactions({ formData, assets, exchangeRate, historicalRates }) {
  const isBatch = Array.isArray(formData);
  const transactions = isBatch ? formData : [formData];
  const sortedTx = [...transactions].sort((a, b) => {
    const dateA = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`);
    const dateB = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`);
    if (dateA - dateB !== 0) return dateA - dateB;

    const isABuy = a.transactionType === "BUY";
    const isBBuy = b.transactionType === "BUY";
    if (isABuy !== isBBuy) return isABuy ? -1 : 1;

    const orderA = a.orderId || a.order_id || "";
    const orderB = b.orderId || b.order_id || "";
    return orderA.localeCompare(orderB);
  });

  const getTodayLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getHistoricalRate = (dateStr) => getHistoricalExchangeRate(dateStr, historicalRates, exchangeRate);

  const skippedTxs = [];
  let updatedAssets = [...assets];

  for (const tx of sortedTx) {
    const sym = (tx.symbol || "").trim().toUpperCase();
    const name = (tx.name || sym).trim();
    const newQty = parseFloat(tx.qty);
    const newPrice = parseFloat(tx.avgPrice ?? tx.price ?? 0);
    const category = tx.type ?? tx.category ?? "stock";
    const broker = (tx.broker || "").trim();

    let buyDate = tx.date ? tx.date.trim() : getTodayLocalDate();
    let buyTime = tx.time ? tx.time.trim() : "00:00";

    if (!sym || isNaN(newQty) || newQty <= 0 || isNaN(newPrice) || newPrice < 0) {
      skippedTxs.push({ tx, reason: "ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง" });
      continue;
    }

    const isThai = sym.endsWith(".BK");
    const transactionType = tx.transactionType || "BUY";

    let existing = updatedAssets.find(a => a.symbol.toUpperCase() === sym && (a.broker || "").toUpperCase() === broker.toUpperCase());

    if (!existing) {
      if (transactionType === "SELL") {
        skippedTxs.push({ tx, reason: `ไม่สามารถขาย ${sym} ได้เนื่องจากยังไม่มีในพอร์ต` });
        continue;
      }
      existing = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: sym,
        name: name || sym,
        qty: 0,
        avgCost: 0,
        avgPrice: 0,
        category,
        broker,
        lots: []
      };
      updatedAssets.push(existing);
    }

    const newLot = {
      id: Math.random().toString(36).substr(2, 9),
      date: buyDate,
      time: buyTime,
      qty: transactionType === "BUY" ? newQty : -newQty,
      price: newPrice,
      type: transactionType,
      // Preserve Dime report metadata if present
      orderId: tx.orderId || tx.order_id || "",
      ...(tx.fee != null ? { fee: tx.fee } : {}),
      ...(tx.vat != null ? { vat: tx.vat } : {}),
      ...(tx.discount != null ? { discount: tx.discount } : {}),
      ...(tx.netAmount != null ? { netAmount: tx.netAmount } : {}),
      ...(tx.ccy || tx.currency ? { ccy: tx.ccy || tx.currency } : {}),
      ...(tx.gross_usd != null ? { gross_usd: tx.gross_usd } : {}),
      ...(tx.fee_usd != null ? { fee_usd: tx.fee_usd } : {}),
      ...(tx.fee_thb != null ? { fee_thb: tx.fee_thb } : {}),
      ...(tx.vat_thb != null ? { vat_thb: tx.vat_thb } : {}),
      ...(tx.discount_thb != null ? { discount_thb: tx.discount_thb } : {}),
      ...(tx.total_usd != null ? { total_usd: tx.total_usd } : {}),
      ...(tx.total_thb != null ? { total_thb: tx.total_thb } : {}),
      ...(tx.total_thb_disc != null ? { total_thb_disc: tx.total_thb_disc } : {}),
      ...(tx.file ? { file: tx.file } : {}),
    };

    const currentLots = existing.lots || [];

    // Order ID duplicate guard — skip if this orderId already exists on the asset
    const checkOrderId = tx.orderId || tx.order_id;
    if (checkOrderId && currentLots.some(l => l.orderId === checkOrderId)) {
      skippedTxs.push({ tx, reason: `Order ID ${checkOrderId} ซ้ำกัน — ข้ามรายการนี้` });
      continue;
    }

    const updatedLots = [...currentLots, newLot].sort((a, b) => {
      const d = new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00"));
      if (d !== 0) return d;
      
      const isABuy = a.qty > 0;
      const isBBuy = b.qty > 0;
      if (isABuy !== isBBuy) return isABuy ? -1 : 1;

      const orderA = a.orderId || a.order_id || "";
      const orderB = b.orderId || b.order_id || "";
      return orderA.localeCompare(orderB);
    });

    const fifoQueue = [];
    let valid = true;

    for (const lot of updatedLots) {
      const lotQty = lot.qty;
      let lotPriceUSD = lot.price || 0;
      const txRate = getHistoricalRate(lot.date);
      if (isThai && txRate) lotPriceUSD = lotPriceUSD / txRate;

      if (lotQty > 0) {
        fifoQueue.push({ qty: lotQty, price: lotPriceUSD });
      } else {
        let remSell = Math.abs(lotQty);
        while (remSell > 0 && fifoQueue.length > 0) {
          const oldest = fifoQueue[0];
          if (oldest.qty <= remSell) {
            remSell -= oldest.qty;
            fifoQueue.shift();
          } else {
            oldest.qty -= remSell;
            remSell = 0;
          }
        }
        if (remSell > 0.0001) {
          valid = false;
          break;
        }
      }
    }

    const runningQty = fifoQueue.reduce((sum, l) => sum + l.qty, 0);
    const runningAvgCostUSD = runningQty > 0 ? fifoQueue.reduce((sum, l) => sum + l.qty * l.price, 0) / runningQty : 0;

    if (!valid) {
      skippedTxs.push({ tx, reason: `ไม่สามารถทำรายการได้เนื่องจากจะทำให้จำนวนหุ้นติดลบ` });
      continue;
    }

    existing.lots = updatedLots;
    existing.qty = runningQty;
    existing.avgCost = runningAvgCostUSD;
    existing.avgPrice = isThai ? runningAvgCostUSD * getHistoricalRate(buyDate) : runningAvgCostUSD;
    existing.category = category;
    existing.name = name || existing.name;

    if (existing.qty < 0.00001 && (!existing.lots || existing.lots.length === 0)) {
      updatedAssets = updatedAssets.filter(a => a.id !== existing.id);
    }
  }

  return { updatedAssets, skippedTxs };
}

export function isTransactionDuplicate(tx, assets) {
  const sym = (tx.symbol || "").trim().toUpperCase();
  const broker = (tx.broker || "").trim();
  const qtyVal = parseFloat(tx.qty);
  const priceVal = parseFloat(tx.avgPrice ?? tx.price ?? 0);
  const txType = tx.transactionType || "BUY";
  
  const existingAsset = assets.find(a => 
    a.symbol.toUpperCase() === sym && 
    (a.broker || "").toUpperCase() === broker.toUpperCase()
  );

  if (!existingAsset || !existingAsset.lots) return false;

  return existingAsset.lots.some(l => {
    const sameDate = l.date === tx.date;
    const sameTime = (l.time || "") === (tx.time || "");
    const targetQty = txType === "BUY" ? qtyVal : -qtyVal;
    const sameQty = Math.abs(l.qty - targetQty) < 0.00001;
    const samePrice = Math.abs(l.price - priceVal) < 0.00001;
    return sameDate && sameTime && sameQty && samePrice;
  });
}

export function recalculatePortfolioFIFO(assets, exchangeRate, historicalRates) {
  const getHistoricalRate = (dateStr) => getHistoricalExchangeRate(dateStr, historicalRates, exchangeRate);

  return assets.map(asset => {
    const isThai = asset.symbol.endsWith(".BK");
    const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

    if (isCashAsset) {
      const sortedLots = [...(asset.lots || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
      let totalQty = 0;
      let totalCostUSD = 0;
      let buyQty = 0;

      for (const lot of sortedLots) {
        totalQty += lot.qty;
        if (lot.qty > 0) {
          buyQty += lot.qty;
          totalCostUSD += lot.qty * lot.price;
        }
      }

      const avgCost = buyQty > 0 ? totalCostUSD / buyQty : asset.avgCost || 1.0;
      return {
        ...asset,
        lots: sortedLots,
        qty: totalQty,
        avgCost,
        avgPrice: avgCost
      };
    }

    const sortedLots = [...(asset.lots || [])].sort((a, b) => {
      const d = new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00"));
      if (d !== 0) return d;
      
      const isABuy = a.qty > 0;
      const isBBuy = b.qty > 0;
      if (isABuy !== isBBuy) return isABuy ? -1 : 1;

      const orderA = a.orderId || a.order_id || "";
      const orderB = b.orderId || b.order_id || "";
      return orderA.localeCompare(orderB);
    });

    const fifoQueue = [];
    for (const lot of sortedLots) {
      const lotQty = lot.qty;
      let lotPriceUSD = lot.price || 0;
      const txRate = getHistoricalRate(lot.date);
      if (isThai && txRate) lotPriceUSD = lotPriceUSD / txRate;

      if (lotQty > 0) {
        fifoQueue.push({ qty: lotQty, price: lotPriceUSD });
      } else {
        let remSell = Math.abs(lotQty);
        while (remSell > 0 && fifoQueue.length > 0) {
          const oldest = fifoQueue[0];
          if (oldest.qty <= remSell) {
            remSell -= oldest.qty;
            fifoQueue.shift();
          } else {
            oldest.qty -= remSell;
            remSell = 0;
          }
        }
      }
    }

    const runningQty = fifoQueue.reduce((sum, l) => sum + l.qty, 0);
    const runningAvgCostUSD = runningQty > 0 ? fifoQueue.reduce((sum, l) => sum + l.qty * l.price, 0) / runningQty : 0;

    return {
      ...asset,
      lots: sortedLots,
      qty: runningQty,
      avgCost: runningAvgCostUSD,
      avgPrice: isThai ? runningAvgCostUSD * getHistoricalRate(sortedLots[sortedLots.length - 1]?.date) : runningAvgCostUSD
    };
  });
}
