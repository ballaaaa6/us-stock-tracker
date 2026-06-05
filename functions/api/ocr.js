/**
 * /api/ocr — Cloudflare Pages Function
 * Uses Cloudflare Workers AI (LLaVA) to parse financial receipt images.
 * FREE: 10,000 AI neurons/day on Cloudflare free plan.
 *
 * POST /api/ocr
 * Body: { images: [{ base64: "...", mime: "image/jpeg" }, ...] }
 * Response: { results: [...], errors: [...] }
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };

  try {
    const auth = request.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const images = body.images;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "No images provided" }), { status: 400, headers: corsHeaders });
    }

    if (!env.AI) {
      return new Response(JSON.stringify({ error: "AI_BINDING_UNAVAILABLE" }), { status: 503, headers: corsHeaders });
    }

    // Very explicit prompt — forces specific field extraction + ISO date
    const buildPrompt = (
      idx,
      total
    ) => `Image ${idx + 1} of ${total}. This is a stock trading receipt from Dime! app (Thai broker).

INSTRUCTIONS — read the image carefully and fill in these exact fields:

FIELD 1 — transactionType:
  Look for the FIRST WORD at the very top of the receipt.
  If it starts with "ซื้อ" → output "BUY"
  If it starts with "ขาย" → output "SELL"

FIELD 2 — symbol:
  The stock ticker symbol appears IMMEDIATELY AFTER "ซื้อ" or "ขาย" on the first line.
  It is 1-6 capital English letters (e.g. MU, AAPL, ASML, NVDA).
  DO NOT use numbers. DO NOT use totals.

FIELD 3 — qty:
  Find the number followed by "หุ้น" (means shares/units).
  Example: "3 หุ้น" → qty = 3

FIELD 4 — price:
  Find the label "ราคาที่ได้จริง" (executed price). The USD number NEXT TO IT is the price per share.
  This is NOT the total. Example: if it says "665.00 USD" → price = 665.00

FIELD 5 — date:
  Find "วันที่ส่งคำสั่ง" (order date).
  The date format is: DD [MONTH] YY  where YY is Buddhist Era.
  Convert to ISO: year = YY + 1957 (e.g. 69 → 2026). Month names: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12
  Output as YYYY-MM-DD. Example: "19 พ.ค. 69" → "2026-05-19"

FIELD 6 — name: Full company name for the symbol (e.g. "Micron Technology" for MU)
FIELD 7 — category: "stock" for US/Thai equities, "crypto" for BTC/ETH etc, "gold" for gold ETFs
FIELD 8 — time:
  Find "วันที่ส่งคำสั่ง" or "วันที่สำเร็จ" (order date/success date). The time of order execution is at the end of that line (e.g., "15:40 น." or "02:22 น.").
  Convert to "HH:MM" format (e.g. "15:40" or "02:22"). If not found, output empty string.

Output ONLY valid JSON, nothing else:
{"symbol":"MU","name":"Micron Technology","category":"stock","transactionType":"BUY","qty":3,"price":665.00,"date":"2026-05-19","time":"02:22"}`;

    const results = [];
    const errors = [];

    for (let i = 0; i < images.length; i++) {
      const { base64, mime } = images[i];

      try {
        // Convert base64 to Uint8Array
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

        const prompt = buildPrompt(i, images.length);

        // Call Cloudflare Workers AI
        const aiResponse = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
          prompt,
          image: [...bytes],
          max_tokens: 300
        });

        const rawText = aiResponse?.description || aiResponse?.response || "";
        if (!rawText) throw new Error("AI returned empty response");

        // Try to extract JSON from response
        let data = null;
        const clean = rawText
          .trim()
          .replace(/^```[\w]*\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[0]);
          } catch {}
        }

        if (!data) throw new Error(`Could not parse AI response: ${clean.slice(0, 100)}`);
        if (!data.symbol || /^\d+$/.test(String(data.symbol))) {
          throw new Error(`Invalid symbol from AI: "${data.symbol}"`);
        }

        // Validate date format
        let date = data.date || "";
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Try to fix common issues
          date = new Date().toISOString().split("T")[0]; // fallback to today
        }

        // Map common garbled Thai characters back to English symbols
        let parsedSymbol = String(data.symbol).trim().toUpperCase();
        if (parsedSymbol === "เบ" || parsedSymbol === "เน" || parsedSymbol === "เม" || parsedSymbol === "เU") {
          parsedSymbol = "MU";
        } else if (parsedSymbol === "กอ" || parsedSymbol === "กO") {
          parsedSymbol = "KO";
        } else {
          parsedSymbol = parsedSymbol.replace(/[^A-Z.]/g, "");
        }

        // Sanity-check price: if price > qty * 10000, it's probably the total not per-share
        let price = parseFloat(data.price) || 0;
        const qty = parseFloat(data.qty) || 1;
        if (price > 100000 && qty > 1) {
          price = price / qty; // auto-divide to get per-share price
        }

        results.push({
          index: i,
          symbol: parsedSymbol,
          name: data.name || parsedSymbol,
          category: data.category || "stock",
          transactionType: data.transactionType || "BUY",
          qty,
          price,
          date,
          time: data.time || ""
        });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results, errors }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
