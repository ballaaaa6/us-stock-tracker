/* Smooth Bezier Curve Path for SVG */
export function smoothPath(pts) {
  if (!pts || pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) * 0.22;
    const cp1y = p1.y + (p2.y - p0.y) * 0.22;
    const cp2x = p2.x - (p3.x - p1.x) * 0.22;
    const cp2y = p2.y - (p3.y - p1.y) * 0.22;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/* Step-like historical Cost line (Dashed / Solid steps) */
export function stepPath(pts) {
  if (!pts || pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const nextX = pts[i + 1].x;
    const nextY = pts[i + 1].y;
    d += ` L ${nextX.toFixed(2)},${pts[i].y.toFixed(2)} L ${nextX.toFixed(2)},${nextY.toFixed(2)}`;
  }
  return d;
}

/* Smooth data points using a moving average filter */
export function smoothPoints(points, toY) {
  if (!points || points.length < 5) return points;
  const windowSize = points.length > 50 ? 5 : 3;
  const half = Math.floor(windowSize / 2);
  return points.map((pt, idx) => {
    if (!pt || pt.value == null) return pt;
    if (idx < half || idx >= points.length - half) return pt;
    let sum = 0;
    let count = 0;
    for (let w = -half; w <= half; w++) {
      const neighbor = points[idx + w];
      if (neighbor && neighbor.value != null) {
        sum += neighbor.value;
        count++;
      }
    }
    if (count === 0) return pt;
    return { ...pt, y: toY(sum / count) };
  });
}

export function getPoints(values, W, H, padX = 0, padY = 10) {
  if (!values || values.length < 2) return [];
  const clean = values.filter((v) => v != null && isFinite(v));
  if (clean.length < 2) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const iW = W - padX * 2;
  const iH = H - padY * 2;
  return values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * iW,
    y: padY + ((max - (v ?? min)) / range) * iH
  }));
}

export const interpolateData = (data, visibleDurationMs) => {
  if (!data || data.length < 2) return data;

  let intervalMs = 0;
  const oneMin = 60 * 1000;
  const oneHour = 60 * oneMin;
  const oneDay = 24 * oneHour;

  if (visibleDurationMs < 6 * oneHour) {
    intervalMs = 1 * oneMin;
  } else if (visibleDurationMs < 24 * oneHour) {
    intervalMs = 5 * oneMin;
  } else if (visibleDurationMs < 3 * oneDay) {
    intervalMs = 15 * oneMin;
  } else if (visibleDurationMs < 10 * oneDay) {
    intervalMs = 1 * oneHour;
  } else if (visibleDurationMs < 45 * oneDay) {
    intervalMs = 4 * oneHour;
  } else if (visibleDurationMs < 180 * oneDay) {
    intervalMs = 12 * oneHour;
  } else {
    return data;
  }

  const interpolated = [];

  for (let i = 0; i < data.length - 1; i++) {
    const p1 = data[i];
    const p2 = data[i + 1];

    const t1 = new Date(p1.date).getTime();
    const t2 = new Date(p2.date).getTime();
    const diff = t2 - t1;

    interpolated.push(p1);

    if (diff > intervalMs) {
      const steps = Math.floor(diff / intervalMs);
      for (let s = 1; s < steps; s++) {
        const t = t1 + s * intervalMs;
        const ratio = (t - t1) / diff;

        // Linear interpolation for value and EMA lines
        const val = p1.value + (p2.value - p1.value) * ratio;
        const ema10 = p1.ema10 != null && p2.ema10 != null ? p1.ema10 + (p2.ema10 - p1.ema10) * ratio : null;
        const ema20 = p1.ema20 != null && p2.ema20 != null ? p1.ema20 + (p2.ema20 - p1.ema20) * ratio : null;
        const ema50 = p1.ema50 != null && p2.ema50 != null ? p1.ema50 + (p2.ema50 - p1.ema50) * ratio : null;
        const ema200 = p1.ema200 != null && p2.ema200 != null ? p1.ema200 + (p2.ema200 - p1.ema200) * ratio : null;
        const cost = p1.cost != null ? p1.cost : null;

        interpolated.push({
          date: new Date(t).toISOString(),
          value: val,
          ema10,
          ema20,
          ema50,
          ema200,
          cost: cost,
          hasPurchased: p1.hasPurchased ?? p1.cost != null
        });
      }
    }
  }

  interpolated.push(data[data.length - 1]);
  return interpolated;
};
