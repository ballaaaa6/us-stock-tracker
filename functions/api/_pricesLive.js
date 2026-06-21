import { YF_HEADERS, getCache, putCache, extractChartPriceInfo } from "./_pricesBase.js";

export async function fetchLivePrices(symbolsParam, isDividends, noCache, context, corsHeaders) {
  try {
    let symbolsList = symbolsParam.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!symbolsList.includes("THB=X")) symbolsList.push("THB=X");

    const quotesMap = {};
    const missingSymbols = [];

    if (!noCache) {
      const cachePromises = symbolsList.map(async (symbol) => {
        const cacheKey = isDividends 
          ? `https://cache.local/price-div/${symbol}` 
          : `https://cache.local/price/${symbol}`;
        try {
          const cached = await getCache(cacheKey);
          if (cached) {
            quotesMap[symbol] = JSON.parse(cached);
            return;
          }
        } catch {}
        missingSymbols.push(symbol);
      });
      await Promise.all(cachePromises);
    } else {
      missingSymbols.push(...symbolsList);
    }

    if (missingSymbols.length > 0) {
      const priceFetches = missingSymbols.map(async (symbol) => {
        try {
          const range = isDividends ? "1y" : "1d";
          const interval = isDividends ? "1d" : "5m";
          const events = isDividends ? "&events=div" : "";
          const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true${events}`;
          const resp = await fetch(chartUrl, { headers: YF_HEADERS });
          if (!resp.ok) return null;

          const data = await resp.json();
          const result = data?.chart?.result?.[0];
          if (!result) return null;

          const parsed = extractChartPriceInfo(symbol, result, Math.floor(Date.now() / 1000));
          if (!parsed) return null;

          // Fetch Beta from Finnhub with Cache API
          let beta = null;
          const isOption = symbol.length > 10 && /\d{6}[CP]\d{8}$/.test(symbol);
          if (symbol !== "THB=X" && !symbol.includes("=") && !symbol.includes("-") && !isOption) {
            const betaCacheKey = `https://cache.local/beta/${symbol}`;
            try {
              const cachedBeta = await getCache(betaCacheKey);
              if (cachedBeta !== null) {
                beta = cachedBeta === "null" ? null : parseFloat(cachedBeta);
              } else {
                const fnToken = "d8e3e4hr01qm5ffvbi4gd8e3e4hr01qm5ffvbi50";
                const fnUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${fnToken}`;
                const fnResp = await fetch(fnUrl);
                if (fnResp.ok) {
                  const fnData = await fnResp.json();
                  const fetchedBeta = fnData?.metric?.beta;
                  if (fetchedBeta != null) {
                    beta = parseFloat(fetchedBeta);
                    putCache(context, betaCacheKey, String(beta), 604800); // 7 days cache
                  } else {
                    putCache(context, betaCacheKey, "null", 86400); // 1 day cache for null
                  }
                }
              }
            } catch (e) {
              console.error("Finnhub Beta error:", e);
            }
          }

          const dividends = result.events?.dividends;
          const entry = {
            ...parsed,
            dividends: dividends || null,
            beta
          };

          if (entry.price > 0) {
            const cacheKey = isDividends 
              ? `https://cache.local/price-div/${symbol}` 
              : `https://cache.local/price/${symbol}`;
            const cacheTTL = isDividends ? 43200 : 30;
            putCache(context, cacheKey, JSON.stringify(entry), cacheTTL);
          }

          return entry;
        } catch {
          return null;
        }
      });

      const fetched = await Promise.all(priceFetches);
      fetched.forEach(item => {
        if (item) quotesMap[item.symbol] = item;
      });
    }

    const exchangeRate = quotesMap["THB=X"]?.price || 35.0;
    return new Response(JSON.stringify({ quotes: quotesMap, exchangeRate }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: "โหลดราคาไม่สำเร็จ: " + err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function fetchDetailedAssetHistory(historyParam, tf, context, corsHeaders) {
  try {
    const symbol = historyParam.trim().toUpperCase();

    const cacheKey = `https://cache.local/history/${tf}/${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return new Response(cached, { status: 200, headers: corsHeaders });

    const tfMap = {
      "1D":  { range: "1d",  interval: "5m"  },
      "5D":  { range: "5d",  interval: "60m" },
      "1W":  { range: "7d",  interval: "30m" },
      "1M":  { range: "1mo", interval: "1d"  },
      "3M":  { range: "3mo", interval: "1d"  },
      "6M":  { range: "6mo", interval: "1d"  },
      "YTD": { range: "ytd", interval: "1d"  },
      "1Y":  { range: "1y",  interval: "1d"  },
      "2Y":  { range: "2y",  interval: "1d"  },
      "5Y":  { range: "5y",  interval: "1d"  },
      "MAX": { range: "max", interval: "1d"  },
    };
    const { range, interval } = tfMap[tf] || tfMap["1M"];

    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=true`;
    const resp = await fetch(chartUrl, { headers: YF_HEADERS });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "ดึงข้อมูลไม่สำเร็จ", status: resp.status }), { status: resp.status, headers: corsHeaders });
    }

    let data;
    try {
      data = await resp.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "ไม่สามารถแปลงข้อมูลราคาจาก Yahoo Finance ได้ชั่วคราว (เซิร์ฟเวอร์อาจบล็อกคำขอ)", status: 502 }), { status: 502, headers: corsHeaders });
    }

    const result = data?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ error: "ไม่มีข้อมูลกราฟ" }), { status: 404, headers: corsHeaders });
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens  = quote.open   || [];
    const highs  = quote.high   || [];
    const lows   = quote.low    || [];
    const closes = quote.close  || [];
    const vols   = quote.volume || [];

    const candles = timestamps.map((ts, i) => ({
      ts,
      date: new Date(ts * 1000).toISOString(),
      open:   opens[i]  ?? null,
      high:   highs[i]  ?? null,
      low:    lows[i]   ?? null,
      close:  closes[i] ?? null,
      volume: vols[i]   ?? null,
    })).filter(c => c.close != null && c.close > 0);

    const meta = result.meta || {};

    const responseBody = JSON.stringify({
      symbol,
      tf,
      interval,
      currency: meta.currency || "USD",
      regularMarketPrice: meta.regularMarketPrice,
      candles,
    });

    if (candles.length > 0) {
      putCache(context, cacheKey, responseBody, 300);
    }

    return new Response(responseBody, { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: "History error: " + err.message }), { status: 500, headers: corsHeaders });
  }
}
