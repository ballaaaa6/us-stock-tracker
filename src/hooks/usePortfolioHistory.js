import { useState, useEffect } from "react";
import { getCurrencyTicker, getCurrencyPriceUSD } from "../utils/assetHelpers";

/**
 * Custom hook to compute historical net worth series.
 * @param {Object} params
 * @param {Array} params.assets
 * @param {Object} params.prices
 * @param {Object} params.sparklines
 * @param {number} params.exchangeRate
 * @param {string} params.chartRange
 * @returns {Array} List of timeline coordinate objects.
 */
export function usePortfolioHistory({ assets, prices, sparklines, exchangeRate, chartRange }) {
  const [portfolioHistory, setPortfolioHistory] = useState([]);

  useEffect(() => {
    if (!Object.keys(sparklines).length || !assets.length) {
      setPortfolioHistory([]);
      return;
    }

    const isShortTF = chartRange === "1D" || chartRange === "5D" || chartRange === "1W";

    const symbolPriceHistories = {};
    Object.keys(sparklines).forEach((sym) => {
      const symData = sparklines[sym];
      if (symData && symData.dates && symData.dates.length > 0) {
        const points = symData.dates
          .map((d, idx) => ({
            dateStr: isShortTF ? d : d.split("T")[0],
            price: symData.closes[idx]
          }))
          .filter((p) => p.price != null && p.price > 0);
        points.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        symbolPriceHistories[sym.toUpperCase()] = points;
      }
    });

    const getPriceOnDate = (sym, targetDateStr) => {
      const points = symbolPriceHistories[sym.toUpperCase()];
      const todayStr = new Date().toISOString().split("T")[0];
      if (!isShortTF && targetDateStr.startsWith(todayStr)) {
        const livePrice = prices[sym.toUpperCase()]?.price;
        if (livePrice != null && livePrice > 0) {
          return livePrice;
        }
      }

      if (points && points.length > 0) {
        for (let i = points.length - 1; i >= 0; i--) {
          if (points[i].dateStr <= targetDateStr) {
            return points[i].price;
          }
        }
        return points[0].price;
      }

      const livePrice = prices[sym.toUpperCase()]?.price;
      if (livePrice != null && livePrice > 0) {
        return livePrice;
      }

      const asset = assets.find((a) => a.symbol.toUpperCase() === sym.toUpperCase());
      if (asset) {
        const avg = asset.avgCost ?? asset.avgPrice ?? 0;
        if (avg > 0) return avg;
      }
      return null;
    };

    const allDatesSet = new Set();
    Object.keys(sparklines).forEach((sym) => {
      const symData = sparklines[sym];
      if (symData && symData.dates) {
        symData.dates.forEach((d) => {
          if (d) {
            if (isShortTF) {
              allDatesSet.add(d);
            } else {
              allDatesSet.add(d.split("T")[0]);
            }
          }
        });
      }
    });

    if (allDatesSet.size === 0) {
      setPortfolioHistory([]);
      return;
    }

    if (isShortTF) {
      allDatesSet.add(new Date().toISOString());
    } else {
      allDatesSet.add(new Date().toISOString().split("T")[0]);
    }

    let timeline = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));

    let earliestDate = null;
    assets.forEach((asset) => {
      const assetLots = asset.lots && asset.lots.length > 0 ? asset.lots : [];
      assetLots.forEach((lot) => {
        if (lot && lot.date && lot.date !== "1970-01-01") {
          if (!earliestDate || lot.date < earliestDate) {
            earliestDate = lot.date;
          }
        }
      });
    });

    let rawStartDateStr = null;
    Object.keys(sparklines).forEach((sym) => {
      const symData = sparklines[sym];
      if (symData && symData.dates && symData.dates.length > 0) {
        const firstDate = symData.dates[0];
        if (firstDate) {
          const dStr = firstDate.split("T")[0];
          if (!rawStartDateStr || dStr < rawStartDateStr) {
            rawStartDateStr = dStr;
          }
        }
      }
    });

    if (earliestDate) {
      const earliestStr = earliestDate.split("T")[0];
      if (rawStartDateStr && earliestStr > rawStartDateStr) {
        timeline = timeline.filter((d) => {
          const dStr = isShortTF ? d.split("T")[0] : d;
          return dStr >= earliestStr;
        });

        const firstTimelineDate = timeline[0] ? (isShortTF ? timeline[0].split("T")[0] : timeline[0]) : "";
        if (timeline.length > 0 && firstTimelineDate > earliestStr) {
          timeline.unshift(isShortTF ? earliestStr + "T00:00:00.000Z" : earliestStr);
        } else if (timeline.length === 0) {
          timeline.push(isShortTF ? earliestStr + "T00:00:00.000Z" : earliestStr);
        }
      }
    }

    const assetLotsWithMappedIdx = assets.map((asset) => {
      const isThai = asset.symbol.toUpperCase().endsWith(".BK");
      const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

      const rawLots =
        asset.lots && asset.lots.length > 0
          ? asset.lots
          : [
              {
                id: "virtual",
                date: "1970-01-01",
                time: "00:00",
                qty: asset.qty,
                price: asset.avgCost ?? asset.avgPrice ?? 0
              }
            ];

      const mappedLots = rawLots
        .map((lot) => {
          if (!lot || !lot.date) return null;
          const lotTime = new Date(lot.date + "T" + (lot.time || "00:00") + ":00.000Z").getTime();

          let bestIdx = 0;
          let bestDiff = Infinity;
          timeline.forEach((tStr, idx) => {
            const tTime = new Date(tStr.includes("T") ? tStr : tStr + "T00:00:00.000Z").getTime();
            const diff = Math.abs(tTime - lotTime);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = idx;
            }
          });

          return { ...lot, mappedIdx: bestIdx };
        })
        .filter(Boolean);

      return {
        ...asset,
        lots: mappedLots,
        isThai,
        isCashAsset
      };
    });

    let history = timeline.map((date, idx) => {
      let totalUSD = 0;
      let totalCostUSD = 0;

      assetLotsWithMappedIdx.forEach((asset) => {
        const lotsBeforeOrOnDate = asset.lots.filter((lot) => lot.mappedIdx <= idx);
        if (lotsBeforeOrOnDate.length === 0) return;

        const qtyOnDate = lotsBeforeOrOnDate.reduce((sum, l) => sum + (l.qty || 0), 0);

        const costOnDateUSD = lotsBeforeOrOnDate.reduce((sum, l) => {
          let priceUSD = asset.isThai ? (l.price || 0) / exchangeRate : l.price || 0;
          if (asset.isCashAsset) {
            if (asset.symbol === "USD") {
              priceUSD = 1.0;
            } else {
              priceUSD = l.price || getCurrencyPriceUSD(asset.symbol, prices, exchangeRate);
            }
          }
          return sum + (l.qty || 0) * priceUSD;
        }, 0);

        if (asset.isCashAsset) {
          let priceUSD = 0;
          if (asset.symbol === "USD") {
            priceUSD = 1.0;
          } else {
            const ticker = getCurrencyTicker(asset.symbol);
            const priceVal = getPriceOnDate(ticker, date);
            if (priceVal != null && priceVal > 0) {
              if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
                priceUSD = priceVal;
              } else {
                priceUSD = 1.0 / priceVal;
              }
            } else {
              priceUSD = asset.symbol === "THB" ? 1.0 / (exchangeRate || 35.0) : 1.0;
            }
          }

          const valueUSD = priceUSD * qtyOnDate;
          totalUSD += valueUSD;
          totalCostUSD += costOnDateUSD;
          return;
        }

        const price = getPriceOnDate(asset.symbol, date);
        let priceUSD = 0;
        if (price != null && price > 0) {
          priceUSD = asset.isThai ? price / exchangeRate : price;
        } else {
          const livePrice = prices[asset.symbol.toUpperCase()]?.price;
          if (livePrice != null && livePrice > 0) {
            priceUSD = asset.isThai ? livePrice / exchangeRate : livePrice;
          } else {
            priceUSD = qtyOnDate > 0 ? costOnDateUSD / qtyOnDate : 0;
          }
        }
        const valueUSD = priceUSD * qtyOnDate;
        totalUSD += valueUSD;
        totalCostUSD += costOnDateUSD;
      });

      const dateIso = date.includes("T") ? date : date + "T00:00:00.000Z";
      return { date: dateIso, value: totalUSD, cost: totalCostUSD };
    });

    history = history.filter((d) => d.value > 0);

    if (history.length === 1) {
      const singlePoint = history[0];
      const prevDate = new Date(new Date(singlePoint.date) - 86400000).toISOString();
      history.unshift({ date: prevDate, value: singlePoint.value, cost: singlePoint.cost });
    }

    setPortfolioHistory(history);
  }, [sparklines, assets, prices, exchangeRate, chartRange]);

  return { portfolioHistory };
}
