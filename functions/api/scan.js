/**
 * /api/scan — Cloudflare Pages Function (Workers AI Only)
 *
 * Receives one or more base64-encoded financial asset slip images,
 * uses Cloudflare Workers AI (@cf/google/gemma-4-26b-a4b-it)
 * to extract transaction data, and returns the structured results.
 *
 * POST /api/scan
 * Headers:
 *   Authorization: Bearer <userId>
 *   Content-Type:  application/json
 * Body: {
 *   images: [{ base64: string, mime: string }],  // 1–10 images per call
 *   skipSave: boolean                            // true to return results without saving to KV
 * }
 */

// ─── CORS headers ────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};

// ─── Prompt & Schema Context ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert OCR transcription tool for Dime! (by SCB) trading receipts.
Your task is to transcribe specific text fields from the receipt image.
Extract the data into a JSON object with the following fields. Do not translate the text, just transcribe exactly what is visible on the image:

{
  "header_text": "The green/red text showing the transaction type and ticker (e.g. ซื้อ [ticker] or ขาย [ticker])",
  "header_color": "The color of the header text (either 'green' or 'red/pink')",
  "status_text": "The status section text near the top (e.g. จับคู่แล้ว or สำเร็จ. คุณได้รับเงินค่าขายคืนแล้ว)",
  "bold_amount": "The large bold green/red text displayed under the asset name. Transcribe EXACTLY including the unit (e.g. '74,999.87 THB', '11,541.59 USD', '60 หุ้น', '100.5480039 หุ้น', '10 หุ้น')",
  "symbol": "The uppercase stock ticker symbol from the header",
  "actual_price": "The executed price per share. Next to 'ราคาที่ได้จริง' or under the column header 'ราคาที่ได้จริง' (transcribe exact numeric text and currency like '[number] USD')",
  "stock_value": "The total stock value next to 'มูลค่าหุ้น' (transcribe exact numeric text and currency like '74,999.87 THB' or '11,541.59 USD'). DO NOT transcribe the share quantity (long decimal number) here.",
  "qty_table": "IMPORTANT: This is ONLY the number next to or under the label 'จำนวนหุ้น'/'จำนวนหน่วย'. It appears on the SAME LINE as 'ราคาที่ได้จริง' in Market orders (e.g. left side shows 'ราคาที่ได้จริง 130.60 USD', right side shows 'จำนวนหุ้น 17.5941041'). If no 'จำนวนหุ้น'/'จำนวนหน่วย' label exists on the receipt, return 'N/A'. NEVER return a commission, VAT, stock value, or any other number here.",
  "exchange_rate": "The exchange rate if visible on the receipt, next to 'อัตราแลกเปลี่ยน' (e.g. '1 USD = 32.64 THB' → return '32.64'). Return 'N/A' if not visible.",
  "order_type": "The order type: 'Market' if the receipt shows 'ใช้ราคาตลาด (Market)' or 'ราคาตลาด (Market)', or 'Limit' if it shows 'ตั้งราคาเอง (Limit)'. Look near 'ประเภทคำสั่ง' label or below the bold amount.",
  "raw_date": "The date-time string next to 'วันที่ส่งคำสั่ง', 'วันที่สำเร็จ', or inside the top card 'สถานะ (ณ ...)' (transcribe the exact text, e.g., '[day] [month] [year] - [time]')",
  "has_received_cash_back_label": true or false, indicating if the label 'ยอดที่จะได้รับคืน' or phrase 'เงินค่าขายคืน' appears anywhere on the receipt,
  "has_payment_amount_label": true or false, indicating if the label 'ยอดที่ต้องชำระ' appears anywhere on the receipt
}

