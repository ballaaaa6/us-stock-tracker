import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProfile } from "../useProfile";
import { usePrices } from "../usePrices";
import { usePortfolio } from "../usePortfolio";
import { usePortfolioHistory } from "../usePortfolioHistory";

// Create stateful mock resolvers that can be customized in tests
let mockProfileData = {};
let mockPortfolioData = [];

vi.mock("../../services/api", () => {
  return {
    api: {
      profile: {
        get: vi.fn().mockImplementation(() => Promise.resolve(mockProfileData)),
        update: vi.fn().mockResolvedValue({ success: true })
      },
      portfolio: {
        get: vi.fn().mockImplementation(() => Promise.resolve(mockPortfolioData)),
        update: vi.fn().mockResolvedValue({ success: true })
      },
      prices: {
        getForSymbols: vi.fn().mockResolvedValue({
          quotes: {
            AAPL: { price: 180, previousClose: 175, change: 5, changePercent: 2.8 }
          },
          exchangeRate: 36.5
        }),
        getSparkline: vi.fn().mockResolvedValue({
          AAPL: {
            dates: ["2026-06-01T00:00:00.000Z", "2026-06-02T00:00:00.000Z"],
            closes: [150, 180]
          },
          "THB=X": {
            dates: ["2026-06-01T00:00:00.000Z", "2026-06-02T00:00:00.000Z"],
            closes: [36.0, 36.5]
          }
        }),
        getHistory: vi.fn().mockResolvedValue({
          candles: [
            { date: "2026-06-01T00:00:00.000Z", close: 36.0 },
            { date: "2026-06-02T00:00:00.000Z", close: 36.5 }
          ]
        })
      },
      auth: {
        changePassword: vi.fn().mockResolvedValue({ success: true })
      }
    }
  };
});

