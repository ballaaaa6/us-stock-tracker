import { useState, useEffect } from "react";
import { api } from "../services/api";
import { getCurrencyTicker } from "../utils/assetHelpers";

/**
 * Custom hook to handle chart data fetching for AssetDetailPanel.
 * @param {Object} asset
 * @param {boolean} isCashAsset
 * @returns {Object} Chart data, loading state, error, tf, and setTf.
 */
export function useAssetChartData(asset, isCashAsset) {
  const [tf, setTf] = useState("1D");
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!asset?.symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChartData(null);

    // Only USD uses completely flat mock data! Other currencies fetch actual rates.
    const isUSDOnly = asset.symbol === "USD";
    if (isUSDOnly) {
      const priceVal = 1.0;
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const mockData = {
        symbol: asset.symbol,
        tf: tf,
        interval: "1d",
        currency: asset.symbol,
        regularMarketPrice: priceVal,
        candles: [
          {
            ts: Math.floor(thirtyDaysAgo.getTime() / 1000),
            date: thirtyDaysAgo.toISOString(),
            open: priceVal,
            high: priceVal,
            low: priceVal,
            close: priceVal,
            volume: 0
          },
          {
            ts: Math.floor(now.getTime() / 1000),
            date: now.toISOString(),
            open: priceVal,
            high: priceVal,
            low: priceVal,
            close: priceVal,
            volume: 0
          }
        ]
      };
      setChartData(mockData);
      setLoading(false);
      return;
    }

    const targetSymbol = isCashAsset ? getCurrencyTicker(asset.symbol) : asset.symbol;

    let fetchTf = tf;
    if (tf === "ตั้งแต่ซื้อ") {
      const sortedLots =
        asset?.lots && asset.lots.length > 0 ? [...asset.lots].sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
      if (sortedLots.length > 0) {
        const firstPurchaseDate = new Date(sortedLots[0].date + "T00:00:00.000Z");
        const today = new Date();
        const diffDays = Math.ceil((today - firstPurchaseDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) fetchTf = "5D";
        else if (diffDays <= 30) fetchTf = "1M";
        else if (diffDays <= 180) fetchTf = "6M";
        else if (diffDays <= 365) fetchTf = "1Y";
        else if (diffDays <= 730) fetchTf = "2Y";
        else if (diffDays <= 1825) fetchTf = "5Y";
        else fetchTf = "MAX";
      } else {
        fetchTf = "MAX";
      }
    }

    api.prices
      .getHistory(targetSymbol, fetchTf)
      .then((data) => {
        if (cancelled) return;
        setChartData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset?.symbol, tf, isCashAsset, asset?.lots]);

  return {
    tf,
    setTf,
    chartData,
    loading,
    error
  };
}
