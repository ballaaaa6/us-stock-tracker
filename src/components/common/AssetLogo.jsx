import React, { useState, useEffect, useMemo } from "react";

export default function AssetLogo({ symbol, category, style }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const sym = symbol ? symbol.split(".")[0].toUpperCase() : "";

  // Build ordered list of logo sources to try
  const sources = useMemo(() => {
    if (!sym) return [];
    const cat = category || "stock";

    if (cat === "fiat") {
      const code = ({
        THB:"th",USD:"us",EUR:"eu",JPY:"jp",GBP:"gb",AUD:"au",CAD:"ca",
        SGD:"sg",CHF:"ch",CNY:"cn",HKD:"hk",KRW:"kr",INR:"in",NZD:"nz",
        SEK:"se",NOK:"no",DKK:"dk",MYR:"my",IDR:"id",PHP:"ph",VND:"vn",
        TWD:"tw",BRL:"br",RUB:"ru",ZAR:"za",TRY:"tr",MXN:"mx"
      })[sym] || sym.slice(0,2).toLowerCase();
      return [`https://flagcdn.com/w80/${code}.png`];
    }

    if (cat === "crypto") {
      return [
        `https://assets.coincap.io/assets/icons/${sym.toLowerCase()}@2x.png`,
        `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons/128/color/${sym.toLowerCase()}.png`,
        `https://www.google.com/s2/favicons?sz=128&domain=${sym.toLowerCase()}.org`
      ];
    }

    if (cat === "gold" || sym === "XAU" || sym === "GLD" || sym === "IAU" || sym === "CL" || (symbol && symbol.toUpperCase() === "CL=F")) {
      if (sym === "CL" || (symbol && symbol.toUpperCase() === "CL=F")) {
        return [`https://images.financialmodelingprep.com/symbol/USO.png`];
      }
      return [`https://images.financialmodelingprep.com/symbol/GLD.png`];
    }

    // Stock: try local logos first, then Financial Modeling Prep, then logo.dev, then Google favicon
    const optionMatch = sym.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
    const baseSym = optionMatch ? optionMatch[1] : sym;

    const localLogos = {
      IREN: "/logos/iren.png",
      DRAM: "/logos/dram.png"
    };

    const logoList = [];

    if (localLogos[baseSym]) {
      logoList.push(localLogos[baseSym]);
    }

    const fullSym = symbol ? symbol.toUpperCase() : "";
    logoList.push(`https://images.financialmodelingprep.com/symbol/${fullSym}.png`);
    logoList.push(`https://images.financialmodelingprep.com/symbol/${baseSym}.png`);
    logoList.push(`https://img.logo.dev/ticker/${baseSym}?token=pk_R4dEIaKTRG-i8tSiILBNZA&size=128&format=png`);

    const domainOverrides = {
      IREN: "irisenergy.co",
      DRAM: "roundhillinvestments.com"
    };
    const domain = domainOverrides[baseSym] || `${baseSym.toLowerCase()}.com`;
    logoList.push(`https://www.google.com/s2/favicons?sz=128&domain=${domain}`);

    return logoList;
  }, [sym, symbol, category]);

  // Reset when symbol changes
  useEffect(() => { setSrcIndex(0); }, [sym, category]);

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
      onError={() => setSrcIndex(i => i + 1)}
      style={{
        width: 38, height: 38, borderRadius: 12,
        objectFit: "contain", background: "#FFFFFF",
        padding: 4, border: "1px solid var(--border)",
        boxShadow: "var(--shadow-xs)", flexShrink: 0,
        ...style
      }}
    />
  );
}
