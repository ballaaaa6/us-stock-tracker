import React, { useState, useEffect, useMemo } from "react";

export default function AssetLogo({ symbol, category, style }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const sym = symbol ? symbol.split(".")[0].toUpperCase() : "";

  // Build ordered list of logo sources to try
  const sources = useMemo(() => {
    if (!sym) return [];
    const cat = category || "stock";

    if (cat === "fiat") {
      const code =
        {
          THB: "th",
          USD: "us",
          EUR: "eu",
          JPY: "jp",
          GBP: "gb",
          AUD: "au",
          CAD: "ca",
          SGD: "sg",
          CHF: "ch",
          CNY: "cn",
          HKD: "hk",
          KRW: "kr",
          INR: "in",
          NZD: "nz",
          SEK: "se",
          NOK: "no",
          DKK: "dk",
          MYR: "my",
          IDR: "id",
          PHP: "ph",
          VND: "vn",
          TWD: "tw",
          BRL: "br",
          RUB: "ru",
          ZAR: "za",
          TRY: "tr",
          MXN: "mx"
        }[sym] || sym.slice(0, 2).toLowerCase();
      return [`https://flagcdn.com/w80/${code}.png`];
    }

    if (cat === "crypto") {
      return [
        `https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`,
        `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/128/color/${sym.toLowerCase()}.png`,
        `https://www.google.com/s2/favicons?sz=128&domain=${sym.toLowerCase()}.org`
      ];
    }

    if (
      cat === "gold" ||
      sym === "XAU" ||
      sym === "GLD" ||
      sym === "IAU" ||
      sym === "CL" ||
      (symbol && symbol.toUpperCase() === "CL=F")
    ) {
      if (sym === "CL" || (symbol && symbol.toUpperCase() === "CL=F")) {
        return [`https://images.financialmodelingprep.com/symbol/USO.png`];
      }
      return [`https://images.financialmodelingprep.com/symbol/GLD.png`];
    }

    // Stock: try Financial Modeling Prep, then logo.dev, then TradingView, then Google favicon
    return [
      `https://images.financialmodelingprep.com/symbol/${sym}.png`,
      `https://img.logo.dev/ticker/${sym}?token=pk_R4dEIaKTRG-i8tSiILBNZA&size=128&format=png`,
      `https://s3-symbol-logo.tradingview.com/stock/${sym.toLowerCase()}.svg`,
      `https://www.google.com/s2/favicons?sz=128&domain=${sym.toLowerCase()}.com`
    ];
  }, [sym, category]);

  // Reset when symbol changes
  useEffect(() => {
    setSrcIndex(0);
  }, [sym, category]);

  if (!sources.length || srcIndex >= sources.length) {
    // Final fallback: colourful text initials
    return (
      <div className={`asset-icon-wrapper ${category || "stock"}`} style={style}>
        {sym.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={sources[srcIndex]}
      alt={sym}
      onError={() => setSrcIndex((i) => i + 1)}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        objectFit: "contain",
        background: "#FFFFFF",
        padding: 4,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-xs)",
        flexShrink: 0,
        ...style
      }}
    />
  );
}
