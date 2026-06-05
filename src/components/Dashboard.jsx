import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "../services/api";
import {
  Plus,
  RefreshCw,
  LogOut,
  Trash2,
  Download,
  Upload,
  PieChart,
  Pencil,
  X,
  Settings,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import AssetModal from "./AssetModal";
import AssetDetailPanel from "./AssetDetailPanel";

import { fmtUSD, fmtTHB, fmtPct, fmtQty, fmtDate } from "../utils/formatters";

import {
  getDisplaySymbol,
  getAssetFullName,
  getCurrencyTicker,
  getCurrencyPriceUSD,
  getRealizedPnL
} from "../utils/assetHelpers";

import DashboardHeader from "./dashboard/DashboardHeader";
import KPIRow from "./dashboard/KPIRow";
import PortfolioSummary from "./dashboard/PortfolioSummary";
import DonutChart from "./dashboard/DonutChart";
import AssetTable from "./dashboard/AssetTable";
import PnLDetailsModal from "./dashboard/PnLDetailsModal";
import PortfolioChart from "./charts/PortfolioChart";

const CATEGORY_LABELS = { stock: "หุ้น", crypto: "คริปโต", gold: "ทองคำ/น้ำมัน", fiat: "เงินสด" };

const PRESET_AVATARS = [
  {
    id: "bull",
    emoji: "📈",
    bg: "linear-gradient(135deg, #3B82F6 0%, #10B981 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bull-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%233B82F6"/><stop offset="100%" stop-color="%2310B981"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bull-g)"/><text x="50%" y="65%" font-size="50" text-anchor="middle" font-family="sans-serif">📈</text></svg>`
  },
  {
    id: "bear",
    emoji: "🐻",
    bg: "linear-gradient(135deg, #8B5CF6 0%, #EF4444 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bear-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238B5CF6"/><stop offset="100%" stop-color="%23EF4444"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23bear-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🐻</text></svg>`
  },
  {
    id: "lion",
    emoji: "🦁",
    bg: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="lion-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23F59E0B"/><stop offset="100%" stop-color="%23EF4444"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23lion-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🦁</text></svg>`
  },
  {
    id: "koala",
    emoji: "🐨",
    bg: "linear-gradient(135deg, #0D9488 0%, #06B6D4 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="koala-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230D9488"/><stop offset="100%" stop-color="%2306B6D4"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23koala-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🐨</text></svg>`
  },
  {
    id: "unicorn",
    emoji: "🦄",
    bg: "linear-gradient(135deg, #6366F1 0%, #EC4899 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="uni-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%236366F1"/><stop offset="100%" stop-color="%23EC4899"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23uni-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🦄</text></svg>`
  },
  {
    id: "fox",
    emoji: "🦊",
    bg: "linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)",
    svg: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="fox-g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238B5CF6"/><stop offset="100%" stop-color="%23D946EF"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(%23fox-g)"/><text x="50%" y="68%" font-size="50" text-anchor="middle" font-family="sans-serif">🦊</text></svg>`
  }
];

