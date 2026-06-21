/**
 * ocrParser.js — Gemini Vision API receipt parser for Dime! trading receipts
 *
 * Strategy (v2 — Gemini Vision Only):
 * 1. Send receipt images to Google Gemini Vision API in batches
 * 2. Use structured output (responseSchema) for consistent JSON format
 * 3. Validate and clean extracted fields
 *
 * Removed: Tesseract.js, Canvas Cropping, regex-based parsing
 * Reason: Tesseract.js cannot reliably read modern Thai UI fonts (Dime! app)
 */

/**
 * Build the optimized Gemini Vision prompt for Dime! receipts.
 * Includes 1-shot example and detailed field definitions.
 */
export function buildDimeReceiptPrompt(imageCount) {
  return `You are analyzing ${imageCount} stock trading receipt image(s) from the Dime! app (Thai broker by SCBS).

IMPORTANT INSTRUCTIONS:
- Each image is a single receipt screenshot
- Extract data EXACTLY as shown on the receipt — do NOT guess or infer values
- The receipt is in Thai language with some English (stock symbols, USD amounts)

FIELD EXTRACTION RULES:

1. transactionType:
   - Look at the TOP LEFT of the receipt
   - "ซื้อ" = "BUY"
   - "ขาย" = "SELL"

2. symbol:
   - The stock ticker appears RIGHT AFTER "ซื้อ" or "ขาย" at the top
   - Always uppercase English letters (e.g., NVDA, AAPL, MU, TSLA, MSFT, AMZN, META, GOOGL)
   - For Thai mutual funds: e.g., K-USA, SCB-GOLD, K-CHANGE

3. qty (จำนวนหุ้น):
   - For MARKET orders: look for the number in the "จำนวนหุ้น" column (right side of the price table)
   - For LIMIT orders: look for the number followed by "หุ้น" near the top (e.g., "10 หุ้น", "1 หุ้น", "60 หุ้น")
   - Can be fractional (e.g., 17.5941041, 75.9920476)
   - NEVER use the total amount as qty

4. price (ราคาที่ได้จริง — Executed Price Per Share):
   - THIS IS CRITICAL: Use ONLY the "ราคาที่ได้จริง" (executed/actual price) value
   - For MARKET orders: it appears as "ราคาที่ได้จริง" with a USD amount (e.g., "130.60 USD")
   - For LIMIT orders: there are TWO prices — "ราคาที่คุณตั้ง" (your set price) and "ราคาที่ได้จริง" (executed price) — use the SECOND one (ราคาที่ได้จริง)
   - This is the PRICE PER SHARE, not the total
   - Do NOT use มูลค่าหุ้น (total stock value) or ยอดที่ต้องชำระ (total payment)

5. date (วันที่ส่งคำสั่ง — Order Date):
   - Find "วันที่ส่งคำสั่ง" label
   - Format: DD เดือนย่อ YY (Thai Buddhist Era abbreviated month + 2-digit BE year)
   - Convert to YYYY-MM-DD (CE/Gregorian):
     - Year conversion: YY + 1957 (e.g., 68 → 2025, 69 → 2026)
     - Month mapping: ม.ค.=01, ก.พ.=02, มี.ค.=03, เม.ย.=04, พ.ค.=05, มิ.ย.=06, ก.ค.=07, ส.ค.=08, ก.ย.=09, ต.ค.=10, พ.ย.=11, ธ.ค.=12
   - Example: "23 พ.ค. 68" → "2025-05-23"
   - Example: "5 ก.ย. 68" → "2025-09-05"

6. time:
   - On the same line as the date, after the dash
   - Format: HH:MM (24-hour)
   - Example: "23 พ.ค. 68 - 22:14 น." → time = "22:14"

7. name: Full company/asset name for the symbol
   - NVDA → "NVIDIA Corporation"
   - AAPL → "Apple Inc."
   - MU → "Micron Technology"
   etc.

8. category: "stock" for US/Thai equities, "crypto" for BTC/ETH etc, "gold" for gold ETFs/funds

EXAMPLE — Market Order (Buy):
Receipt shows: "ซื้อ NVDA", "ราคาที่ได้จริง 130.60 USD", "จำนวนหุ้น 17.5941041", "วันที่ส่งคำสั่ง 23 พ.ค. 68 - 22:14 น."
Expected output:
{"index":0,"transactionType":"BUY","symbol":"NVDA","name":"NVIDIA Corporation","category":"stock","qty":17.5941041,"price":130.60,"date":"2025-05-23","time":"22:14"}

EXAMPLE — Limit Order (Sell):
Receipt shows: "ขาย NVDA", "60 หุ้น", "ราคาที่คุณตั้ง 172.18 USD", "ราคาที่ได้จริง 172.18 USD", "วันที่ส่งคำสั่ง 18 ก.ค. 68 - 21:28 น."
Expected output:
{"index":0,"transactionType":"SELL","symbol":"NVDA","name":"NVIDIA Corporation","category":"stock","qty":60,"price":172.18,"date":"2025-07-18","time":"21:28"}

For each receipt image, output a JSON object. If analyzing multiple images, output a JSON array.
Each object MUST include the "index" field matching the SLIP INDEX number provided before each image.

Output ONLY valid JSON — no explanations, no markdown, no extra text.`;
}

