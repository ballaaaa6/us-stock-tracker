import { describe, it, expect, beforeEach } from "vitest";
import { onRequest } from "./portfolio";

class MockKV {
  constructor() {
    this.store = {};
  }
  async get(key) {
    return this.store[key] || null;
  }
  async put(key, value) {
    this.store[key] = value;
  }
}

describe("portfolio API", () => {
  let mockKV;

  beforeEach(() => {
    mockKV = new MockKV();
  });

  const makeContext = (method, token, body = null) => {
    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (body) {
      headers.set("Content-Type", "application/json");
    }

    const request = new Request("http://localhost/api/portfolio", {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    return {
      request,
      env: {
        PORTFOLIOS: mockKV
      }
    };
  };

  it("should return 204 for OPTIONS request", async () => {
    const context = makeContext("OPTIONS", null);
    const response = await onRequest(context);
    expect(response.status).toBe(204);
  });

  it("should return 401 when Authorization header is missing", async () => {
    const context = makeContext("GET", null);
    const response = await onRequest(context);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain("ไม่พบสิทธิ์การใช้งาน");
  });

  it("should return 401 when token is empty", async () => {
    const context = makeContext("GET", "   ");
    const response = await onRequest(context);
    expect(response.status).toBe(401);
  });

  it("should initialize and return an empty portfolio (200) for a new user (GET)", async () => {
    const context = makeContext("GET", "user-uuid-123");
    const response = await onRequest(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual([]);

    // Check that it was initialized in the KV store
    const stored = await mockKV.get("portfolio:user-uuid-123");
    expect(stored).toBe("[]");
  });

  it("should return existing portfolio data (200) if already saved (GET)", async () => {
    await mockKV.put("portfolio:user-uuid-123", JSON.stringify([{ symbol: "AAPL", qty: 10 }]));
    const context = makeContext("GET", "user-uuid-123");
    const response = await onRequest(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual([{ symbol: "AAPL", qty: 10 }]);
  });

  it("should update portfolio and return 200 when body is a valid array (POST)", async () => {
    const portfolioData = [{ symbol: "TSLA", qty: 5 }, { symbol: "NVDA", qty: 25 }];
    const context = makeContext("POST", "user-uuid-123", portfolioData);
    const response = await onRequest(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toContain("บันทึกพอร์ตเรียบร้อยแล้ว");

    // Verify it is saved in KV
    const stored = await mockKV.get("portfolio:user-uuid-123");
    expect(JSON.parse(stored)).toEqual(portfolioData);
  });

  it("should return 400 if POST body is not an array", async () => {
    const badData = { symbol: "TSLA", qty: 5 }; // Object instead of Array
    const context = makeContext("POST", "user-uuid-123", badData);
    const response = await onRequest(context);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("รูปแบบข้อมูลพอร์ตไม่ถูกต้อง");
  });

  it("should return 405 for unsupported HTTP methods", async () => {
    const context = makeContext("DELETE", "user-uuid-123");
    const response = await onRequest(context);
    expect(response.status).toBe(405);
  });
});
