/**
 * @file types.js
 * @description Central JSDoc type definitions for the US Stock Tracker application.
 * These type definitions assist IDE autocomplete and guide AI development.
 */

/**
 * Represents a single transaction or buy/sell lot of an asset.
 * @typedef {Object} TradeLot
 * @property {string} id - Unique identifier for the lot (e.g., 'scan-171829-abc').
 * @property {string} date - Transaction date in Gregorian YYYY-MM-DD format.
 * @property {string} time - Transaction time in 24-hour HH:MM format.
 * @property {number} qty - Share count. Positive for BUY, negative for SELL.
 * @property {number} price - Unit price paid or received.
 * @property {string} [broker] - Broker name (e.g., "Dime!", "InnovestX").
 */

/**
 * Represents a consolidated asset holding inside the user's portfolio.
 * @typedef {Object} Asset
 * @property {string} id - Unique asset identifier (e.g., 'asset-171829-xyz').
 * @property {string} symbol - Ticker symbol, uppercase (e.g., "AAPL", "SCB.BK", "BTC").
 * @property {string} name - Full company or asset name.
 * @property {'stock' | 'crypto' | 'gold' | 'fiat'} category - Asset classification.
 * @property {'stock' | 'crypto' | 'gold' | 'fiat'} [type] - Duplicate/alternative alias of category.
 * @property {number} qty - Current net quantity of shares owned (sum of lots qty).
 * @property {number} avgPrice - Weighted average cost basis per share (in USD).
 * @property {TradeLot[]} lots - Array of historical transaction lots for this asset.
 */

/**
 * Represents user profile settings and preferences.
 * @typedef {Object} UserProfile
 * @property {string} [portfolioName] - Custom title for the dashboard header.
 * @property {string} [profilePic] - Base64 JPEG data URL or name of active avatar preset.
 * @property {string} [nickname] - Display name in the profile bar.
 */

/**
 * Represents live market quote details returned by yahoo finance.
 * @typedef {Object} PriceQuote
 * @property {number} price - Current market price of the asset.
 * @property {number} [change] - Absolute price movement since last close.
 * @property {number} [changePercent] - Percentage price movement since last close.
 * @property {number} [high] - Daily high price.
 * @property {number} [low] - Daily low price.
 * @property {number} [open] - Market opening price.
 * @property {number} [prevClose] - Previous trading day closing price.
 */

/**
 * Map of dates to currency conversion exchange rates.
 * @typedef {Object.<string, number>} HistoricalRates
 * @example { "2026-06-01": 35.12, "2026-06-02": 35.25 }
 */

export {};
