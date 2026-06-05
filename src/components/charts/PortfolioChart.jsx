import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BarChart2 } from "lucide-react";
import { fmtUSD, fmtPct, fmtQty } from "../../utils/formatters";
import { getCurrencyPriceUSD } from "../../utils/assetHelpers";
import { smoothPath, stepPath, smoothPoints, interpolateData } from "./chartUtils";
import TimeframeSelector from "./TimeframeSelector";
import PortfolioChartGrid from "./PortfolioChartGrid";
import PortfolioTooltip from "./PortfolioTooltip";

export function PortfolioChart({ history, range, onRangeChange, assets, exchangeRate, prices, hideValues }) {
  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [dims, setDims] = useState({ w: 800, h: 350 });
  const [zoomRange, setZoomRange] = useState(null); // { start: number, end: number }
  const [dragStart, setDragStart] = useState(null); // { x, type: "zoom" | "pan" | "diff", startZoom }
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

  const fmt = useMemo(
    () => ({
      usd: (n) => fmtUSD(n, hideValues),
      pct: fmtPct,
      qty: (n) => fmtQty(n, hideValues)
    }),
    [hideValues]
  );

  useEffect(() => {
    setZoomRange(null);
  }, [history, range]);

  // Responsive resizing
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        const isMobile = e.contentRect.width < 500;
        setDims({
          w: e.contentRect.width,
          h: isMobile
            ? Math.min(500, Math.max(320, e.contentRect.width * 0.88))
            : Math.min(550, Math.max(420, e.contentRect.width * 0.7))
        });
      }
    });
    if (svgRef.current) obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, [history]);

  const W = dims.w;
  const H = dims.h;

  const isMobile = W < 500;
  const PAD_L = isMobile ? 30 : 42;
  const PAD_R = isMobile ? 12 : 24;
  const PAD_T = isMobile ? 4 : 6;
  const PAD_B = isMobile ? 18 : 24;

  const iW = W - PAD_L - PAD_R;
  const iH = H - PAD_T - PAD_B;

  const rawDisplayedData = useMemo(() => {
    if (!history) return [];
    if (!zoomRange) return history;
    return history.slice(zoomRange.start, zoomRange.end + 1);
  }, [history, zoomRange]);

  const visibleDurationMs = useMemo(() => {
    if (!rawDisplayedData || rawDisplayedData.length < 2) return 0;
    const firstTime = new Date(rawDisplayedData[0].date).getTime();
    const lastTime = new Date(rawDisplayedData[rawDisplayedData.length - 1].date).getTime();
    return lastTime - firstTime;
  }, [rawDisplayedData]);

  const displayedData = useMemo(() => {
    const interpolated = interpolateData(rawDisplayedData, visibleDurationMs);
    if (!interpolated || interpolated.length < 2) return interpolated;

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
          interpolated.forEach((d, idx) => {
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

      return {
        ...asset,
        lots: mappedLots,
        isThai,
        isCashAsset
      };
    });

    return interpolated.map((d, idx) => {
      let totalCostUSD = 0;
      let hasPurchasedAny = false;

      assetLotsWithMappedIdx.forEach((asset) => {
        const lotsBeforeOrOn = asset.lots.filter((lot) => lot.mappedIdx <= idx);
        if (lotsBeforeOrOn.length === 0) return;

        hasPurchasedAny = true;

        const costUSD = lotsBeforeOrOn.reduce((sum, l) => {
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

        totalCostUSD += costUSD;
      });

      return {
        ...d,
        cost: hasPurchasedAny ? totalCostUSD : null
      };
    });
  }, [rawDisplayedData, visibleDurationMs, assets, prices, exchangeRate]);

  const hasMultipleYears = useMemo(() => {
    if (!rawDisplayedData || rawDisplayedData.length < 2) return false;
    const firstYear = new Date(rawDisplayedData[0].date).getFullYear();
    const lastYear = new Date(rawDisplayedData[rawDisplayedData.length - 1].date).getFullYear();
    return firstYear !== lastYear;
  }, [rawDisplayedData]);

  const transactionsByIdx = useMemo(() => {
    if (!assets || !history || history.length < 2) return {};
    const map = {};
    const startStr = history[0].date.split("T")[0];
    const endStr = history[history.length - 1].date.split("T")[0];

    assets.forEach((asset) => {
      (asset.lots || []).forEach((lot) => {
        if (!lot || !lot.date) return;
        const lotDateStr = lot.date;

        if (lotDateStr < startStr || lotDateStr > endStr) return;

        let bestIdx = -1,
          bestDiff = Infinity;

        bestIdx = history.findIndex((h) => h.date.split("T")[0] === lotDateStr);

        if (bestIdx === -1) {
          const targetTime = new Date(lotDateStr + "T00:00:00.000Z").getTime();
          history.forEach((h, i) => {
            const hTime = new Date(h.date).getTime();
            const diff = Math.abs(hTime - targetTime);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = i;
            }
          });
        }

        if (bestIdx >= 0) {
          if (!map[bestIdx]) map[bestIdx] = [];
          map[bestIdx].push({
            symbol: asset.symbol,
            type: lot.type || "BUY",
            qty: lot.qty,
            price: lot.price,
            date: lot.date,
            time: lot.time
          });
        }
      });
    });
    return map;
  }, [assets, history]);

  const lotMarkers = useMemo(() => {
    if (!displayedData || displayedData.length < 2 || !assets || !history || history.length < 2) return [];

    const displayStart = new Date(displayedData[0].date).getTime();
    const displayEnd = new Date(displayedData[displayedData.length - 1].date).getTime();

    const rawMarkers = [];
    assets.forEach((asset) => {
      (asset.lots || []).forEach((lot) => {
        if (!lot || !lot.date) return;
        const lotTime = new Date(lot.date + "T" + (lot.time || "00:00") + ":00.000Z").getTime();

        if (lotTime < displayStart || lotTime > displayEnd) return;

        let bestDisplayIdx = -1,
          bestDiff = Infinity;
        displayedData.forEach((d, idx) => {
          const diff = Math.abs(new Date(d.date).getTime() - lotTime);
          if (diff < bestDiff) {
            bestDiff = diff;
            bestDisplayIdx = idx;
          }
        });

        if (bestDisplayIdx !== -1) {
          const isBuy = (lot.qty || 0) >= 0;
          const x = PAD_L + (bestDisplayIdx / (displayedData.length - 1)) * iW;
          rawMarkers.push({
            x,
            isBuy,
            symbol: asset.symbol,
            lot,
            time: lotTime
          });
        }
      });
    });

    rawMarkers.sort((a, b) => a.x - b.x);

    const grouped = [];
    rawMarkers.forEach((m) => {
      if (grouped.length === 0) {
        grouped.push({
          xSum: m.x,
          count: 1,
          buysCount: m.isBuy ? 1 : 0,
          sellsCount: !m.isBuy ? 1 : 0,
          txs: [m]
        });
      } else {
        const lastGroup = grouped[grouped.length - 1];
        const avgX = lastGroup.xSum / lastGroup.count;
        if (Math.abs(m.x - avgX) < 18) {
          lastGroup.xSum += m.x;
          lastGroup.count += 1;
          if (m.isBuy) lastGroup.buysCount++;
          else lastGroup.sellsCount++;
          lastGroup.txs.push(m);
        } else {
          grouped.push({
            xSum: m.x,
            count: 1,
            buysCount: m.isBuy ? 1 : 0,
            sellsCount: !m.isBuy ? 1 : 0,
            txs: [m]
          });
        }
      }
    });

    return grouped.map((group) => {
      const x = group.xSum / group.count;
      let colorType = "mixed";
      if (group.buysCount > 0 && group.sellsCount === 0) colorType = "buy";
      else if (group.buysCount === 0 && group.sellsCount > 0) colorType = "sell";

      const uniqueSymbols = Array.from(new Set(group.txs.map((t) => t.symbol)));
      let label = "";
      if (uniqueSymbols.length === 1) {
        label = uniqueSymbols[0].slice(0, 1);
      } else {
        label = String(group.txs.length);
      }

      return {
        x,
        colorType,
        label,
        symbol: uniqueSymbols.length === 1 ? uniqueSymbols[0] : "*",
        txs: group.txs.map((t) => ({
          symbol: t.symbol,
          type: t.lot.type || (t.lot.qty >= 0 ? "BUY" : "SELL"),
          qty: Math.abs(t.lot.qty),
          price: t.lot.price,
          date: t.lot.date,
          time: t.lot.time
        }))
      };
    });
  }, [assets, displayedData, history, iW, PAD_L]);

  const { pts, costPts, yMin, yMax, isUp, color, renderPts } = useMemo(() => {
    if (!displayedData || displayedData.length < 2)
      return { pts: [], costPts: [], yMin: 0, yMax: 1, isUp: true, color: "var(--gain)", renderPts: [] };

    const vals = displayedData.map((h) => h.value);
    const costs = displayedData.map((h) => h.cost || 0);

    const isShortTF = range === "1D" || range === "5D" || range === "1W";
    const dataMin = isShortTF ? Math.min(...vals) : Math.min(...vals, ...costs.filter((c) => c > 0));
    const dataMax = isShortTF ? Math.max(...vals) : Math.max(...vals, ...costs);
    const rangeVal = dataMax - dataMin || dataMin * 0.02 || 1;

    const pad = rangeVal * 0.05;
    const yMin = Math.max(0, dataMin - pad);
    const yMax = dataMax + pad;
    const yRange = yMax - yMin;

    const toY = (v) => PAD_T + ((yMax - v) / yRange) * iH;
    const toX = (i) => PAD_L + (i / (displayedData.length - 1)) * iW;

    const pts = displayedData.map((h, i) => ({ x: toX(i), y: toY(h.value), value: h.value, date: h.date }));
    const costPts = displayedData.map((h, i) => ({ x: toX(i), y: toY(h.cost || 0), cost: h.cost || 0, date: h.date }));

    const renderPts = smoothPoints(pts, toY);

    const isUp = vals[vals.length - 1] >= vals[0];
    const color = isUp ? "var(--gain)" : "var(--loss)";

    return { pts, costPts, yMin, yMax, isUp, color, renderPts };
  }, [displayedData, iH, iW, range, PAD_T, PAD_L, PAD_B]);

  const findClosestPtByTimestamp = useCallback(
    (ts) => {
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
    },
    [pts]
  );

  const linePath = useMemo(() => smoothPath(renderPts), [renderPts]);
  const costLinePath = useMemo(() => stepPath(costPts), [costPts]);

  // Gain & Loss fill paths
  const fillValueArea = useMemo(() => {
    if (!linePath || renderPts.length < 2) return "";
    const first = renderPts[0],
      last = renderPts[renderPts.length - 1];
    const bottomY = H - PAD_B;
    return linePath + ` L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  }, [linePath, renderPts, H, PAD_B]);

  const fillCostArea = useMemo(() => {
    if (!costLinePath || costPts.length < 2) return "";
    const first = costPts[0],
      last = costPts[costPts.length - 1];
    const bottomY = H - PAD_B;
    return costLinePath + ` L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  }, [costLinePath, costPts, H, PAD_B]);

  // Clip path definitions using SVG path data
  const clipAboveCostPath = useMemo(() => {
    if (!costLinePath || costPts.length < 2) return "";
    const first = costPts[0],
      last = costPts[costPts.length - 1];
    return costLinePath + ` L ${last.x},0 L ${first.x},0 Z`;
  }, [costLinePath, costPts]);

  const clipBelowCostPath = useMemo(() => {
    if (!costLinePath || costPts.length < 2) return "";
    const first = costPts[0],
      last = costPts[costPts.length - 1];
    const bottomY = H - PAD_B;
    return costLinePath + ` L ${last.x},${bottomY} L ${first.x},${bottomY} Z`;
  }, [costLinePath, costPts, H, PAD_B]);

  const clipAboveValuePath = useMemo(() => {
    if (!linePath || renderPts.length < 2) return "";
    const first = renderPts[0],
      last = renderPts[renderPts.length - 1];
    return linePath + ` L ${last.x},0 L ${first.x},0 Z`;
  }, [linePath, renderPts]);

  const stateRef = useRef();
  stateRef.current = {
    history,
    zoomRange,
    displayedData,
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
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    if (mouseX >= PAD_L && mouseX <= W - PAD_R) {
      if (e.shiftKey && zoomRange) {
        setDragStart({ x: mouseX, type: "pan", startZoom: { ...zoomRange } });
      } else {
        const relX = (mouseX - PAD_L) / iW;
        const idx = Math.max(0, Math.min(Math.round(relX * (displayedData.length - 1)), displayedData.length - 1));
        const ts = new Date(displayedData[idx].date).getTime();

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
      if (!svgRef.current || pts.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseXInSvg = ((e.clientX - rect.left) / rect.width) * W;

      if (dragStart) {
        if (dragStart.type === "diff") {
          const boundedX = Math.max(PAD_L, Math.min(W - PAD_R, mouseXInSvg));
          const relX = (boundedX - PAD_L) / iW;
          const idx = Math.max(0, Math.min(Math.round(relX * (displayedData.length - 1)), displayedData.length - 1));
          const ts = new Date(displayedData[idx].date).getTime();

          updateDiffEndIdx(ts);
          setHovered(null);
        } else if (dragStart.type === "pan") {
          const deltaX = mouseXInSvg - dragStart.x;
          const len = history.length;
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
      const idx = Math.max(0, Math.min(Math.round(relX * (displayedData.length - 1)), displayedData.length - 1));
      if (displayedData[idx]) {
        let originalIdx = 0;
        let bestDiff = Infinity;
        history.forEach((h, i) => {
          const diff = Math.abs(new Date(h.date) - new Date(displayedData[idx].date));
          if (diff < bestDiff) {
            bestDiff = diff;
            originalIdx = i;
          }
        });

        setHovered({
          idx,
          originalIdx,
          x: renderPts[idx]?.x || pts[idx].x,
          y: renderPts[idx]?.y || pts[idx].y,
          costY: costPts[idx]?.y,
          value: displayedData[idx].value,
          cost: displayedData[idx].cost || 0,
          date: displayedData[idx].date
        });
      }
    },
    [renderPts, pts, costPts, displayedData, iW, W, dragStart, zoomRange, history, isDiffActive, PAD_L, PAD_R]
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
  };

  const handleMouseLeave = () => {
    setHovered(null);
    setDragStart(null);
  };

  // Combined programmatic event listeners to control passive behavior and enable vertical scrolling
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const getLatest = () => stateRef.current;

    const handleWheel = (e) => {
      const { history, zoomRange, displayedData, W, iW, PAD_L } = getLatest();
      if (!history || history.length < 2) return;
      e.preventDefault();

      const isZoomIn = e.deltaY < 0;
      const len = history.length;
      const currentStart = zoomRange ? zoomRange.start : 0;
      const currentEnd = zoomRange ? zoomRange.end : len - 1;
      const rangeSize = currentEnd - currentStart;

      const rect = el.getBoundingClientRect();
      const mouseXInSvg = ((e.clientX - rect.left) / rect.width) * W;
      const relX = (mouseXInSvg - PAD_L) / iW;
      const hoveredIdx = Math.max(0, Math.min(Math.round(relX * (displayedData.length - 1)), displayedData.length - 1));

      let centerIdx = currentStart;
      let bestDiff = Infinity;
      history.forEach((h, i) => {
        const diff = Math.abs(new Date(h.date) - new Date(displayedData[hoveredIdx].date));
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
      const { history, zoomRange, displayedData, W, iW, PAD_L, PAD_R } = getLatest();
      if (!history || history.length < 2) return;

      if (e.touches.length === 1) {
        const rect = el.getBoundingClientRect();
        const touchX = ((e.touches[0].clientX - rect.left) / rect.width) * W;
        if (touchX >= PAD_L && touchX <= W - PAD_R) {
          const relX = (touchX - PAD_L) / iW;
          const idx = Math.max(0, Math.min(Math.round(relX * (displayedData.length - 1)), displayedData.length - 1));

          let originalIdx = zoomRange ? zoomRange.start : 0;
          let bestDiff = Infinity;
          history.forEach((h, i) => {
            const diff = Math.abs(new Date(h.date) - new Date(displayedData[idx].date));
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
        const initialZoom = zoomRange || { start: 0, end: history.length - 1 };
        touchRef.current = {
          startDist: dist,
          startZoom: { ...initialZoom },
          isPinching: true,
          centerX: (t1.clientX + t2.clientX) / 2
        };
      }
    };

    const handleTouchMove = (e) => {
      const { history, zoomRange, displayedData, W, iW, PAD_L, PAD_R } = getLatest();
      if (!history || history.length < 2) return;
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
          const idx = Math.max(0, Math.min(Math.round(relX * (displayedData.length - 1)), displayedData.length - 1));

          let originalIdx = zoomRange ? zoomRange.start : 0;
          let bestDiff = Infinity;
          history.forEach((h, i) => {
            const diff = Math.abs(new Date(h.date) - new Date(displayedData[idx].date));
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
        const len = history.length;
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
        }
      }
      touchRef.current = null;
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
  }, [history]);

  if (!history || history.length < 2) {
    return (
      <div ref={svgRef}>
        <div className="chart-card-header">
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            📈 มูลค่าพอร์ต
          </span>
          <TimeframeSelector range={range} onRangeChange={onRangeChange} />
        </div>
        <div className="chart-empty">
          <BarChart2 size={36} strokeWidth={1.5} />
          <p style={{ fontSize: 13, textAlign: "center" }}>
            เพิ่มสินทรัพย์และรอดึงข้อมูลประวัติราคา
            <br />
            กราฟจะแสดงมูลค่าพอร์ตย้อนหลัง
          </p>
        </div>
      </div>
    );
  }

  const startVal = displayedData[0]?.value || 0;
  const endVal = displayedData[displayedData.length - 1]?.value || 0;
  const totalChange = endVal - startVal;
  const totalChangePct = startVal > 0 ? (totalChange / startVal) * 100 : 0;

  // Axis labels
  const dateLabels = (() => {
    if (displayedData.length <= 1) return [];
    const isShortTF = range === "1D" || range === "5D" || range === "1W";
    const maxTicks = isMobile ? (isShortTF ? 3 : 5) : isShortTF ? 8 : 12;
    const count = Math.min(maxTicks, displayedData.length);
    const step = Math.floor((displayedData.length - 1) / Math.max(count - 1, 1));
    return Array.from({ length: count }, (_, i) => {
      const idx = Math.min(i === count - 1 ? displayedData.length - 1 : i * step, displayedData.length - 1);
      return { idx, x: PAD_L + (idx / (displayedData.length - 1)) * iW, date: displayedData[idx].date };
    });
  })();

  const yTicks = (() => {
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
  })();

  const latestCost = displayedData[displayedData.length - 1]?.cost || 0;
  const latestVal = displayedData[displayedData.length - 1]?.value || 0;
  const pnlPercent = latestCost > 0 ? ((latestVal - latestCost) / latestCost) * 100 : 0;

  return (
    <div>
      <div className="chart-card-header">
        <div>
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            📈 มูลค่าพอร์ต & ต้นทุนรวม
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{range} ประสิทธิภาพ:</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: totalChange >= 0 ? "var(--gain)" : "var(--loss)" }}>
              {totalChange >= 0 ? "▲" : "▼"} {fmt.usd(Math.abs(totalChange))} ({fmt.pct(totalChangePct)})
            </span>
            {latestCost > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: pnlPercent >= 0 ? "var(--gain-light)" : "var(--loss-light)",
                  color: pnlPercent >= 0 ? "var(--gain)" : "var(--loss)",
                  padding: "1px 6px",
                  borderRadius: 6
                }}
              >
                กำไรสะสม: {fmt.pct(pnlPercent)}
              </span>
            )}
          </div>
        </div>
        <TimeframeSelector range={range} onRangeChange={onRangeChange} />
      </div>

      <div
        className="chart-area-wrapper"
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onSelectStart={(e) => e.preventDefault()}
        style={{
          cursor: zoomRange ? (dragStart && dragStart.type === "pan" ? "grabbing" : "grab") : "crosshair",
          position: "relative",
          width: "100%",
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none"
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" style={{ height: H, display: "block" }}>
          <defs>
            <linearGradient id="portGainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00B98A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00B98A" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="portLossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4B55" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#FF4B55" stopOpacity="0.20" />
            </linearGradient>

            {clipAboveCostPath && (
              <clipPath id="portClipAboveCost">
                <path d={clipAboveCostPath} />
              </clipPath>
            )}
            {clipBelowCostPath && (
              <clipPath id="portClipBelowCost">
                <path d={clipBelowCostPath} />
              </clipPath>
            )}
            {clipAboveValuePath && (
              <clipPath id="portClipAboveValue">
                <path d={clipAboveValuePath} />
              </clipPath>
            )}
            <clipPath id="portClipFull">
              <rect x={PAD_L} y={PAD_T} width={iW} height={iH} />
            </clipPath>
          </defs>

          <PortfolioChartGrid
            yTicks={yTicks}
            dateLabels={dateLabels}
            PAD_L={PAD_L}
            PAD_R={PAD_R}
            PAD_T={PAD_T}
            PAD_B={PAD_B}
            W={W}
            H={H}
            visibleDurationMs={visibleDurationMs}
            hasMultipleYears={hasMultipleYears}
          />

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

          {costPts.length > 0 && fillValueArea && fillCostArea ? (
            <g clipPath="url(#portClipFull)">
              <path d={fillValueArea} fill="url(#portGainGrad)" clipPath="url(#portClipAboveCost)" />
              <path d={fillCostArea} fill="url(#portLossGrad)" clipPath="url(#portClipAboveValue)" />
            </g>
          ) : (
            fillValueArea && (
              <path d={fillValueArea} fill={`url(#port${isUp ? "Gain" : "Loss"}Grad)`} clipPath="url(#portClipFull)" />
            )
          )}

          {costLinePath && (
            <path
              d={costLinePath}
              fill="none"
              stroke="#5236FF"
              strokeWidth="2.2"
              strokeDasharray="6 4"
              opacity="0.85"
              clipPath="url(#portClipFull)"
            />
          )}

          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath="url(#portClipFull)"
            />
          )}

          {lotMarkers.map((m, i) => {
            const markerColor = m.colorType === "buy" ? "#16A34A" : m.colorType === "sell" ? "#DC2626" : "#F59E0B";
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
                <circle cx={m.x} cy={PAD_T + 12} r="7.5" fill={markerColor} />
                <text
                  x={m.x}
                  y={PAD_T + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill="white"
                  fontWeight="900"
                  fontFamily="var(--font-family)"
                  dominantBaseline="middle"
                >
                  {m.label}
                </text>
                <title>
                  {m.txs
                    .map(
                      (t) =>
                        `${t.type === "BUY" ? "ซื้อ" : "ขาย"} ${t.symbol} ${t.qty.toLocaleString()} หุ้น @ ${fmt.usd(t.price)}${t.time ? ` · ${t.time} น.` : ""}`
                    )
                    .join("\n")}
                </title>
              </g>
            );
          })}

          {hovered && (
            <line
              x1={hovered.x}
              y1={PAD_T}
              x2={hovered.x}
              y2={H - PAD_B}
              stroke="#CBD5E1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {hovered && (
            <>
              <circle
                cx={hovered.x}
                cy={hovered.y}
                r="5"
                fill="#FFFFFF"
                stroke={hovered.value >= hovered.cost ? "#00B98A" : "#FF4B55"}
                strokeWidth="2.5"
              />
              {hovered.cost > 0 && (
                <circle cx={hovered.x} cy={hovered.costY} r="4.5" fill="#FFFFFF" stroke="#5236FF" strokeWidth="2" />
              )}
            </>
          )}

          {costPts && costPts.length > 0 && (
            <>
              <rect
                x={W - PAD_R - 80}
                y={costPts[costPts.length - 1].y - 12}
                width={80}
                height={22}
                rx="6"
                fill="#5236FF"
                opacity="0.95"
              />
              <text
                x={W - PAD_R - 40}
                y={costPts[costPts.length - 1].y + 4}
                textAnchor="middle"
                fontSize="11"
                fill="white"
                fontWeight="900"
                fontFamily="var(--font-family)"
              >
                {fmt.usd(costPts[costPts.length - 1].cost)}
              </text>
            </>
          )}
        </svg>

        <PortfolioTooltip
          hovered={hovered}
          isDiffActive={isDiffActive}
          diffStartIdx={diffStartIdx}
          diffEndIdx={diffEndIdx}
          history={history}
          visibleDurationMs={visibleDurationMs}
          hasMultipleYears={hasMultipleYears}
          transactionsByIdx={transactionsByIdx}
          W={W}
          H={H}
          hideValues={hideValues}
          findClosestPtByTimestamp={findClosestPtByTimestamp}
        />
      </div>
    </div>
  );
}
export default PortfolioChart;
