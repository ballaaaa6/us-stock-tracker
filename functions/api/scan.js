/**
 * /api/scan — Cloudflare Pages Function (Workers AI Only)
 *
 * Receives one or more base64-encoded financial asset slip images,
 * uses Cloudflare Workers AI (@cf/meta/llama-3.2-11b-vision-instruct)
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
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type":                 "application/json",
};

// ─── Prompt & Schema Context ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert OCR transcription tool for Dime! (by SCB) trading receipts.
Your task is to transcribe specific text fields from the receipt image.
Extract the data into a JSON object with the following fields. Do not translate the text, just transcribe exactly what is visible on the image:

{
  "header_text": "The green/red text showing the transaction type and ticker (e.g. ซื้อ [ticker] or ขาย [ticker])",
  "header_color": "The color of the header text (either 'green' or 'red/pink')",
  "status_text": "The status section text near the top (e.g. จับคู่แล้ว or สำเร็จ. คุณได้รับเงินค่าขายคืนแล้ว)",
  "bold_amount": "The large bold amount displayed under the asset name (e.g. total currency amount or unit count like '[number] หุ้น' or '[number] หน่วย')",
  "symbol": "The uppercase stock ticker symbol from the header",
  "actual_price": "The executed price per share next to 'ราคาที่ได้จริง' (transcribe exact numeric text and currency like '[number] USD')",
  "stock_value": "The total stock value next to 'มูลค่าหุ้น' (transcribe exact numeric text and currency)",
  "qty_table": "The quantity of shares next to 'จำนวนหุ้น' or 'จำนวนหน่วย' in the details table (transcribe the exact number, or 'N/A' if the row does not exist)",
  "raw_date": "The date-time string next to 'วันที่ส่งคำสั่ง', 'วันที่สำเร็จ', or inside the top card 'สถานะ (ณ ...)' (transcribe the exact text, e.g., '[day] [month] [year] - [time]')",
  "has_received_cash_back_label": true or false, indicating if the label 'ยอดที่จะได้รับคืน' or phrase 'เงินค่าขายคืน' appears anywhere on the receipt,
  "has_payment_amount_label": true or false, indicating if the label 'ยอดที่ต้องชำระ' appears anywhere on the receipt
}

THAI MONTHS VISUAL GUIDE:
- มี.ค. = March (มีนาคม) - look for 'ม' with a long vowel 'ี' on top
- พ.ค. = May (พฤษภาคม) - look for 'พ' (no vowel mark on top of the first letter)
- พ.ย. = November (พฤศจิกายน) - look for 'พ' and 'ย'
- ม.ค. = January (มกราคม) - look for 'ม' (no vowel on top of the first letter)
- เม.ย. = April (เมษายน) - look for 'เ' before 'ม'
- มิ.ย. = June (มิถุนายน) - look for 'ม' with 'ิ' on top
Please be extremely careful not to confuse 'พ.ค.' (May) with 'มี.ค.' (March). 'พ.ค.' has NO vowel mark on top of the first letter 'พ', whereas 'มี.ค.' has the vowel 'ี' on top of 'ม'.

QUANTITY EXTRACTION RULES:
- The details table contains multiple rows.
- Look at the row labeled "จำนวนหุ้น" or "จำนวนหน่วย". In the same row, there is a numeric value (e.g. 1.2345678 or 15.0).
- In the row labeled "มูลค่าหุ้น" or "ยอดที่ต้องชำระ", there is a monetary value (e.g. 27,364.49 บาท or 112.50 USD).
- Do NOT mix up the "จำนวนหุ้น" (shares) value with the "มูลค่าหุ้น" or "ยอดที่ต้องชำระ" (total money value). The quantity of shares is usually a decimal number or a whole number of shares, and is DIFFERENT from the total money value in Baht or USD.

OUTPUT: Raw JSON only. No markdown, no explanation. Start with '{', end with '}'.`;

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
  const dayMatch = rawStr.match(/(?:ณ\s+|ส่งคำสั่ง\s+|สำเร็จ\s+)?(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{2,4})/);
  const timeMatch = rawStr.match(/(\d{1,2}):(\d{2})/);

  let year = "";
  let month = "";
  let dStr = "";

  if (dayMatch) {
    dStr = dayMatch[1].padStart(2, "0");
    const mStr = dayMatch[2].trim();
    const yStr = dayMatch[3].trim();

    const monthMap = {
      "ม.ค.": "01", "ม.ค": "01", "มกราคม": "01",
      "ก.พ.": "02", "ก.พ": "02", "กุมภาพันธ์": "02",
      "มี.ค.": "03", "มี.ค": "03", "มีนาคม": "03",
      "เม.ย.": "04", "เม.ย": "04", "เมษายน": "04",
      "พ.ค.": "05", "พ.ค": "05", "พฤษภาคม": "05",
      "มิ.ย.": "06", "มิ.ย": "06", "มิถุนายน": "06",
      "ก.ค.": "07", "ก.ค": "07", "กรกฎาคม": "07",
      "ส.ค.": "08", "ส.ค": "08", "สิงหาคม": "08",
      "ก.ย.": "09", "ก.ย": "09", "กันยายน": "09",
      "ต.ค.": "10", "ต.ค": "10", "ตุลาคม": "10",
      "พ.ย.": "11", "พ.ย": "11", "พฤศจิกายน": "11",
      "ธ.ค.": "12", "ธ.ค": "12", "ธันวาคม": "12"
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
  let symbol = String(raw.symbol || "").trim().toUpperCase();
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

  // Resolve exchange rate if available
  let exchangeRate = 0;
  if (raw.exchange_rate && raw.exchange_rate !== "N/A") {
    const rateMatch = String(raw.exchange_rate).match(/(\d{2,3}(?:\.\d+)?)/);
    if (rateMatch) {
      exchangeRate = parseFloat(rateMatch[1]);
    }
  }

  // Check currency in bold_amount and stock_value
  const boldStr = String(raw.bold_amount || "").toLowerCase();
  const valueStr = String(raw.stock_value || "").toLowerCase();
  const hasTHBUnit = boldStr.includes("บาท") || boldStr.includes("thb") || boldStr.includes("฿") || allText.includes("บาท") || allText.includes("thb");

  if (price <= 0) return null;

  // 4. Resolve Quantity (share_amount) with cross-validation
  let share_amount = 0;

  // Detect and flag when AI hallucinates and puts total monetary amount directly into qtyTable
  let isQtyHallucinated = false;
  if (qtyTable > 0 && price > 1.5) {
    const ratioWithBold = boldNum > 0 ? qtyTable / boldNum : 0;
    const ratioWithValue = stockValue > 0 ? qtyTable / stockValue : 0;

    if ((ratioWithBold > 0.95 && ratioWithBold < 1.05) || (ratioWithValue > 0.95 && ratioWithValue < 1.05)) {
      isQtyHallucinated = true;
    } else {
      const product = qtyTable * price;
      // If USD stock but the total value exceeds $10,000 USD and we have a THB slip, it is likely hallucinated
      if (product > 10000 && hasTHBUnit) {
        isQtyHallucinated = true;
      } else if (boldNum > 0 && Math.abs(qtyTable - boldNum) < 0.1 && hasTHBUnit) {
        isQtyHallucinated = true;
      }
    }
  }

  if (qtyTable > 0 && !isQtyHallucinated) {
    share_amount = qtyTable;
  }
  // Rule 4.2: If the bold amount at the top is explicitly labeled as shares/units (common in Limit orders and SELLs)
  else if (boldNum > 0 && (boldText.includes("หุ้น") || boldText.includes("หน่วย") || boldText.includes("share") || boldText.includes("unit"))) {
    share_amount = boldNum;
  }
  // Rule 4.3: If it's a SELL and we have a total stock value, divide it by the price
  else if (action === "SELL") {
    if (stockValue > 0) {
      share_amount = stockValue / price;
    } else if (boldNum > 0) {
      share_amount = boldNum;
    }
  }
  // Rule 4.4: If it's a BUY and the bold amount is a monetary value, divide by price
  else {
    let total = stockValue > 0 ? stockValue : boldNum;
    
    // If it's in THB, convert to USD before dividing by share price
    if (hasTHBUnit && total > 0) {
      const rate = exchangeRate > 0 ? exchangeRate : 35.0;
      total = total / rate;
    }
    
    if (total > 0) {
      share_amount = total / price;
    }
  }

  // Cross-validation fallback if share_amount is 0 or was marked hallucinated (holding raw THB amount)
  if ((share_amount <= 0 || isQtyHallucinated) && price > 0) {
    const rawTotal = boldNum > 0 ? boldNum : qtyTable;
    if (rawTotal > 0) {
      const hasUSDUnit = boldStr.includes("usd") || boldStr.includes("$") || valueStr.includes("usd") || valueStr.includes("$") || allText.includes("usd") || allText.includes("$");
      
      let totalUsd = 0;
      if (hasUSDUnit) {
        totalUsd = rawTotal;
      } else if (hasTHBUnit || rawTotal > 2000) {
        const rate = exchangeRate > 0 ? exchangeRate : 35.0;
        totalUsd = rawTotal / rate;
      } else {
        totalUsd = rawTotal;
      }
      
      share_amount = totalUsd / price;
    }
  }

  // Final double-check: Detect obvious mix-ups between total value and share count
  if (share_amount > 0 && price > 0) {
    const product = share_amount * price;
    // If the product of quantity and price is > 500k USD, it's almost certainly a total cost value misclassified as quantity
    if (product > 500000) {
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
    const time  = hhmm === "00:00" ? "" : hhmm;
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
    id:    `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    time,
    qty:   lotQty,
    price: slip.actual_price,
  };

  const existingIdx = portfolio.findIndex(
    (a) => a.symbol.toUpperCase() === slip.symbol.toUpperCase()
  );

  if (existingIdx >= 0) {
    const existing = portfolio[existingIdx];
    const allLots  = [...(existing.lots || []), newLot];
    const totalQty = allLots.reduce((s, l) => s + l.qty, 0);

    const buyLots  = allLots.filter((l) => l.qty > 0);
    const buyQty   = buyLots.reduce((s, l) => s + l.qty, 0);
    const buyCost  = buyLots.reduce((s, l) => s + l.qty * l.price, 0);
    const avgCost  = buyQty > 0 ? buyCost / buyQty : existing.avgCost || 0;

    portfolio[existingIdx] = { ...existing, lots: allLots, qty: totalQty, avgCost };
  } else {
    portfolio.push({
      id:       `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol:   slip.symbol,
      name:     slip.symbol,
      category: "stock",
      lots:     [newLot],
      qty:      lotQty,
      avgCost:  slip.actual_price,
    });
  }

  return portfolio;
}

/**
 * Call Cloudflare Workers AI Vision Llama-3.2-11b-vision-instruct model.
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

  const model = "@cf/meta/llama-3.2-11b-vision-instruct";

  let response;
  try {
    response = await ai.run(model, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Extract the transaction data from this receipt image. Your response MUST be ONLY a raw JSON object matching the schema, with no conversational filler or markdown blocks. Start directly with '{'." }
      ],
      image: imageBytes,
      max_tokens: 512,
      temperature: 0.0,
      response_format: {
        type: "json_object"
      }
    });
  } catch (err) {
    // If terms of service code 5016, or license consent is required
    if (err.message && (err.message.includes("5016") || err.message.includes("license") || err.message.includes("agree") || err.message.includes("Acceptable Use Policy"))) {
      try {
        console.log("Agreeing to Meta license terms for llama-3.2...");
        try {
          await ai.run(model, { prompt: "agree" });
        } catch (agreeErr) {
          // If the error message is confirmation of agreement, ignore the throw
          if (!agreeErr.message.includes("Thank you for agreeing")) {
            throw agreeErr;
          }
        }
        
        // Wait 1.2 seconds for propagation on Cloudflare global edge
        await new Promise(r => setTimeout(r, 1200));

        // Retry vision generation with JSON mode and messages
        response = await ai.run(model, {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: "Extract the transaction data from this receipt image. Your response MUST be ONLY a raw JSON object matching the schema, with no conversational filler or markdown blocks. Start directly with '{'." }
          ],
          image: imageBytes,
          max_tokens: 512,
          temperature: 0.0,
          response_format: {
            type: "json_object"
          }
        });
      } catch (retryErr) {
        throw new Error(`Workers AI run failed after license agreement: ${retryErr.message}`);
      }
    } else {
      throw new Error(`Workers AI run failed: ${err.message}`);
    }
  }

  // Safe resultText string resolution
  let resultText = "";
  if (typeof response === "string") {
    resultText = response;
  } else if (response && typeof response === "object") {
    if (typeof response.response === "string") {
      resultText = response.response;
    } else if (response.response && typeof response.response === "object") {
      resultText = response.response.text || JSON.stringify(response.response);
    } else if (typeof response.text === "string") {
      resultText = response.text;
    } else {
      resultText = JSON.stringify(response);
    }
  }

  if (!resultText) {
    throw new Error("Empty response from Cloudflare Workers AI");
  }

  const jsonMatch = resultText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Cloudflare AI did not return a valid JSON object block: ${resultText.slice(0, 150)}`);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    throw new Error(`Failed to parse extracted JSON from text: ${parseErr.message} (raw match: ${jsonMatch[0].slice(0, 120)})`);
  }
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
      return new Response(
        JSON.stringify({ error: "images array is required and must not be empty" }),
        { status: 400, headers: CORS }
      );
    }
    if (images.length > 10) {
      return new Response(
        JSON.stringify({ error: "Maximum 10 images per request" }),
        { status: 400, headers: CORS }
      );
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
    const errors  = [];

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
          throw new Error(
            `Extracted data is incomplete or invalid: ${JSON.stringify(parsed).slice(0, 120)}`
          );
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

    return new Response(
      JSON.stringify({ results, errors }),
      { status: 200, headers: CORS }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: CORS }
    );
  }
}

// ─── CORS preflight ───────────────────────────────────────────────────────────
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