describe("Custom Hooks Unit Tests", () => {
  const mockUser = { username: "test_user", token: "mock-token" };
  const mockShowToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockProfileData = {};
    mockPortfolioData = [];
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

  const waitForMicrotasks = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  };

  describe("useProfile Hook", () => {
    it("should initialize profile with default values or localStorage", () => {
      localStorage.setItem("portfolio_name_test_user", "MyCustomVault");
      localStorage.setItem("profile_nickname_test_user", "OldNick");

      const { result } = renderHook(() => useProfile({ user: mockUser, showToast: mockShowToast }));

      expect(result.current.portfolioName).toBe("MyCustomVault");
      expect(result.current.nickname).toBe("OldNick");
      expect(result.current.profilePic).toBe("");
    });

    it("should allow updating profile nickname and saving it", async () => {
      // Mock profile get to resolve empty so it does not overwrite nickname with mock data
      mockProfileData = {};

      const { result } = renderHook(() => useProfile({ user: mockUser, showToast: mockShowToast }));

      // Wait for mount load to finish
      await waitForMicrotasks();

      act(() => {
        result.current.setProfileModalOpen(true);
      });

      act(() => {
        result.current.setNewNickname("NewNick");
      });

      await act(async () => {
        await result.current.handleSaveProfile();
      });

      expect(result.current.nickname).toBe("NewNick");
      expect(localStorage.getItem("profile_nickname_test_user")).toBe("NewNick");
      expect(mockShowToast).toHaveBeenCalledWith("บันทึกข้อมูลโปรไฟล์สำเร็จ!", "success");
    });

    it("should change password when old and new passwords are provided", async () => {
      const { result } = renderHook(() => useProfile({ user: mockUser, showToast: mockShowToast }));

      act(() => {
        result.current.setOldPassword("old-pass123");
        result.current.setNewPassword("new-secure-pass");
      });

      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(mockShowToast).toHaveBeenCalledWith("เปลี่ยนรหัสผ่านสำเร็จแล้ว!", "success");
    });

    it("should reset profile details to defaults", async () => {
      mockProfileData = {};

      const { result } = renderHook(() => useProfile({ user: mockUser, showToast: mockShowToast }));

      await waitForMicrotasks();

      act(() => {
        result.current.setProfilePic("some-pic-data");
        result.current.setNickname("OldNick");
      });

      await act(async () => {
        await result.current.resetProfile();
      });

      expect(result.current.profilePic).toBe("");
      expect(result.current.nickname).toBe("");
      expect(result.current.portfolioName).toBe("StockVault");
    });
  });

  describe("usePrices Hook", () => {
    it("should initialize default prices values", () => {
      const mockAssetsRef = { current: [] };
      const { result } = renderHook(() =>
        usePrices({ user: mockUser, showToast: mockShowToast, assetsRef: mockAssetsRef })
      );

      expect(result.current.prices).toEqual({});
      expect(result.current.exchangeRate).toBe(35.0);
    });

    it("should calculate correct historical rate mapping", () => {
      const mockAssetsRef = { current: [] };
      const { result } = renderHook(() =>
        usePrices({ user: mockUser, showToast: mockShowToast, assetsRef: mockAssetsRef })
      );

      act(() => {
        result.current.setHistoricalRates({
          "2026-06-01": 36.0,
          "2026-06-02": 36.5
        });
        result.current.setExchangeRate(36.5);
      });

      expect(result.current.getHistoricalRate("2026-06-01T12:00:00Z")).toBe(36.0);
      expect(result.current.getHistoricalRate("2026-06-02T15:00:00Z")).toBe(36.5);
      expect(result.current.getHistoricalRate("2026-05-01")).toBe(36.5);
    });

    it("should calculate realized P&L in THB correctly using historical rates", () => {
      const mockAssetsRef = { current: [] };
      const { result } = renderHook(() =>
        usePrices({ user: mockUser, showToast: mockShowToast, assetsRef: mockAssetsRef })
      );

      act(() => {
        result.current.setHistoricalRates({
          "2026-06-01": 36.0
        });
      });

      const lots = [
        { id: "1", date: "2026-06-01", qty: 10, price: 360 },
        { id: "2", date: "2026-06-01", qty: -5, price: 540 }
      ];

      const realizedTHB = result.current.getRealizedPnLInTHB(lots, true);
      expect(realizedTHB).toBe(900);
    });
  });

  describe("usePortfolio Hook", () => {
    const mockFetchPrices = vi.fn();
    const mockFetchSparklines = vi.fn();
    const mockGetRealizedPnLInTHB = vi.fn().mockReturnValue(100);

    it("should load empty assets on initial mount failure or success", async () => {
      mockPortfolioData = [];

      const { result } = renderHook(() =>
        usePortfolio({
          user: mockUser,
          showToast: mockShowToast,
          fetchPrices: mockFetchPrices,
          fetchSparklines: mockFetchSparklines,
          chartRange: "1D",
          exchangeRate: 35.0,
          getRealizedPnLInTHB: mockGetRealizedPnLInTHB,
          hideValues: false
        })
      );

      await waitForLoading(result);

      expect(result.current.assets).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it("should perform asset save lot operations successfully", async () => {
      mockPortfolioData = [];

      const { result } = renderHook(() =>
        usePortfolio({
          user: mockUser,
          showToast: mockShowToast,
          fetchPrices: mockFetchPrices,
          fetchSparklines: mockFetchSparklines,
          chartRange: "1D",
          exchangeRate: 35.0,
          getRealizedPnLInTHB: mockGetRealizedPnLInTHB,
          hideValues: false
        })
      );

      await waitForLoading(result);

      // Seed assets state after loading resolves to []
      act(() => {
        result.current.setAssets([
          {
            id: "asset-1",
            symbol: "AAPL",
            qty: 10,
            avgCost: 150,
            lots: [{ id: "lot-1", date: "2026-06-01", qty: 10, price: 150 }]
          }
        ]);
      });

      const mockModalClose = vi.fn();

      await act(async () => {
        await result.current.handleSaveAsset(
          {
            symbol: "AAPL",
            qty: "5",
            price: "160",
            transactionType: "BUY",
            category: "stock"
          },
          mockModalClose
        );
      });

      expect(result.current.assets.length).toBe(1);
      expect(result.current.assets[0].qty).toBe(15);
      expect(mockModalClose).toHaveBeenCalled();
    });
  });

  describe("usePortfolioHistory Hook", () => {
    it("should correctly compile net worth coordinates array", () => {
      const assets = [
        {
          id: "asset-1",
          symbol: "AAPL",
          category: "stock",
          qty: 10,
          avgCost: 150,
          lots: [{ id: "l-1", date: "2026-06-01", qty: 10, price: 150 }]
        }
      ];

      const prices = {
        AAPL: { price: 180 }
      };

      const sparklines = {
        AAPL: {
          dates: ["2026-06-01T00:00:00.000Z", "2026-06-02T00:00:00.000Z"],
          closes: [150, 180]
        }
      };

      const { result } = renderHook(() =>
        usePortfolioHistory({
          assets,
          prices,
          sparklines,
          exchangeRate: 35.0,
          chartRange: "1M"
        })
      );

      // Points calculated: 2 points from sparklines + 1 point for today's value = 3 total points.
      expect(result.current.portfolioHistory.length).toBe(3);
      expect(result.current.portfolioHistory[0].value).toBe(1500);
      expect(result.current.portfolioHistory[1].value).toBe(1800);
    });
  });
});
