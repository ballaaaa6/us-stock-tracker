/**
 * Static mappings and naming helpers for assets, stocks, fiat, gold, and crypto.
 */

export const ASSET_NAME_MAP = {
  "MU": "Micron Technology, Inc.", "AAPL": "Apple Inc.", "TSLA": "Tesla, Inc.", "NVDA": "NVIDIA Corporation",
  "MSFT": "Microsoft Corporation", "AMZN": "Amazon.com, Inc.", "GOOGL": "Alphabet Inc.", "GOOG": "Alphabet Inc.",
  "META": "Meta Platforms, Inc.", "NFLX": "Netflix, Inc.", "AMD": "Advanced Micro Devices, Inc.", "INTC": "Intel Corporation",
  "BABA": "Alibaba Group Holding Limited", "ASML": "ASML Holding N.V.", "TSM": "Taiwan Semiconductor Manufacturing Company, Limited",
  "DIS": "The Walt Disney Company", "NKE": "NIKE, Inc.", "JPM": "JPMorgan Chase & Co.", "V": "Visa Inc.",
  "MA": "Mastercard Incorporated", "WMT": "Walmart Inc.", "PG": "The Procter & Gamble Company", "KO": "The Coca-Cola Company",
  "PEP": "PepsiCo, Inc.", "COST": "Costco Wholesale Corporation", "AVGO": "Broadcom Inc.", "QCOM": "Qualcomm Incorporated",
  "TXN": "Texas Instruments Incorporated", "ADBE": "Adobe Inc.", "CRM": "Salesforce, Inc.", "ORCL": "Oracle Corporation",
  "ACN": "Accenture plc", "MCD": "McDonald's Corporation", "SBUX": "Starbucks Corporation", "CAT": "Caterpillar Inc.",
  "GE": "General Electric Company", "F": "Ford Motor Company", "GM": "General Motors Company", "XOM": "Exxon Mobil Corporation",
  "CVX": "Chevron Corporation", "GC=F": "Spot Gold (ทองคำตลาดโลก)", "CL=F": "Crude Oil (น้ำมันดิบตลาดโลก)",
  "OIL": "Crude Oil (น้ำมันดิบตลาดโลก)", "GOLD": "Spot Gold (ทองคำตลาดโลก)", "PTT.BK": "PTT Public Company Limited",
  "CPALL.BK": "CP ALL Public Company Limited", "AOT.BK": "Airports of Thailand Public Company Limited",
  "BDMS.BK": "Bangkok Dusit Medical Services Public Company Limited", "KBANK.BK": "Kasikornbank Public Company Limited",
  "SCB.BK": "SCB X Public Company Limited", "ADVANC.BK": "Advanced Info Service Public Company Limited",
  "GULF.BK": "Gulf Energy Development Public Company Limited", "PTTEP.BK": "PTT Exploration and Production Public Company Limited",
  "INTUCH.BK": "Intouch Holdings Public Company Limited", "BDMS": "Bangkok Dusit Medical Services Public Company Limited",
  "KBANK": "Kasikornbank Public Company Limited", "SCB": "SCB X Public Company Limited",
  "THB": "Thai Baht (เงินบาทไทย ฿)", "USD": "US Dollar (ดอลลาร์สหรัฐ $)",
  "EUR": "Euro (ยูโร 🇪🇺)", "GBP": "British Pound (ปอนด์สหราชอาณาจักร 🇬🇧)", "JPY": "Japanese Yen (เยนญี่ปุ่น 🇯🇵)",
  "SGD": "Singapore Dollar (ดอลลาร์สิงคโปร์ 🇸🇬)", "HKD": "Hong Kong Dollar (ดอลลาร์ฮ่องกง 🇭🇰)", "AUD": "Australian Dollar (ดอลลาร์ออสเตรเลีย 🇦🇺)"
};

export const getDisplaySymbol = (symbol) => {
  if (!symbol) return "";
  const optionMatch = symbol.toUpperCase().match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (optionMatch) {
    const [_, underlying, yy, mm, dd, type, strikeRaw] = optionMatch;
    const strike = parseFloat(strikeRaw) / 1000;
    return `${underlying} ${type}${strike}`;
  }
  const parts = symbol.split(".");
  if (parts.length > 1 && parts[parts.length - 1].length <= 3) {
    return parts.slice(0, -1).join(".");
  }
  return symbol;
};

