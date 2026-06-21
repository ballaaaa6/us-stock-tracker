/**
 * Formatters for currency, percentages, quantities, and dates.
 * Eliminates global mutable state by accepting hideValues as a parameter.
 */

export const fmtUSD = (n, hideValues = false, exactDecimals = false) => {
  if (hideValues) return "****";
  if (n == null) return "—";
  let maxDecimals = 2;
  if (exactDecimals) {
    const parts = n.toString().split('.');
    const decimalCount = parts[1] ? parts[1].length : 0;
    maxDecimals = Math.max(2, Math.min(20, decimalCount));
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDecimals
  }).format(n);
};

export const fmtTHB = (n, decimals = 2, hideValues = false, exactDecimals = false) => {
  if (hideValues) return "****";
  if (n == null) return "—";
  let maxDecimals = decimals;
  if (exactDecimals) {
    const parts = n.toString().split('.');
    const decimalCount = parts[1] ? parts[1].length : 0;
    maxDecimals = Math.max(decimals, Math.min(20, decimalCount));
  }
  return "฿" + new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: maxDecimals
  }).format(n);
};

export const fmtPct = (n) => {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

export const fmtQty = (n, hideValues = false) => {
  if (hideValues) return "****";
  if (n == null) return "—";
  const parts = n.toString().split('.');
  const decimalCount = parts[1] ? parts[1].length : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, Math.min(20, decimalCount))
  }).format(n);
};

export const fmtDate = (s) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit"
  });
};

export const fmtDateShort = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit"
  });
};

export const getDynamicDateFormat = (dateIso, visibleDurationMs, hasMultipleYears = false, isTooltip = false) => {
  const d = new Date(dateIso);
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const sixMonths = 180 * oneDay;

  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;

  if (visibleDurationMs <= oneDay) {
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  if (isTooltip && hasTime) {
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  if (visibleDurationMs <= sixMonths) {
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  } else {
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: hasMultipleYears ? "2-digit" : undefined });
  }
};

export const isExtendedHoursNY = (dateIso) => {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  try {
    const nyString = d.toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyString);
    const hours = nyDate.getHours();
    const minutes = nyDate.getMinutes();
    const timeVal = hours * 100 + minutes;
    const isRegular = timeVal >= 930 && timeVal < 1600;
    return !isRegular;
  } catch {
    return false;
  }
};

