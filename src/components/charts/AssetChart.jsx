import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { fmtUSD, fmtTHB, fmtPct, fmtQty, getDynamicDateFormat, fmtDateShort } from "../../utils/formatters";
import { smoothPath, stepPath, smoothPoints, interpolateData } from "./chartUtils";

const calculateEMA = (data, period) => {
  if (!data || data.length === 0) return [];
  const k = 2 / (period + 1);
  const emaValues = new Array(data.length);

  let firstValidIdx = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] && data[i].value != null) {
      firstValidIdx = i;
      break;
    }
  }

  if (firstValidIdx === -1) return emaValues;

  emaValues[firstValidIdx] = data[firstValidIdx].value;
  let prevEMA = data[firstValidIdx].value;

  for (let i = firstValidIdx + 1; i < data.length; i++) {
    if (data[i] && data[i].value != null) {
      const currentVal = data[i].value;
      const emaVal = currentVal * k + prevEMA * (1 - k);
      emaValues[i] = emaVal;
      prevEMA = emaVal;
    } else {
      emaValues[i] = null;
    }
  }

  return emaValues;
};

export function AssetChart({ candles, avgCost, lots, tf, isThai, exchangeRate, asset, hideValues, getHistoricalRate }) {
  const isCashAsset = asset?.type === "fiat" || asset?.category === "fiat";
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [dims, setDims] = useState({ w: 600, h: 280 });
  const [zoomRange, setZoomRange] = useState(null); // { start, end }
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [diffStartIdx, setDiffStartIdx] = useState(null);
  const [diffEndIdx, setDiffEndIdx] = useState(null);
  const [isDiffActive, setIsDiffActive] = useState(false);
  const touchRef = useRef({
    lastX: 0,
    lastY: 0,
    type: null,
    startDist: 0,
    startZoom: null,
    isPinching: false,
    centerX: 0
  });
  const lastTouchTime = useRef(0);

  const [showEma10, setShowEma10] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("ema_showEma10");
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [showEma20, setShowEma20] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("ema_showEma20");
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [showEma50, setShowEma50] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("ema_showEma50");
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [showEma200, setShowEma200] = useState(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("ema_showEma200");
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("ema_showEma10", JSON.stringify(showEma10));
    }
  }, [showEma10]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("ema_showEma20", JSON.stringify(showEma20));
    }
  }, [showEma20]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("ema_showEma50", JSON.stringify(showEma50));
    }
  }, [showEma50]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("ema_showEma200", JSON.stringify(showEma200));
    }
  }, [showEma200]);

  const diffStartIdxRef = useRef(null);
  const diffEndIdxRef = useRef(null);

  const updateDiffStartIdx = (val) => {
    setDiffStartIdx(val);
    diffStartIdxRef.current = val;
  };

  const updateDiffEndIdx = (val) => {
    setDiffEndIdx(val);
    diffEndIdxRef.current = val;
  };

  useEffect(() => {
    setZoomRange(null);
  }, [candles, tf]);

  /* Responsive resizing */
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setDims({ w: e.contentRect.width, h: Math.min(300, Math.max(200, e.contentRect.width * 0.42)) });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [candles]);

  const { W, H, PAD_L, PAD_R, PAD_T, PAD_B } = useMemo(() => {
    const isMobile = dims.w < 500;
    return {
      W: dims.w,
      H: dims.h,
      PAD_L: isMobile ? 40 : 58,
      PAD_R: isMobile ? 12 : 24,
      PAD_T: 24,
      PAD_B: 40
    };
  }, [dims]);

  const iW = W - PAD_L - PAD_R;
  const iH = H - PAD_T - PAD_B;

  const rawDisplayedCandles = useMemo(() => {
    if (!candles) return [];
    if (!zoomRange) return candles;
    return candles.slice(zoomRange.start, zoomRange.end + 1);
  }, [candles, zoomRange]);

  const visibleDurationMs = useMemo(() => {
    if (!rawDisplayedCandles || rawDisplayedCandles.length < 2) return 0;
    const firstTime = new Date(rawDisplayedCandles[0].date).getTime();
    const lastTime = new Date(rawDisplayedCandles[rawDisplayedCandles.length - 1].date).getTime();
    return lastTime - firstTime;
  }, [rawDisplayedCandles]);

  const transactionsByDate = useMemo(() => {
    if (!lots) return {};
    const sortedLots = [...lots].filter((lot) => lot && lot.date).sort((a, b) => new Date(a.date) - new Date(b.date));
    const map = {};
    sortedLots.forEach((lot, i) => {
      const dateStr = lot.date.split("T")[0];
      if (!map[dateStr]) {
        map[dateStr] = [];
      }
      map[dateStr].push({
        num: i + 1,
        type: lot.type || (lot.qty >= 0 ? "BUY" : "SELL"),
        qty: Math.abs(lot.qty),
        price: lot.price,
        date: lot.date,
        time: lot.time
      });
    });
    return map;
  }, [lots]);

  const hasMultipleYears = useMemo(() => {
    if (!rawDisplayedCandles || rawDisplayedCandles.length < 2) return false;
    const firstYear = new Date(rawDisplayedCandles[0].date).getFullYear();
    const lastYear = new Date(rawDisplayedCandles[rawDisplayedCandles.length - 1].date).getFullYear();
    return firstYear !== lastYear;
  }, [rawDisplayedCandles]);

  /* ── Compute Y range: adaptive tight scale with dynamic cost curve ── */
  const {
    pts,
    costPts,
    yMin,
    yMax,
    isUp,
    interpolatedData,
    renderPts,
    ema10Path,
    ema20Path,
    ema50Path,
    ema200Path,
    toY,
    toX
  } = useMemo(() => {
    if (!rawDisplayedCandles || rawDisplayedCandles.length < 2) {
      return {
        pts: [],
        costPts: [],
        yMin: 0,
        yMax: 1,
        isUp: true,
        interpolatedData: [],
        renderPts: [],
        ema10Path: "",
        ema20Path: "",
        ema50Path: "",
        ema200Path: ""
      };
    }

    // Sort lots by date ascending
    const sortedLots =
      lots && lots.length > 0
        ? [...lots].sort((a, b) => new Date(a.date) - new Date(b.date))
        : [{ id: "virtual", date: "1970-01-01", qty: 1, price: avgCost }];

    const isCashAsset = asset?.type === "fiat" || asset?.category === "fiat";

    // A. Create a full price timeline
    const fullPriceData = candles.map((c) => {
      let priceUSD = 0;
      if (isCashAsset) {
        if (asset.symbol === "USD") {
          priceUSD = 1.0;
        } else {
          if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
            priceUSD = c.close;
          } else {
            priceUSD = 1.0 / c.close;
          }
        }
      } else {
        priceUSD = isThai ? c.close / exchangeRate : c.close;
      }
      return { date: c.date, value: priceUSD };
    });

    let ema10Arr = [];
    let ema20Arr = [];
    let ema50Arr = [];
    let ema200Arr = [];

    if (!isCashAsset) {
      ema10Arr = calculateEMA(fullPriceData, 10);
      ema20Arr = calculateEMA(fullPriceData, 20);
      ema50Arr = calculateEMA(fullPriceData, 50);
      ema200Arr = calculateEMA(fullPriceData, 200);
    }

    const fullPriceDataWithEmas = fullPriceData.map((d, i) => ({
      ...d,
      ema10: ema10Arr[i] ?? null,
      ema20: ema20Arr[i] ?? null,
      ema50: ema50Arr[i] ?? null,
      ema200: ema200Arr[i] ?? null
    }));

    // Slice price data to match current zoom viewport
    const rawPriceData = zoomRange
      ? fullPriceDataWithEmas.slice(zoomRange.start, zoomRange.end + 1)
      : fullPriceDataWithEmas;

    // 2. Interpolate priceData dynamically based on visibleDurationMs
    const interpolatedPriceData = interpolateData(rawPriceData, visibleDurationMs);

    // 3. Pre-map each lot in sortedLots to its closest index in interpolatedPriceData
    const lotsWithMappedIdx = sortedLots
      .map((lot) => {
        if (!lot || !lot.date) return null;
        const lotTime = new Date(lot.date + "T" + (lot.time || "00:00") + ":00.000Z").getTime();

        let bestIdx = 0;
        let bestDiff = Infinity;
        interpolatedPriceData.forEach((d, idx) => {
          const dTime = new Date(d.date).getTime();
          const diff = Math.abs(dTime - lotTime);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = idx;
          }
        });
        return {
          ...lot,
          mappedIdx: bestIdx
        };
      })
      .filter(Boolean);

    const firstPurchaseMappedIdx = lotsWithMappedIdx[0]?.mappedIdx ?? 0;

    // Helper to calculate holding stats on a specific index
    const getStatsOnIndex = (idx) => {
      const lotsBeforeOrOn = lotsWithMappedIdx.filter((lot) => lot.mappedIdx <= idx);

      let runningQty = 0;
      let runningAvgCost = 0;

      lotsBeforeOrOn.forEach((lot) => {
        const lotQty = lot.qty || 0;
        const lotPrice = lot.price || 0;

        if (lotQty > 0) {
          const oldCost = runningQty * runningAvgCost;
          const newCost = oldCost + lotQty * lotPrice;
          runningQty += lotQty;
          runningAvgCost = runningQty > 0 ? newCost / runningQty : 0;
        } else if (lotQty < 0) {
          const sellQty = Math.abs(lotQty);
          runningQty = Math.max(0, runningQty - sellQty);
        }
      });

      return { qty: runningQty, cost: runningQty * runningAvgCost, avgCost: runningAvgCost };
    };

    // 4. Generate the final interpolatedData
    const interpolatedData = interpolatedPriceData.map((d, i) => {
      const hasPurchased = i >= firstPurchaseMappedIdx;

      if (!hasPurchased) {
        return {
          date: d.date,
          value: d.value,
          ema10: d.ema10,
          ema20: d.ema20,
          ema50: d.ema50,
          ema200: d.ema200,
          cost: null,
          hasPurchased: false
        };
      }

      const stats = getStatsOnIndex(i);

      let costUSD = 0;
      if (stats.qty > 0) {
        if (isCashAsset) {
          costUSD = stats.avgCost;
        } else {
          costUSD = isThai ? stats.avgCost / exchangeRate : stats.avgCost;
        }
      } else {
        costUSD = isThai ? avgCost / exchangeRate : avgCost;
      }

      return {
        date: d.date,
        value: d.value,
        ema10: d.ema10,
        ema20: d.ema20,
        ema50: d.ema50,
        ema200: d.ema200,
        cost: costUSD,
        hasPurchased: true
      };
    });

    const valuesUSD = interpolatedData.map((d) => d.value).filter((v) => v != null);
    const costsUSD = interpolatedData
      .filter((d) => d.hasPurchased)
      .map((d) => d.cost)
      .filter((c) => c != null);

    if (valuesUSD.length === 0) {
      return {
        pts: [],
        costPts: [],
        yMin: 0,
        yMax: 1,
        isUp: true,
        interpolatedData,
        renderPts: [],
        ema10Path: "",
        ema20Path: "",
        ema50Path: "",
        ema200Path: ""
      };
    }

    const isShortTF = tf === "1D" || tf === "5D" || tf === "1W";

    const activeEmas = [];
    if (!isCashAsset) {
      interpolatedData.forEach((d) => {
        if (showEma10 && d.ema10 != null) activeEmas.push(d.ema10);
        if (showEma20 && d.ema20 != null) activeEmas.push(d.ema20);
        if (showEma50 && d.ema50 != null) activeEmas.push(d.ema50);
        if (showEma200 && d.ema200 != null) activeEmas.push(d.ema200);
      });
    }

    const dataMin = isShortTF
      ? Math.min(...valuesUSD, ...activeEmas)
      : Math.min(...valuesUSD, ...costsUSD, ...activeEmas);
    const dataMax = isShortTF
      ? Math.max(...valuesUSD, ...activeEmas)
      : Math.max(...valuesUSD, ...costsUSD, ...activeEmas);
    const rangeVal = dataMax - dataMin || dataMin * 0.02 || 1;

    const pad = rangeVal * 0.05;
    const yMin = Math.max(0, dataMin - pad);
    const yMax = dataMax + pad;
    const yRange = yMax - yMin;

    const toY = (v) => PAD_T + ((yMax - v) / yRange) * iH;
    const toX = (i) => PAD_L + (i / (interpolatedData.length - 1)) * iW;

    const pts = interpolatedData.map((d, i) => {
      if (d.value == null) return null;
      return { x: toX(i), y: toY(d.value), value: d.value, date: d.date, hasPurchased: d.hasPurchased };
    });

    const costPts = interpolatedData.map((d, i) => {
      if (!d.hasPurchased || d.cost == null) return null;
      return { x: toX(i), y: toY(d.cost), cost: d.cost, date: d.date };
    });

    const renderPts = smoothPoints(pts, toY);

    const ema10Pts = !isCashAsset
      ? interpolatedData.map((d, i) => (d.ema10 != null ? { x: toX(i), y: toY(d.ema10) } : null)).filter(Boolean)
      : [];
    const ema20Pts = !isCashAsset
      ? interpolatedData.map((d, i) => (d.ema20 != null ? { x: toX(i), y: toY(d.ema20) } : null)).filter(Boolean)
      : [];
    const ema50Pts = !isCashAsset
      ? interpolatedData.map((d, i) => (d.ema50 != null ? { x: toX(i), y: toY(d.ema50) } : null)).filter(Boolean)
      : [];
    const ema200Pts = !isCashAsset
      ? interpolatedData.map((d, i) => (d.ema200 != null ? { x: toX(i), y: toY(d.ema200) } : null)).filter(Boolean)
      : [];

    const ema10Path = smoothPath(ema10Pts);
    const ema20Path = smoothPath(ema20Pts);
    const ema50Path = smoothPath(ema50Pts);
    const ema200Path = smoothPath(ema200Pts);

    const isUp = valuesUSD.length >= 2 ? valuesUSD[valuesUSD.length - 1] >= valuesUSD[0] : true;

    return {
      pts,
      costPts,
      yMin,
      yMax,
      isUp,
      toY,
      toX,
      interpolatedData,
      renderPts,
      ema10Path,
      ema20Path,
      ema50Path,
      ema200Path
    };
  }, [
    rawDisplayedCandles,
    visibleDurationMs,
    avgCost,
    lots,
    isThai,
    exchangeRate,
    PAD_T,
    iH,
    PAD_L,
    iW,
    tf,
    asset,
    candles,
    zoomRange,
    showEma10,
    showEma20,
    showEma50,
    showEma200
  ]);

  /* ── Y-axis tick labels ── */
  const yTicks = useMemo(() => {
    if (yMax === yMin) return [];
    const rangeVal = yMax - yMin;
    const rawStep = rangeVal / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const step = Math.ceil(rawStep / magnitude) * magnitude || 10;
    const ticks = [];
    const start = Math.ceil(yMin / step) * step;
    for (let v = start; v <= yMax + step * 0.01; v += step) {
      const y = PAD_T + ((yMax - v) / (yMax - yMin)) * iH;
      if (y >= PAD_T - 4 && y <= H - PAD_B + 4) {
        ticks.push({ v, y });
      }
    }
    return ticks;
  }, [yMin, yMax, PAD_T, iH, H, PAD_B]);

  /* ── X-axis tick labels ── */
  const xTicks = useMemo(() => {
    if (!interpolatedData || interpolatedData.length < 2) return [];
    const isShortTF = tf === "1D" || tf === "5D" || tf === "1W";
    const isMobile = dims.w < 500;
    const maxTicks = isMobile ? (isShortTF ? 3 : 5) : isShortTF ? 8 : 12;
    const count = Math.min(maxTicks, interpolatedData.length);
    const step = Math.floor((interpolatedData.length - 1) / Math.max(count - 1, 1));
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.min(i === count - 1 ? interpolatedData.length - 1 : i * step, interpolatedData.length - 1);
      return { idx, x: PAD_L + (idx / (interpolatedData.length - 1)) * iW, date: interpolatedData[idx].date };
    });
  }, [interpolatedData, PAD_L, iW, tf, dims]);

  const activePts = useMemo(() => renderPts.filter(Boolean), [renderPts]);
  const activeCostPts = useMemo(() => costPts.filter(Boolean), [costPts]);

  const linePath = useMemo(() => smoothPath(activePts), [activePts]);
  const costLinePath = useMemo(() => {
    if (activeCostPts.length === 0) return "";
    if (activeCostPts.length === 1) {
      const pt = activeCostPts[0];
      return `M ${pt.x.toFixed(2)},${pt.y.toFixed(2)} L ${(W - PAD_R).toFixed(2)},${pt.y.toFixed(2)}`;
    }
    return stepPath(activeCostPts);
  }, [activeCostPts, W, PAD_R]);

  // Gain & Loss fill areas
  const fillValueArea = useMemo(() => {
    if (!linePath || activePts.length < 2) return "";
    const first = activePts[0],
      last = activePts[activePts.length - 1];
    const bottomY = H - PAD_B;
    return linePath + ` L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  }, [linePath, activePts, H, PAD_B]);

  const fillCostArea = useMemo(() => {
    if (!costLinePath || activeCostPts.length === 0) return "";
    const first = activeCostPts[0];
    const lastX = activeCostPts.length === 1 ? W - PAD_R : activeCostPts[activeCostPts.length - 1].x;
    const bottomY = H - PAD_B;
    return (
      costLinePath + ` L ${lastX.toFixed(2)},${bottomY.toFixed(2)} L ${first.x.toFixed(2)},${bottomY.toFixed(2)} Z`
    );
  }, [costLinePath, activeCostPts, H, PAD_B, W, PAD_R]);

  // Clipping path definitions using active boundaries
  const clipAboveCostPath = useMemo(() => {
    if (!costLinePath || activeCostPts.length === 0) return "";
    const first = activeCostPts[0];
    const lastX = activeCostPts.length === 1 ? W - PAD_R : activeCostPts[activeCostPts.length - 1].x;
    return costLinePath + ` L ${lastX.toFixed(2)},0 L ${first.x.toFixed(2)},0 Z`;
  }, [costLinePath, activeCostPts, W, PAD_R]);

  const clipBelowCostPath = useMemo(() => {
    if (!costLinePath || activeCostPts.length === 0) return "";
    const first = activeCostPts[0];
    const lastX = activeCostPts.length === 1 ? W - PAD_R : activeCostPts[activeCostPts.length - 1].x;
    const bottomY = H - PAD_B;
    return (
      costLinePath + ` L ${lastX.toFixed(2)},${bottomY.toFixed(2)} L ${first.x.toFixed(2)},${bottomY.toFixed(2)} Z`
    );
  }, [costLinePath, activeCostPts, H, PAD_B, W, PAD_R]);

  const clipAboveValuePath = useMemo(() => {
    if (!linePath || activePts.length < 2) return "";
    const first = activePts[0],
      last = activePts[activePts.length - 1];
    return linePath + ` L ${last.x},0 L ${first.x},0 Z`;
  }, [linePath, activePts]);

  /* ── Lot markers (purchase dates) ── */
  const lotMarkers = useMemo(() => {
    if (!lots || !candles || candles.length < 2 || !interpolatedData || interpolatedData.length < 2) return [];

    const sortedLots = [...lots]
      .filter((lot) => lot && lot.date)
      .sort((a, b) => {
        const tA = new Date(a.date + "T" + (a.time || "00:00") + ":00.000Z").getTime();
        const tB = new Date(b.date + "T" + (b.time || "00:00") + ":00.000Z").getTime();
        return tA - tB;
      });

    const displayStart = new Date(interpolatedData[0].date).getTime();
    const displayEnd = new Date(interpolatedData[interpolatedData.length - 1].date).getTime();

    const rawMarkers = [];
    sortedLots.forEach((lot, i) => {
      const lotTime = new Date(lot.date + "T" + (lot.time || "00:00") + ":00.000Z").getTime();

      if (lotTime < displayStart || lotTime > displayEnd) return;

      let bestDisplayIdx = -1,
        bestDiff = Infinity;
      interpolatedData.forEach((d, idx) => {
        const diff = Math.abs(new Date(d.date).getTime() - lotTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestDisplayIdx = idx;
        }
      });

      if (bestDisplayIdx !== -1) {
        const isBuy = (lot.qty || 0) >= 0;
        const x = PAD_L + (bestDisplayIdx / (interpolatedData.length - 1)) * iW;
        rawMarkers.push({
          x,
          num: i + 1,
          isBuy,
          lot,
          priceUSD: lot.price && isThai ? lot.price / exchangeRate : lot.price
        });
      }
    });

    rawMarkers.sort((a, b) => a.x - b.x);

    const groupedMarkers = [];
    rawMarkers.forEach((m) => {
      if (groupedMarkers.length === 0) {
        groupedMarkers.push({
          xSum: m.x,
          count: 1,
          nums: [m.num],
          buysCount: m.isBuy ? 1 : 0,
          sellsCount: !m.isBuy ? 1 : 0,
          txs: [m]
        });
      } else {
        const lastGroup = groupedMarkers[groupedMarkers.length - 1];
        const avgX = lastGroup.xSum / lastGroup.count;
        if (Math.abs(m.x - avgX) < 18) {
          lastGroup.xSum += m.x;
          lastGroup.count += 1;
          lastGroup.nums.push(m.num);
          if (m.isBuy) lastGroup.buysCount++;
          else lastGroup.sellsCount++;
          lastGroup.txs.push(m);
        } else {
          groupedMarkers.push({
            xSum: m.x,
            count: 1,
            nums: [m.num],
            buysCount: m.isBuy ? 1 : 0,
            sellsCount: !m.isBuy ? 1 : 0,
            txs: [m]
          });
        }
      }
    });

    return groupedMarkers.map((group) => {
      const x = group.xSum / group.count;
      let colorType = "mixed";
      if (group.buysCount > 0 && group.sellsCount === 0) colorType = "buy";
      else if (group.buysCount === 0 && group.sellsCount > 0) colorType = "sell";

      group.nums.sort((a, b) => a - b);
      let isConsecutive = true;
      for (let k = 1; k < group.nums.length; k++) {
        if (group.nums[k] !== group.nums[k - 1] + 1) {
          isConsecutive = false;
          break;
        }
      }
      const label =
        group.nums.length === 1
          ? String(group.nums[0])
          : isConsecutive
            ? `${group.nums[0]}-${group.nums[group.nums.length - 1]}`
            : group.nums.join(",");

      return {
        x,
        colorType,
        label,
        numsCount: group.nums.length,
        txs: group.txs
      };
    });
  }, [lots, candles, interpolatedData, PAD_L, iW, isThai, exchangeRate]);

  const displayedCandles = interpolatedData;

  const findClosestPtByTimestamp = (ts) => {
    if (!pts || pts.length === 0 || ts == null) return null;
    let bestPt = pts[0];
    let bestDiff = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const pt = pts[i];
      if (!pt) continue;
      const ptTime = new Date(pt.date).getTime();
      const diff = Math.abs(ptTime - ts);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPt = pt;
      }
    }
    return bestPt;
  };

  const stateRef = useRef();
  stateRef.current = {
    candles,
    zoomRange,
    displayedCandles,
    W,
    H,
    iW,
    iH,
    PAD_L,
    PAD_R,
    PAD_T,
    PAD_B,
    diffStartIdx,
    diffEndIdx,
    pts,
    costPts,
    isDiffActive
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    if (mouseX >= PAD_L && mouseX <= W - PAD_R) {
      if (e.shiftKey && zoomRange) {
        setDragStart({ x: mouseX, type: "pan", startZoom: { ...zoomRange } });
      } else {
        const relX = (mouseX - PAD_L) / iW;
        const idx = Math.max(
          0,
          Math.min(Math.round(relX * (displayedCandles.length - 1)), displayedCandles.length - 1)
        );
        const ts = new Date(displayedCandles[idx].date).getTime();

        setIsDiffActive(true);
        updateDiffStartIdx(ts);
        updateDiffEndIdx(ts);
        setDragStart({ x: mouseX, type: "diff" });
        setHovered(null);
      }
    }
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!containerRef.current || !pts || pts.length < 2) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseXInSvg = ((e.clientX - rect.left) / rect.width) * W;

      if (dragStart) {
        if (dragStart.type === "diff") {
          const boundedX = Math.max(PAD_L, Math.min(W - PAD_R, mouseXInSvg));
          const relX = (boundedX - PAD_L) / iW;
          const idx = Math.max(
            0,
            Math.min(Math.round(relX * (displayedCandles.length - 1)), displayedCandles.length - 1)
          );
          const ts = new Date(displayedCandles[idx].date).getTime();

          updateDiffEndIdx(ts);
          setHovered(null);
        } else if (dragStart.type === "pan") {
          const deltaX = mouseXInSvg - dragStart.x;
          const len = candles.length;
          const currentStart = dragStart.startZoom.start;
          const currentEnd = dragStart.startZoom.end;
          const rangeSize = currentEnd - currentStart;
          const stepSize = iW / Math.max(1, rangeSize);
          const indexShift = Math.round(-deltaX / stepSize);

          if (indexShift !== 0) {
            let newStart = currentStart + indexShift;
            let newEnd = currentEnd + indexShift;
            if (newStart < 0) {
              newStart = 0;
              newEnd = newStart + rangeSize;
            }
            if (newEnd >= len) {
              newEnd = len - 1;
              newStart = Math.max(0, newEnd - rangeSize);
            }
            setZoomRange({ start: newStart, end: newEnd });
          }
          setHovered(null);
        }
        return;
      }

      if (isDiffActive) return;

      const relX = (mouseXInSvg - PAD_L) / iW;
      const idx = Math.max(0, Math.min(Math.round(relX * (displayedCandles.length - 1)), displayedCandles.length - 1));
      const pt = renderPts[idx];
      if (pt) {
        const costPt = costPts[idx];
        const rawPt = pts[idx];
        setHovered({
          idx,
          x: pt.x,
          y: pt.y,
          costY: costPt ? costPt.y : null,
          value: rawPt?.value || pt.value,
          cost: costPt ? costPt.cost : null,
          date: pt.date,
          hasPurchased: pt.hasPurchased
        });
      }
    },
    [renderPts, pts, costPts, displayedCandles, PAD_L, iW, W, dragStart, zoomRange, candles, isDiffActive]
  );

  const handleMouseUp = () => {
    if (dragStart && dragStart.type === "diff") {
      if (diffStartIdxRef.current === diffEndIdxRef.current) {
        setIsDiffActive(false);
        updateDiffStartIdx(null);
        updateDiffEndIdx(null);
      }
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const handleMouseLeave = () => {
    setHovered(null);
    setDragStart(null);
    setDragEnd(null);
  };

  // Touch handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getLatest = () => stateRef.current;

    const handleWheel = (e) => {
      const { candles, zoomRange, displayedCandles, W, iW, PAD_L } = getLatest();
      if (!candles || candles.length < 2) return;
      e.preventDefault();

      const isZoomIn = e.deltaY < 0;
      const len = candles.length;
      const currentStart = zoomRange ? zoomRange.start : 0;
      const currentEnd = zoomRange ? zoomRange.end : len - 1;
      const rangeSize = currentEnd - currentStart;

      const rect = el.getBoundingClientRect();
      const mouseXInSvg = ((e.clientX - rect.left) / rect.width) * W;
      const relX = (mouseXInSvg - PAD_L) / iW;
      const hoveredIdx = Math.max(
        0,
        Math.min(Math.round(relX * (displayedCandles.length - 1)), displayedCandles.length - 1)
      );

      let centerIdx = currentStart;
      let bestDiff = Infinity;
      candles.forEach((h, i) => {
        const diff = Math.abs(new Date(h.date) - new Date(displayedCandles[hoveredIdx].date));
        if (diff < bestDiff) {
          bestDiff = diff;
          centerIdx = i;
        }
      });

      if (isZoomIn) {
        if (rangeSize <= 2) return;
        const cropSize = Math.max(1, Math.floor(rangeSize * 0.12));
        const newRangeSize = Math.max(2, rangeSize - cropSize * 2);

        let newStart = Math.round(centerIdx - relX * newRangeSize);
        let newEnd = newStart + newRangeSize;

        if (newStart < 0) {
          newStart = 0;
          newEnd = newRangeSize;
        }
        if (newEnd >= len) {
          newEnd = len - 1;
          newStart = Math.max(0, newEnd - newRangeSize);
        }

        setZoomRange({ start: newStart, end: newEnd });
      } else {
        if (!zoomRange) return;
        const expandSize = Math.max(1, Math.floor(rangeSize * 0.12));
        const newRangeSize = Math.min(len - 1, rangeSize + expandSize * 2);

        let newStart = Math.round(centerIdx - relX * newRangeSize);
        let newEnd = newStart + newRangeSize;

        if (newStart < 0) {
          newStart = 0;
          newEnd = newRangeSize;
        }
        if (newEnd >= len) {
          newEnd = len - 1;
          newStart = Math.max(0, newEnd - newRangeSize);
        }

        if (newStart === 0 && newEnd === len - 1) {
          setZoomRange(null);
        } else {
          setZoomRange({ start: newStart, end: newEnd });
        }
      }
    };

    const handleDblClick = (e) => {
      e.preventDefault();
      setZoomRange(null);
    };

    const handleTouchStart = (e) => {
      const { candles, zoomRange, displayedCandles, W, iW, PAD_L, PAD_R } = getLatest();
      if (!candles || candles.length < 2) return;

      if (e.touches.length === 1) {
        const rect = el.getBoundingClientRect();
        const touchX = ((e.touches[0].clientX - rect.left) / rect.width) * W;
        if (touchX >= PAD_L && touchX <= W - PAD_R) {
          const relX = (touchX - PAD_L) / iW;
          const idx = Math.max(
            0,
            Math.min(Math.round(relX * (displayedCandles.length - 1)), displayedCandles.length - 1)
          );

          let originalIdx = zoomRange ? zoomRange.start : 0;
          let bestDiff = Infinity;
          candles.forEach((h, i) => {
            const diff = Math.abs(new Date(h.date) - new Date(displayedCandles[idx].date));
            if (diff < bestDiff) {
              bestDiff = diff;
              originalIdx = i;
            }
          });

          touchRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            lastX: e.touches[0].clientX,
            lastY: e.touches[0].clientY,
            type: null,
            startIdx: originalIdx,
            isPinching: false
          };
          setHovered(null);
        }
      } else if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const initialZoom = zoomRange || { start: 0, end: candles.length - 1 };
        touchRef.current = {
          startDist: dist,
          startZoom: { ...initialZoom },
          isPinching: true,
          centerX: (t1.clientX + t2.clientX) / 2
        };
      }
    };

    const handleTouchMove = (e) => {
      const { candles, zoomRange, displayedCandles, W, iW, PAD_L, PAD_R } = getLatest();
      if (!candles || candles.length < 2) return;
      const ref = touchRef.current;
      if (!ref) return;

      if (e.touches.length === 1 && !ref.isPinching) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;

        if (ref.type === null) {
          const dx = Math.abs(currentX - ref.startX);
          const dy = Math.abs(currentY - ref.startY);
          if (dx > 5 || dy > 5) {
            if (dx > dy) {
              ref.type = "diff";
              setIsDiffActive(true);
              updateDiffStartIdx(ref.startIdx);
              updateDiffEndIdx(ref.startIdx);
            } else {
              ref.type = "scroll";
            }
          }
        }

        if (ref.type === "diff") {
          const rect = el.getBoundingClientRect();
          const touchX = ((currentX - rect.left) / rect.width) * W;
          const boundedX = Math.max(PAD_L, Math.min(W - PAD_R, touchX));
          const relX = (boundedX - PAD_L) / iW;
          const idx = Math.max(
            0,
            Math.min(Math.round(relX * (displayedCandles.length - 1)), displayedCandles.length - 1)
          );

          let originalIdx = zoomRange ? zoomRange.start : 0;
          let bestDiff = Infinity;
          candles.forEach((h, i) => {
            const diff = Math.abs(new Date(h.date) - new Date(displayedCandles[idx].date));
            if (diff < bestDiff) {
              bestDiff = diff;
              originalIdx = i;
            }
          });

          updateDiffEndIdx(originalIdx);
          setHovered(null);
          e.preventDefault();
        }
      } else if (e.touches.length === 2 && ref.isPinching) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const ratio = ref.startDist / dist;
        const len = candles.length;
        const startZoom = ref.startZoom;
        const initialRangeSize = startZoom.end - startZoom.start;

        let newRangeSize = Math.round(initialRangeSize * ratio);
        newRangeSize = Math.max(2, Math.min(len - 1, newRangeSize));

        const rect = el.getBoundingClientRect();
        const relativeX = (ref.centerX - rect.left) / rect.width;

        let newStart = Math.round(startZoom.start + initialRangeSize * relativeX - relativeX * newRangeSize);
        let newEnd = newStart + newRangeSize;

        if (newStart < 0) {
          newStart = 0;
          newEnd = newRangeSize;
        }
        if (newEnd >= len) {
          newEnd = len - 1;
          newStart = Math.max(0, newEnd - newRangeSize);
        }

        if (newStart === 0 && newEnd === len - 1) {
          setZoomRange(null);
        } else {
          setZoomRange({ start: newStart, end: newEnd });
        }
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      const ref = touchRef.current;
      if (ref) {
        if (ref.type === "diff") {
          if (diffStartIdxRef.current === diffEndIdxRef.current) {
            setIsDiffActive(false);
            updateDiffStartIdx(null);
            updateDiffEndIdx(null);
          }
        } else if (ref.type === null) {
          setIsDiffActive(false);
          updateDiffStartIdx(null);
          updateDiffEndIdx(null);
        }
      }
      touchRef.current = { lastX: 0, startDist: 0, startZoom: null, isPinching: false, centerX: 0 };
    };

    const handleTouchStartWithDoubleTap = (e) => {
      const now = Date.now();
      if (now - lastTouchTime.current < 300) {
        e.preventDefault();
        setZoomRange(null);
        return;
      }
      lastTouchTime.current = now;
      handleTouchStart(e);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("dblclick", handleDblClick);
    el.addEventListener("touchstart", handleTouchStartWithDoubleTap, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("dblclick", handleDblClick);
      el.removeEventListener("touchstart", handleTouchStartWithDoubleTap);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [candles]);

  const hasCostLine = activeCostPts.length > 0 && (avgCost > 0 || (lots && lots.length > 0));
  const color = isUp ? "#00B98A" : "#FF4B55";

  if (!candles || candles.length < 2) {
    return (
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94A3B8",
          fontSize: 13
        }}
      >
        <RefreshCw size={18} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} /> กำลังโหลดข้อมูลกราฟ...
      </div>
    );
  }

  const latestCost = activeCostPts.length > 0 ? activeCostPts[activeCostPts.length - 1].cost : 0;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onSelectStart={(e) => e.preventDefault()}
      style={{
        width: "100%",
        position: "relative",
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none",
        cursor: zoomRange ? (dragStart && dragStart.type === "pan" ? "grabbing" : "grab") : "crosshair",
        touchAction: "pan-y"
      }}
    >
      {/* Floating EMA Toggle Panel */}
      {!isCashAsset && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "8px",
            right: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "4px 10px",
            boxShadow: "var(--shadow-xs)",
            zIndex: 10,
            pointerEvents: "auto",
            fontFamily: "Outfit, sans-serif"
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--text-muted)",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={showEma10}
              onChange={(e) => setShowEma10(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#00d2ff" }}
            />
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#00d2ff"
              }}
            ></span>
            EMA 10
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--text-muted)",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={showEma20}
              onChange={(e) => setShowEma20(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#FBBF24" }}
            />
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "1px",
                border: "1px dashed #FBBF24",
                background: "transparent"
              }}
            ></span>
            EMA 20
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--text-muted)",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={showEma50}
              onChange={(e) => setShowEma50(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#F97316" }}
            />
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#F97316"
              }}
            ></span>
            EMA 50
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: "700",
              color: "var(--text-muted)",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={showEma200}
              onChange={(e) => setShowEma200(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#DC2626" }}
            />
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#DC2626"
              }}
            ></span>
            EMA 200
          </label>
        </div>
      )}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", cursor: "crosshair" }}>
        <defs>
          <linearGradient id="gainGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00B98A" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#00B98A" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF4B55" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#FF4B55" stopOpacity="0.25" />
          </linearGradient>

          {clipAboveCostPath && (
            <clipPath id="assetClipAboveCost">
              <path d={clipAboveCostPath} />
            </clipPath>
          )}
          {clipBelowCostPath && (
            <clipPath id="assetClipBelowCost">
              <path d={clipBelowCostPath} />
            </clipPath>
          )}
          {clipAboveValuePath && (
            <clipPath id="assetClipAboveValue">
              <path d={clipAboveValuePath} />
            </clipPath>
          )}
          <clipPath id="assetClipFull">
            <rect x={PAD_L} y={PAD_T} width={iW} height={iH} />
          </clipPath>
          {hasCostLine && activeCostPts.length >= 1 && (
            <>
              <clipPath id="prePurchasedClip">
                <rect x={PAD_L} y={0} width={Math.max(0, activeCostPts[0].x - PAD_L)} height={H} />
              </clipPath>
              <clipPath id="purchasedClip">
                <rect x={activeCostPts[0].x} y={0} width={Math.max(0, W - PAD_R - activeCostPts[0].x)} height={H} />
              </clipPath>
            </>
          )}
        </defs>

        {yTicks.map(({ y }, i) => (
          <line
            key={i}
            x1={PAD_L}
            y1={y}
            x2={W - PAD_R}
            y2={y}
            stroke="#E8EBF2"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}
        {xTicks.map(({ x }, i) => (
          <line key={i} x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="#F1F5F9" strokeWidth="1" />
        ))}

        {isDiffActive &&
          diffStartIdx !== null &&
          diffEndIdx !== null &&
          diffStartIdx !== diffEndIdx &&
          (() => {
            const ptA = findClosestPtByTimestamp(diffStartIdx);
            const ptB = findClosestPtByTimestamp(diffEndIdx);

            if (ptA && ptB) {
              const xA = ptA.x;
              const xB = ptB.x;
              const yA = ptA.y;
              const yB = ptB.y;

              return (
                <g style={{ pointerEvents: "none" }}>
                  <line
                    x1={xA}
                    y1={PAD_T}
                    x2={xA}
                    y2={H - PAD_B}
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                  <line
                    x1={xB}
                    y1={PAD_T}
                    x2={xB}
                    y2={H - PAD_B}
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                  <line
                    x1={xA}
                    y1={yA}
                    x2={xB}
                    y2={yB}
                    stroke="var(--primary)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <circle cx={xA} cy={yA} r="6" fill="white" stroke="var(--primary)" strokeWidth="3" />
                  <circle cx={xB} cy={yB} r="6" fill="white" stroke="var(--primary)" strokeWidth="3" />
                </g>
              );
            }
            return null;
          })()}

        {hasCostLine && costLinePath && fillValueArea && fillCostArea && activeCostPts.length >= 1 ? (
          <g clipPath="url(#purchasedClip)">
            <path d={fillValueArea} fill="url(#gainGrad)" clipPath="url(#assetClipAboveCost)" />
            <path d={fillCostArea} fill="url(#lossGrad)" clipPath="url(#assetClipAboveValue)" />
          </g>
        ) : (
          fillValueArea && (
            <path d={fillValueArea} fill={isUp ? "url(#gainGrad)" : "url(#lossGrad)"} clipPath="url(#assetClipFull)" />
          )
        )}

        {hasCostLine && costLinePath && (
          <path
            d={costLinePath}
            fill="none"
            stroke="#5236FF"
            strokeWidth="1.8"
            strokeDasharray="6 4"
            opacity="0.85"
            clipPath="url(#assetClipFull)"
          />
        )}

        {!isCashAsset && showEma10 && ema10Path && (
          <path
            d={ema10Path}
            fill="none"
            stroke="#00d2ff"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#assetClipFull)"
            opacity="0.9"
          />
        )}
        {!isCashAsset && showEma20 && ema20Path && (
          <path
            d={ema20Path}
            fill="none"
            stroke="#FBBF24"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#assetClipFull)"
            opacity="0.9"
          />
        )}
        {!isCashAsset && showEma50 && ema50Path && (
          <path
            d={ema50Path}
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#assetClipFull)"
            opacity="0.95"
          />
        )}
        {!isCashAsset && showEma200 && ema200Path && (
          <path
            d={ema200Path}
            fill="none"
            stroke="#DC2626"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            clipPath="url(#assetClipFull)"
            opacity="0.95"
          />
        )}

        {linePath && costLinePath && activeCostPts.length >= 1 ? (
          <>
            <path
              d={linePath}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
              clipPath="url(#prePurchasedClip)"
            />
            <g clipPath="url(#purchasedClip)">
              <path
                d={linePath}
                fill="none"
                stroke="#00B98A"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath="url(#assetClipAboveCost)"
              />
              <path
                d={linePath}
                fill="none"
                stroke="#FF4B55"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                clipPath="url(#assetClipBelowCost)"
              />
            </g>
          </>
        ) : (
          linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath="url(#assetClipFull)"
            />
          )
        )}

        {hasCostLine && activeCostPts.length > 0 && (
          <>
            <rect
              x={W - PAD_R - 74}
              y={activeCostPts[activeCostPts.length - 1].y - 11}
              width={74}
              height={20}
              rx="5"
              fill="#5236FF"
              opacity="0.9"
            />
            <text
              x={W - PAD_R - 37}
              y={activeCostPts[activeCostPts.length - 1].y + 4}
              textAnchor="middle"
              fontSize="10"
              fill="white"
              fontWeight="800"
              fontFamily="Outfit,sans-serif"
            >
              {fmtUSD(latestCost, hideValues)}
            </text>
          </>
        )}

        {lotMarkers.map((m, i) => {
          const markerColor = m.colorType === "buy" ? "#16A34A" : m.colorType === "sell" ? "#DC2626" : "#F59E0B";
          const isMultiple = m.numsCount > 1;
          const badgeW = isMultiple ? Math.max(16, m.label.length * 6 + 10) : 15;
          return (
            <g key={i}>
              <line
                x1={m.x}
                y1={PAD_T}
                x2={m.x}
                y2={H - PAD_B}
                stroke={markerColor}
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.85"
              />
              {isMultiple ? (
                <rect x={m.x - badgeW / 2} y={PAD_T + 4.5} width={badgeW} height={15} rx="7.5" fill={markerColor} />
              ) : (
                <circle cx={m.x} cy={PAD_T + 12} r="7.5" fill={markerColor} />
              )}
              <text
                x={m.x}
                y={PAD_T + 12}
                textAnchor="middle"
                fontSize="9"
                fill="white"
                fontWeight="900"
                fontFamily="Outfit,sans-serif"
                dominantBaseline="middle"
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {hovered && (
          <>
            <line
              x1={hovered.x}
              y1={PAD_T}
              x2={hovered.x}
              y2={H - PAD_B}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r="5"
              fill="white"
              stroke={
                hovered.cost != null && hovered.value >= hovered.cost
                  ? "#00B98A"
                  : hovered.cost != null
                    ? "#FF4B55"
                    : "#94A3B8"
              }
              strokeWidth="2.5"
            />
            {hovered.costY != null && (
              <circle cx={hovered.x} cy={hovered.costY} r="4" fill="white" stroke="#5236FF" strokeWidth="2" />
            )}
          </>
        )}

        {yTicks.map(({ v, y }, i) => (
          <text
            key={i}
            x={PAD_L - 6}
            y={y + 4}
            textAnchor="end"
            fontSize="10"
            fill="#94A3B8"
            fontFamily="Outfit,sans-serif"
            fontWeight="600"
          >
            {v >= 1000 ? (v / 1000).toFixed(1) + "k" : v < 1 ? v.toFixed(4) : v.toFixed(v >= 100 ? 0 : 2)}
          </text>
        ))}

        {xTicks.map(({ x, date }, i) => (
          <text
            key={i}
            x={x}
            y={H - PAD_B + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#94A3B8"
            fontFamily="Outfit,sans-serif"
            fontWeight="600"
          >
            {getDynamicDateFormat(date, visibleDurationMs, hasMultipleYears)}
          </text>
        ))}
      </svg>

      {hovered &&
        (() => {
          const diff = hovered.cost != null ? hovered.value - hovered.cost : 0;
          const diffPct = hovered.cost != null && hovered.cost > 0 ? (diff / hovered.cost) * 100 : 0;
          const dateStr = hovered.date.split("T")[0];
          const txs = transactionsByDate[dateStr];
          const isThaiAsset = asset?.symbol?.endsWith(".BK");
          return (
            <div
              className="chart-tooltip-box"
              style={{
                top: Math.max(10, Math.min(H - 180, hovered.y - 45)) + "px",
                left: (hovered.x / W) * 100 + "%",
                opacity: 1,
                transform: hovered.x < W / 2 ? "translateX(15px)" : "translateX(calc(-100% - 15px))",
                zIndex: 100,
                pointerEvents: "none"
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 2 }}>
                {getDynamicDateFormat(hovered.date, visibleDurationMs, hasMultipleYears, true)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>ราคา:</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "white" }}>
                    {isThaiAsset ? fmtTHB(hovered.value * exchangeRate, hideValues) : fmtUSD(hovered.value, hideValues)}
                  </span>
                </div>
                {hovered.cost != null && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>ทุนเฉลี่ย:</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#A5B4FC" }}>
                        {isThaiAsset
                          ? fmtTHB(hovered.cost * exchangeRate, hideValues)
                          : fmtUSD(hovered.cost, hideValues)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        paddingTop: 2,
                        marginTop: 2
                      }}
                    >
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>P&L:</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: diff >= 0 ? "#6EE7B7" : "#FCA5A5" }}>
                        {diff >= 0 ? "+" : ""}
                        {isThaiAsset ? fmtTHB(diff * exchangeRate, hideValues) : fmtUSD(diff, hideValues)} (
                        {fmtPct(diffPct)})
                      </span>
                    </div>
                  </>
                )}
                {txs && txs.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      borderTop: "1px dashed rgba(255,255,255,0.2)",
                      paddingTop: 6,
                      display: "flex",
                      flexDirection: "column",
                      gap: 3
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "#F59E0B",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      🛒 ธุรกรรมในวันนี้:
                    </span>
                    {txs.map((tx, idx) => (
                      <span key={idx} style={{ fontSize: 10, color: "#FFF", opacity: 0.9 }}>
                        • {tx.type === "BUY" ? "ซื้อ" : "ขาย"} {fmtQty(tx.qty, hideValues)}{" "}
                        {isCashAsset ? asset.symbol : "หุ้น"} @{" "}
                        {isThai ? fmtTHB(tx.price, hideValues) : fmtUSD(tx.price, hideValues)} (ครั้งที่ {tx.num})
                        {tx.time ? ` · ${tx.time} น.` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {isDiffActive &&
        diffStartIdx !== null &&
        diffEndIdx !== null &&
        diffStartIdx !== diffEndIdx &&
        (() => {
          const ptA = findClosestPtByTimestamp(diffStartIdx);
          const ptB = findClosestPtByTimestamp(diffEndIdx);

          if (ptA && ptB) {
            const findClosestCandle = (ts) => {
              if (!candles || candles.length === 0) return null;
              let best = candles[0],
                bestDiff = Infinity;
              candles.forEach((c) => {
                const diff = Math.abs(new Date(c.date).getTime() - ts);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  best = c;
                }
              });
              return best;
            };
            const pA = findClosestCandle(diffStartIdx);
            const pB = findClosestCandle(diffEndIdx);
            if (!pA || !pB) return null;

            const isThai = asset?.symbol?.endsWith(".BK");
            const valA = isThai ? pA.close / exchangeRate : pA.close;
            const valB = isThai ? pB.close / exchangeRate : pB.close;
            const diffVal = valB - valA;
            const diffPct = valA > 0 ? (diffVal / valA) * 100 : 0;

            const dateA = new Date(pA.date);
            const dateB = new Date(pB.date);
            const diffDays = Math.round(Math.abs(dateB - dateA) / (1000 * 60 * 60 * 24));
            let timeStr = `${diffDays} วัน`;
            if (diffDays >= 365) {
              timeStr = `${(diffDays / 365).toFixed(1)} ปี`;
            } else if (diffDays >= 30) {
              timeStr = `${(diffDays / 30.4).toFixed(1)} เดือน`;
            }

            const xA = ptA.x;
            const xB = ptB.x;
            const centerPct = ((xA + xB) / 2 / W) * 100;
            const yA = ptA.y;
            const yB = ptB.y;
            const topPos = Math.min(yA, yB) - 50;

            return (
              <div
                style={{
                  position: "absolute",
                  top: "10px",
                  left: centerPct >= 50 ? "52px" : "auto",
                  right: centerPct < 50 ? "12px" : "auto",
                  opacity: 1,
                  transform: "none",
                  zIndex: 101,
                  pointerEvents: "none",
                  width: "220px",
                  padding: "10px 14px",
                  background: "rgba(30, 41, 59, 0.95)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  color: "white",
                  fontFamily: "Outfit, sans-serif"
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#94A3B8",
                    fontWeight: 800,
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    paddingBottom: 4,
                    marginBottom: 2
                  }}
                >
                  📊 เปรียบเทียบราคาหุ้น
                </div>
                <div style={{ fontSize: 10, color: "#CBD5E1" }}>
                  {fmtDateShort(pA.date)} ➔ {fmtDateShort(pB.date)} ({timeStr})
                </div>

                <div style={{ display: "flex", flexDirection: "column", fontSize: 11, marginTop: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94A3B8" }}>เริ่ม:</span>
                    <span style={{ color: "white", fontWeight: 700 }}>{fmtUSD(valA, hideValues)}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10, color: "#94A3B8" }}>
                    ({fmtTHB(valA * getHistoricalRate(pA.date), hideValues)})
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94A3B8" }}>สิ้นสุด:</span>
                    <span style={{ color: "white", fontWeight: 700 }}>{fmtUSD(valB, hideValues)}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10, color: "#94A3B8" }}>
                    ({fmtTHB(valB * getHistoricalRate(pB.date), hideValues)})
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderTop: "1px dashed rgba(255,255,255,0.15)",
                    paddingTop: 4,
                    marginTop: 2
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#94A3B8" }}>ส่วนต่าง:</span>
                    <span
                      style={{
                        fontWeight: 900,
                        color: diffVal >= 0 ? "#10B981" : "#EF4444"
                      }}
                    >
                      {diffVal >= 0 ? "+" : ""}
                      {fmtUSD(diffVal, hideValues)} ({diffVal >= 0 ? "+" : ""}
                      {diffPct.toFixed(2)}%)
                    </span>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 10,
                      fontWeight: 700,
                      color: diffVal >= 0 ? "#10B981" : "#EF4444"
                    }}
                  >
                    ({diffVal >= 0 ? "+" : ""}
                    {fmtTHB(diffVal * getHistoricalRate(pB.date), hideValues)})
                  </div>
                </div>
                <div style={{ fontSize: 9, color: "#94A3B8", textAlign: "center", marginTop: 4, fontStyle: "italic" }}>
                  คลิก 1 ครั้งบนกราฟเพื่อล้างข้อมูลเปรียบเทียบ
                </div>
              </div>
            );
          }
          return null;
        })()}
    </div>
  );
}
export default AssetChart;
