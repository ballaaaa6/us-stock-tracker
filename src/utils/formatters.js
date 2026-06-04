/**
 * Formatters for currency, percentages, quantities, and dates.
 * Eliminates global mutable state by accepting hideValues as a parameter.
 */

export const fmtUSD = (n, hideValues = false) => {
  if (hideValues) return "****";
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(n) < 1 ? 4 : 2
  }).format(n);
};

export const fmtTHB = (n, decimals = 2, hideValues = false) => {
  if (hideValues) return "****";
  if (n == null) return "—";
  return "฿" + new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n);
};

export const fmtPct = (n) => {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
};

export const fmtQty = (n, hideValues = false) => {
  if (hideValues) return "****";
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
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
