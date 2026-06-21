import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrencyTicker } from "../utils/assetHelpers";
import { generateMockPrices, generateMockSparklines, generateMockHistoricalRates } from "../utils/mockDataHelpers";

export function usePortfolioPrices({ user, chartRange, showToast }) {
  const [prices, setPrices] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [exchangeRate, setExchangeRate] = useState(35.0);
  const [historicalRates, setHistoricalRates] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [sparklineLoading, setSparklineLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [priceFlash, setPriceFlash] = useState({});

  const prevPricesRef = useRef({});

  const fetchPrices = useCallback(async (portfolioAssets, isManual = false) => {
    setRefreshing(true);
    try {
      const portfolioSymbols = portfolioAssets
        .filter(a => a.qty > 0.00001 || a.type === "fiat" || a.category === "fiat")
        .map(a => (a.type === "fiat" || a.category === "fiat") ? (a.symbol === "USD" ? null : getCurrencyTicker(a.symbol)) : a.symbol)
        .filter(Boolean);
      
      const fixedTapeSymbols = ["^GSPC", "^NDX", "^RUT", "^SET.BK", "THB=X", "BTC-USD", "GC=F", "CL=F"];
      const symbols = [...new Set([...portfolioSymbols, ...fixedTapeSymbols])].join(",");

      if (!symbols) {
        setPrices({});
        return;
      }

      let res = null;
      try {
        const url = `/api/prices?symbols=${encodeURIComponent(symbols)}${isManual ? "&nocache=true" : ""}`;
        res = await fetch(url);
      } catch (err) {
        console.warn("fetchPrices API offline:", err.message);
      }

      if (res && res.ok) {
        const data = await res.json();
        const newPrices = data.quotes || {};
        const flash = {};
        Object.keys(newPrices).forEach(sym => {
          const prev = prevPricesRef.current[sym]?.price;
          const curr = newPrices[sym]?.price;
          if (prev != null && curr != null && curr !== prev) flash[sym] = curr > prev ? "up" : "down";
        });
        if (Object.keys(flash).length > 0) {
          setPriceFlash(flash);
          setTimeout(() => setPriceFlash({}), 1600);
        }
        prevPricesRef.current = newPrices;
        setPrices(newPrices);
        if (data.exchangeRate) setExchangeRate(data.exchangeRate);
      } else {
        const fallback = generateMockPrices(symbols, portfolioAssets, prevPricesRef.current, exchangeRate);
        setPriceFlash({});
        prevPricesRef.current = fallback.prices;
        setPrices(fallback.prices);
        setExchangeRate(fallback.exchangeRate);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, [exchangeRate]);

  const fetchSparklines = useCallback(async (portfolioAssets, range) => {
    if (!portfolioAssets.length) return;
    setSparklineLoading(true);
    try {
      const syms = [...new Set(
        portfolioAssets
          .filter(a => a.qty > 0.00001 || a.type === "fiat" || a.category === "fiat")
          .map(a => (a.type === "fiat" || a.category === "fiat") ? (a.symbol === "USD" ? null : getCurrencyTicker(a.symbol)) : a.symbol)
          .filter(Boolean)
      )];
      let earliestDate = null;
      portfolioAssets.forEach(asset => {
        (asset.lots || []).forEach(lot => {
          if (lot && lot.date && lot.date !== "1970-01-01" && (!earliestDate || lot.date < earliestDate)) earliestDate = lot.date;
        });
      });

      let optimalRange = range;
      if (earliestDate) {
        const ageInDays = (Date.now() - new Date(earliestDate + "T00:00:00.000Z").getTime()) / 86400000;
        const rangeDurationDays = { "1D": 1, "1W": 7, "1M": 30, "3M": 90, "6M": 180, "YTD": 365, "1Y": 365, "5Y": 1825, "MAX": Infinity };
        const rangesOrder = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];
        let matchedRange = "1D";
        for (const r of rangesOrder) {
          matchedRange = r;
          if (rangeDurationDays[r] >= ageInDays) break;
        }
        if (rangesOrder.indexOf(matchedRange) < rangesOrder.indexOf(range)) optimalRange = matchedRange;
      }

      let res = null;
      try {
        res = await fetch(`/api/prices?sparkline=${encodeURIComponent(syms.join(","))}&tf=${optimalRange}`);
      } catch (err) {
        console.warn("fetchSparklines offline:", err.message);
      }

      if (res && res.ok) {
        setSparklines(await res.json());
      } else {
        setSparklines(generateMockSparklines(syms, portfolioAssets, optimalRange));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSparklineLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchHistoricalRates = async () => {
      let res = null;
      try {
        res = await fetch("/api/prices?history=THB=X&tf=MAX");
      } catch (err) {
        console.warn("fetchHistoricalRates API offline:", err.message);
      }
      if (res && res.ok) {
        const data = await res.json();
        const rates = {};
        if (data.candles) {
          data.candles.forEach(c => {
            if (c.date && c.close) rates[c.date.split("T")[0]] = c.close;
          });
        }
        setHistoricalRates(rates);
      } else {
        setHistoricalRates(generateMockHistoricalRates());
      }
    };
    fetchHistoricalRates();
  }, [user.username]);

  return {
    prices,
    setPrices,
    sparklines,
    setSparklines,
    exchangeRate,
    setExchangeRate,
    historicalRates,
    setHistoricalRates,
    refreshing,
    sparklineLoading,
    autoRefresh,
    setAutoRefresh,
    priceFlash,
    fetchPrices,
    fetchSparklines
  };
}
