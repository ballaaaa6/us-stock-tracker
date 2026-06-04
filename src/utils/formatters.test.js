import { describe, it, expect } from "vitest";
import {
  fmtUSD,
  fmtTHB,
  fmtPct,
  fmtQty,
  fmtDate,
  fmtDateShort,
  getDynamicDateFormat
} from "./formatters";

describe("formatters", () => {
  describe("fmtUSD", () => {
    it("should return **** when hideValues is true", () => {
      expect(fmtUSD(123.45, true)).toBe("****");
    });

    it("should return — when value is null or undefined", () => {
      expect(fmtUSD(null)).toBe("—");
      expect(fmtUSD(undefined)).toBe("—");
    });

    it("should format large USD amounts with 2 decimal places", () => {
      expect(fmtUSD(100.5)).toContain("$100.50");
      expect(fmtUSD(1000)).toContain("$1,000.00");
    });

    it("should format small USD amounts (< 1) with up to 4 decimal places", () => {
      expect(fmtUSD(0.12345)).toContain("$0.1235");
      expect(fmtUSD(0.005)).toContain("$0.005");
    });
  });

  describe("fmtTHB", () => {
    it("should return **** when hideValues is true", () => {
      expect(fmtTHB(123.45, 2, true)).toBe("****");
    });

    it("should return — when value is null or undefined", () => {
      expect(fmtTHB(null)).toBe("—");
      expect(fmtTHB(undefined)).toBe("—");
    });

    it("should format THB using th-TH format and ฿ symbol", () => {
      expect(fmtTHB(1000)).toContain("฿1,000.00");
      expect(fmtTHB(1000, 0)).toContain("฿1,000");
    });
  });

  describe("fmtPct", () => {
    it("should return — when value is null or undefined", () => {
      expect(fmtPct(null)).toBe("—");
      expect(fmtPct(undefined)).toBe("—");
    });

    it("should add + sign for positive percentages", () => {
      expect(fmtPct(5.25)).toBe("+5.25%");
      expect(fmtPct(0)).toBe("+0.00%");
    });

    it("should keep - sign for negative percentages", () => {
      expect(fmtPct(-3.14)).toBe("-3.14%");
    });
  });

  describe("fmtQty", () => {
    it("should return **** when hideValues is true", () => {
      expect(fmtQty(123.45, true)).toBe("****");
    });

    it("should return — when value is null or undefined", () => {
      expect(fmtQty(null)).toBe("—");
      expect(fmtQty(undefined)).toBe("—");
    });

    it("should format quantities up to 6 decimal places", () => {
      expect(fmtQty(10)).toBe("10");
      expect(fmtQty(10.1234567)).toBe("10.123457");
      expect(fmtQty(1000.5)).toBe("1,000.5");
    });
  });

  describe("fmtDate & fmtDateShort", () => {
    it("should return — when date is invalid or empty", () => {
      expect(fmtDate(null)).toBe("—");
      expect(fmtDate("")).toBe("—");
    });

    it("should format date correctly in th-TH locale", () => {
      const dateStr = "2026-06-05T00:00:00.000Z";
      expect(fmtDate(dateStr)).toContain("มิ.ย.");
      expect(fmtDateShort(dateStr)).toContain("มิ.ย.");
    });
  });

  describe("getDynamicDateFormat", () => {
    const testDate = "2026-06-05T15:30:00.000Z";

    it("should format with hour and minute for short durations (<= 1 day)", () => {
      const oneHour = 60 * 60 * 1000;
      const formatted = getDynamicDateFormat(testDate, oneHour);
      // Expected time format (dependent on environment timezone, but should be localized digits)
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it("should include date and time for tooltips when hasTime is true", () => {
      const oneDay = 24 * 60 * 60 * 1000;
      const formatted = getDynamicDateFormat(testDate, oneDay * 5, false, true);
      expect(formatted).toContain("มิ.ย.");
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it("should format only date for medium durations (<= 6 months)", () => {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const formatted = getDynamicDateFormat(testDate, thirtyDays);
      expect(formatted).toContain("มิ.ย.");
      expect(formatted).not.toContain("2569"); // No year unless visibleDuration is long
    });
  });
});
