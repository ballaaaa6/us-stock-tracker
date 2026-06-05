const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9"
};

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const symbolsParam = url.searchParams.get("symbols");
  const sparklineParam = url.searchParams.get("sparkline");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  // ─── 1. Autocomplete Search (?q=) ────────────────────────────────────────
  if (q) {
    try {
      const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
      const resp = await fetch(searchUrl, { headers: YF_HEADERS });
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: "ค้นหาไม่สำเร็จ" }), { status: resp.status, headers: corsHeaders });
      }
      const data = await resp.json();
      const results = (data.quotes || []).map((item) => ({
        symbol: item.symbol,
        name: item.longname || item.shortname || item.dispName || item.symbol,
        type: item.quoteType || item.typeDisp || "UNKNOWN",
        exchange: item.exchDisp || item.exchange || "GLOBAL"
      }));
      return new Response(JSON.stringify(results), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: "ข้อผิดพลาดค้นหา: " + err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  // ─── 2. Sparkline History (?sparkline=SYM1,SYM2&tf=1M) ────────────────
  if (sparklineParam) {
    try {
      const symbols = sparklineParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const tf = (url.searchParams.get("tf") || "1M").toUpperCase();

      const tfMap = {
        "1D": { range: "1d", interval: "5m" },
        "5D": { range: "5d", interval: "60m" },
        "1W": { range: "7d", interval: "30m" },
        "1M": { range: "1mo", interval: "1d" },
        "3M": { range: "3mo", interval: "1d" },
        "6M": { range: "6mo", interval: "1d" },
        YTD: { range: "ytd", interval: "1d" },
        "1Y": { range: "1y", interval: "1d" },
        "2Y": { range: "2y", interval: "1d" },
        "5Y": { range: "5y", interval: "1d" },
        MAX: { range: "max", interval: "1d" }
      };
      const { range, interval } = tfMap[tf] || tfMap["1M"];

      const historyFetches = symbols.map(async (symbol) => {
        try {
          const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
          const resp = await fetch(chartUrl, { headers: YF_HEADERS });
          if (!resp.ok) return { symbol, dates: [], closes: [] };

          const data = await resp.json();
          const result = data?.chart?.result?.[0];
          if (!result) return { symbol, dates: [], closes: [] };

          const timestamps = result.timestamp || [];
          const rawCloses = result.indicators?.quote?.[0]?.close || [];

          // Filter out null values (non-trading days)
          const paired = timestamps
            .map((ts, i) => ({
              date: new Date(ts * 1000).toISOString(),
              close: rawCloses[i]
            }))
            .filter((p) => p.close != null && p.close > 0);

          return {
            symbol,
            dates: paired.map((p) => p.date),
            closes: paired.map((p) => p.close)
          };
        } catch {
          return { symbol, dates: [], closes: [] };
        }
      });

      const results = await Promise.all(historyFetches);
      const sparklineMap = {};
      results.forEach((r) => {
        sparklineMap[r.symbol] = { dates: r.dates, closes: r.closes };
      });

      return new Response(JSON.stringify(sparklineMap), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: "โหลดประวัติราคาไม่สำเร็จ: " + err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  // ─── 3. Live Prices (?symbols=) ─────────────────────────────────────────
  if (symbolsParam) {
    try {
      let symbolsList = symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (!symbolsList.includes("THB=X")) symbolsList.push("THB=X");

      const priceFetches = symbolsList.map(async (symbol) => {
        try {
          const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
          const resp = await fetch(chartUrl, { headers: YF_HEADERS });
          if (!resp.ok) return null;

          const data = await resp.json();
          const result = data?.chart?.result?.[0];
          if (!result) return null;

          const meta = result.meta;
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.chartPreviousClose || meta.previousClose || price;
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          // Determine current market state from trading periods
          let marketState = "REGULAR";
          const now = Math.floor(Date.now() / 1000);
          const ctp = meta.currentTradingPeriod;
          if (ctp) {
            const pre = ctp.pre;
            const reg = ctp.regular;
            const post = ctp.post;

            if (pre && now >= pre.start && now < pre.end) {
              marketState = "PRE";
            } else if (reg && now >= reg.start && now < reg.end) {
              marketState = "REGULAR";
            } else if (post && now >= post.start && now < post.end) {
              marketState = "POST";
            } else {
              marketState = "CLOSED";
            }
          }

          // Extract last close from the 5m chart
          const timestamps = result.timestamp || [];
          const rawCloses = result.indicators?.quote?.[0]?.close || [];
          const paired = timestamps
            .map((ts, i) => ({
              ts,
              close: rawCloses[i]
            }))
            .filter((p) => p.close != null && p.close > 0);

          const lastPoint = paired[paired.length - 1];
          const lastPrice = lastPoint ? lastPoint.close : price;

          let prePrice = null;
          let postPrice = null;

          if (marketState === "PRE") {
            prePrice = lastPrice;
          } else if (marketState === "POST") {
            postPrice = lastPrice;
          } else if (marketState === "CLOSED") {
            // Keep showing after-hours price if the last point lies in the post-market window
            if (ctp && ctp.post && lastPoint && lastPoint.ts >= ctp.post.start && lastPoint.ts <= ctp.post.end) {
              postPrice = lastPrice;
            }
          }

          return {
            symbol,
            price,
            change,
            changePercent,
            previousClose: prevClose,
            currency: meta.currency || "USD",
            marketState,
            prePrice,
            preChangePercent: prePrice && prevClose ? ((prePrice - prevClose) / prevClose) * 100 : null,
            postPrice,
            postChangePercent: postPrice && price ? ((postPrice - price) / price) * 100 : null
          };
        } catch {
          return null;
        }
      });

      const fetched = await Promise.all(priceFetches);

      let exchangeRate = 35.0;
      const quotesMap = {};

      fetched.forEach((item) => {
        if (!item) return;
        if (item.symbol === "THB=X") {
          exchangeRate = item.price || 35.0;
        }
        quotesMap[item.symbol] = item;
      });

      return new Response(JSON.stringify({ quotes: quotesMap, exchangeRate }), { status: 200, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: "โหลดราคาไม่สำเร็จ: " + err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  // ─── 4. Detailed Asset History (?history=SYM&tf=1D|5D|1M|3M|6M|1Y) ──────
  const historyParam = url.searchParams.get("history");
  if (historyParam) {
    try {
      const symbol = historyParam.trim().toUpperCase();
      const tf = (url.searchParams.get("tf") || "1M").toUpperCase();

      // Map TF → Yahoo Finance range + interval
      const tfMap = {
        "1D": { range: "1d", interval: "5m" },
        "5D": { range: "5d", interval: "60m" },
        "1W": { range: "7d", interval: "30m" },
        "1M": { range: "1mo", interval: "1d" },
        "3M": { range: "3mo", interval: "1d" },
        "6M": { range: "6mo", interval: "1d" },
        YTD: { range: "ytd", interval: "1d" },
        "1Y": { range: "1y", interval: "1d" },
        "2Y": { range: "2y", interval: "1d" },
        "5Y": { range: "5y", interval: "1d" },
        MAX: { range: "max", interval: "1d" }
      };
      const { range, interval } = tfMap[tf] || tfMap["1M"];

      const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
      const resp = await fetch(chartUrl, { headers: YF_HEADERS });
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: "ดึงข้อมูลไม่สำเร็จ", status: resp.status }), {
          status: resp.status,
          headers: corsHeaders
        });
      }

      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        return new Response(JSON.stringify({ error: "ไม่มีข้อมูลกราฟ" }), { status: 404, headers: corsHeaders });
      }

      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const vols = quote.volume || [];

      // Build candle array, filter null
      const candles = timestamps
        .map((ts, i) => ({
          ts,
          date: new Date(ts * 1000).toISOString(),
          open: opens[i] ?? null,
          high: highs[i] ?? null,
          low: lows[i] ?? null,
          close: closes[i] ?? null,
          volume: vols[i] ?? null
        }))
        .filter((c) => c.close != null && c.close > 0);

      const meta = result.meta || {};

      return new Response(
        JSON.stringify({
          symbol,
          tf,
          interval,
          currency: meta.currency || "USD",
          regularMarketPrice: meta.regularMarketPrice,
          candles
        }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      return new Response(JSON.stringify({ error: "History error: " + err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }

  return new Response(JSON.stringify({ error: "ระบุพารามิเตอร์ ?symbols= หรือ ?q= หรือ ?sparkline= หรือ ?history=" }), {
    status: 400,
    headers: corsHeaders
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