export const getAssetFullName = (symbol, name, category) => {
  const symUpper = (symbol || "").toUpperCase();
  const optionMatch = symUpper.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (optionMatch) {
    const [_, underlying, yy, mm, dd, type, strikeRaw] = optionMatch;
    const year = `20${yy}`;
    const strike = parseFloat(strikeRaw) / 1000;
    const optionType = type === "C" ? "Call" : "Put";
    return `${underlying} ${optionType} $${strike.toFixed(2)} (${dd}/${mm}/${year})`;
  }
  if (ASSET_NAME_MAP[symUpper]) return ASSET_NAME_MAP[symUpper];
  if (symUpper.endsWith(".BK")) {
    const base = symUpper.replace(".BK", "");
    if (!name || name === symbol || name === base) {
      return `${base} Public Company Limited`;
    }
  }
  if (category === "gold") {
    if (symUpper === "CL=F") return "Crude Oil (น้ำมันดิบตลาดโลก)";
    return "Spot Gold (ทองคำตลาดโลก)";
  }
  if (name && name.toUpperCase() !== symUpper) return name;
  return `${symUpper} Asset`;
};

export const getCurrencyTicker = (symbol) => {
  if (symbol === "USD") return "USD";
  if (["EUR", "GBP", "AUD", "NZD"].includes(symbol)) {
    return `${symbol}USD=X`;
  }
  return `${symbol}=X`;
};

export const getCurrencyPriceUSD = (symbol, prices, exchangeRate) => {
  if (symbol === "USD") return 1.0;
  const ticker = getCurrencyTicker(symbol);
  const pData = prices[ticker];
  const priceVal = pData?.price;
  if (priceVal != null && priceVal > 0) {
    if (["EUR", "GBP", "AUD", "NZD"].includes(symbol)) {
      return priceVal;
    }
    return 1.0 / priceVal;
  }
  if (symbol === "THB") return 1.0 / (exchangeRate || 35.0);
  return 1.0;
};

export function getRealizedPnL(lots, isThai, exchangeRate) {
  if (!lots || !lots.length) return 0;
  const sortedLots = [...lots].sort((a, b) => {
    const d = new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00"));
    if (d !== 0) return d;
    
    const isABuy = a.qty > 0;
    const isBBuy = b.qty > 0;
    if (isABuy !== isBBuy) return isABuy ? -1 : 1;

    const orderA = a.orderId || a.order_id || "";
    const orderB = b.orderId || b.order_id || "";
    return orderA.localeCompare(orderB);
  });
  let realized = 0;
  const buyLots = [];
  for (const lot of sortedLots) {
    const lotQty = lot.qty;
    let lotPrice = lot.price || 0;
    if (isThai && exchangeRate) {
      lotPrice = lotPrice / exchangeRate;
    }
    if (lotQty > 0) {
      buyLots.push({ qty: lotQty, price: lotPrice });
    } else if (lotQty < 0) {
      let remSell = Math.abs(lotQty);
      let costOfSharesSold = 0;
      while (remSell > 0 && buyLots.length > 0) {
        const oldest = buyLots[0];
        if (oldest.qty <= remSell) {
          costOfSharesSold += oldest.qty * oldest.price;
          remSell -= oldest.qty;
          buyLots.shift();
        } else {
          costOfSharesSold += remSell * oldest.price;
          oldest.qty -= remSell;
          remSell = 0;
        }
      }
      const sellValue = Math.abs(lotQty) * lotPrice;
      realized += (sellValue - costOfSharesSold);
    }
  }
  return realized;
}

