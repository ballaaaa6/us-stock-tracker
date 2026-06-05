import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../services/api";
import { getCurrencyTicker } from "../utils/assetHelpers";

/**
 * Custom hook to handle live price updates, exchange rates, and historical data.
 * @param {Object} params
 * @param {Object} params.user
 * @param {Function} params.showToast
 * @param {Object} params.assetsRef - Ref referencing the current assets state, for auto-refresh calls.
 * @returns {Object} Prices state and fetching actions.
 */
export function usePrices({ user, showToast: _showToast, assetsRef }) {
  const [prices, setPrices] = useState({});
  const [sparklines, setSparklines] = useState({});
  const [exchangeRate, setExchangeRate] = useState(35.0);
  const [historicalRates, setHistoricalRates] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [sparklineLoading, setSparklineLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [priceFlash, setPriceFlash] = useState({});

  const prevPricesRef = useRef({});

  const getHistoricalRate = useCallback(
    (dateStr) => {
      if (!dateStr) return exchangeRate;
      const targetDate = dateStr.split("T")[0];
      if (historicalRates[targetDate]) {
        return historicalRates[targetDate];
      }
      const dates = Object.keys(historicalRates).sort();
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
    },
    [historicalRates, exchangeRate]
  );

  const getRealizedPnLInTHB = useCallback(
    (lots, isThai) => {
      if (!lots || !lots.length) return 0;
      const sortedLots = [...lots].sort((a, b) => new Date(a.date) - new Date(b.date));
      let realizedTHB = 0;
      let currentQty = 0;
      let currentAvgCostUSD = 0;
      for (const lot of sortedLots) {
        const lotQty = lot.qty;
        let lotPriceUSD = lot.price || 0;
        const txRate = getHistoricalRate(lot.date);
        if (isThai && txRate) {
          lotPriceUSD = lotPriceUSD / txRate;
        }
        if (lotQty > 0) {
          const newQty = currentQty + lotQty;
          const newCost = currentQty * currentAvgCostUSD + lotQty * lotPriceUSD;
          currentAvgCostUSD = newQty > 0 ? newCost / newQty : 0;
          currentQty = newQty;
        } else if (lotQty < 0) {
          const sellQty = Math.abs(lotQty);
          const gainUSD = (lotPriceUSD - currentAvgCostUSD) * sellQty;
          const gainTHB = gainUSD * txRate;
          realizedTHB += gainTHB;
          currentQty = Math.max(0, currentQty - sellQty);
        }
      }
      return realizedTHB;
    },
    [getHistoricalRate]
  );

  const fetchPrices = useCallback(async (portfolioAssets) => {
    setRefreshing(true);
    try {
      const symbols = portfolioAssets
        .map((a) => {
          const isCashAsset = a.type === "fiat" || a.category === "fiat";
          if (isCashAsset) {
            if (a.symbol === "USD") return null;
            return getCurrencyTicker(a.symbol);
          }
          return a.symbol;
        })
        .filter(Boolean)
        .join(",");

      if (!symbols) {
        setPrices({});
        setRefreshing(false);
        return;
      }

      let data = null;
      try {
        data = await api.prices.getForSymbols(symbols);
      } catch (apiErr) {
        console.warn("fetchPrices API network error, falling back to mock:", apiErr.message);
      }

      if (data) {
        const newPrices = data.quotes || {};

        // Detect price changes for flash animation
        const flash = {};
        Object.keys(newPrices).forEach((sym) => {
          const prev = prevPricesRef.current[sym]?.price;
          const curr = newPrices[sym]?.price;
          if (prev != null && curr != null && curr !== prev) {
            flash[sym] = curr > prev ? "up" : "down";
          }
        });
        if (Object.keys(flash).length > 0) {
          setPriceFlash(flash);
          setTimeout(() => setPriceFlash({}), 1600);
        }

        prevPricesRef.current = newPrices;
        setPrices(newPrices);
        if (data.exchangeRate) setExchangeRate(data.exchangeRate);
      } else {
        const newPrices = { ...prevPricesRef.current };
        const symList = symbols ? symbols.split(",") : [];

        symList.forEach((s) => {
          const cleanSym = s.toUpperCase();
          let basePrice = 100.0;

          const matchAsset = portfolioAssets.find(
            (a) => a.symbol.toUpperCase() === cleanSym || getCurrencyTicker(a.symbol).toUpperCase() === cleanSym
          );
          if (matchAsset) {
            basePrice = matchAsset.avgCost || matchAsset.avgPrice || 100.0;
          }

          const changePercent = (Math.random() - 0.5) * 0.02;
          const lastPrice = prevPricesRef.current[cleanSym]?.price || basePrice;
          const currPrice = lastPrice * (1 + changePercent);

          newPrices[cleanSym] = {
            price: currPrice,
            change: changePercent * 100,
            changesPercentage: changePercent * 100,
            marketState: "REGULAR",
            displayName: cleanSym
          };
        });

        const mockExchangeRate = 35.0 + (Math.random() - 0.5) * 0.2;
        setExchangeRate(mockExchangeRate);

        newPrices["THB=X"] = {
          price: mockExchangeRate,
          change: 0.0,
          changesPercentage: 0.0,
          marketState: "REGULAR",
          displayName: "THB"
        };
        newPrices["USD"] = {
          price: 1.0,
          change: 0,
          changesPercentage: 0,
          marketState: "REGULAR"
        };

        const flash = {};
        Object.keys(newPrices).forEach((sym) => {
          const prev = prevPricesRef.current[sym]?.price;
          const curr = newPrices[sym]?.price;
          if (prev != null && curr != null && curr !== prev) {
            flash[sym] = curr > prev ? "up" : "down";
          }
        });
        if (Object.keys(flash).length > 0) {
          setPriceFlash(flash);
          setTimeout(() => setPriceFlash({}), 1600);
        }

        prevPricesRef.current = newPrices;
        setPrices(newPrices);
      }
    } catch (err) {
      console.error("Price fetch error:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchSparklines = useCallback(async (portfolioAssets, range) => {
    if (!portfolioAssets.length) return;
    setSparklineLoading(true);
    try {
      const syms = [
        ...new Set(
          portfolioAssets
            .map((a) => {
              const isCashAsset = a.type === "fiat" || a.category === "fiat";
              if (isCashAsset) {
                if (a.symbol === "USD") return null;
                return getCurrencyTicker(a.symbol);
              }
              return a.symbol;
            })
            .filter(Boolean)
        )
      ];

      // Calculate optimal timeframe range based on earliest transaction date
      let earliestDate = null;
      portfolioAssets.forEach((asset) => {
        const assetLots = asset.lots && asset.lots.length > 0 ? asset.lots : [];
        assetLots.forEach((lot) => {
          if (lot && lot.date && lot.date !== "1970-01-01") {
            if (!earliestDate || lot.date < earliestDate) {
              earliestDate = lot.date;
            }
          }
        });
      });

      let optimalRange = range;
      if (earliestDate) {
        const earliestTime = new Date(earliestDate + "T00:00:00.000Z").getTime();
        const ageInDays = (Date.now() - earliestTime) / 86400000;

        const rangeDurationDays = {
          "1D": 1,
          "1W": 7,
          "1M": 30,
          "3M": 90,
          "6M": 180,
          YTD: 365,
          "1Y": 365,
          "5Y": 1825,
          MAX: Infinity
        };

        const rangesOrder = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];
        let matchedRange = "1D";
        for (const r of rangesOrder) {
          matchedRange = r;
          if (rangeDurationDays[r] >= ageInDays) {
            break;
          }
        }

        const requestedIdx = rangesOrder.indexOf(range);
        const matchedIdx = rangesOrder.indexOf(matchedRange);
        if (matchedIdx < requestedIdx) {
          optimalRange = matchedRange;
        }
      }

      let data = null;
      try {
        data = await api.prices.getSparkline(syms.join(","), optimalRange);
      } catch (apiErr) {
        console.warn("fetchSparklines API network error, falling back to mock:", apiErr.message);
      }

      if (data) {
        setSparklines(data);
      } else {
        const mockSparklines = {};
        const days =
          {
            "1D": 24,
            "1W": 7,
            "1M": 30,
            "3M": 90,
            "6M": 180,
            YTD: 150,
            "1Y": 252,
            "5Y": 252 * 5,
            MAX: 252 * 5
          }[optimalRange] || 30;

        const nowTime = Date.now();
        const dateInterval =
          {
            "1D": 3600 * 1000,
            "1W": 24 * 3600 * 1000,
            "1M": 24 * 3600 * 1000,
            "3M": 24 * 3600 * 1000,
            "6M": 24 * 3600 * 1000,
            YTD: 24 * 3600 * 1000,
            "1Y": 24 * 3600 * 1000,
            "5Y": 7 * 24 * 3600 * 1000,
            MAX: 7 * 24 * 3600 * 1000
          }[optimalRange] || 24 * 3600 * 1000;

        syms.forEach((sym) => {
          const cleanSym = sym.toUpperCase();
          const dates = [];
          const closes = [];

          let basePrice = 100.0;
          const matchAsset = portfolioAssets.find(
            (a) => a.symbol.toUpperCase() === cleanSym || getCurrencyTicker(a.symbol).toUpperCase() === cleanSym
          );
          if (matchAsset) {
            basePrice = matchAsset.avgCost || matchAsset.avgPrice || 100.0;
          }

          let currentVal = basePrice * 0.9;

          for (let i = days; i >= 0; i--) {
            const timeAt = nowTime - i * dateInterval;
            const dateStr = new Date(timeAt).toISOString();
            const drift = (Math.random() - 0.48) * 0.03;
            currentVal = currentVal * (1 + drift);
            if (currentVal < 0.01) currentVal = 0.01;

            dates.push(dateStr);
            closes.push(currentVal);
          }

          mockSparklines[cleanSym] = { dates, closes };
        });

        const thbCloses = [];
        const thbDates = [];
        let currThb = 35.0;
        for (let i = days; i >= 0; i--) {
          const timeAt = nowTime - i * dateInterval;
          const dateStr = new Date(timeAt).toISOString();
          const drift = (Math.random() - 0.5) * 0.005;
          currThb = currThb * (1 + drift);
          thbDates.push(dateStr);
          thbCloses.push(currThb);
        }
        mockSparklines["THB=X"] = { dates: thbDates, closes: thbCloses };

        setSparklines(mockSparklines);
      }
    } catch (err) {
      console.error("Sparkline fetch error:", err);
    } finally {
      setSparklineLoading(false);
    }
  }, []);

  const fetchHistoricalRates = useCallback(async () => {
    let data = null;
    try {
      data = await api.prices.getHistory("THB=X", "MAX");
    } catch (apiErr) {
      console.warn("fetchHistoricalRates API network error, falling back to mock:", apiErr.message);
    }

    if (data) {
      const rates = {};
      if (data.candles) {
        data.candles.forEach((c) => {
          if (c.date && c.close) {
            const dateKey = c.date.split("T")[0];
            rates[dateKey] = c.close;
          }
        });
      }
      setHistoricalRates(rates);
    } else {
      const rates = {};
      const now = Date.now();
      let currentThb = 35.0;
      for (let i = 0; i < 3650; i++) {
        const timeAt = now - i * 24 * 3600 * 1000;
        const dateKey = new Date(timeAt).toISOString().split("T")[0];
        const drift = (Math.random() - 0.5) * 0.002;
        currentThb = currentThb * (1 + drift);
        if (currentThb < 28) currentThb = 28;
        if (currentThb > 40) currentThb = 40;
        rates[dateKey] = currentThb;
      }
      setHistoricalRates(rates);
    }
  }, []);

  // Fetch historical rates on user mount
  useEffect(() => {
    fetchHistoricalRates();
  }, [user.username, fetchHistoricalRates]);

  // Handle auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => {
      if (assetsRef && assetsRef.current) {
        fetchPrices(assetsRef.current);
      }
    }, 30000);
    return () => clearInterval(iv);
  }, [autoRefresh, fetchPrices, assetsRef]);

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
    setRefreshing,
    sparklineLoading,
    setSparklineLoading,
    autoRefresh,
    setAutoRefresh,
    priceFlash,
    setPriceFlash,
    fetchPrices,
    fetchSparklines,
    fetchHistoricalRates,
    getHistoricalRate,
    getRealizedPnLInTHB
  };
}
