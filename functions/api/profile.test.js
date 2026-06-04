import { describe, it, expect, beforeEach } from "vitest";
import { onRequest } from "./profile";

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

describe("profile API", () => {
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

    const request = new Request("http://localhost/api/profile", {
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

  it("should return an empty object (200) for a new user without a profile (GET)", async () => {
    const context = makeContext("GET", "user-uuid-123");
    const response = await onRequest(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({});
  });

  it("should return existing profile data (200) if already saved (GET)", async () => {
    const profileObj = { username: "Alice", avatar: "preset1" };
    await mockKV.put("profile:user-uuid-123", JSON.stringify(profileObj));
    const context = makeContext("GET", "user-uuid-123");
    const response = await onRequest(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual(profileObj);
  });

  it("should save profile and return 200 (POST)", async () => {
    const profileObj = { username: "Bob", avatar: "preset2" };
    const context = makeContext("POST", "user-uuid-123", profileObj);
    const response = await onRequest(context);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toContain("บันทึกโปรไฟล์เรียบร้อย");

    // Verify it is saved in KV
    const stored = await mockKV.get("profile:user-uuid-123");
    expect(JSON.parse(stored)).toEqual(profileObj);
  });

  it("should return 405 for unsupported HTTP methods", async () => {
    const context = makeContext("PUT", "user-uuid-123");
    const response = await onRequest(context);
    expect(response.status).toBe(405);
  });
});