export function calculatePortfolioHistoryCost(interpolated, assets, prices, exchangeRate) {
  if (!interpolated || interpolated.length < 2) return interpolated;

  const assetLotsWithMappedIdx = assets.map(asset => {
    const isThai = asset.symbol.toUpperCase().endsWith(".BK");
    const isCashAsset = asset.type === "fiat" || asset.category === "fiat";
    
    const rawLots = asset.lots && asset.lots.length > 0
      ? asset.lots
      : [{ id: "virtual", date: "1970-01-01", time: "00:00", qty: asset.qty, price: (asset.avgCost ?? asset.avgPrice ?? 0) }];
      
    const mappedLots = rawLots.map(lot => {
      if (!lot || !lot.date) return null;
      const lotTime = new Date(lot.date + "T" + (lot.time || "00:00") + ":00.000Z").getTime();
      
      let bestIdx = 0;
      let bestDiff = Infinity;
      interpolated.forEach((d, idx) => {
        const dTime = new Date(d.date).getTime();
        const diff = Math.abs(dTime - lotTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = idx;
        }
      });
      
      return { ...lot, mappedIdx: bestIdx };
    }).filter(Boolean);
    
    return { ...asset, lots: mappedLots, isThai, isCashAsset };
  });

  return interpolated.map((d, idx) => {
    let totalCostUSD = 0;
    let hasPurchasedAny = false;

    assetLotsWithMappedIdx.forEach(asset => {
      const lotsBeforeOrOn = asset.lots.filter(lot => lot.mappedIdx <= idx);
      if (lotsBeforeOrOn.length === 0) return;
      
      hasPurchasedAny = true;

      const costUSD = lotsBeforeOrOn.reduce((sum, l) => {
        let priceUSD = asset.isThai ? (l.price || 0) / exchangeRate : (l.price || 0);
        if (asset.isCashAsset) {
          if (asset.symbol === "USD") {
            priceUSD = 1.0;
          } else {
            priceUSD = l.price || getCurrencyPriceUSD(asset.symbol, prices, exchangeRate);
          }
        }
        return sum + (l.qty || 0) * priceUSD;
      }, 0);

      totalCostUSD += costUSD;
    });

    return { ...d, cost: (hasPurchasedAny && totalCostUSD) ? totalCostUSD : null };
  });
}

export function getHistoricalExchangeRate(dateStr, historicalRates, exchangeRate) {
  if (!dateStr) return exchangeRate;
  const targetDate = dateStr.split("T")[0];
  if (historicalRates && historicalRates[targetDate]) {
    return historicalRates[targetDate];
  }
  const dates = Object.keys(historicalRates || {}).sort();
  if (dates.length === 0) return exchangeRate;
  let bestRate = exchangeRate;
  for (const d of dates) {
    if (d <= targetDate) {
      bestRate = historicalRates[d];
    } else {
      break;
    }
  }
  return bestRate;
}

export function getRealizedPnLInTHB(lots, isThai, historicalRates, exchangeRate) {
  if (!lots || !lots.length) return 0;
  const sortedLots = [...lots].sort((a, b) => {
    const d = new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00"));
    if (d !== 0) return d;
    
    const isABuy = a.qty > 0;
    const isBBuy = b.qty > 0;
    if (isABuy !== isBBuy) return isABuy ? -1 : 1;

    const orderA = a.orderId || a.order_id || "";
    const orderB = b.orderId || b.order_id || "";
    return orderA.localeCompare(orderB);
  });
  let realizedTHB = 0;
  const buyLots = [];
  for (const lot of sortedLots) {
    const lotQty = lot.qty;
    let lotPriceUSD = lot.price || 0;
    const txRate = getHistoricalExchangeRate(lot.date, historicalRates, exchangeRate);
    if (isThai && txRate) {
      lotPriceUSD = lotPriceUSD / txRate;
    }
    if (lotQty > 0) {
      buyLots.push({ qty: lotQty, priceUSD: lotPriceUSD });
    } else if (lotQty < 0) {
      let remSell = Math.abs(lotQty);
      let costOfSharesSoldUSD = 0;
      while (remSell > 0 && buyLots.length > 0) {
        const oldest = buyLots[0];
        if (oldest.qty <= remSell) {
          costOfSharesSoldUSD += oldest.qty * oldest.priceUSD;
          remSell -= oldest.qty;
          buyLots.shift();
        } else {
          costOfSharesSoldUSD += remSell * oldest.priceUSD;
          oldest.qty -= remSell;
          remSell = 0;
        }
      }
      const sellValueUSD = Math.abs(lotQty) * lotPriceUSD;
      const gainUSD = sellValueUSD - costOfSharesSoldUSD;
      const gainTHB = gainUSD * txRate;
      realizedTHB += gainTHB;
    }
  }
  return realizedTHB;
}

