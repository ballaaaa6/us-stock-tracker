import { describe, it, expect } from "vitest";
import {
  getDisplaySymbol,
  getAssetFullName,
  getCurrencyTicker,
  getCurrencyPriceUSD,
  getRealizedPnL
} from "./assetHelpers";

describe("assetHelpers", () => {
  describe("getDisplaySymbol", () => {
    it("should strip suffix like .BK from symbol", () => {
      expect(getDisplaySymbol("PTT.BK")).toBe("PTT");
      expect(getDisplaySymbol("KBANK.BK")).toBe("KBANK");
    });

    it("should return the original symbol if no suffix matches", () => {
      expect(getDisplaySymbol("AAPL")).toBe("AAPL");
      expect(getDisplaySymbol("BTC-USD")).toBe("BTC-USD");
    });

    it("should return empty string if no symbol is provided", () => {
      expect(getDisplaySymbol(null)).toBe("");
      expect(getDisplaySymbol(undefined)).toBe("");
    });
  });

  describe("getAssetFullName", () => {
    it("should map known symbols to their official full names", () => {
      expect(getAssetFullName("AAPL")).toBe("Apple Inc.");
      expect(getAssetFullName("NVDA")).toBe("NVIDIA Corporation");
      expect(getAssetFullName("THB")).toBe("Thai Baht (เงินบาทไทย ฿)");
    });

    it("should format .BK Thai stocks to Public Company Limited names", () => {
      expect(getAssetFullName("PTT.BK")).toBe("PTT Public Company Limited");
      expect(getAssetFullName("CPALL.BK", "CPALL")).toBe("CP ALL Public Company Limited");
    });

    it("should resolve gold and commodities by category", () => {
      expect(getAssetFullName("GOLD", null, "gold")).toBe("Spot Gold (ทองคำตลาดโลก)");
      expect(getAssetFullName("CL=F", null, "gold")).toBe("Crude Oil (น้ำมันดิบตลาดโลก)");
    });

    it("should fallback to name parameter or symbol default", () => {
      expect(getAssetFullName("UNKNOWN", "My Custom Asset")).toBe("My Custom Asset");
      expect(getAssetFullName("UNKNOWN")).toBe("UNKNOWN Asset");
    });
  });

  describe("getCurrencyTicker", () => {
    it("should return USD for USD", () => {
      expect(getCurrencyTicker("USD")).toBe("USD");
    });

    it("should append USD=X for direct currency quotes", () => {
      expect(getCurrencyTicker("EUR")).toBe("EURUSD=X");
      expect(getCurrencyTicker("GBP")).toBe("GBPUSD=X");
    });

    it("should append =X for other currencies", () => {
      expect(getCurrencyTicker("THB")).toBe("THB=X");
      expect(getCurrencyTicker("JPY")).toBe("JPY=X");
    });
  });

  describe("getCurrencyPriceUSD", () => {
    it("should return 1.0 for USD", () => {
      expect(getCurrencyPriceUSD("USD", {}, 35)).toBe(1.0);
    });

    it("should look up and return EUR/GBP direct rates", () => {
      const prices = { "EURUSD=X": { price: 1.09 } };
      expect(getCurrencyPriceUSD("EUR", prices)).toBe(1.09);
    });

    it("should divide for reverse currency quotes like JPY or THB", () => {
      const prices = { "THB=X": { price: 36.0 } };
      expect(getCurrencyPriceUSD("THB", prices)).toBe(1 / 36.0);
    });

    it("should fallback to exchangeRate parameter for THB if ticker not in prices", () => {
      expect(getCurrencyPriceUSD("THB", {}, 35.0)).toBe(1 / 35.0);
    });
  });

  describe("getRealizedPnL", () => {
    it("should return 0 if no lots are provided", () => {
      expect(getRealizedPnL([])).toBe(0);
      expect(getRealizedPnL(null)).toBe(0);
    });

    it("should return 0 when there are only BUY lots", () => {
      const lots = [{ date: "2026-06-01", qty: 10, price: 100 }];
      expect(getRealizedPnL(lots)).toBe(0);
    });

    it("should calculate correct PnL for simple BUY and SELL transactions", () => {
      const lots = [
        { date: "2026-06-01", qty: 10, price: 100 }, // Buy 10 at 100 (Total cost = 1000, avg cost = 100)
        { date: "2026-06-02", qty: -5, price: 120 } // Sell 5 at 120. PnL = (120 - 100) * 5 = 100.
      ];
      expect(getRealizedPnL(lots)).toBe(100);
    });

    it("should track average cost correctly across multiple BUY lots before a SELL", () => {
      const lots = [
        { date: "2026-06-01", qty: 10, price: 100 }, // Buy 10 at 100 (Cost = 1000)
        { date: "2026-06-02", qty: 10, price: 120 }, // Buy 10 at 120 (Cost = 1200) -> Total qty = 20, cost = 2200, avg cost = 110
        { date: "2026-06-03", qty: -10, price: 130 } // Sell 10 at 130 -> PnL = (130 - 110) * 10 = 200
      ];
      expect(getRealizedPnL(lots)).toBe(200);
    });

    it("should handle currency conversion when isThai is true", () => {
      const exchangeRate = 35.0;
      const lots = [
        { date: "2026-06-01", qty: 10, price: 3500 }, // Buy 10 at 3500 THB (= 100 USD each, total 1000 USD, avg cost 100 USD)
        { date: "2026-06-02", qty: -5, price: 4200 } // Sell 5 at 4200 THB (= 120 USD each). PnL = (120 - 100) * 5 = 100 USD.
      ];
      expect(getRealizedPnL(lots, true, exchangeRate)).toBe(100);
    });
  });
});