/**
 * Gemini response schema for structured output.
 * Forces the AI to return data in exactly this shape.
 */
export function getDimeReceiptSchema() {
  return {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        index:           { type: "INTEGER",  description: "Image index number" },
        transactionType: { type: "STRING",   description: "BUY or SELL",                     enum: ["BUY", "SELL"] },
        symbol:          { type: "STRING",   description: "Stock ticker symbol (uppercase)" },
        name:            { type: "STRING",   description: "Full company/asset name" },
        category:        { type: "STRING",   description: "Asset category",                  enum: ["stock", "crypto", "gold", "fiat"] },
        qty:             { type: "NUMBER",   description: "Quantity of shares/units" },
        price:           { type: "NUMBER",   description: "Executed price per share (ราคาที่ได้จริง)" },
        date:            { type: "STRING",   description: "Transaction date in YYYY-MM-DD format" },
        time:            { type: "STRING",   description: "Transaction time in HH:MM format" }
      },
      required: ["index", "transactionType", "symbol", "name", "category", "qty", "price", "date", "time"]
    }
  };
}

/**
 * Clean a string representation of a number to a clean float.
 */
function parseNumeric(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const cleaned = String(value)
    .replace(/[$,฿]/g, "")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "")
    .trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Validate and clean a single parsed receipt from AI response.
 * Returns a cleaned object or null if invalid.
 */
export function validateParsedReceipt(data, imageIndex) {
  if (!data) return null;

  // ── Symbol cleanup ──
  let symbol = String(data.symbol || "").trim().toUpperCase();
  // Allow Thai mutual fund symbols with hyphens (e.g. K-USA, SCB-GOLD)
  symbol = symbol.replace(/[^A-Z0-9.-]/g, "");
  if (!symbol || /^\d+$/.test(symbol)) return null;

  // ── Quantity ──
  const qty = parseNumeric(data.qty);
  if (qty <= 0) return null;

  // ── Price ──
  let price = parseNumeric(data.price);
  if (price <= 0) return null;

  // Sanity check: if price looks like a total (> $50,000 and qty > 1), divide
  if (price > 50000 && qty > 1) {
    price = price / qty;
  }

  // ── Date validation ──
  let date = String(data.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    date = new Date().toISOString().split("T")[0];
  }
  // Sanity: year should be 2020-2030
  const year = parseInt(date.split("-")[0]);
  if (year < 2020 || year > 2030) {
    date = new Date().toISOString().split("T")[0];
  }

  // ── Time validation ──
  let time = String(data.time || "");
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    time = "";
  }

  // ── Transaction type ──
  const transactionType = String(data.transactionType || "BUY").toUpperCase();
  if (transactionType !== "BUY" && transactionType !== "SELL") {
    return null;
  }

  // ── Category ──
  const VALID_CATEGORIES = new Set(["stock", "crypto", "gold", "fiat"]);
  let category = String(data.category || "stock").toLowerCase();
  if (!VALID_CATEGORIES.has(category)) category = "stock";

  return {
    index: imageIndex ?? data.index ?? 0,
    symbol,
    name: String(data.name || symbol),
    category,
    transactionType,
    qty,
    price,
    date,
    time,
    broker: data.broker || "Dime! (Kiatnakin Phatra / เกียรตินาคินภัทร)"
  };
}