CRITICAL TRANSCRIPTION DIRECTIONS:
1. DATE ACCURACY: Look extremely closely at the Thai month abbreviation in raw_date. The loopless modern Thai font (ไม่มีหัว) used by the app makes some letters look highly similar:
   - "ก.ค." = กรกฎาคม (July). Starts with 'ก' (arch shape, open bottom, no curve inside).
   - "ม.ค." = มกราคม (January). Starts with 'ม' (has a subtle loop/curve at the bottom left).
   - "มิ.ย." = มิถุนายน (June). Has 'ม' with a curve vowel symbol 'ิ' on top, and ends with 'ย'.
   - "มี.ค." = มีนาคม (March). Has 'ม' with a loop vowel symbol 'ี' on top, and ends with 'ค'.
   Be extremely careful not to confuse "ก.ค." (July) with "ม.ค." (January) or "มิ.ย." (June) with "ม.ค." (January).

2. NO CALCULATION OR MATH: Do NOT perform any mathematical division or calculation yourself. Transcribe the exact numbers visible in the image. For "qty_table", do NOT divide "bold_amount" by "actual_price" to calculate it; copy the exact digits printed next to or under the "จำนวนหุ้น" / "จำนวนหน่วย" header.

3. RECEIPT LAYOUT TYPES — There are exactly 4 layouts. Understanding them helps you find qty_table correctly:
   a. Fractional BUY (Market): bold_amount is a CURRENCY amount (e.g. "11,541.59 USD" or "74,999.87 THB"). The จำนวนหุ้น appears on the SAME LINE as ราคาที่ได้จริง, on the RIGHT SIDE. It is a LONG DECIMAL like 75.9920476. This is the qty_table value.
   b. Whole-share BUY (Limit): bold_amount is "N หุ้น" (e.g. "10 หุ้น"). There is NO จำนวนหุ้น label or row anywhere. qty_table should be "N/A".
   c. Whole-share SELL (Limit): bold_amount is "N หุ้น" (e.g. "60 หุ้น", "114 หุ้น"). There is NO จำนวนหุ้น label or row. qty_table should be "N/A".
   d. Fractional SELL (Market): bold_amount is "N.NNNNNNN หุ้น" (e.g. "100.5480039 หุ้น"). There is NO จำนวนหุ้น label or row. qty_table should be "N/A".
   KEY RULE: qty_table exists ONLY in layout (a) — Fractional BUY Market orders. For all other layouts, return "N/A".

4. QUANTITY VS COMMISSION/STOCK VALUE ACCURACY: When transcribing "qty_table", be extremely careful:
   - The จำนวนหุ้น value is on the SAME LINE as ราคาที่ได้จริง, positioned to its RIGHT. It is NOT in the fee table below.
   - Do NOT confuse it with "มูลค่าหุ้น" (Stock Value, e.g., 74,999.87), "ค่าคอมมิชชัน" (Commission, e.g., 6.07), or "ภาษีมูลค่าเพิ่ม" (VAT, e.g., 0.18). These are in separate rows BELOW.
   - The share quantity has 6-8 decimal places (e.g., 75.9920476). Fees always have exactly 2 decimal places.

5. NO FILLER: Output Raw JSON only. No markdown, no explanation. Start with '{', end with '}'.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
 * Deterministic cross-validation for share_amount.
 *
 * สำหรับคำสั่ง Market BUY ตัวเลขตัวใหญ่สีเขียวด้านบนคือยอดรวม (เช่น 11,541.59 USD)
 * ไม่ใช่จำนวนหุ้น — แต่ AI ชอบดึงยอดรวมมาใส่เป็น share_amount
 *
 * วิธีตรวจ: ถ้า shares × price > 500,000 USD แสดงว่า share_amount จริงๆ คือยอดรวม
 * แก้โดย: real_shares = total / price_per_share
 *
 * ตรวจสอบกับสลิปตัวอย่าง 7 ใบผ่านหมด:
 *  - สลิปปกติ: 84 × 183 = 15,393 < 500K → ไม่แก้ ✓
 *  - สลิปพัง: 11541 × 151 = 1,752,850 > 500K → แก้เป็น 11541/151 = 75.99 ✓
 */