export function computeSingleAssetData(asset, prices, exchangeRate) {
  const isThai = asset.symbol.endsWith(".BK");
  const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

  if (isCashAsset) {
    const price = 1.0;
    const priceUSD = getCurrencyPriceUSD(asset.symbol, prices, exchangeRate);
    const valueUSD = priceUSD * asset.qty;
    const valueTHB = valueUSD * exchangeRate;
    const avgCost = asset.avgCost ?? asset.avgPrice ?? priceUSD;
    const costUSD = avgCost * asset.qty;
    const gainUSD = valueUSD - costUSD;
    const gainPct = costUSD > 0 ? (gainUSD / costUSD) * 100 : 0;

    let todayChg = 0, todayPct = 0;
    if (asset.symbol !== "USD") {
      const ticker = getCurrencyTicker(asset.symbol);
      const pData = prices[ticker];
      if (pData) {
        const prevPriceVal = pData.prevClose || pData.price;
        if (prevPriceVal > 0) {
          const prevPriceUSD = ["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol) ? prevPriceVal : 1.0 / prevPriceVal;
          todayChg = (priceUSD - prevPriceUSD) * asset.qty;
          todayPct = prevPriceUSD > 0 ? ((priceUSD - prevPriceUSD) / prevPriceUSD) * 100 : 0;
        }
      }
    }

    return {
      price, priceUSD, valueUSD, valueTHB, costUSD, gainUSD, gainPct, todayChg, todayPct,
      extPrice: null, extChangePct: null, extType: null
    };
  }

  const pData = prices[asset.symbol];
  const regPrice = pData?.price ?? 0;
  const isPre = pData?.marketState === "PRE" || pData?.marketState === "PREPRE";
  const isPost = pData?.marketState === "POST" || pData?.marketState === "POSTPOST";
  const isClosed = pData?.marketState === "CLOSED";

  let extPrice = null, extChangePct = null, extType = null;
  if (isPre && pData.prePrice != null && pData.prePrice > 0) {
    extPrice = pData.prePrice;
    extChangePct = regPrice > 0 ? ((pData.prePrice - regPrice) / regPrice) * 100 : 0;
    extType = "Pre";
  } else if ((isPost || isClosed) && pData.postPrice != null && pData.postPrice > 0) {
    extPrice = pData.postPrice;
    extChangePct = regPrice > 0 ? ((pData.postPrice - regPrice) / regPrice) * 100 : 0;
    extType = "After";
  }

  const price = extPrice ?? regPrice;
  const priceUSD = isThai ? price / exchangeRate : price;
  const valueUSD = priceUSD * asset.qty;
  const valueTHB = valueUSD * exchangeRate;
  const avgCost = asset.avgCost ?? asset.avgPrice ?? 0;
  const costUSD = avgCost * asset.qty;
  const gainUSD = valueUSD - costUSD;
  const gainPct = costUSD > 0 ? (gainUSD / costUSD) * 100 : 0;

  const activePrice = price;
  const prevClose = pData?.prevClose ?? activePrice;
  const todayChg = ((activePrice - prevClose) * asset.qty);
  const todayPct = (prevClose > 0 ? ((activePrice - prevClose) / prevClose) * 100 : 0);

  const regPriceUSD = isThai ? regPrice / exchangeRate : regPrice;
  const regValueUSD = regPriceUSD * asset.qty;
  const regValueTHB = regValueUSD * exchangeRate;
  const regGainUSD = regValueUSD - costUSD;
  const regGainPct = costUSD > 0 ? (regGainUSD / costUSD) * 100 : 0;
  const regTodayChg = pData?.change ? (isThai ? pData.change / exchangeRate : pData.change) * asset.qty : 0;
  const regTodayPct = pData?.changePercent ?? 0;

  let extPriceUSD = null, extValueUSD = null, extValueTHB = null, extGainUSD = null, extGainPct = null, extTodayPct = null;
  if (extPrice != null) {
    extPriceUSD = isThai ? extPrice / exchangeRate : extPrice;
    extValueUSD = extPriceUSD * asset.qty;
    extValueTHB = extValueUSD * exchangeRate;
    extGainUSD = extValueUSD - costUSD;
    extGainPct = costUSD > 0 ? (extGainUSD / costUSD) * 100 : 0;
    extTodayPct = extChangePct ?? 0;
  }

  return {
    price, priceUSD, valueUSD, valueTHB, costUSD, gainUSD, gainPct, todayChg, todayPct,
    extPrice, extChangePct, extType,
    regPrice, regPriceUSD, regValueUSD, regValueTHB, regGainUSD, regGainPct, regTodayChg, regTodayPct,
    extPriceUSD, extValueUSD, extValueTHB, extGainUSD, extGainPct, extTodayPct,
    beta: pData?.beta || null
  };
}
