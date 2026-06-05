/**
 * Static mappings and naming helpers for assets, stocks, fiat, gold, and crypto.
 */

export const ASSET_NAME_MAP = {
  MU: "Micron Technology, Inc.",
  AAPL: "Apple Inc.",
  TSLA: "Tesla, Inc.",
  NVDA: "NVIDIA Corporation",
  MSFT: "Microsoft Corporation",
  AMZN: "Amazon.com, Inc.",
  GOOGL: "Alphabet Inc.",
  GOOG: "Alphabet Inc.",
  META: "Meta Platforms, Inc.",
  NFLX: "Netflix, Inc.",
  AMD: "Advanced Micro Devices, Inc.",
  INTC: "Intel Corporation",
  BABA: "Alibaba Group Holding Limited",
  ASML: "ASML Holding N.V.",
  TSM: "Taiwan Semiconductor Manufacturing Company, Limited",
  DIS: "The Walt Disney Company",
  NKE: "NIKE, Inc.",
  JPM: "JPMorgan Chase & Co.",
  V: "Visa Inc.",
  MA: "Mastercard Incorporated",
  WMT: "Walmart Inc.",
  PG: "The Procter & Gamble Company",
  KO: "The Coca-Cola Company",
  PEP: "PepsiCo, Inc.",
  COST: "Costco Wholesale Corporation",
  AVGO: "Broadcom Inc.",
  QCOM: "Qualcomm Incorporated",
  TXN: "Texas Instruments Incorporated",
  ADBE: "Adobe Inc.",
  CRM: "Salesforce, Inc.",
  ORCL: "Oracle Corporation",
  ACN: "Accenture plc",
  MCD: "McDonald's Corporation",
  SBUX: "Starbucks Corporation",
  CAT: "Caterpillar Inc.",
  GE: "General Electric Company",
  F: "Ford Motor Company",
  GM: "General Motors Company",
  XOM: "Exxon Mobil Corporation",
  CVX: "Chevron Corporation",
  "GC=F": "Spot Gold (ทองคำตลาดโลก)",
  "CL=F": "Crude Oil (น้ำมันดิบตลาดโลก)",
  OIL: "Crude Oil (น้ำมันดิบตลาดโลก)",
  GOLD: "Spot Gold (ทองคำตลาดโลก)",
  "PTT.BK": "PTT Public Company Limited",
  "CPALL.BK": "CP ALL Public Company Limited",
  "AOT.BK": "Airports of Thailand Public Company Limited",
  "BDMS.BK": "Bangkok Dusit Medical Services Public Company Limited",
  "KBANK.BK": "Kasikornbank Public Company Limited",
  "SCB.BK": "SCB X Public Company Limited",
  "ADVANC.BK": "Advanced Info Service Public Company Limited",
  "GULF.BK": "Gulf Energy Development Public Company Limited",
  "PTTEP.BK": "PTT Exploration and Production Public Company Limited",
  "INTUCH.BK": "Intouch Holdings Public Company Limited",
  BDMS: "Bangkok Dusit Medical Services Public Company Limited",
  KBANK: "Kasikornbank Public Company Limited",
  SCB: "SCB X Public Company Limited",
  THB: "Thai Baht (เงินบาทไทย ฿)",
  USD: "US Dollar (ดอลลาร์สหรัฐ $)",
  EUR: "Euro (ยูโร 🇪🇺)",
  GBP: "British Pound (ปอนด์สหราชอาณาจักร 🇬🇧)",
  JPY: "Japanese Yen (เยนญี่ปุ่น 🇯🇵)",
  SGD: "Singapore Dollar (ดอลลาร์สิงคโปร์ 🇸🇬)",
  HKD: "Hong Kong Dollar (ดอลลาร์ฮ่องกง 🇭🇰)",
  AUD: "Australian Dollar (ดอลลาร์ออสเตรเลีย 🇦🇺)"
};

export const getDisplaySymbol = (symbol) => {
  if (!symbol) return "";
  const parts = symbol.split(".");
  if (parts.length > 1 && parts[parts.length - 1].length <= 3) {
    return parts.slice(0, -1).join(".");
  }
  return symbol;
};

export const getAssetFullName = (symbol, name, category) => {
  const symUpper = (symbol || "").toUpperCase();
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
  const sortedLots = [...lots].sort((a, b) => new Date(a.date) - new Date(b.date));
  let realized = 0;
  let currentQty = 0;
  let currentAvgCost = 0;
  for (const lot of sortedLots) {
    const lotQty = lot.qty;
    let lotPrice = lot.price || 0;
    if (isThai && exchangeRate) {
      lotPrice = lotPrice / exchangeRate;
    }
    if (lotQty > 0) {
      const newQty = currentQty + lotQty;
      const newCost = currentQty * currentAvgCost + lotQty * lotPrice;
      currentAvgCost = newQty > 0 ? newCost / newQty : 0;
      currentQty = newQty;
    } else if (lotQty < 0) {
      const sellQty = Math.abs(lotQty);
      const gain = (lotPrice - currentAvgCost) * sellQty;
      realized += gain;
      currentQty = Math.max(0, currentQty - sellQty);
    }
  }
  return realized;
}
