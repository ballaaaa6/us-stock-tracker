import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAssetChartData } from "../useAssetChartData";

let mockHistoryData = {
  candles: [
    { date: "2026-06-01T00:00:00.000Z", close: 36.0 },
    { date: "2026-06-02T00:00:00.000Z", close: 36.5 }
  ]
};
let mockError = null;

vi.mock("../../services/api", () => {
  return {
    api: {
      prices: {
        getHistory: vi.fn().mockImplementation(() => {
          if (mockError) return Promise.reject(mockError);
          return Promise.resolve(mockHistoryData);
        })
      }
    }
  };
});

describe("useAssetChartData Hook Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockError = null;
    mockHistoryData = {
      candles: [
        { date: "2026-06-01T00:00:00.000Z", close: 36.0 },
        { date: "2026-06-02T00:00:00.000Z", close: 36.5 }
      ]
    };
  });

  const waitForLoading = async (result) => {
    let count = 0;
    while (result.current.loading && count < 100) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
      count++;
    }
  };

  it("should initialize with default states", () => {
    const asset = { symbol: "AAPL", lots: [] };
    const { result } = renderHook(() => useAssetChartData(asset, false));

    expect(result.current.tf).toBe("1D");
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("should load mockup flat data for USD cash asset", async () => {
    const asset = { symbol: "USD", lots: [] };
    const { result } = renderHook(() => useAssetChartData(asset, true));

    await waitForLoading(result);

    expect(result.current.loading).toBe(false);
    expect(result.current.chartData).not.toBeNull();
    expect(result.current.chartData.symbol).toBe("USD");
    expect(result.current.chartData.candles.length).toBe(2);
    expect(result.current.chartData.candles[0].open).toBe(1.0);
  });

  it("should fetch history for standard assets", async () => {
    const asset = { symbol: "AAPL", lots: [] };
    const { result } = renderHook(() => useAssetChartData(asset, false));

    await waitForLoading(result);

    expect(result.current.loading).toBe(false);
    expect(result.current.chartData).toEqual(mockHistoryData);
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch error correctly", async () => {
    mockError = new Error("Network failure");
    const asset = { symbol: "AAPL", lots: [] };
    const { result } = renderHook(() => useAssetChartData(asset, false));

    await waitForLoading(result);

    expect(result.current.loading).toBe(false);
    expect(result.current.chartData).toBeNull();
    expect(result.current.error).toBe("Network failure");
  });

  it("should adjust timeframe (tf) correctly", async () => {
    const asset = { symbol: "AAPL", lots: [] };
    const { result } = renderHook(() => useAssetChartData(asset, false));

    await waitForLoading(result);

    act(() => {
      result.current.setTf("1W");
    });

    expect(result.current.tf).toBe("1W");
  });
});