export default function Dashboard({ user, onLogout, showToast }) {
  const [hideValues, setHideValues] = useState(() => {
    return localStorage.getItem("hide_portfolio_values") === "true";
  });

  useEffect(() => {
    localStorage.setItem("hide_portfolio_values", hideValues ? "true" : "false");
  }, [hideValues]);

  const [assets, setAssets] = useState([]);
  const [prices, setPrices] = useState({});
  const [sparklines, setSparklines] = useState({}); // { SYM: { dates, closes } }
  const [portfolioHistory, setPortfolioHistory] = useState([]); // [{date, value}]
  const [exchangeRate, setExchangeRate] = useState(35.0);
  const [historicalRates, setHistoricalRates] = useState({});

  const fmt = useMemo(
    () => ({
      usd: (n) => fmtUSD(n, hideValues),
      thb: (n, decimals = 2) => fmtTHB(n, decimals, hideValues),
      pct: fmtPct,
      qty: (n) => fmtQty(n, hideValues),
      date: fmtDate
    }),
    [hideValues]
  );

  const getHistoricalRate = useCallback(
    (dateStr) => {
      if (!dateStr) return exchangeRate;
      const targetDate = dateStr.split("T")[0];
      if (historicalRates[targetDate]) {
        return historicalRates[targetDate];
      }
      const dates = Object.keys(historicalRates).sort();
      if (dates.length === 0) return exchangeRate;
      let bestRate = exchangeRate;
      for (const d of dates) {
        if (d <= targetDate) {
          bestRate = historicalRates[d];
        } else {
          break;
        }
      }
      return bestRate;
    },
    [historicalRates, exchangeRate]
  );

  const getRealizedPnLInTHB = useCallback(
    (lots, isThai) => {
      if (!lots || !lots.length) return 0;
      const sortedLots = [...lots].sort((a, b) => new Date(a.date) - new Date(b.date));
      let realizedTHB = 0;
      let currentQty = 0;
      let currentAvgCostUSD = 0;
      for (const lot of sortedLots) {
        const lotQty = lot.qty;
        let lotPriceUSD = lot.price || 0;
        const txRate = getHistoricalRate(lot.date);
        if (isThai && txRate) {
          lotPriceUSD = lotPriceUSD / txRate;
        }
        if (lotQty > 0) {
          const newQty = currentQty + lotQty;
          const newCost = currentQty * currentAvgCostUSD + lotQty * lotPriceUSD;
          currentAvgCostUSD = newQty > 0 ? newCost / newQty : 0;
          currentQty = newQty;
        } else if (lotQty < 0) {
          const sellQty = Math.abs(lotQty);
          const gainUSD = (lotPriceUSD - currentAvgCostUSD) * sellQty;
          const gainTHB = gainUSD * txRate;
          realizedTHB += gainTHB;
          currentQty = Math.max(0, currentQty - sellQty);
        }
      }
      return realizedTHB;
    },
    [getHistoricalRate]
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sparklineLoading, setSparklineLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [chartRange, setChartRange] = useState("1D");
  const [sortConfig, setSortConfig] = useState({ key: "value", dir: "desc" });
  const [priceFlash, setPriceFlash] = useState({}); // { SYM: "up"|"down" }
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [portfolioName, setPortfolioName] = useState(
    () => localStorage.getItem(`portfolio_name_${user.username}`) || "StockVault"
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [showPnLDetailsModal, setShowPnLDetailsModal] = useState(false);

  const syncProfileToServer = async (name, pic, nick) => {
    if (user.username === "local_user") return;
    try {
      await api.profile.update(user.token, {
        portfolioName: name,
        profilePic: pic,
        nickname: nick
      });
    } catch (err) {
      console.error("Profile sync failed:", err);
    }
  };

  useEffect(() => {
    const fetchProfileSync = async () => {
      try {
        const data = await api.profile.get(user.token);
        if (data.portfolioName) {
          setPortfolioName(data.portfolioName);
          localStorage.setItem(`portfolio_name_${user.username}`, data.portfolioName);
        }
        if (data.profilePic) {
          setProfilePic(data.profilePic);
          localStorage.setItem(`profile_pic_${user.username}`, data.profilePic);
        }
        if (data.nickname) {
          setNickname(data.nickname);
          localStorage.setItem(`profile_nickname_${user.username}`, data.nickname);
        }
      } catch (err) {
        console.warn("โหลดโปรไฟล์จากเซิร์ฟเวอร์ไม่สำเร็จ ใช้ข้อมูล Local แทน:", err.message);
      }
    };
    fetchProfileSync();
  }, [user.token, user.username]);

  const handleSaveName = async () => {
    const trimmed = tempName.trim();
    if (trimmed) {
      setPortfolioName(trimmed);
      localStorage.setItem(`portfolio_name_${user.username}`, trimmed);
      await syncProfileToServer(trimmed, profilePic, nickname);
    }
    setIsEditingName(false);
  };

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(`profile_pic_${user.username}`) || "");
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [donutDrillCategory, setDonutDrillCategory] = useState(null);
  const [nickname, setNickname] = useState(() => localStorage.getItem(`profile_nickname_${user.username}`) || "");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");

  const [newNickname, setNewNickname] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (profileModalOpen) {
      setNewNickname(nickname);
      setOldPassword("");
      setNewPassword("");
    }
  }, [profileModalOpen, nickname]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("ขนาดไฟล์ต้องไม่เกิน 10MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_DIM = 300;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setProfilePic(compressedDataUrl);
      };
      img.onerror = () => {
        showToast("ไม่สามารถประมวลผลไฟล์รูปภาพนี้ได้", "error");
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    try {
      const trimmedNickname = newNickname.trim();
      localStorage.setItem(`profile_nickname_${user.username}`, trimmedNickname);
      setNickname(trimmedNickname);
      localStorage.setItem(`profile_pic_${user.username}`, profilePic);
      showToast("บันทึกข้อมูลโปรไฟล์สำเร็จ!", "success");
      setProfileModalOpen(false);
      await syncProfileToServer(portfolioName, profilePic, trimmedNickname);
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการบันทึกโปรไฟล์", "error");
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      showToast("กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่ให้ครบถ้วน", "error");
      return;
    }
    if (newPassword.length < 6) {
      showToast("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร", "error");
      return;
    }

    try {
      await api.auth.changePassword(user.username, oldPassword, newPassword);
      showToast("เปลี่ยนรหัสผ่านสำเร็จแล้ว!", "success");
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      showToast("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน", "error");
    }
  };

  const prevPricesRef = useRef({});
  const assetsRef = useRef([]);
  assetsRef.current = assets;

  const handleClearAsset = async (assetId) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const displaySym = asset.broker
      ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})`
      : getDisplaySymbol(asset.symbol);
    const confirmMsg = `คุณแน่ใจหรือไม่ที่จะล้างผลตอบแทนสะสมที่รับรู้แล้ว (Realized P&L) ของ ${displaySym} ให้กลับไปเป็น 0? \n\nการดำเนินการนี้จะล้างเฉพาะค่าผลตอบแทนสะสมในอดีต โดยจะไม่ส่งผลกระทบใดๆ ต่อรายการประวัติการซื้อขายดั้งเดิม หรือจำนวนหุ้นที่คุณถืออยู่ปัจจุบัน`;
    if (!confirm(confirmMsg)) return;

    const isThai = asset.symbol.toUpperCase().endsWith(".BK");
    const rawRealized = getRealizedPnL(asset.lots || [], isThai, exchangeRate);
    const rawRealizedTHB = getRealizedPnLInTHB(asset.lots || [], isThai);

    const updatedAssets = assets.map((a) => {
      if (a.id === assetId) {
        return {
          ...a,
          clearedRealizedUSD: rawRealized,
          clearedRealizedTHB: rawRealizedTHB
        };
      }
      return a;
    });

    await savePortfolio(updatedAssets);
    await fetchPrices(updatedAssets);
    fetchSparklines(updatedAssets, chartRange);
    showToast(`ล้างผลตอบแทนสะสมที่รับรู้แล้วของ ${displaySym} เรียบร้อย`, "success");
  };

  const handleDeleteAsset = async (param, fromModal = false) => {
    const assetId = typeof param === "string" ? param : param?.id;
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const displaySym = asset.broker
      ? `${getDisplaySymbol(asset.symbol)} (${asset.broker})`
      : getDisplaySymbol(asset.symbol);

    if (fromModal) {
      if (asset.qty > 0) {
        alert(
          `❌ ไม่สามารถลบ ${displaySym} จากหน้ากำไร/ขาดทุนรายตัวได้เนื่องจากยังมีหุ้นเหลืออยู่บนหน้าหลัก (${asset.qty} หน่วย)\n\nกรุณาลบจากหน้ากระดานหลัก หรือทำธุรกรรมขายออกให้หมดก่อน`
        );
        return;
      }
    }

    const confirmMsg = `คุณแน่ใจหรือไม่ที่จะลบสินทรัพย์ ${displaySym} และประวัติธุรกรรมทั้งหมดออกอย่างถาวร?`;
    if (!confirm(confirmMsg)) return;

    const updatedAssets = assets.filter((a) => a.id !== assetId);
    try {
      await savePortfolio(updatedAssets);
      await fetchPrices(updatedAssets);
      fetchSparklines(updatedAssets, chartRange);
      showToast(`ลบสินทรัพย์ ${displaySym} ออกเรียบร้อย`, "success");
    } catch (err) {
      showToast("ลบไม่สำเร็จ: " + err.message, "error");
    }
  };

  const savePortfolio = async (updatedAssets) => {
    setAssets(updatedAssets);
    localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(updatedAssets));

    try {
      await api.portfolio.update(user.token, updatedAssets);
    } catch (err) {
      console.warn("ไม่สามารถเซฟข้อมูลลง Cloudflare ได้ ใช้ Local Storage แทน:", err.message);
      showToast("บันทึกข้อมูลในอุปกรณ์เครื่องนี้แล้ว (เซิร์ฟเวอร์ออฟไลน์)", "warning");
    }
  };

  /* ── FETCH PORTFOLIO ── */
  const fetchPortfolio = async () => {
    try {
      const data = await api.portfolio.get(user.token);
      setAssets(data);
      localStorage.setItem(`local_portfolio_${user.username}`, JSON.stringify(data));
      await fetchPrices(data);
      if (data.length > 0) fetchSparklines(data, chartRange);
    } catch (err) {
      console.warn("โหลดพอร์ตจากเซิร์ฟเวอร์ไม่สำเร็จ ใช้ข้อมูล Local แทน:", err.message);
      const localData = JSON.parse(localStorage.getItem(`local_portfolio_${user.username}`) || "[]");
      setAssets(localData);
      await fetchPrices(localData);
      if (localData.length > 0) fetchSparklines(localData, chartRange);
      showToast("ใช้ข้อมูลพอร์ตที่บันทึกในเครื่องชั่วคราว", "info");
    } finally {
      setLoading(false);
    }
  };

  /* ── FETCH LIVE PRICES ── */
  const fetchPrices = async (portfolioAssets) => {
    setRefreshing(true);
    try {
      const symbols = portfolioAssets
        .map((a) => {
          const isCashAsset = a.type === "fiat" || a.category === "fiat";
          if (isCashAsset) {
            if (a.symbol === "USD") return null;
            return getCurrencyTicker(a.symbol);
          }
          return a.symbol;
        })
        .filter(Boolean)
        .join(",");

      if (!symbols) {
        setPrices({});
        setRefreshing(false);
        return;
      }

      let data = null;
      try {
        data = await api.prices.getForSymbols(symbols);
      } catch (apiErr) {
        console.warn("fetchPrices API network error, falling back to mock:", apiErr.message);
      }

      if (data) {
        const newPrices = data.quotes || {};

        // Detect price changes for flash animation
        const flash = {};
        Object.keys(newPrices).forEach((sym) => {
          const prev = prevPricesRef.current[sym]?.price;
          const curr = newPrices[sym]?.price;
          if (prev != null && curr != null && curr !== prev) {
            flash[sym] = curr > prev ? "up" : "down";
          }
        });
        if (Object.keys(flash).length > 0) {
          setPriceFlash(flash);
          setTimeout(() => setPriceFlash({}), 1600);
        }

        prevPricesRef.current = newPrices;
        setPrices(newPrices);
        if (data.exchangeRate) setExchangeRate(data.exchangeRate);
      } else {
        const newPrices = { ...prevPricesRef.current };
        const symList = symbols ? symbols.split(",") : [];

        symList.forEach((s) => {
          const cleanSym = s.toUpperCase();
          let basePrice = 100.0;

          const matchAsset = portfolioAssets.find(
            (a) => a.symbol.toUpperCase() === cleanSym || getCurrencyTicker(a.symbol).toUpperCase() === cleanSym
          );
          if (matchAsset) {
            basePrice = matchAsset.avgCost || matchAsset.avgPrice || 100.0;
          }

          const changePercent = (Math.random() - 0.5) * 0.02;
          const lastPrice = prevPricesRef.current[cleanSym]?.price || basePrice;
          const currPrice = lastPrice * (1 + changePercent);

          newPrices[cleanSym] = {
            price: currPrice,
            change: changePercent * 100,
            changesPercentage: changePercent * 100,
            marketState: "REGULAR",
            displayName: cleanSym
          };
        });

        const mockExchangeRate = 35.0 + (Math.random() - 0.5) * 0.2;
        setExchangeRate(mockExchangeRate);

        newPrices["THB=X"] = {
          price: mockExchangeRate,
          change: 0.0,
          changesPercentage: 0.0,
          marketState: "REGULAR",
          displayName: "THB"
        };
        newPrices["USD"] = {
          price: 1.0,
          change: 0,
          changesPercentage: 0,
          marketState: "REGULAR"
        };

        const flash = {};
        Object.keys(newPrices).forEach((sym) => {
          const prev = prevPricesRef.current[sym]?.price;
          const curr = newPrices[sym]?.price;
          if (prev != null && curr != null && curr !== prev) {
            flash[sym] = curr > prev ? "up" : "down";
          }
        });
        if (Object.keys(flash).length > 0) {
          setPriceFlash(flash);
          setTimeout(() => setPriceFlash({}), 1600);
        }

        prevPricesRef.current = newPrices;
        setPrices(newPrices);
      }
    } catch (err) {
      console.error("Price fetch error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  /* ── FETCH SPARKLINES ── */
  const fetchSparklines = async (portfolioAssets, range) => {
    if (!portfolioAssets.length) return;
    setSparklineLoading(true);
    try {
      const syms = [
        ...new Set(
          portfolioAssets
            .map((a) => {
              const isCashAsset = a.type === "fiat" || a.category === "fiat";
              if (isCashAsset) {
                if (a.symbol === "USD") return null;
                return getCurrencyTicker(a.symbol);
              }
              return a.symbol;
            })
            .filter(Boolean)
        )
      ];

      // Calculate optimal timeframe range based on earliest transaction date
      let earliestDate = null;
      portfolioAssets.forEach((asset) => {
        const assetLots = asset.lots && asset.lots.length > 0 ? asset.lots : [];
        assetLots.forEach((lot) => {
          if (lot && lot.date && lot.date !== "1970-01-01") {
            if (!earliestDate || lot.date < earliestDate) {
              earliestDate = lot.date;
            }
          }
        });
      });

      let optimalRange = range;
      if (earliestDate) {
        const earliestTime = new Date(earliestDate + "T00:00:00.000Z").getTime();
        const ageInDays = (Date.now() - earliestTime) / 86400000;

        const rangeDurationDays = {
          "1D": 1,
          "1W": 7,
          "1M": 30,
          "3M": 90,
          "6M": 180,
          YTD: 365,
          "1Y": 365,
          "5Y": 1825,
          MAX: Infinity
        };

        const rangesOrder = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];
        let matchedRange = "1D";
        for (const r of rangesOrder) {
          matchedRange = r;
          if (rangeDurationDays[r] >= ageInDays) {
            break;
          }
        }

        const requestedIdx = rangesOrder.indexOf(range);
        const matchedIdx = rangesOrder.indexOf(matchedRange);
        if (matchedIdx < requestedIdx) {
          optimalRange = matchedRange;
        }
      }

      let data = null;
      try {
        data = await api.prices.getSparkline(syms.join(","), optimalRange);
      } catch (apiErr) {
        console.warn("fetchSparklines API network error, falling back to mock:", apiErr.message);
      }

      if (data) {
        setSparklines(data);
      } else {
        const mockSparklines = {};
        const days =
          {
            "1D": 24,
            "1W": 7,
            "1M": 30,
            "3M": 90,
            "6M": 180,
            YTD: 150,
            "1Y": 252,
            "5Y": 252 * 5,
            MAX: 252 * 5
          }[optimalRange] || 30;

        const nowTime = Date.now();
        const dateInterval =
          {
            "1D": 3600 * 1000,
            "1W": 24 * 3600 * 1000,
            "1M": 24 * 3600 * 1000,
            "3M": 24 * 3600 * 1000,
            "6M": 24 * 3600 * 1000,
            YTD: 24 * 3600 * 1000,
            "1Y": 24 * 3600 * 1000,
            "5Y": 7 * 24 * 3600 * 1000,
            MAX: 7 * 24 * 3600 * 1000
          }[optimalRange] || 24 * 3600 * 1000;

        syms.forEach((sym) => {
          const cleanSym = sym.toUpperCase();
          const dates = [];
          const closes = [];

          let basePrice = 100.0;
          const matchAsset = portfolioAssets.find(
            (a) => a.symbol.toUpperCase() === cleanSym || getCurrencyTicker(a.symbol).toUpperCase() === cleanSym
          );
          if (matchAsset) {
            basePrice = matchAsset.avgCost || matchAsset.avgPrice || 100.0;
          }

          let currentVal = basePrice * 0.9;

          for (let i = days; i >= 0; i--) {
            const timeAt = nowTime - i * dateInterval;
            const dateStr = new Date(timeAt).toISOString();
            const drift = (Math.random() - 0.48) * 0.03;
            currentVal = currentVal * (1 + drift);
            if (currentVal < 0.01) currentVal = 0.01;

            dates.push(dateStr);
            closes.push(currentVal);
          }

          mockSparklines[cleanSym] = { dates, closes };
        });

        const thbCloses = [];
        const thbDates = [];
        let currThb = 35.0;
        for (let i = days; i >= 0; i--) {
          const timeAt = nowTime - i * dateInterval;
          const dateStr = new Date(timeAt).toISOString();
          const drift = (Math.random() - 0.5) * 0.005;
          currThb = currThb * (1 + drift);
          thbDates.push(dateStr);
          thbCloses.push(currThb);
        }
        mockSparklines["THB=X"] = { dates: thbDates, closes: thbCloses };

        setSparklines(mockSparklines);
      }
    } catch (err) {
      console.error("Sparkline fetch error:", err);
    } finally {
      setSparklineLoading(false);
    }
  };

  /* ── COMPUTE PORTFOLIO HISTORY ── */
  useEffect(() => {
    if (!Object.keys(sparklines).length || !assets.length) {
      setPortfolioHistory([]);
      return;
    }

    const isShortTF = chartRange === "1D" || chartRange === "5D" || chartRange === "1W";

    const symbolPriceHistories = {};
    Object.keys(sparklines).forEach((sym) => {
      const symData = sparklines[sym];
      if (symData && symData.dates && symData.dates.length > 0) {
        const points = symData.dates
          .map((d, idx) => ({
            dateStr: isShortTF ? d : d.split("T")[0],
            price: symData.closes[idx]
          }))
          .filter((p) => p.price != null && p.price > 0);
        points.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        symbolPriceHistories[sym.toUpperCase()] = points;
      }
    });

    const getPriceOnDate = (sym, targetDateStr) => {
      const points = symbolPriceHistories[sym.toUpperCase()];
      const todayStr = new Date().toISOString().split("T")[0];
      if (!isShortTF && targetDateStr.startsWith(todayStr)) {
        const livePrice = prices[sym.toUpperCase()]?.price;
        if (livePrice != null && livePrice > 0) {
          return livePrice;
        }
      }

      if (points && points.length > 0) {
        for (let i = points.length - 1; i >= 0; i--) {
          if (points[i].dateStr <= targetDateStr) {
            return points[i].price;
          }
        }
        return points[0].price;
      }

      const livePrice = prices[sym.toUpperCase()]?.price;
      if (livePrice != null && livePrice > 0) {
        return livePrice;
      }

      const asset = assets.find((a) => a.symbol.toUpperCase() === sym.toUpperCase());
      if (asset) {
        const avg = asset.avgCost ?? asset.avgPrice ?? 0;
        if (avg > 0) return avg;
      }
      return null;
    };

    const allDatesSet = new Set();
    Object.keys(sparklines).forEach((sym) => {
      const symData = sparklines[sym];
      if (symData && symData.dates) {
        symData.dates.forEach((d) => {
          if (d) {
            if (isShortTF) {
              allDatesSet.add(d);
            } else {
              allDatesSet.add(d.split("T")[0]);
            }
          }
        });
      }
    });

    if (allDatesSet.size === 0) {
      setPortfolioHistory([]);
      return;
    }

    if (isShortTF) {
      allDatesSet.add(new Date().toISOString());
    } else {
      allDatesSet.add(new Date().toISOString().split("T")[0]);
    }

    let timeline = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));

    let earliestDate = null;
    assets.forEach((asset) => {
      const assetLots = asset.lots && asset.lots.length > 0 ? asset.lots : [];
      assetLots.forEach((lot) => {
        if (lot && lot.date && lot.date !== "1970-01-01") {
          if (!earliestDate || lot.date < earliestDate) {
            earliestDate = lot.date;
          }
        }
      });
    });

    let rawStartDateStr = null;
    Object.keys(sparklines).forEach((sym) => {
      const symData = sparklines[sym];
      if (symData && symData.dates && symData.dates.length > 0) {
        const firstDate = symData.dates[0];
        if (firstDate) {
          const dStr = firstDate.split("T")[0];
          if (!rawStartDateStr || dStr < rawStartDateStr) {
            rawStartDateStr = dStr;
          }
        }
      }
    });

    if (earliestDate) {
      const earliestStr = earliestDate.split("T")[0];
      if (rawStartDateStr && earliestStr > rawStartDateStr) {
        timeline = timeline.filter((d) => {
          const dStr = isShortTF ? d.split("T")[0] : d;
          return dStr >= earliestStr;
        });

        const firstTimelineDate = timeline[0] ? (isShortTF ? timeline[0].split("T")[0] : timeline[0]) : "";
        if (timeline.length > 0 && firstTimelineDate > earliestStr) {
          timeline.unshift(isShortTF ? earliestStr + "T00:00:00.000Z" : earliestStr);
        } else if (timeline.length === 0) {
          timeline.push(isShortTF ? earliestStr + "T00:00:00.000Z" : earliestStr);
        }
      }
    }

    const assetLotsWithMappedIdx = assets.map((asset) => {
      const isThai = asset.symbol.toUpperCase().endsWith(".BK");
      const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

      const rawLots =
        asset.lots && asset.lots.length > 0
          ? asset.lots
          : [
              {
                id: "virtual",
                date: "1970-01-01",
                time: "00:00",
                qty: asset.qty,
                price: asset.avgCost ?? asset.avgPrice ?? 0
              }
            ];

      const mappedLots = rawLots
        .map((lot) => {
          if (!lot || !lot.date) return null;
          const lotTime = new Date(lot.date + "T" + (lot.time || "00:00") + ":00.000Z").getTime();

          let bestIdx = 0;
          let bestDiff = Infinity;
          timeline.forEach((tStr, idx) => {
            const tTime = new Date(tStr.includes("T") ? tStr : tStr + "T00:00:00.000Z").getTime();
            const diff = Math.abs(tTime - lotTime);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = idx;
            }
          });

          return { ...lot, mappedIdx: bestIdx };
        })
        .filter(Boolean);

      return {
        ...asset,
        lots: mappedLots,
        isThai,
        isCashAsset
      };
    });

    let history = timeline.map((date, idx) => {
      let totalUSD = 0;
      let totalCostUSD = 0;

      assetLotsWithMappedIdx.forEach((asset) => {
        const lotsBeforeOrOnDate = asset.lots.filter((lot) => lot.mappedIdx <= idx);
        if (lotsBeforeOrOnDate.length === 0) return;

        const qtyOnDate = lotsBeforeOrOnDate.reduce((sum, l) => sum + (l.qty || 0), 0);

        const costOnDateUSD = lotsBeforeOrOnDate.reduce((sum, l) => {
          let priceUSD = asset.isThai ? (l.price || 0) / exchangeRate : l.price || 0;
          if (asset.isCashAsset) {
            if (asset.symbol === "USD") {
              priceUSD = 1.0;
            } else {
              priceUSD = l.price || getCurrencyPriceUSD(asset.symbol, prices, exchangeRate);
            }
          }
          return sum + (l.qty || 0) * priceUSD;
        }, 0);

        if (asset.isCashAsset) {
          let priceUSD = 0;
          if (asset.symbol === "USD") {
            priceUSD = 1.0;
          } else {
            const ticker = getCurrencyTicker(asset.symbol);
            const priceVal = getPriceOnDate(ticker, date);
            if (priceVal != null && priceVal > 0) {
              if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
                priceUSD = priceVal;
              } else {
                priceUSD = 1.0 / priceVal;
              }
            } else {
              priceUSD = asset.symbol === "THB" ? 1.0 / (exchangeRate || 35.0) : 1.0;
            }
          }

          const valueUSD = priceUSD * qtyOnDate;
          totalUSD += valueUSD;
          totalCostUSD += costOnDateUSD;
          return;
        }

        const price = getPriceOnDate(asset.symbol, date);
        let priceUSD = 0;
        if (price != null && price > 0) {
          priceUSD = asset.isThai ? price / exchangeRate : price;
        } else {
          const livePrice = prices[asset.symbol.toUpperCase()]?.price;
          if (livePrice != null && livePrice > 0) {
            priceUSD = asset.isThai ? livePrice / exchangeRate : livePrice;
          } else {
            priceUSD = qtyOnDate > 0 ? costOnDateUSD / qtyOnDate : 0;
          }
        }
        const valueUSD = priceUSD * qtyOnDate;
        totalUSD += valueUSD;
        totalCostUSD += costOnDateUSD;
      });

      const dateIso = date.includes("T") ? date : date + "T00:00:00.000Z";
      return { date: dateIso, value: totalUSD, cost: totalCostUSD };
    });

    history = history.filter((d) => d.value > 0);

    if (history.length === 1) {
      const singlePoint = history[0];
      const prevDate = new Date(new Date(singlePoint.date) - 86400000).toISOString();
      history.unshift({ date: prevDate, value: singlePoint.value, cost: singlePoint.cost });
    }

    setPortfolioHistory(history);
  }, [sparklines, assets, prices, exchangeRate, chartRange]);

  /* ── CHART RANGE CHANGE ── */
  const handleRangeChange = useCallback((r) => {
    setChartRange(r);
    if (assetsRef.current.length > 0) fetchSparklines(assetsRef.current, r);
  }, []);

  /* ── AUTO-REFRESH ENGINE ── */
  useEffect(() => {
    fetchPortfolio();
  }, []);

  useEffect(() => {
    const fetchHistoricalRates = async () => {
      let data = null;
      try {
        data = await api.prices.getHistory("THB=X", "MAX");
      } catch (apiErr) {
        console.warn("fetchHistoricalRates API network error, falling back to mock:", apiErr.message);
      }

      if (data) {
        const rates = {};
        if (data.candles) {
          data.candles.forEach((c) => {
            if (c.date && c.close) {
              const dateKey = c.date.split("T")[0];
              rates[dateKey] = c.close;
            }
          });
        }
        setHistoricalRates(rates);
      } else {
        const rates = {};
        const now = Date.now();
        let currentThb = 35.0;
        for (let i = 0; i < 3650; i++) {
          const timeAt = now - i * 24 * 3600 * 1000;
          const dateKey = new Date(timeAt).toISOString().split("T")[0];
          const drift = (Math.random() - 0.5) * 0.002;
          currentThb = currentThb * (1 + drift);
          if (currentThb < 28) currentThb = 28;
          if (currentThb > 40) currentThb = 40;
          rates[dateKey] = currentThb;
        }
        setHistoricalRates(rates);
      }
    };
    fetchHistoricalRates();
  }, [user.username]);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(() => fetchPrices(assetsRef.current), 30000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  /* ── SORT TABLE ── */
  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  /* ── COMPUTE PER-ASSET VALUATION ── */
  const computeAsset = useCallback(
    (asset) => {
      const isThai = asset.symbol.endsWith(".BK");
      const isCashAsset = asset.type === "fiat" || asset.category === "fiat";

      if (isCashAsset) {
        const price = 1.0;
        const priceUSD = getCurrencyPriceUSD(asset.symbol, prices, exchangeRate);
        const valueUSD = priceUSD * asset.qty;
        const valueTHB = valueUSD * exchangeRate;

        const avgCost = asset.avgCost ?? asset.avgPrice ?? priceUSD;
        const costUSD = avgCost * asset.qty;
        const gainUSD = valueUSD - costUSD;
        const gainPct = costUSD > 0 ? (gainUSD / costUSD) * 100 : 0;

        let todayChg = 0;
        let todayPct = 0;
        if (asset.symbol !== "USD") {
          const ticker = getCurrencyTicker(asset.symbol);
          const pData = prices[ticker];
          if (pData) {
            const prevPriceVal = pData.previousClose || pData.price;
            if (prevPriceVal > 0) {
              let prevPriceUSD = 0;
              if (["EUR", "GBP", "AUD", "NZD"].includes(asset.symbol)) {
                prevPriceUSD = prevPriceVal;
              } else {
                prevPriceUSD = 1.0 / prevPriceVal;
              }
              todayChg = (priceUSD - prevPriceUSD) * asset.qty;
              todayPct = prevPriceUSD > 0 ? ((priceUSD - prevPriceUSD) / prevPriceUSD) * 100 : 0;
            }
          }
        }

        return {
          price,
          priceUSD,
          valueUSD,
          valueTHB,
          costUSD,
          gainUSD,
          gainPct,
          todayChg,
          todayPct,
          extPrice: null,
          extChangePct: null,
          extType: null
        };
      }

      const pData = prices[asset.symbol];
      const regPrice = pData?.price ?? 0;

      const isPre = pData?.marketState === "PRE" || pData?.marketState === "PREPRE";
      const isPost = pData?.marketState === "POST" || pData?.marketState === "POSTPOST";

      let extPrice = null;
      let extChangePct = null;
      let extType = null;

      if (isPre && pData.prePrice != null && pData.prePrice > 0) {
        extPrice = pData.prePrice;
        extChangePct = regPrice > 0 ? ((pData.prePrice - regPrice) / regPrice) * 100 : 0;
        extType = "Pre";
      } else if (isPost && pData.postPrice != null && pData.postPrice > 0) {
        extPrice = pData.postPrice;
        extChangePct = regPrice > 0 ? ((pData.postPrice - regPrice) / regPrice) * 100 : 0;
        extType = "After";
      }

      const price = extPrice ?? regPrice;
      const priceUSD = isThai ? price / exchangeRate : price;
      const valueUSD = priceUSD * asset.qty;
      const valueTHB = valueUSD * exchangeRate;

      const avgCost = asset.avgCost ?? asset.avgPrice ?? 0;
      const costUSD = avgCost * asset.qty;
      const gainUSD = valueUSD - costUSD;
      const gainPct = costUSD > 0 ? (gainUSD / costUSD) * 100 : 0;

      const activePrice = price;
      const prevClose = pData?.previousClose ?? activePrice;
      const todayChg = (activePrice - prevClose) * asset.qty;
      const todayPct = prevClose > 0 ? ((activePrice - prevClose) / prevClose) * 100 : 0;

      const regPriceUSD = isThai ? regPrice / exchangeRate : regPrice;
      const regValueUSD = regPriceUSD * asset.qty;
      const regValueTHB = regValueUSD * exchangeRate;
      const regGainUSD = regValueUSD - costUSD;
      const regGainPct = costUSD > 0 ? (regGainUSD / costUSD) * 100 : 0;
      const regTodayChg = pData?.change ? (isThai ? pData.change / exchangeRate : pData.change) * asset.qty : 0;
      const regTodayPct = pData?.changePercent ?? 0;

      let extPriceUSD = null,
        extValueUSD = null,
        extValueTHB = null,
        extGainUSD = null,
        extGainPct = null,
        extTodayPct = null;

      if (extPrice != null) {
        extPriceUSD = isThai ? extPrice / exchangeRate : extPrice;
        extValueUSD = extPriceUSD * asset.qty;
        extValueTHB = extValueUSD * exchangeRate;
        extGainUSD = extValueUSD - costUSD;
        extGainPct = costUSD > 0 ? (extGainUSD / costUSD) * 100 : 0;
        extTodayPct = extChangePct ?? 0;
      }

      return {
        price,
        priceUSD,
        valueUSD,
        valueTHB,
        costUSD,
        gainUSD,
        gainPct,
        todayChg,
        todayPct,
        extPrice,
        extChangePct,
        extType,
        regPrice,
        regPriceUSD,
        regValueUSD,
        regValueTHB,
        regGainUSD,
        regGainPct,
        regTodayChg,
        regTodayPct,
        extPriceUSD,
        extValueUSD,
        extValueTHB,
        extGainUSD,
        extGainPct,
        extTodayPct
      };
    },
    [prices, exchangeRate]
  );

  /* ── COMPUTED PORTFOLIO TOTALS ── */
  const {
    totalUSD,
    totalCostUSD,
    todayChangeUSD,
    totalRealizedUSD,
    totalRealizedTHB,
    bestAsset,
    sortedAssets,
    donutSegments
  } = useMemo(() => {
    if (!assets.length)
      return {
        totalUSD: 0,
        totalCostUSD: 0,
        todayChangeUSD: 0,
        totalRealizedUSD: 0,
        totalRealizedTHB: 0,
        bestAsset: null,
        sortedAssets: [],
        donutSegments: []
      };

    let totVal = 0,
      totCost = 0,
      totToday = 0;
    let totRealized = 0;
    let totRealizedTHB = 0;
    let bestSym = null,
      bestPct = -Infinity;

    const computed = assets.map((a) => {
      const c = computeAsset(a);
      totVal += c.valueUSD;
      totCost += c.costUSD;
      totToday += c.todayChg;

      const isThai = a.symbol.toUpperCase().endsWith(".BK");
      const rawRealized = getRealizedPnL(a.lots || [], isThai, exchangeRate);
      const realized = rawRealized - (a.clearedRealizedUSD || 0);
      totRealized += realized;

      const rawRealizedTHB = getRealizedPnLInTHB(a.lots || [], isThai);
      const realizedTHB = rawRealizedTHB - (a.clearedRealizedTHB || 0);
      totRealizedTHB += realizedTHB;

      const assetWithPnL = {
        ...a,
        ...c,
        realizedPnL: realized,
        realizedPnLTHB: realizedTHB,
        unrealizedPnL: a.qty > 0 ? c.valueUSD - c.costUSD : 0,
        totalPnL: realized + (a.qty > 0 ? c.valueUSD - c.costUSD : 0)
      };

      if (c.gainPct > bestPct && a.qty > 0 && (a.avgCost > 0 || a.avgPrice > 0)) {
        bestPct = c.gainPct;
        bestSym = a;
      }
      return assetWithPnL;
    });

    const activeAssets = computed.filter((a) => a.qty > 0.00001);

    const sorted = [...activeAssets].sort((a, b) => {
      if (!sortConfig.key) return b.valueUSD - a.valueUSD;
      const dir = sortConfig.dir === "asc" ? 1 : -1;
      switch (sortConfig.key) {
        case "value":
          return dir * (a.valueUSD - b.valueUSD);
        case "gain":
          return dir * (a.gainPct - b.gainPct);
        case "today":
          return dir * (a.todayPct - b.todayPct);
        case "symbol":
          return dir * a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });

    const catMap = {};
    activeAssets.forEach((a) => {
      const cat = a.category || "stock";
      if (!catMap[cat]) catMap[cat] = 0;
      catMap[cat] += a.valueUSD;
    });
    const donut = Object.entries(catMap)
      .map(([cat, val]) => ({
        id: cat,
        label: CATEGORY_LABELS[cat] || cat,
        pct: totVal > 0 ? (val / totVal) * 100 : 0,
        value: val
      }))
      .filter((s) => s.pct > 0)
      .sort((a, b) => b.pct - a.pct);

    return {
      totalUSD: totVal,
      totalCostUSD: totCost,
      todayChangeUSD: totToday,
      totalRealizedUSD: totRealized,
      totalRealizedTHB: totRealizedTHB,
      bestAsset: bestSym ? { symbol: bestSym.symbol, pct: bestPct } : null,
      sortedAssets: sorted,
      donutSegments: donut
    };
  }, [assets, prices, exchangeRate, sortConfig, computeAsset, getRealizedPnLInTHB]);

  const initialCapitalUSD = useMemo(() => {
    let sumBuys = 0;
    let hasBuys = false;
    assets.forEach((a) => {
      const isCashAsset = a.type === "fiat" || a.category === "fiat";
      if (!isCashAsset) {
        const isThai = a.symbol.toUpperCase().endsWith(".BK");
        (a.lots || []).forEach((l) => {
          if (l.qty > 0) {
            const priceUSD = isThai ? l.price / exchangeRate : l.price;
            sumBuys += l.qty * priceUSD;
            hasBuys = true;
          }
        });
      }
    });
    if (hasBuys && sumBuys > 0) return sumBuys;
    return totalCostUSD;
  }, [assets, exchangeRate, totalCostUSD]);

  const totalUnrealizedUSD = totalUSD - totalCostUSD;
  const totalUnrealizedTHB = totalUnrealizedUSD * exchangeRate;
  const totalGainTHB = totalUnrealizedTHB + totalRealizedTHB;
  const totalGainUSD = totalUnrealizedUSD + totalRealizedUSD;
  const totalGainPct = initialCapitalUSD > 0 ? (totalGainUSD / initialCapitalUSD) * 100 : 0;
  const todayChangePct = totalCostUSD > 0 ? (todayChangeUSD / (totalUSD - todayChangeUSD)) * 100 : 0;

  /* ── SAVE ASSET ── */
  const handleSaveAsset = async (formData) => {
    const isBatch = Array.isArray(formData);
    const transactions = isBatch ? formData : [formData];

    const sortedTx = [...transactions].sort((a, b) => {
      const isABuy = a.transactionType === "BUY";
      const isBBuy = b.transactionType === "BUY";
      if (isABuy !== isBBuy) {
        return isABuy ? -1 : 1;
      }
      const dtA = new Date(`${a.date || "1970-01-01"}T${a.time || "00:00"}`);
      const dtB = new Date(`${b.date || "1970-01-01"}T${b.time || "00:00"}`);
      return dtA - dtB;
    });

    const skippedTxs = [];

    try {
      let updatedAssets = [...assets];

      const getTodayLocalDate = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      for (const tx of sortedTx) {
        const sym = (tx.symbol || "").trim().toUpperCase();
        const name = (tx.name || sym).trim();
        const newQty = parseFloat(tx.qty);
        const newPrice = parseFloat(tx.avgPrice ?? tx.price ?? 0);
        const category = tx.type ?? tx.category ?? "stock";
        const broker = (tx.broker || "").trim();

        let buyDate = tx.date ? tx.date.trim() : "";
        if (!buyDate) {
          buyDate = getTodayLocalDate();
        }
        let buyTime = tx.time ? tx.time.trim() : "";
        if (!buyTime) {
          buyTime = "00:00";
        }

        if (!sym) {
          if (!isBatch) showToast("เลือกสินทรัพย์ก่อนนะครับ", "error");
          else skippedTxs.push({ tx, reason: "ไม่พบสัญลักษณ์สินทรัพย์" });
          continue;
        }
        if (isNaN(newQty) || newQty <= 0) {
          if (!isBatch) showToast("ใส่จำนวนให้ถูกต้อง", "error");
          else skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: "จำนวนหุ้นไม่ถูกต้อง" });
          continue;
        }
        if (isNaN(newPrice) || newPrice < 0) {
          if (!isBatch) showToast("ใส่ราคาทุนให้ถูกต้อง", "error");
          else skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: "ราคาทุนไม่ถูกต้อง" });
          continue;
        }

        const isSell = tx.transactionType === "SELL";
        const displaySym = broker ? `${sym} (${broker})` : sym;

        const existingIdx = updatedAssets.findIndex(
          (a) => a.symbol === sym && (a.broker || "").trim().toLowerCase() === broker.toLowerCase()
        );

        if (isSell) {
          if (existingIdx < 0) {
            if (!isBatch) {
              showToast(`❌ ไม่สามารถขาย ${displaySym} ได้ เพราะไม่มีในพอร์ตโฟลิโอ\nกรุณาเพิ่มรายการซื้อก่อน`, "error");
              return;
            } else {
              skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: `ไม่มีสินทรัพย์ ${displaySym} นี้ในพอร์ตโฟลิโอ` });
              continue;
            }
          } else {
            const existing = updatedAssets[existingIdx];
            if (newQty > existing.qty) {
              if (!isBatch) {
                showToast(
                  `❌ ขาย ${displaySym} ไม่ได้ — จำนวนที่ขาย (${fmtQty(newQty, hideValues)}) มากกว่าที่ถืออยู่ (${fmtQty(existing.qty, hideValues)} หน่วย)`,
                  "error"
                );
                return;
              } else {
                skippedTxs.push({
                  tx: { symbol: sym, ...tx },
                  reason: `จำนวนหุ้นไม่เพียงพอ (ขาย ${fmtQty(newQty, hideValues)} แต่ในพอร์ตมี ${fmtQty(existing.qty, hideValues)})`
                });
                continue;
              }
            }
          }
        }

        if (existingIdx >= 0) {
          const existingAsset = updatedAssets[existingIdx];
          const duplicateLot = (existingAsset.lots || []).find((l) => {
            const sameDate = l.date === buyDate;
            const sameTime = (l.time || "") === buyTime;
            const sameQty = Math.abs(l.qty - (isSell ? -newQty : newQty)) < 0.00001;
            const samePrice = Math.abs(l.price - newPrice) < 0.00001;
            const sameBroker = (l.broker || "").trim().toLowerCase() === broker.toLowerCase();
            return sameDate && sameTime && sameQty && samePrice && sameBroker;
          });
          if (duplicateLot) {
            const confirmMsg = `⚠️ ตรวจพบธุรกรรมที่อาจซ้ำซ้อน:\nมีรายการ ${isSell ? "ขาย" : "ซื้อ"} ${displaySym} จำนวน ${newQty} หุ้น @ $${newPrice} วันที่ ${buyDate} ${buyTime ? "เวลา " + buyTime + " น." : ""} อยู่ในระบบแล้ว\n\nคุณต้องการบันทึกธุรกรรมนี้เพิ่มอีกรายการใช่หรือไม่?`;
            if (!confirm(confirmMsg)) {
              if (isBatch) {
                skippedTxs.push({ tx: { symbol: sym, ...tx }, reason: "ผู้ใช้ยกเลิกเนื่องจากพบธุรกรรมซ้ำซ้อน" });
              }
              continue;
            }
          }
        }

        const newLot = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: buyDate,
          time: buyTime,
          qty: isSell ? -newQty : newQty,
          price: newPrice,
          broker: broker
        };

        if (existingIdx >= 0) {
          const existing = updatedAssets[existingIdx];
          const oldLots = existing.lots || [];
          const allLots = [...oldLots, newLot];
          const totalQty = allLots.reduce((s, l) => s + l.qty, 0);

          const buyLots = allLots.filter((l) => l.qty > 0);
          const buyQty = buyLots.reduce((s, l) => s + l.qty, 0);
          const buyCost = buyLots.reduce((s, l) => s + l.qty * l.price, 0);
          const avgCost = buyQty > 0 ? buyCost / buyQty : 0;

          updatedAssets[existingIdx] = {
            ...existing,
            lots: allLots,
            qty: totalQty,
            avgCost: avgCost
          };

          if (!isBatch) {
            const isCash = category === "fiat";
            showToast(
              isSell
                ? `✅ ${isCash ? "ถอนเงินสด" : "ขายออก"} ${displaySym} ${fmtQty(newQty, hideValues)} หน่วยสำเร็จ`
                : `✅ ${isCash ? "ฝากเพิ่ม" : "ซื้อเพิ่ม"} ${displaySym} ${fmtQty(newQty, hideValues)} หน่วยสำเร็จ`,
              "success"
            );
          }
        } else {
          updatedAssets.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            symbol: sym,
            name,
            category,
            broker,
            lots: [newLot],
            qty: isSell ? -newQty : newQty,
            avgCost: newPrice
          });
          if (!isBatch) {
            const isCash = category === "fiat";
            showToast(`✅ เพิ่ม ${isCash ? "เงินสด" : "สินทรัพย์"} ${displaySym} เข้าพอร์ตแล้ว`, "success");
          }
        }
      }

      await savePortfolio(updatedAssets);

      setModalOpen(false);
      setEditingAsset(null);
      await fetchPrices(updatedAssets);
      fetchSparklines(updatedAssets, chartRange);

      if (isBatch) {
        if (skippedTxs.length > 0) {
          const successCount = sortedTx.length - skippedTxs.length;
          const errorDetails = skippedTxs
            .map(
              (s) =>
                `- ${s.tx.symbol} (${s.tx.transactionType === "BUY" ? "ซื้อ" : "ขาย"} · ${s.tx.qty} หน่วย): ${s.reason}`
            )
            .join("\n");
          alert(
            `⚠️ นำเข้าธุรกรรมสำเร็จ ${successCount}/${sortedTx.length} รายการ\n\nรายการที่ถูกข้ามเนื่องจากข้อผิดพลาด:\n${errorDetails}`
          );
        } else {
          showToast(`✅ นำเข้าธุรกรรมทั้งหมด ${sortedTx.length} รายการสำเร็จ!`, "success");
        }
      }
    } catch (err) {
      showToast("บันทึกไม่สำเร็จ: " + err.message, "error");
    }
  };

  /* ── CLEAR PORTFOLIO ── */
  const handleClearPortfolio = async () => {
    if (
      !confirm("⚠️ คุณต้องการล้างข้อมูลหุ้นและธุรกรรมทั้งหมดในพอร์ตใช่หรือไม่? (ชื่อเล่นและรูปโปรไฟล์ของคุณจะไม่ถูกลบ)")
    )
      return;
    try {
      await savePortfolio([]);
      showToast("🗑️ ล้างข้อมูลพอร์ตหุ้นเรียบร้อยแล้ว!", "success");
      setProfileModalOpen(false);
    } catch (err) {
      showToast("ล้างข้อมูลไม่สำเร็จ: " + err.message, "error");
    }
  };

  /* ── CLEAR ALL DATA ── */
  const handleClearAllData = async () => {
    if (
      !confirm(
        "⚠️ คำเตือน: คุณต้องการล้างข้อมูลทุกอย่างทั้งหมด (ทั้งข้อมูลหุ้น, ชื่อเล่น, และรูปโปรไฟล์) กลับเป็นค่าเริ่มต้นใช่หรือไม่?"
      )
    )
      return;
    try {
      await savePortfolio([]);

      setProfilePic("");
      setNickname("");
      setNewNickname("");
      setPortfolioName("StockVault");
      localStorage.removeItem(`profile_pic_${user.username}`);
      localStorage.removeItem(`profile_nickname_${user.username}`);
      localStorage.removeItem(`portfolio_name_${user.username}`);
      await syncProfileToServer("StockVault", "", "");

      showToast("🗑️ ล้างข้อมูลทั้งหมดในระบบเรียบร้อยแล้ว!", "success");
      setProfileModalOpen(false);
    } catch (err) {
      showToast("ล้างข้อมูลไม่สำเร็จ: " + err.message, "error");
    }
  };

  /* ── EXPORT / IMPORT ── */
  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ assets, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 ส่งออกข้อมูลสำเร็จ", "success");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const imported = parsed.assets || parsed;
        if (!Array.isArray(imported)) {
          showToast("ไฟล์ไม่ถูกต้อง", "error");
          return;
        }
        await savePortfolio(imported);
        showToast(`✅ นำเข้า ${imported.length} รายการสำเร็จ`, "success");
        fetchPrices(imported);
        fetchSparklines(imported, chartRange);
      } catch {
        showToast("ไฟล์ไม่ถูกต้อง", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (loading) {
    return (
      <div className="loading-overlay" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <p style={{ fontWeight: 600, color: "var(--text-muted)" }}>กำลังโหลดพอร์ตโฟลิโอ...</p>
      </div>
    );
  }

  const hasPrices = Object.keys(prices).length > 0;

  return (
    <>
      <div className="fade-in">
        <DashboardHeader
          portfolioName={portfolioName}
          isEditingName={isEditingName}
          setIsEditingName={setIsEditingName}
          tempName={tempName}
          setTempName={setTempName}
          handleSaveName={handleSaveName}
          nickname={nickname}
          user={user}
          profilePic={profilePic}
          setProfileModalOpen={setProfileModalOpen}
        />

        <div className="app-container">
          <KPIRow
            totalUSD={hasPrices ? totalUSD : null}
            totalTHB={hasPrices ? totalUSD * exchangeRate : null}
            totalCostUSD={totalCostUSD}
            todayChange={hasPrices ? todayChangeUSD : 0}
            todayChangeTHB={hasPrices ? todayChangeUSD * exchangeRate : 0}
            todayChangePct={hasPrices ? todayChangePct : 0}
            totalGain={hasPrices ? totalGainUSD : 0}
            totalGainTHB={hasPrices ? totalGainTHB : 0}
            totalGainPct={hasPrices ? totalGainPct : 0}
            bestAsset={hasPrices ? bestAsset : null}
            loading={!hasPrices && assets.length > 0}
          />

          <div className="dashboard-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PortfolioSummary
                hasPrices={hasPrices}
                totalUSD={totalUSD}
                exchangeRate={exchangeRate}
                totalCostUSD={totalCostUSD}
                totalGainUSD={totalGainUSD}
                totalGainPct={totalGainPct}
                totalGainTHB={totalGainTHB}
                assets={assets}
                totalRealizedUSD={totalRealizedUSD}
                totalUnrealizedUSD={totalUnrealizedUSD}
                initialCapitalUSD={initialCapitalUSD}
                todayChangeUSD={todayChangeUSD}
                setShowPnLDetailsModal={setShowPnLDetailsModal}
                hideValues={hideValues}
              />

              <div className="card stagger-3">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    minHeight: 28
                  }}
                >
                  <div className="card-section-title">
                    <PieChart size={16} /> สัดส่วนสินทรัพย์
                  </div>
                  {donutDrillCategory && (
                    <button
                      onClick={() => setDonutDrillCategory(null)}
                      style={{
                        background: "var(--primary-light)",
                        color: "var(--primary)",
                        border: "none",
                        borderRadius: 10,
                        padding: "4px 10px",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "var(--transition)",
                        boxShadow: "var(--shadow-xs)"
                      }}
                      className="ripple-btn"
                    >
                      ← ย้อนกลับ
                    </button>
                  )}
                </div>
                <DonutChart
                  segments={hasPrices && donutSegments.length > 0 ? donutSegments : []}
                  activeAssets={sortedAssets}
                  hasAssets={sortedAssets.length > 0}
                  drillCategory={donutDrillCategory}
                  setDrillCategory={setDonutDrillCategory}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card stagger-2" style={{ padding: "16px 14px 10px" }}>
                <PortfolioChart
                  history={portfolioHistory}
                  range={chartRange}
                  onRangeChange={handleRangeChange}
                  assets={assets}
                  exchangeRate={exchangeRate}
                  prices={prices}
                />
              </div>

              <AssetTable
                sortedAssets={sortedAssets}
                prices={prices}
                priceFlash={priceFlash}
                bestAsset={bestAsset}
                totalUSD={totalUSD}
                exchangeRate={exchangeRate}
                setSelectedAsset={setSelectedAsset}
                selectedAsset={selectedAsset}
                refreshing={refreshing}
                fetchPrices={fetchPrices}
                assets={assets}
                setHideValues={setHideValues}
                hideValues={hideValues}
                setEditingAsset={setEditingAsset}
                setModalOpen={setModalOpen}
                sortConfig={sortConfig}
                handleSort={handleSort}
                handleDeleteAsset={handleDeleteAsset}
                hasPrices={hasPrices}
                sparklines={sparklines}
              />
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <AssetModal
          isOpen={modalOpen}
          editingAsset={editingAsset}
          onClose={() => {
            setModalOpen(false);
            setEditingAsset(null);
          }}
          onSave={handleSaveAsset}
          exchangeRate={exchangeRate}
          showToast={showToast}
        />
      )}

      {showPnLDetailsModal && (
        <PnLDetailsModal
          isOpen={showPnLDetailsModal}
          onClose={() => setShowPnLDetailsModal(false)}
          assets={assets}
          prices={prices}
          exchangeRate={exchangeRate}
          historicalRates={historicalRates}
          totalUSD={totalUSD}
          totalCostUSD={totalCostUSD}
          totalRealizedUSD={totalRealizedUSD}
          totalUnrealizedUSD={totalUnrealizedUSD}
          totalGainUSD={totalGainUSD}
          totalGainPct={totalGainPct}
          initialCapitalUSD={initialCapitalUSD}
          onClearAsset={handleClearAsset}
          onDeleteAsset={handleDeleteAsset}
        />
      )}

      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          price={
            selectedAsset.type === "fiat" || selectedAsset.category === "fiat"
              ? prices[getCurrencyTicker(selectedAsset.symbol)]
              : prices[selectedAsset.symbol]
          }
          exchangeRate={exchangeRate}
          historicalRates={historicalRates}
          onClose={() => setSelectedAsset(null)}
          hideValues={hideValues}
        />
      )}

      {profileModalOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProfileModalOpen(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <span className="modal-title">⚙️ ตั้งค่าระบบ (Settings)</span>
              <button className="btn-close" onClick={() => setProfileModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* SECTION 1: PROFILE INFO */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    borderBottom: "1.5px solid var(--primary-light)",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  👤 ข้อมูลส่วนตัว (Profile Info)
                </span>

                {/* Avatar Upload */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setAvatarHovered(true)}
                    onMouseLeave={() => setAvatarHovered(false)}
                  >
                    <img
                      src={
                        profilePic ||
                        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 80 80'><rect width='80' height='80' fill='%23F1F5F9'/><text x='50%' y='55%' font-family='sans-serif' font-size='32' text-anchor='middle' fill='%2394A3B8'>👤</text></svg>"
                      }
                      alt="profile avatar"
                      style={{
                        width: 90,
                        height: 90,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "3px solid var(--primary)",
                        boxShadow: "var(--shadow-md)",
                        display: "block"
                      }}
                    />

                    {/* Hover Tint Overlay with View Button */}
                    {profilePic && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: 90,
                          height: 90,
                          borderRadius: "50%",
                          background: "rgba(0, 0, 0, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: avatarHovered ? 1 : 0,
                          transition: "opacity 0.2s ease-in-out",
                          pointerEvents: avatarHovered ? "auto" : "none",
                          zIndex: 4
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setAvatarPreviewOpen(true)}
                          style={{
                            background: "rgba(255, 255, 255, 0.25)",
                            border: "none",
                            color: "white",
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            transition: "background 0.2s, transform 0.2s",
                            backdropFilter: "blur(4px)"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)";
                            e.currentTarget.style.transform = "scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          title="ดูรูปภาพโปรไฟล์"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    )}

                    {/* Red Delete Button */}
                    {profilePic && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("คุณต้องการลบรูปโปรไฟล์นี้ใช่หรือไม่?")) {
                            setProfilePic("");
                          }
                        }}
                        style={{
                          position: "absolute",
                          top: "-4px",
                          right: "-4px",
                          background: "#EF4444",
                          color: "white",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                          border: "2px solid white",
                          zIndex: 10,
                          transition: "transform 0.2s, background 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.15)";
                          e.currentTarget.style.background = "#DC2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.background = "#EF4444";
                        }}
                        title="ลบรูปโปรไฟล์"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    )}

                    {/* Bottom-Left Sparkles Button (to open Presets Grid Modal) - only visible if avatar is empty */}
                    {!profilePic && (
                      <button
                        type="button"
                        onClick={() => setPresetModalOpen(true)}
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
                          color: "white",
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: "var(--shadow-md)",
                          border: "2px solid white",
                          zIndex: 8,
                          padding: 0,
                          transition: "transform 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "scale(1.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title="เลือกรูปภาพสำเร็จรูป (Presets)"
                      >
                        <Sparkles size={14} />
                      </button>
                    )}

                    {/* Bottom-Right Plus Button (to upload file) */}
                    <label
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        background: "var(--primary)",
                        color: "white",
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "var(--shadow-md)",
                        border: "2px solid white",
                        zIndex: 8
                      }}
                      title="เปลี่ยนรูปโปรไฟล์"
                    >
                      <Plus size={16} />
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                    </label>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textAlign: "center" }}>
                    รองรับไฟล์รูปภาพ JPG, PNG, WebP (ไม่เกิน 10MB)
                  </span>
                </div>

                {/* Nickname Input */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ชื่อเล่น / ชื่อเรียก</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="กรอกชื่อเล่นเพื่อแสดงแทนชื่อผู้ใช้"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary ripple-btn"
                  onClick={handleSaveProfile}
                  style={{ height: 44, fontSize: 13 }}
                >
                  บันทึกข้อมูลส่วนตัว
                </button>
              </div>

              {/* SECTION 2: CHANGE PASSWORD */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    borderBottom: "1.5px solid var(--loss-light)",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  🔑 เปลี่ยนรหัสผ่านใหม่ (Change Password)
                </span>

                {/* Password Inputs */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">รหัสผ่านเดิม</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="ตั้งรหัสผ่านใหม่"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <button
                  className="btn ripple-btn"
                  onClick={handleChangePassword}
                  style={{
                    height: 44,
                    fontSize: 13,
                    background: "var(--loss)",
                    color: "white",
                    boxShadow: "0 4px 12px var(--loss-glow)",
                    border: "none"
                  }}
                >
                  ยืนยันเปลี่ยนรหัสผ่าน
                </button>
              </div>

              {/* SECTION 3: BACKUP & RESTORE */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "var(--text-main)",
                    borderBottom: "1.5px solid var(--primary-light)",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  💾 สำรองข้อมูล (Backup & Restore)
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-secondary ripple-btn"
                    style={{ height: 44, fontSize: 13, flex: 1 }}
                    onClick={handleExport}
                  >
                    <Download size={15} /> ส่งออก JSON
                  </button>
                  <label
                    className="btn btn-secondary ripple-btn"
                    style={{
                      height: 44,
                      fontSize: 13,
                      flex: 1,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    <Upload size={15} /> นำเข้า JSON
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
                  </label>
                </div>
              </div>

              {/* SECTION 5: DATA MANAGEMENT */}
              <div
                style={{
                  background: "#FFF5F5",
                  border: "1px solid #FEE2E2",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#EF4444",
                    borderBottom: "1.5px solid #FCA5A5",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  ⚠️ การจัดการข้อมูล (Data Management)
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    className="btn ripple-btn"
                    onClick={handleClearPortfolio}
                    style={{
                      height: 40,
                      fontSize: 12,
                      background: "white",
                      color: "#EF4444",
                      border: "1.5px solid #EF4444",
                      fontWeight: 700,
                      borderRadius: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    🗑️ ล้างเฉพาะข้อมูลพอร์ตหุ้น
                  </button>
                  <button
                    className="btn ripple-btn"
                    onClick={handleClearAllData}
                    style={{
                      height: 40,
                      fontSize: 12,
                      background: "#EF4444",
                      color: "white",
                      border: "none",
                      fontWeight: 700,
                      borderRadius: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)"
                    }}
                  >
                    🔥 ล้างข้อมูลทั้งหมดในระบบ (ลบทุกอย่าง)
                  </button>
                </div>
              </div>

              {/* SECTION 6: USER ACCOUNT & LOGOUT */}
              <div
                style={{
                  background: "#FFF5F5",
                  border: "1px solid #FEE2E2",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#EF4444",
                    borderBottom: "1.5px solid #FCA5A5",
                    paddingBottom: 6,
                    display: "block"
                  }}
                >
                  🚪 บัญชีผู้ใช้งาน (User Account)
                </span>
                <button
                  className="btn ripple-btn"
                  onClick={onLogout}
                  style={{
                    height: 44,
                    fontSize: 13,
                    background: "#EF4444",
                    color: "white",
                    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.2)",
                    border: "none",
                    fontWeight: 700,
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8
                  }}
                >
                  <LogOut size={16} /> ออกจากระบบ (Logout)
                </button>
              </div>
            </div>

            {/* Close modal */}
            <div className="modal-footer" style={{ padding: "8px 24px 16px" }}>
              <button
                className="btn btn-secondary ripple-btn"
                onClick={() => setProfileModalOpen(false)}
                style={{ height: 44, fontSize: 13 }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {avatarPreviewOpen && profilePic && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeInOverlay 0.3s ease-out"
          }}
          onClick={() => setAvatarPreviewOpen(false)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90%",
              maxHeight: "90%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "scaleInModal 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAvatarPreviewOpen(false)}
              style={{
                position: "absolute",
                top: -48,
                right: 0,
                background: "rgba(255, 255, 255, 0.15)",
                border: "none",
                color: "white",
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s, transform 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "scale(1)";
              }}
              title="ปิดการแสดงรูปภาพ"
            >
              <X size={20} />
            </button>
            <img
              src={profilePic}
              alt="Avatar Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                borderRadius: "16px",
                objectFit: "contain",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                border: "4px solid rgba(255, 255, 255, 0.2)"
              }}
            />
          </div>
        </div>
      )}

      {presetModalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
            animation: "fadeInOverlay 0.3s ease-out"
          }}
          onClick={() => setPresetModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: 380,
              background: "#FFFFFF",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              animation: "scaleInModal 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: "none", padding: 0 }}>
              <span className="modal-title" style={{ fontSize: 16, fontWeight: 800 }}>
                🎨 เลือกรูปประจำตัว (Presets)
              </span>
              <button
                type="button"
                className="btn-close"
                onClick={() => setPresetModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 4
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                justifyItems: "center",
                padding: "8px 0"
              }}
            >
              {PRESET_AVATARS.map((preset) => {
                const isSelected = profilePic === preset.svg;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setProfilePic(preset.svg);
                      setPresetModalOpen(false);
                    }}
                    style={{
                      background: preset.bg,
                      border: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 32,
                      cursor: "pointer",
                      padding: 0,
                      boxShadow: isSelected ? "0 0 16px rgba(82, 54, 255, 0.5)" : "var(--shadow-md)",
                      transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                    title={`เลือกรูปประจำตัว ${preset.id}`}
                  >
                    {preset.emoji}
                  </button>
                );
              })}
            </div>

            <div className="modal-footer" style={{ borderTop: "none", padding: 0 }}>
              <button
                type="button"
                className="btn btn-secondary ripple-btn"
                onClick={() => setPresetModalOpen(false)}
                style={{ height: 40, fontSize: 13, borderRadius: "12px" }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
