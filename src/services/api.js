/**
 * Centralized API client service.
 * Handles URL parsing, request formatting, responses, and authorization headers.
 */

const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
};

const getHeaders = (userId, isMultipart = false) => {
  const headers = {};
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  if (userId) {
    headers["Authorization"] = `Bearer ${userId}`;
  }
  return headers;
};

export const api = {
  auth: {
    login: async (username, password) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ username, password })
      });
      return handleResponse(res);
    },
    register: async (username, password) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ username, password })
      });
      return handleResponse(res);
    },
    changePassword: async (username, oldPassword, newPassword) => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ username, oldPassword, newPassword })
      });
      return handleResponse(res);
    }
  },

  profile: {
    get: async (userId) => {
      const res = await fetch("/api/profile", {
        headers: getHeaders(userId)
      });
      return handleResponse(res);
    },
    update: async (userId, profileData) => {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: getHeaders(userId),
        body: JSON.stringify(profileData)
      });
      return handleResponse(res);
    }
  },

  portfolio: {
    get: async (userId) => {
      const res = await fetch("/api/portfolio", {
        headers: getHeaders(userId)
      });
      return handleResponse(res);
    },
    update: async (userId, assets) => {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: getHeaders(userId),
        body: JSON.stringify(assets)
      });
      return handleResponse(res);
    }
  },

  prices: {
    getForSymbols: async (symbols) => {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`);
      return handleResponse(res);
    },
    getSparkline: async (symbols, tf) => {
      const res = await fetch(`/api/prices?sparkline=${encodeURIComponent(symbols)}&tf=${tf}`);
      return handleResponse(res);
    },
    getHistory: async (symbol, tf) => {
      const res = await fetch(`/api/prices?history=${encodeURIComponent(symbol)}&tf=${tf}`);
      return handleResponse(res);
    },
    checkPrice: async (symbol) => {
      const res = await fetch(`/api/prices?q=${encodeURIComponent(symbol)}`);
      return handleResponse(res);
    }
  },

  ocr: {
    scan: async (userId, payload) => {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: getHeaders(userId),
        body: JSON.stringify(payload)
      });
      return handleResponse(res);
    }
  }
};