function crossValidateShareAmount(shareAmount, actualPrice) {
  if (actualPrice <= 0 || shareAmount <= 0) return shareAmount;

  const product = shareAmount * actualPrice;

  // ถ้ายอดรวมเกิน $500K = AI เอายอดเงินมาใส่แทนจำนวนหุ้นแน่ๆ
  if (product > 500000) {
    const corrected = shareAmount / actualPrice;
    if (corrected > 0.0001) {
      return parseFloat(corrected.toFixed(8));
    }
  }

  return shareAmount;
}

/**
 * Parse a raw Thai date string into ISO 8601 (YYYY-MM-DDTHH:MM:SS) format.
 */
function parseThaiDateToISO(rawStr) {
  if (!rawStr || typeof rawStr !== "string") return "";

  // 1. Try to match Thai Date layout with explicit months: e.g. "22 ก.ค. 68" or "22 ก.ค. 2025" or "22ก.ค.68"
  const dayMatch = rawStr.match(
    /(?:ณ\s+|ส่งคำสั่ง\s+|สำเร็จ\s+)?(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{2,4})/
  );
  const timeMatch = rawStr.match(/(\d{1,2}):(\d{2})/);

  let year = "";
  let month = "";
  let dStr = "";

  if (dayMatch) {
    dStr = dayMatch[1].padStart(2, "0");
    const mStr = dayMatch[2].trim();
    const yStr = dayMatch[3].trim();

    const monthMap = {
      "ม.ค.": "01",
      "ม.ค": "01",
      มกราคม: "01",
      "ก.พ.": "02",
      "ก.พ": "02",
      กุมภาพันธ์: "02",
      "มี.ค.": "03",
      "มี.ค": "03",
      มีนาคม: "03",
      "เม.ย.": "04",
      "เม.ย": "04",
      เมษายน: "04",
      "พ.ค.": "05",
      "พ.ค": "05",
      พฤษภาคม: "05",
      "มิ.ย.": "06",
      "มิ.ย": "06",
      มิถุนายน: "06",
      "ก.ค.": "07",
      "ก.ค": "07",
      กรกฎาคม: "07",
      "ส.ค.": "08",
      "ส.ค": "08",
      สิงหาคม: "08",
      "ก.ย.": "09",
      "ก.ย": "09",
      กันยายน: "09",
      "ต.ค.": "10",
      "ต.ค": "10",
      ตุลาคม: "10",
      "พ.ย.": "11",
      "พ.ย": "11",
      พฤศจิกายน: "11",
      "ธ.ค.": "12",
      "ธ.ค": "12",
      ธันวาคม: "12"
    };

    month = monthMap[mStr] || monthMap[mStr + "."] || "";
    if (month) {
      let yr = parseInt(yStr, 10);
      if (yr < 100) {
        // Assume BE year e.g. 68 -> BE 2568 -> CE 2025
        yr = yr + 2500;
        year = String(yr - 543);
      } else if (yr > 2400) {
        // 4-digit BE year (e.g. 2568 -> CE 2025)
        year = String(yr - 543);
      } else {
        // Already 4-digit CE year (e.g. 2025)
        year = String(yr);
      }
    }
  }

  // Fallbacks: If Thai parsing didn't work, try standard date-time string regex matching
  if (!year || !month || !dStr) {
    // Check YYYY-MM-DD
    const isoMatch = rawStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      year = isoMatch[1];
      month = isoMatch[2].padStart(2, "0");
      dStr = isoMatch[3].padStart(2, "0");
    } else {
      // Check DD/MM/YYYY (CE or BE)
      const ddmmMatch = rawStr.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
      if (ddmmMatch) {
        dStr = ddmmMatch[1].padStart(2, "0");
        month = ddmmMatch[2].padStart(2, "0");
        let yr = parseInt(ddmmMatch[3], 10);
        if (yr < 100) yr += 2000;
        if (yr > 2400) yr -= 543;
        year = String(yr);
      }
    }
  }

  if (!year || !month || !dStr) return "";

  let time = "00:00:00";
  if (timeMatch) {
    time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00`;
  }

  return `${year}-${month}-${dStr}T${time}`;
}

/**
 * Clean and validate the raw object returned by Workers AI.
 */
function validateSlipData(raw) {
  if (!raw || typeof raw !== "object") return null;

  // 1. Determine Action (BUY or SELL) using a voting/heuristic system
  let action = "";
  const header = String(raw.header_text || "").toLowerCase();
  const status = String(raw.status_text || "").toLowerCase();
  const bold = String(raw.bold_amount || "").toLowerCase();
  const color = String(raw.header_color || "").toLowerCase();
  const allText = JSON.stringify(raw).toLowerCase();

  // Heuristic 1.1: Check the explicit boolean labels from receipt contents (highly reliable)
  const hasCashBack = raw.has_received_cash_back_label === true || raw.has_received_cash_back_label === "true";
  const hasPayment = raw.has_payment_amount_label === true || raw.has_payment_amount_label === "true";

  if (hasCashBack && !hasPayment) {
    action = "SELL";
  } else if (hasPayment && !hasCashBack) {
    action = "BUY";
  }

  // Heuristic 1.2: Check header_color (very reliable indicator of green vs red/pink)
  if (!action) {
    if (color.includes("red") || color.includes("pink")) {
      action = "SELL";
    } else if (color.includes("green")) {
      action = "BUY";
    }
  }

  // Heuristic 1.3: Check header_text
  if (!action) {
    if (header.includes("ซื้อ")) {
      action = "BUY";
    } else if (header.includes("ขาย")) {
      action = "SELL";
    }
  }

  // Heuristic 1.4: Check status_text
  if (!action) {
    if (status.includes("ขายคืน") || status.includes("รับเงินค่าขาย")) {
      action = "SELL";
    } else if (status.includes("ซื้อ") || status.includes("รับหุ้น") || status.includes("จับคู่")) {
      action = "BUY";
    }
  }

  // Heuristic 1.5: Check bold_amount format
  if (!action) {
    if (bold.includes("หุ้น") || bold.includes("หน่วย")) {
      action = "SELL";
    } else if (bold.includes("usd") || bold.includes("฿") || bold.includes("thb")) {
      action = "BUY";
    }
  }

  // Heuristic 1.6: Check general text fallback
  if (!action) {
    if (allText.includes("ขายคืน") || allText.includes("ขาย") || allText.includes("ยอดที่จะได้รับคืน")) {
      action = "SELL";
    } else if (allText.includes("ซื้อ") || allText.includes("จับคู่") || allText.includes("ยอดที่ต้องชำระ")) {
      action = "BUY";
    } else {
      action = "BUY"; // Default
    }
  }

  // 2. Parse Symbol
  let symbol = String(raw.symbol || "")
    .trim()
    .toUpperCase();
  if (!symbol && header) {
    const match = header.match(/(?:ซื้อ|ขาย)\s*([A-Z0-9.\-]+)/i);
    if (match) {
      symbol = match[1].toUpperCase();
    }
  }
  symbol = symbol.replace(/[^A-Z0-9.\-]/g, "");
  if (!symbol || /^\d+$/.test(symbol)) return null;

  // 3. Clean and parse numbers
  const price = parseNumeric(raw.actual_price);
  const stockValue = parseNumeric(raw.stock_value);
  const qtyTable = parseNumeric(raw.qty_table);
  const boldNum = parseNumeric(raw.bold_amount);
  const boldText = String(raw.bold_amount || "").toLowerCase();

  // Resolve exchange rate if available (from AI or fallback)
  let exchangeRate = 0;
  if (raw.exchange_rate && raw.exchange_rate !== "N/A") {
    const rateMatch = String(raw.exchange_rate).match(/(\d{2,3}(?:\.\d+)?)/);
    if (rateMatch) {
      exchangeRate = parseFloat(rateMatch[1]);
    }
  }

  // Check currency in bold_amount, stock_value, header_text, and status_text
  const boldStr = String(raw.bold_amount || "").toLowerCase();
  const valueStr = String(raw.stock_value || "").toLowerCase();
  const headerStr = String(raw.header_text || "").toLowerCase();
  const statusStr = String(raw.status_text || "").toLowerCase();
  const hasTHBUnit =
    boldStr.includes("บาท") ||
    boldStr.includes("thb") ||
    boldStr.includes("฿") ||
    valueStr.includes("บาท") ||
    valueStr.includes("thb") ||
    valueStr.includes("฿") ||
    headerStr.includes("บาท") ||
    headerStr.includes("thb") ||
    statusStr.includes("บาท") ||
    statusStr.includes("thb") ||
    exchangeRate > 0;

  if (price <= 0) return null;

  // ─── 4. Resolve Quantity (share_amount) ───
  //
  // Dime! receipts have 4 layout types with different quantity locations:
  //   Layout A (Fractional BUY / Market): bold = currency amount, qty in table (จำนวนหุ้น)
  //   Layout B (Whole BUY / Limit):       bold = "N หุ้น", NO qty in table
  //   Layout C (Whole SELL / Limit):      bold = "N หุ้น", NO qty in table
  //   Layout D (Fractional SELL / Market): bold = "N.NNNN หุ้น", NO qty in table
  //
  // RULE: If bold contains "หุ้น" or "หน่วย", the quantity IS in the bold text.
  //       Otherwise, the quantity is in the table (qty_table) — but only if valid.
  let share_amount = 0;

  // 4.1 Check if bold_amount directly contains the share count
  const isBoldUnitCount =
    boldText.includes("หุ้น") || boldText.includes("หน่วย") || boldText.includes("share") || boldText.includes("unit");

  if (isBoldUnitCount && boldNum > 0) {
    // ══ Layouts B, C, D: Bold text contains the share count ══
    // Works for both integer ("60 หุ้น") and fractional ("100.5480039 หุ้น")
    share_amount = boldNum;
  } else {
    // ══ Layout A: Bold text is a currency amount, qty should be in table ══
    // Use exchange rate from AI if available, otherwise default
    const rate = exchangeRate > 0 ? exchangeRate : 35.0;

    // Convert stock_value to USD for cross-validation
    const stockValueUsd = stockValue > 0 ? (hasTHBUnit ? stockValue / rate : stockValue) : 0;

    // Calculate expected quantity from stock_value / price for cross-validation
    let expectedQty = 0;
    if (price > 0 && stockValueUsd > 0) {
      expectedQty = stockValueUsd / price;
    }

    // Get decimal count of qty_table raw string
    const rawQtyStr = String(raw.qty_table || "").trim();
    const decimalPart = rawQtyStr.split(".")[1] || "";
    const decimalCount = decimalPart.length;

    // Trust qty_table if it has 5+ decimal places (definitely a fractional share count)
    if (qtyTable > 0 && decimalCount >= 5) {
      share_amount = qtyTable;
    } else if (qtyTable > 0 && expectedQty > 0) {
      // Cross-validate: check if qty_table is close to expected
      const diffPercent = Math.abs(qtyTable - expectedQty) / expectedQty;
      if (diffPercent < 0.15) {
        // qty_table matches expected — use it
        share_amount = qtyTable;
      } else {
        // qty_table is way off (likely commission/VAT/stock_value) — use calculated
        share_amount = expectedQty;
      }
    } else if (expectedQty > 0) {
      // No valid qty_table, fall back to calculated
      share_amount = expectedQty;
    } else if (qtyTable > 0) {
      // Last resort: use qty_table even without cross-validation
      share_amount = qtyTable;
    } else if (boldNum > 0 && price > 0) {
      // Fallback: compute from boldNum (total) / price
      const computedBoldUsd = hasTHBUnit ? boldNum / rate : boldNum;
      share_amount = computedBoldUsd / price;
    }
  }

  // Final safety: if share_amount × price grossly exceeds stock_value, it's likely
  // the total monetary value was used as quantity — correct it by dividing by price.
  // We compare against stock_value instead of a hardcoded threshold to avoid
  // incorrectly "correcting" legitimate large share counts.
  if (share_amount > 0 && price > 0 && !isBoldUnitCount) {
    const impliedTotal = share_amount * price;
    const rate = exchangeRate > 0 ? exchangeRate : 35.0;
    const stockValueUsd = stockValue > 0 ? (hasTHBUnit ? stockValue / rate : stockValue) : 0;

    if (stockValueUsd > 0) {
      // If implied total is more than 3× stock value, share_amount is wrong
      if (impliedTotal > stockValueUsd * 3) {
        const corrected = stockValueUsd / price;
        if (corrected > 0.0001) {
          share_amount = corrected;
        }
      }
    } else if (impliedTotal > 500000) {
      // Legacy fallback: no stock_value available, use $500K absolute threshold
      const corrected = share_amount / price;
      if (corrected > 0.0001) {
        share_amount = corrected;
      }
    }
  }

  if (share_amount > 0) {
    share_amount = parseFloat(share_amount.toFixed(8));
  }

  if (share_amount <= 0) return null;

  // 5. Parse Date / Timestamp
  let timestamp = "";
  if (raw.raw_date) {
    timestamp = parseThaiDateToISO(raw.raw_date);
  }
  if (!timestamp && raw.timestamp) {
    timestamp = String(raw.timestamp).trim();
  }
  if (!/\d{4}/.test(timestamp)) {
    timestamp = "";
  }

  return { action, symbol, actual_price: price, share_amount, timestamp };
}

/**
 * Parse ISO or partial timestamp into { date: "YYYY-MM-DD", time: "HH:MM" }.
 */
function parseTimestamp(ts) {
  if (!ts) return { date: new Date().toISOString().split("T")[0], time: "" };
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return { date: new Date().toISOString().split("T")[0], time: "" };
    const date = d.toISOString().split("T")[0];
    const hhmm = d.toISOString().split("T")[1].slice(0, 5);
    const time = hhmm === "00:00" ? "" : hhmm;
    return { date, time };
  } catch {
    return { date: new Date().toISOString().split("T")[0], time: "" };
  }
}

/**
 * Merge a new transaction lot into the portfolio array.
 */
function mergeLotIntoPortfolio(portfolio, slip) {
  const { date, time } = parseTimestamp(slip.timestamp);
  const isSell = slip.action === "SELL";
  const lotQty = isSell ? -Math.abs(slip.share_amount) : Math.abs(slip.share_amount);

  const newLot = {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    time,
    qty: lotQty,
    price: slip.actual_price
  };

  const existingIdx = portfolio.findIndex((a) => a.symbol.toUpperCase() === slip.symbol.toUpperCase());

  if (existingIdx >= 0) {
    const existing = portfolio[existingIdx];
    const allLots = [...(existing.lots || []), newLot];
    const totalQty = allLots.reduce((s, l) => s + l.qty, 0);

    const buyLots = allLots.filter((l) => l.qty > 0);
    const buyQty = buyLots.reduce((s, l) => s + l.qty, 0);
    const buyCost = buyLots.reduce((s, l) => s + l.qty * l.price, 0);
    const avgCost = buyQty > 0 ? buyCost / buyQty : existing.avgCost || 0;

    portfolio[existingIdx] = { ...existing, lots: allLots, qty: totalQty, avgCost };
  } else {
    portfolio.push({
      id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: slip.symbol,
      name: slip.symbol,
      category: "stock",
      lots: [newLot],
      qty: lotQty,
      avgCost: slip.actual_price
    });
  }

  return portfolio;
}

/**
 * Call Cloudflare Workers AI Vision google/gemma-4-26b-a4b-it model with fallback and model-specific image formatting.
 */
async function callWorkersAIVision(ai, base64, mime) {
  let binaryString;
  try {
    binaryString = atob(base64);
  } catch (e) {
    throw new Error("Invalid base64 image data");
  }

  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const imageBytes = Array.from(bytes);

  const primaryModel = "@cf/google/gemma-4-26b-a4b-it";
  const backupModel = "@cf/meta/llama-3.2-11b-vision-instruct";

  // Helper to run a model with its correct signature
  async function runModel(modelName, maxTokens) {
    if (modelName === "@cf/google/gemma-4-26b-a4b-it") {
      // Gemma 4 uses OpenAI-compatible multimodal messages array format
      return await ai.run(modelName, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the transaction data from this receipt image. Your response MUST be ONLY a raw JSON object matching the schema, with no conversational filler or markdown blocks. Start directly with '{'."
              },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
            ]
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.0,
        thinking: false,
        chat_template_kwargs: {
          enable_thinking: false
        },
        response_format: {
          type: "json_object"
        }
      });
    } else {
      // Llama 3.2 Vision uses the top-level image property (Uint8Array)
      return await ai.run(modelName, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Extract the transaction data from this receipt image. Your response MUST be ONLY a raw JSON object matching the schema, with no conversational filler or markdown blocks. Start directly with '{'."
          }
        ],
        image: imageBytes,
        max_tokens: maxTokens,
        temperature: 0.0,
        response_format: {
          type: "json_object"
        }
      });
    }
  }

  // Parse text response, supporting both OpenAI choices array and legacy formats
  function parseTextResponse(res) {
    let resultText = "";
    if (typeof res === "string") {
      resultText = res;
    } else if (res && typeof res === "object") {
      // Check for OpenAI compatible chat completion format choices
      if (Array.isArray(res.choices) && res.choices.length > 0) {
        const choice = res.choices[0];
        if (choice.message && typeof choice.message.content === "string") {
          resultText = choice.message.content;
        } else if (typeof choice.text === "string") {
          resultText = choice.text;
        }
      }

      // Legacy or custom formats fallback
      if (!resultText) {
        if (typeof res.response === "string") {
          resultText = res.response;
        } else if (res.response && typeof res.response === "object") {
          resultText = res.response.text || JSON.stringify(res.response);
        } else if (typeof res.text === "string") {
          resultText = res.text;
        } else {
          resultText = JSON.stringify(res);
        }
      }
    }
    return resultText;
  }

  let response;
  let usedModel = primaryModel;
  let parsedJson = null;

  // 1. Try Primary Model (Gemma 4)
  try {
    console.log(`Trying primary model: ${primaryModel}`);
    response = await runModel(primaryModel, 2048);
  } catch (err) {
    // If license agreement error
    if (
      err.message &&
      (err.message.includes("5016") ||
        err.message.includes("license") ||
        err.message.includes("agree") ||
        err.message.includes("Acceptable Use Policy"))
    ) {
      try {
        console.log(`Agreeing to terms for model: ${primaryModel}`);
        try {
          await ai.run(primaryModel, { prompt: "agree" });
        } catch (agreeErr) {
          if (!agreeErr.message.includes("Thank you for agreeing")) {
            throw agreeErr;
          }
        }
        await new Promise((r) => setTimeout(r, 1200));
        response = await runModel(primaryModel, 2048);
      } catch (retryErr) {
        console.warn(`Primary model failed after license agreement: ${retryErr.message}. Falling back to backup.`);
        response = null;
      }
    } else {
      console.warn(`Primary model failed with error: ${err.message}. Falling back to backup.`);
      response = null;
    }
  }

  // 2. Parse Primary Model Response
  if (response) {
    try {
      const txt = parseTextResponse(response);
      const match = txt.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJson = JSON.parse(match[0]);
        // Schema check: verify that this is not a wrapper object and contains expected fields
        if (!parsedJson.bold_amount && !parsedJson.symbol && !parsedJson.actual_price) {
          console.warn(
            "Primary model returned JSON but it doesn't match expected receipt schema fields. Falling back."
          );
          parsedJson = null;
        }
      }
    } catch (parseErr) {
      console.warn(`Failed to parse or validate JSON from primary model: ${parseErr.message}. Falling back.`);
      parsedJson = null;
    }
  }

  // 3. Fallback to Backup Model (Llama 3.2 Vision)
  if (!parsedJson) {
    console.log(`Primary model failed or returned invalid data. Running backup model: ${backupModel}`);
    usedModel = backupModel;
    try {
      response = await runModel(backupModel, 512);
    } catch (err) {
      if (
        err.message &&
        (err.message.includes("5016") ||
          err.message.includes("license") ||
          err.message.includes("agree") ||
          err.message.includes("Acceptable Use Policy"))
      ) {
        try {
          console.log(`Agreeing to terms for model: ${backupModel}`);
          try {
            await ai.run(backupModel, { prompt: "agree" });
          } catch (agreeErr) {
            if (!agreeErr.message.includes("Thank you for agreeing")) {
              throw agreeErr;
            }
          }
          await new Promise((r) => setTimeout(r, 1200));
          response = await runModel(backupModel, 512);
        } catch (retryErr) {
          throw new Error(`Backup model run failed after license agreement: ${retryErr.message}`);
        }
      } else {
        throw new Error(`Backup model run failed: ${err.message}`);
      }
    }

    const txt = parseTextResponse(response);
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Backup model did not return a valid JSON object block: ${txt.slice(0, 150)}`);
    }

    try {
      parsedJson = JSON.parse(match[0]);
    } catch (parseErr) {
      throw new Error(`Failed to parse extracted JSON from backup model text: ${parseErr.message}`);
    }
  }

  // Add metadata for debugging/logging
  if (parsedJson) {
    parsedJson._debug_model = usedModel;
  }

  return parsedJson;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const auth = request.headers.get("Authorization") || "";
    const userId = auth.replace("Bearer ", "").trim();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await request.json();
    const { images, skipSave } = body;

    const hasWorkersAI = !!env.AI;
    if (!hasWorkersAI) {
      return new Response(
        JSON.stringify({ error: "Cloudflare Workers AI binding [env.AI] is missing in this project" }),
        { status: 500, headers: CORS }
      );
    }

    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "images array is required and must not be empty" }), {
        status: 400,
        headers: CORS
      });
    }
    if (images.length > 10) {
      return new Response(JSON.stringify({ error: "Maximum 10 images per request" }), { status: 400, headers: CORS });
    }

    // ── Load existing portfolio from KV ───────────────────────────────────────
    const PORTFOLIOS = env.PORTFOLIOS;
    let portfolio = [];
    try {
      const raw = await PORTFOLIOS.get(`portfolio:${userId}`);
      if (raw) portfolio = JSON.parse(raw);
      if (!Array.isArray(portfolio)) portfolio = [];
    } catch {
      portfolio = [];
    }

    // ── Process each image via Workers AI ─────────────────────────────────────
    const results = [];
    const errors = [];

    for (let i = 0; i < images.length; i++) {
      const { base64, mime } = images[i];
      if (!base64 || !mime) {
        errors.push({ index: i, error: "Missing base64 or mime for image" });
        continue;
      }

      try {
        const parsed = await callWorkersAIVision(env.AI, base64, mime);
        if (!parsed) {
          throw new Error("Failed to extract data using Workers AI.");
        }

        const validated = validateSlipData(parsed);
        if (!validated) {
          throw new Error(`Extracted data is incomplete or invalid: ${JSON.stringify(parsed).slice(0, 120)}`);
        }

        // Merge into portfolio if not skipping save
        if (!skipSave) {
          portfolio = mergeLotIntoPortfolio(portfolio, validated);
        }

        results.push({ index: i, ...validated, raw_ai: parsed, saved: !skipSave, engine: "Cloudflare Workers AI" });
      } catch (imgErr) {
        errors.push({ index: i, error: imgErr.message });
      }
    }

    // ── Persist updated portfolio to KV ───────────────────────────────────────
    if (results.length > 0 && !skipSave) {
      await PORTFOLIOS.put(`portfolio:${userId}`, JSON.stringify(portfolio));
    }

    return new Response(JSON.stringify({ results, errors }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}

// ─── CORS preflight ───────────────────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
