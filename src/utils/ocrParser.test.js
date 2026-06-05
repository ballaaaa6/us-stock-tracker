import { describe, it, expect } from "vitest";
import { validateParsedReceipt } from "./ocrParser";

describe("ocrParser - validateParsedReceipt", () => {
  it("should return null for null or undefined data", () => {
    expect(validateParsedReceipt(null)).toBeNull();
    expect(validateParsedReceipt(undefined)).toBeNull();
  });

  it("should clean and validate stock symbols", () => {
    const validData = {
      symbol: "  nvda  ",
      qty: 5,
      price: 130.5,
      date: "2026-06-05",
      time: "15:30",
      transactionType: "BUY",
      category: "stock"
    };
    const cleaned = validateParsedReceipt(validData, 1);
    expect(cleaned).not.toBeNull();
    expect(cleaned.symbol).toBe("NVDA");
  });

  it("should return null if symbol is empty or invalid (e.g. only numbers)", () => {
    const invalidData = {
      symbol: "12345",
      qty: 5,
      price: 130.5,
      date: "2026-06-05",
      time: "15:30",
      transactionType: "BUY"
    };
    expect(validateParsedReceipt(invalidData)).toBeNull();
  });

  it("should allow Thai mutual fund symbols with hyphens and dots", () => {
    const validData = {
      symbol: "SCB-GOLD",
      qty: 120.5,
      price: 15.67,
      date: "2026-06-05",
      time: "15:30",
      transactionType: "BUY",
      category: "gold"
    };
    const cleaned = validateParsedReceipt(validData);
    expect(cleaned.symbol).toBe("SCB-GOLD");
    expect(cleaned.category).toBe("gold");
  });

  it("should return null if qty or price is <= 0 or invalid", () => {
    const invalidQty = {
      symbol: "AAPL",
      qty: 0,
      price: 150,
      date: "2026-06-05",
      time: "15:30",
      transactionType: "BUY"
    };
    expect(validateParsedReceipt(invalidQty)).toBeNull();

    const invalidPrice = {
      symbol: "AAPL",
      qty: 10,
      price: -5,
      date: "2026-06-05",
      time: "15:30",
      transactionType: "BUY"
    };
    expect(validateParsedReceipt(invalidPrice)).toBeNull();
  });

  it("should divide price by qty if price looks like a total (> 50,000 and qty > 1)", () => {
    const anomalousData = {
      symbol: "AAPL",
      qty: 100,
      price: 150000, // Looks like total value ($150,000) instead of unit price ($1,500)
      date: "2026-06-05",
      time: "15:30",
      transactionType: "BUY"
    };
    const cleaned = validateParsedReceipt(anomalousData);
    expect(cleaned.price).toBe(1500); // 150000 / 100
  });

  it("should fallback to today's date if date format is invalid or year is out of bounds", () => {
    const badDateObj = {
      symbol: "AAPL",
      qty: 10,
      price: 150,
      date: "bad-date-format",
      time: "15:30",
      transactionType: "BUY"
    };
    const today = new Date().toISOString().split("T")[0];
    expect(validateParsedReceipt(badDateObj).date).toBe(today);

    const badYearObj = {
      symbol: "AAPL",
      qty: 10,
      price: 150,
      date: "2045-06-05", // year out of bounds (2020-2030)
      time: "15:30",
      transactionType: "BUY"
    };
    expect(validateParsedReceipt(badYearObj).date).toBe(today);
  });

  it("should normalize transaction type and category", () => {
    const data = {
      symbol: "BTC",
      qty: 0.05,
      price: 68000,
      date: "2026-06-05",
      time: "15:30",
      transactionType: "sell", // lower case
      category: "CRYPTO" // upper case
    };
    const cleaned = validateParsedReceipt(data);
    expect(cleaned.transactionType).toBe("SELL");
    expect(cleaned.category).toBe("crypto");
  });
});
