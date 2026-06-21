/**
 * import-dime-json.js
 * Programmatic script to import and merge Dime transactions from transactions_history.json.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseOptionSymbol } from '../src/utils/dimePdfParser.js';
import { processTransactions } from '../src/utils/portfolioTransactionHelpers.js';

// Resolve __dirname under ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to show usage
function showUsage() {
  console.log(`
Usage:
  node scripts/import-dime-json.js --user <username> --pass <password> [--url <api_base_url>]

Arguments:
  --user, -u  Username to log in
  --pass, -p  Password to log in
  --url, -l   API Base URL (default: https://us-stock-tracker.pages.dev)
`);
  process.exit(1);
}

// Parse args
const args = process.argv.slice(2);
let username = '';
let password = '';
let apiBaseUrl = 'https://us-stock-tracker.pages.dev';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--user' || args[i] === '-u') {
    username = args[i + 1];
    i++;
  } else if (args[i] === '--pass' || args[i] === '-p') {
    password = args[i + 1];
    i++;
  } else if (args[i] === '--url' || args[i] === '-l') {
    apiBaseUrl = args[i + 1];
    if (apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1);
    }
    i++;
  }
}

if (!username || !password) {
  showUsage();
}

async function run() {
  try {
    const transactionsPath = path.resolve(__dirname, '../transactions_history.json');
    if (!fs.existsSync(transactionsPath)) {
      console.error(`Error: File not found at ${transactionsPath}`);
      process.exit(1);
    }

    const rawData = fs.readFileSync(transactionsPath, 'utf8');
    const rawTransactions = JSON.parse(rawData);

    console.log(`Loaded ${rawTransactions.length} transactions from JSON file.`);

    // Map raw transactions to standard schema
    const mappedTransactions = rawTransactions.map(tx => {
      const ticker = tx.ticker.toUpperCase();
      const optionDetails = parseOptionSymbol(ticker);
      
      // Date conversion: DD/MM/YYYY to YYYY-MM-DD
      const dateParts = tx.date.split('/');
      const formattedDate = dateParts.length === 3 
        ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` 
        : tx.date;

      const ccy = tx.currency || 'USD';
      
      return {
        date: formattedDate,
        time: "00:00",
        transactionType: tx.type === "BUY" ? "BUY" : "SELL",
        symbol: ticker,
        name: optionDetails
          ? `${optionDetails.underlying} ${optionDetails.type} $${optionDetails.strike.toFixed(2)}`
          : ticker,
        qty: tx.units,
        avgPrice: tx.price,
        type: optionDetails ? "option" : "stock",
        category: optionDetails ? "option" : "stock",
        broker: "Dime!",
        orderId: tx.order_id,
        
        // Core parameters mapping
        fee: ccy === "USD" ? tx.fee_usd : tx.fee_thb,
        vat: tx.vat_thb,
        discount: tx.discount_thb,
        netAmount: ccy === "USD" ? tx.total_usd : tx.total_thb,
        ccy,

        // Extra Dime metadata to forward to lot object
        gross_usd: tx.gross_usd,
        fee_usd: tx.fee_usd,
        fee_thb: tx.fee_thb,
        vat_thb: tx.vat_thb,
        discount_thb: tx.discount_thb,
        total_usd: tx.total_usd,
        total_thb: tx.total_thb,
        total_thb_disc: tx.total_thb_disc,
        file: tx.file
      };
    });

    console.log(`Logging in to ${apiBaseUrl} as ${username}...`);
    const loginRes = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      console.error(`Login failed: ${loginRes.status} - ${errText}`);
      process.exit(1);
    }

    const loginData = await loginRes.json();
    const token = loginData.token;
    if (!token) {
      console.error('Login succeeded but token was not returned.');
      process.exit(1);
    }

    console.log('Login successful.');

    console.log('Fetching current portfolio...');
    const portfolioRes = await fetch(`${apiBaseUrl}/api/portfolio`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!portfolioRes.ok) {
      const errText = await portfolioRes.text();
      console.error(`Failed to fetch portfolio: ${portfolioRes.status} - ${errText}`);
      process.exit(1);
    }

    const existingAssets = await portfolioRes.json();
    console.log(`Current portfolio contains ${existingAssets.length} assets.`);

    console.log('Processing and merging transactions...');
    const { updatedAssets, skippedTxs } = processTransactions({
      formData: mappedTransactions,
      assets: existingAssets,
      exchangeRate: 35.0, // fallback
      historicalRates: {} // fallback
    });

    console.log(`Processed all transactions.`);
    console.log(`Skipped/Duplicate transactions: ${skippedTxs.length}`);
    
    const originalLotsCount = existingAssets.reduce((sum, a) => sum + (a.lots || []).length, 0);
    const updatedLotsCount = updatedAssets.reduce((sum, a) => sum + (a.lots || []).length, 0);
    const addedLotsCount = updatedLotsCount - originalLotsCount;
    console.log(`Original transaction lots count: ${originalLotsCount}`);
    console.log(`Updated transaction lots count: ${updatedLotsCount}`);
    console.log(`Added transaction lots count: ${addedLotsCount}`);

    if (addedLotsCount === 0) {
      console.log('No new transactions to add. Portfolio is already up to date.');
      return;
    }

    console.log('Saving updated portfolio...');
    const saveRes = await fetch(`${apiBaseUrl}/api/portfolio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedAssets)
    });

    if (!saveRes.ok) {
      const errText = await saveRes.text();
      console.error(`Failed to save portfolio: ${saveRes.status} - ${errText}`);
      process.exit(1);
    }

    const saveData = await saveRes.json();
    console.log(`Portfolio saved successfully: ${saveData.message || 'Success'}`);

  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}

run();
