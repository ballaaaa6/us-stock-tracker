import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "./api";

describe("api service client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  const mockResponse = (status, data, ok = true) => {
    return Promise.resolve({
      status,
      ok,
      json: () => Promise.resolve(data)
    });
  };

  describe("auth", () => {
    it("should post login requests and return user data on success", async () => {
      const mockUser = { id: "user-123", username: "alice", token: "uuid-abc" };
      fetch.mockImplementation(() => mockResponse(200, mockUser));

      const result = await api.auth.login("alice", "pass123");

      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "alice", password: "pass123" })
        })
      );
      expect(result).toEqual(mockUser);
    });

    it("should throw an error on failed login requests", async () => {
      fetch.mockImplementation(() => mockResponse(401, { error: "รหัสผ่านไม่ถูกต้อง" }, false));

      await expect(api.auth.login("alice", "wrongpass")).rejects.toThrow("รหัสผ่านไม่ถูกต้อง");
    });

    it("should post register requests and return success details", async () => {
      const mockResult = { message: "สมัครสมาชิกสำเร็จ" };
      fetch.mockImplementation(() => mockResponse(200, mockResult));

      const result = await api.auth.register("bob", "secret123");

      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ username: "bob", password: "secret123" })
        })
      );
      expect(result).toEqual(mockResult);
    });

    it("should post change password requests with username", async () => {
      const mockResult = { message: "เปลี่ยนรหัสผ่านสำเร็จ" };
      fetch.mockImplementation(() => mockResponse(200, mockResult));

      await api.auth.changePassword("alice", "old123", "new123");

      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/change-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ username: "alice", oldPassword: "old123", newPassword: "new123" })
        })
      );
    });
  });

  describe("profile", () => {
    it("should fetch profile with Bearer authorization header", async () => {
      const mockProfile = { portfolioName: "My Wealth" };
      fetch.mockImplementation(() => mockResponse(200, mockProfile));

      const result = await api.profile.get("user-token-123");

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer user-token-123"
          }
        })
      );
      expect(result).toEqual(mockProfile);
    });

    it("should update profile with POST request and auth header", async () => {
      const mockProfile = { portfolioName: "New Name" };
      fetch.mockImplementation(() => mockResponse(200, { message: "OK" }));

      await api.profile.update("user-token-123", mockProfile);

      expect(fetch).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer user-token-123"
          },
          body: JSON.stringify(mockProfile)
        })
      );
    });
  });

  describe("portfolio", () => {
    it("should fetch portfolio with Bearer authorization header", async () => {
      const mockPortfolio = [{ symbol: "AAPL", qty: 10 }];
      fetch.mockImplementation(() => mockResponse(200, mockPortfolio));

      const result = await api.portfolio.get("user-token-123");

      expect(fetch).toHaveBeenCalledWith(
        "/api/portfolio",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer user-token-123"
          }
        })
      );
      expect(result).toEqual(mockPortfolio);
    });

    it("should update portfolio assets with POST request", async () => {
      const assets = [{ symbol: "AAPL", qty: 12 }];
      fetch.mockImplementation(() => mockResponse(200, { message: "OK" }));

      await api.portfolio.update("user-token-123", assets);

      expect(fetch).toHaveBeenCalledWith(
        "/api/portfolio",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(assets)
        })
      );
    });
  });

  describe("prices", () => {
    it("should request symbols price query", async () => {
      fetch.mockImplementation(() => mockResponse(200, { quotes: {} }));

      await api.prices.getForSymbols("AAPL,TSLA");

      expect(fetch).toHaveBeenCalledWith("/api/prices?symbols=AAPL%2CTSLA");
    });

    it("should request sparkline price query with range parameters", async () => {
      fetch.mockImplementation(() => mockResponse(200, {}));

      await api.prices.getSparkline("NVDA", "1M");

      expect(fetch).toHaveBeenCalledWith("/api/prices?sparkline=NVDA&tf=1M");
    });

    it("should request price history with range parameter", async () => {
      fetch.mockImplementation(() => mockResponse(200, {}));

      await api.prices.getHistory("GC=F", "MAX");

      expect(fetch).toHaveBeenCalledWith("/api/prices?history=GC%3DF&tf=MAX");
    });

    it("should request search query endpoint", async () => {
      fetch.mockImplementation(() => mockResponse(200, []));

      await api.prices.checkPrice("App");

      expect(fetch).toHaveBeenCalledWith("/api/prices?q=App");
    });
  });

  describe("ocr", () => {
    it("should request scan endpoint with images base64 payload", async () => {
      fetch.mockImplementation(() => mockResponse(200, { results: [] }));
      const scanPayload = { images: [{ base64: "base64img", mime: "image/jpeg" }], skipSave: true };

      await api.ocr.scan("user-token-123", scanPayload);

      expect(fetch).toHaveBeenCalledWith(
        "/api/scan",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer user-token-123"
          },
          body: JSON.stringify(scanPayload)
        })
      );
    });
  });
});
