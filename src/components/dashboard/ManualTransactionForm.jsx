import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Search } from "lucide-react";
import { api } from "../../services/api";

const getDisplaySymbol = (symbol) => {
  if (!symbol) return "";
  const parts = symbol.split(".");
  if (parts.length > 1 && parts[parts.length - 1].length <= 3) {
    return parts.slice(0, -1).join(".");
  }
  return symbol;
};

const getCurrencyTicker = (symbol) => {
  if (symbol === "USD") return "USD";
  if (["EUR", "GBP", "AUD", "NZD"].includes(symbol)) {
    return `${symbol}USD=X`;
  }
  return `${symbol}=X`;
};

/* ─── Global Currencies List (165+ สกุลเงินทั่วโลก) ─── */
const CURRENCIES = [
  { code: "THB", name: "Thai Baht (บาท 🇹🇭)" },
  { code: "USD", name: "US Dollar (ดอลลาร์สหรัฐ 🇺🇸)" },
  { code: "EUR", name: "Euro (ยูโร 🇪🇺)" },
  { code: "GBP", name: "British Pound (ปอนด์สหราชอาณาจักร 🇬🇧)" },
  { code: "JPY", name: "Japanese Yen (เยนญี่ปุ่น 🇯🇵)" },
  { code: "SGD", name: "Singapore Dollar (ดอลลาร์สิงคโปร์ 🇸🇬)" },
  { code: "HKD", name: "Hong Kong Dollar (ดอลลาร์ฮ่องกง 🇭🇰)" },
  { code: "AUD", name: "Australian Dollar (ดอลลาร์ออสเตรเลีย 🇦🇺)" },
  { code: "CAD", name: "Canadian Dollar (ดอลลาร์แคนาดา 🇨🇦)" },
  { code: "CHF", name: "Swiss Franc (ฟรังก์สวิส 🇨🇭)" },
  { code: "CNY", name: "Chinese Yuan (หยวนจีน 🇨🇳)" },
  { code: "KRW", name: "South Korean Won (วอนเกาหลีใต้ 🇰🇷)" },
  { code: "TWD", name: "New Taiwan Dollar (ดอลลาร์ไต้หวัน 🇹🇼)" },
  { code: "INR", name: "Indian Rupee (รูปีอินเดีย 🇮🇳)" },
  { code: "NZD", name: "New Zealand Dollar (ดอลลาร์นิวซีแลนด์ 🇳🇿)" },
  { code: "MYR", name: "Malaysian Ringgit (ริงกิตมาเลเซีย 🇲🇾)" },
  { code: "IDR", name: "Indonesian Rupiah (รูเปียห์อินโดนีเซีย 🇮🇩)" },
  { code: "PHP", name: "Philippine Peso (เปโซฟิลิปปินส์ 🇵🇭)" },
  { code: "VND", name: "Vietnamese Dong (ดองเวียดนาม 🇻🇳)" },
  { code: "DKK", name: "Danish Krone (โครนเดนมาร์ก 🇩🇰)" },
  { code: "NOK", name: "Norwegian Krone (โครนนอร์เวย์ 🇳🇴)" },
  { code: "SEK", name: "Swedish Krona (โครนสวีเดน 🇸🇪)" },
  { code: "AED", name: "UAE Dirham (ดีแรฮมสหรัฐอาหรับเอมิเรตส์ 🇦🇪)" },
  { code: "SAR", name: "Saudi Riyal (ริยัลซาอุดีอาระเบีย 🇸🇦)" },
  { code: "RUB", name: "Russian Ruble (รูเบิลรัสเซีย 🇷🇺)" },
  { code: "TRY", name: "Turkish Lira (ลีราตุรกี 🇹🇷)" },
  { code: "BRL", name: "Brazilian Real (เรียลบราซิล 🇧🇷)" },
  { code: "MXN", name: "Mexican Peso (เปโซเม็กซิโก 🇲🇽)" },
  { code: "ZAR", name: "South African Rand (แรนด์แอฟริกาใต้ 🇿🇦)" },
  { code: "AFN", name: "Afghan Afghani (อัฟกานิอัฟกานิสถาน 🇦🇫)" },
  { code: "ALL", name: "Albanian Lek (เลกแอลเบเนีย 🇦🇱)" },
  { code: "AMD", name: "Armenian Dram (ดรัมอาร์เมเนีย 🇦🇲)" },
  { code: "ANG", name: "Netherlands Antillean Guilder (กิลเดอร์เนเธอร์แลนด์แอนทิลลิส 🇨🇼)" },
  { code: "AOA", name: "Angolan Kwanza (ควานซาแองโกลา 🇦🇴)" },
  { code: "ARS", name: "Argentine Peso (เปโซอาร์เจนตินา 🇦🇷)" },
  { code: "AWG", name: "Aruban Florin (ฟลอรินอารูบา 🇦🇼)" },
  { code: "AZN", name: "Azerbaijani Manat (มานัตอาเซอร์ไบจาน 🇦🇿)" },
  { code: "BAM", name: "Bosnia convertible mark (มาร์กบอสเนีย 🇧🇦)" },
  { code: "BBD", name: "Barbadian Dollar (ดอลลาร์บาร์เบโดส 🇧🇧)" },
  { code: "BDT", name: "Bangladeshi Taka (ตากาบังกลาเทศ 🇧🇩)" },
  { code: "BGN", name: "Bulgarian Lev (เลฟบัลแกเรีย 🇧🇬)" },
  { code: "BHD", name: "Bahraini Dinar (ดีนาร์บาห์เรน 🇧🇭)" },
  { code: "BIF", name: "Burundian Franc (ฟรังก์บุรุนดี 🇧🇮)" },
  { code: "BMD", name: "Bermudian Dollar (ดอลลาร์เบอร์มิวดา 🇧🇲)" },
  { code: "BND", name: "Brunei Dollar (ดอลลาร์บรูไน 🇧🇳)" },
  { code: "BOB", name: "Bolivian Boliviano (โบลีเวียโน 🇧🇴)" },
  { code: "BSD", name: "Bahamian Dollar (ดอลลาร์บาฮามาส 🇧🇸)" },
  { code: "BTN", name: "Bhutanese Ngultrum (เอ็นกุลตรัม 🇧🇹)" },
  { code: "BWP", name: "Botswana Pula (ปูลาบอตสวานา 🇧🇼)" },
  { code: "BYN", name: "Belarusian Ruble (รูเบิลเบลารุส 🇧🇾)" },
  { code: "BZD", name: "Belize Dollar (ดอลลาร์เบลีซ 🇧🇿)" },
  { code: "CDF", name: "Congolese Franc (ฟรังก์คองโก 🇨🇩)" },
  { code: "CLP", name: "Chilean Peso (เปโซชิลี 🇨🇱)" },
  { code: "COP", name: "Colombian Peso (เปโซโคลอมเบีย 🇨🇴)" },
  { code: "CRC", name: "Costa Rican Colón (โกลอนคอสตาริกา 🇨🇷)" },
  { code: "CUP", name: "Cuban Peso (เปโซคิวบา 🇨🇺)" },
  { code: "CVE", name: "Cape Verdean Escudo (เอสคูโดเคปเวิร์ด 🇨🇻)" },
  { code: "CZK", name: "Czech Koruna (โครูนาเช็ก 🇨🇿)" },
  { code: "DJF", name: "Djiboutian Franc (ฟรังก์จิบูตี 🇩🇯)" },
  { code: "DOP", name: "Dominican Peso (เปโซโดมินิกัน 🇩🇴)" },
  { code: "DZD", name: "Algerian Dinar (ดีนาร์แอลจีเรีย 🇩🇿)" },
  { code: "EGP", name: "Egyptian Pound (ปอนด์อียิปต์ 🇪🇬)" },
  { code: "ERN", name: "Eritrean Nakfa (แนกฟา 🇪🇷)" },
  { code: "ETB", name: "Ethiopian Birr (เบอร์เอธิโอเปีย 🇪🇹)" },
  { code: "FJD", name: "Fijian Dollar (ดอลลาร์ฟิจิ 🇫🇯)" },
  { code: "FKP", name: "Falkland Islands Pound (ปอนด์หมู่เกาะฟอล์กแลนด์ 🇫🇰)" },
  { code: "FOK", name: "Faroese Króna (โครนาหมู่เกาะแฟโร 🇫🇴)" },
  { code: "GEL", name: "Georgian Lari (ลารีจอร์เจีย 🇬🇪)" },
  { code: "GGP", name: "Guernsey Pound (ปอนด์เกิร์นซีย์ 🇬🇬)" },
  { code: "GHS", name: "Ghanaian Cedi (เซดีกานา 🇬🇭)" },
  { code: "GIP", name: "Gibraltar Pound (ปอนด์ยิบรอลตาร์ 🇬🇮)" },
  { code: "GMD", name: "Gambian Dalasi (ดาลาซีกัมเบีย 🇬🇲)" },
  { code: "GNF", name: "Guinean Franc (ฟรังก์กินี 🇬🇳)" },
  { code: "GTQ", name: "Guatemalan Quetzal (เกตซัล 🇬🇹)" },
  { code: "GYD", name: "Guyanese Dollar (ดอลลาร์กายอานา 🇬🇾)" },
  { code: "HNL", name: "Honduran Lempira (เลมปีราฮอนดูรัส 🇭🇳)" },
  { code: "HRK", name: "Croatian Kuna (คูนาโครเอเชีย 🇭🇷)" },
  { code: "HTG", name: "Haitian Gourde (กูร์ดเฮติ 🇭🇹)" },
  { code: "HUF", name: "Hungarian Forint (ฟอรินต์ฮังการี 🇭🇺)" },
  { code: "ILS", name: "Israeli New Shekel (เชเกลอิสราเอล 🇮🇱)" },
  { code: "IMP", name: "Isle of Man Pound (ปอนด์เกาะแมน 🇮🇲)" },
  { code: "IQD", name: "Iraqi Dinar (ดีนาร์อิรัก 🇮🇶)" },
  { code: "IRR", name: "Iranian Rial (เรียลอิหร่าน 🇮🇷)" },
  { code: "ISK", name: "Icelandic Króna (โครนาไอซ์แลนด์ 🇮🇸)" },
  { code: "JEP", name: "Jersey Pound (ปอนด์เจอร์ซีย์ 🇯🇪)" },
  { code: "JMD", name: "Jamaican Dollar (ดอลลาร์จาเมกา 🇯🇲)" },
  { code: "JOD", name: "Jordanian Dinar (ดีนาร์จอร์แดน 🇯🇴)" },
  { code: "KES", name: "Kenyan Shilling (ชิลลิงเคนยา 🇰🇪)" },
  { code: "KGS", name: "Kyrgyzstani Som (ซอมคีร์กีซสถาน 🇰🇬)" },
  { code: "KHR", name: "Cambodian Riel (เรียลกัมพูชา 🇰🇭)" },
  { code: "KID", name: "Kiribati Dollar (ดอลลาร์คิริบาส 🇰🇮)" },
  { code: "KMF", name: "Comorian Franc (ฟรังก์คอโมโรส 🇰ม)" },
  { code: "KPW", name: "North Korean Won (วอนเกาหลีเหนือ 🇰🇵)" },
  { code: "KWD", name: "Kuwaiti Dinar (ดีนาร์คูเวต 🇰🇼)" },
  { code: "KYD", name: "Cayman Islands Dollar (ดอลลาร์หมู่เกาะเคย์แมน 🇰🇾)" },
  { code: "KZT", name: "Kazakhstani Tenge (เทงเกคาซัคสถาน 🇰🇿)" },
  { code: "LAK", name: "Lao Kip (กีบลาว 🇱🇦)" },
  { code: "LBP", name: "Lebanese Pound (ปอนด์เลบานอน 🇱🇧)" },
  { code: "LKR", name: "Sri Lankan Rupee (รูปีศรีลังกา 🇱🇰)" },
  { code: "LRD", name: "Liberian Dollar (ดอลลาร์ไลบีเรีย 🇱🇷)" },
  { code: "LSL", name: "Lesotho Loti (โลตีเลโซโท 🇱🇸)" },
  { code: "LYD", name: "Libyan Dinar (ดีนาร์ลิเบีย 🇱🇾)" },
  { code: "MAD", name: "Moroccan Dirham (ดีแรฮมโมร็อกโก 🇲🇦)" },
  { code: "MDL", name: "Moldovan Leu (เลวมอลโดวา 🇲🇩)" },
  { code: "MGA", name: "Malagasy Ariary (อาเรียรี 🇲🇬)" },
  { code: "MKD", name: "Macedonian Denar (ดีนาร์มาซิโดเนีย 🇲🇰)" },
  { code: "MMK", name: "Myanmar Kyat (จ๊าดพม่า 🇲🇲)" },
  { code: "MNT", name: "Mongolian Tögrög (ทูกริกมองโกเลีย 🇲🇳)" },
  { code: "MOP", name: "Macanese Pataca (ปาตากามาเก๊า 🇲🇴)" },
  { code: "MRU", name: "Mauritanian Ouguiya (อูกียา 🇲🇷)" },
  { code: "MUR", name: "Mauritian Rupee (รูปีมอริเชียส 🇲🇺)" },
  { code: "MVR", name: "Maldivian Rufiyaa (รูฟิยาห์ 🇲🇻)" },
  { code: "MWK", name: "Malawian Kwacha (ควาชา 🇲🇼)" },
  { code: "MZN", name: "Mozambican Metical (เมทิคัล 🇲🇿)" },
  { code: "NAD", name: "Namibian Dollar (ดอลลาร์นามิเบีย 🇳🇦)" },
  { code: "NGN", name: "Nigerian Naira (ไนราไนจีเรีย 🇳🇬)" },
  { code: "NIO", name: "Nicaraguan Córdoba (กอร์โดบา 🇳🇮)" },
  { code: "NPR", name: "Nepalese Rupee (รูปีเนปาล 🇳🇵)" },
  { code: "OMR", name: "Omani Rial (เรียลโอมาน 🇴🇲)" },
  { code: "PAB", name: "Panamanian Balboa (บัลบัว 🇵🇦)" },
  { code: "PEN", name: "Peruvian Sol (ซอลเปรู 🇵🇪)" },
  { code: "PGK", name: "Papua New Guinean Kina (กีนา 🇵🇬)" },
  { code: "PKR", name: "Pakistani Rupee (รูปีปากีสถาน 🇵🇰)" },
  { code: "PLN", name: "Polish Złoty (ซวอตี 🇵🇱)" },
  { code: "PYG", name: "Paraguayan Guaraní (กวารานี 🇵🇾)" },
  { code: "QAR", name: "Qatari Riyal (ริยัลกาตาร์ 🇶🇦)" },
  { code: "RON", name: "Romanian Leu (เลวโรมาเนีย 🇷🇴)" },
  { code: "RSD", name: "Serbian Dinar (ดีนาร์เซอร์เบีย 🇷🇸)" },
  { code: "RWF", name: "Rwandan Franc (ฟรังก์รวันดา 🇷🇼)" },
  { code: "SBD", name: "Solomon Islands Dollar (ดอลลาร์หมู่เกาะโซโลมอน 🇸🇧)" },
  { code: "SCR", name: "Seychellois Rupee (รูปีเซเชลส์ 🇸🇨)" },
  { code: "SDG", name: "Sudanese Pound (ปอนด์ซูดาน 🇸🇩)" },
  { code: "SHP", name: "Saint Helena Pound (ปอนด์เซนต์เฮเลนา 🇸🇭)" },
  { code: "SLE", name: "Sierra Leonean Leone (ลีโอน 🇸🇱)" },
  { code: "SOS", name: "Somali Shilling (ชิลลิงโซมาเลีย 🇸🇴)" },
  { code: "SRD", name: "Surinamese Dollar (ดอลลาร์สุรินทร์ 🇸🇷)" },
  { code: "SSP", name: "South Sudanese Pound (ปอนด์ซูดานใต้ 🇸🇸)" },
  { code: "STN", name: "São Tomé Dobra (โดบรา 🇸🇹)" },
  { code: "SVC", name: "Salvadoran Colón (โกลอน 🇸🇻)" },
  { code: "SYP", name: "Syrian Pound (ปอนด์ซีเรีย 🇸🇾)" },
  { code: "SZL", name: "Swazi Lilangeni (ลีลันเกนี 🇸🇿)" },
  { code: "TJS", name: "Tajikistani Somoni (โซโมนิ 🇹🇯)" },
  { code: "TMT", name: "Turkmenistan Manat (มานัต 🇹🇲)" },
  { code: "TND", name: "Tunisian Dinar (ดีนาร์ตูนิเซีย 🇹🇳)" },
  { code: "TOP", name: "Tongan Paʻanga (พาแองกา 🇹🇴)" },
  { code: "TTD", name: "Trinidad Dollar (ดอลลาร์ตรินิแดด 🇹🇹)" },
  { code: "TVD", name: "Tuvaluan Dollar (ดอลลาร์ตูวาลู 🇹🇻)" },
  { code: "TZS", name: "Tanzanian Shilling (ชิลลิงแทนซาเนีย 🇹🇿)" },
  { code: "UAH", name: "Ukrainian Hryvnia (ฮริฟเนียยูเครน 🇺🇦)" },
  { code: "UGX", name: "Ugandan Shilling (ชิลลิงยูแกนดา 🇺🇬)" },
  { code: "UYU", name: "Uruguayan Peso (เปโซอุรุกวัย 🇺🇾)" },
  { code: "UZS", name: "Uzbekistani Som (ซอมอุซเบกิสถาน 🇺🇿)" },
  { code: "VES", name: "Venezuelan Bolívar (โบลิวาร์ 🇻🇪)" },
  { code: "VUV", name: "Vanuatu Vatu (วาตู 🇻🇺)" },
  { code: "WST", name: "Samoan Tālā (ทาลา 🇼🇸)" },
  { code: "XAF", name: "Central African CFA Franc (ฟรังก์แอฟริกากลาง 🇨🇫)" },
  { code: "XCD", name: "East Caribbean Dollar (ดอลลาร์แคริบเบียนตะวันออก 🇩🇲)" },
  { code: "XOF", name: "West African CFA Franc (ฟรังก์แอฟริกาตะวันตก 🇸🇳)" },
  { code: "XPF", name: "CFP Franc (ฟรังก์ซีเอฟพี 🇵🇫)" },
  { code: "YER", name: "Yemeni Rial (เรียลเยเมน 🇾🇪)" },
  { code: "ZMW", name: "Zambian Kwacha (ควาชาแซมเบีย 🇿🇲)" },
  { code: "ZWL", name: "Zimbabwean Dollar (ดอลลาร์ซิมบับเว 🇿🇼)" }
];

export default function ManualTransactionForm({
  editingAsset,
  exchangeRate,
  qtyInputRef,
  type,
  setType,
  symbol,
  setSymbol,
  name,
  setName,
  qty,
  setQty,
  price,
  setPrice,
  date,
  setDate,
  time,
  setTime,
  broker,
  setBroker,
  txType,
  setTxType
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [currencyQuery, setCurrencyQuery] = useState("");
  const [showCurrencyDrop, setShowCurrencyDrop] = useState(false);
  const [currencyRate, setCurrencyRate] = useState(1.0);
  const [currencyRateLoading, setCurrencyRateLoading] = useState(false);

  const debounceRef = useRef(null);

  // Initialize values when symbol changes (like in editingAsset mode)
  useEffect(() => {
    if (symbol) {
      setConfirmed(true);
      setQuery(symbol);
      if (type === "fiat") {
        setCurrencyQuery(symbol);
      }
    } else {
      setConfirmed(false);
      setQuery("");
      setCurrencyQuery("");
    }
  }, [symbol, type]);

  // Debounced search for stocks/cryptos
  useEffect(() => {
    if (confirmed || editingAsset) return;

    clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 1) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.prices.checkPrice(query);
        if (data) {
          setSuggestions(data.slice(0, 7));
          setShowDrop(data.length > 0);
        }
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query, confirmed, editingAsset]);

  // Fetch exchange rate for selected fiat currency
  useEffect(() => {
    if (type !== "fiat" || !symbol) return;
    if (symbol === "USD") {
      setCurrencyRate(1.0);
      setPrice("1.0");
      return;
    }
    if (symbol === "THB") {
      const rate = 1.0 / (exchangeRate || 35.0);
      setCurrencyRate(rate);
      setPrice(String(rate));
      return;
    }

    setCurrencyRateLoading(true);
    const ticker = getCurrencyTicker(symbol);
    api.prices
      .getForSymbols(ticker)
      .then((data) => {
        const q = data.quotes?.[ticker];
        if (q && q.price > 0) {
          let calculatedRate = 1.0;
          if (["EUR", "GBP", "AUD", "NZD"].includes(symbol)) {
            calculatedRate = q.price;
          } else {
            calculatedRate = 1.0 / q.price;
          }
          setCurrencyRate(calculatedRate);
          setPrice(String(calculatedRate));
        }
      })
      .catch((err) => console.error("Error fetching currency rate:", err))
      .finally(() => setCurrencyRateLoading(false));
  }, [symbol, type, exchangeRate, setPrice]);

  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.trim().toLowerCase();
    const pinned = CURRENCIES.filter((c) => c.code === "THB" || c.code === "USD");
    const others = CURRENCIES.filter((c) => c.code !== "THB" && c.code !== "USD");

    if (!q) {
      return [...pinned, ...others];
    }

    const filteredPinned = pinned.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    const filteredOthers = others.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));

    return [...filteredPinned, ...filteredOthers];
  }, [currencyQuery]);

  const pickSuggestion = (item) => {
    setSymbol(item.symbol);
    setName(item.name);
    setQuery(item.symbol);
    setShowDrop(false);
    setConfirmed(true);
    setSuggestions([]);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const clearSymbol = () => {
    setSymbol("");
    setName("");
    setQuery("");
    setConfirmed(false);
    setShowDrop(false);
    setSuggestions([]);
  };

  const pickCategory = (c) => {
    if (editingAsset) return;
    setType(c);
    clearSymbol();
    if (c === "gold") {
      setSymbol("GC=F");
      setName("Spot Gold (ทองคำตลาดโลก)");
      setQuery("GC=F");
      setConfirmed(true);
    } else if (c === "fiat") {
      setSymbol("THB");
      setName("Thai Baht (บาท 🇹🇭)");
      setQuery("THB");
      setCurrencyQuery("THB");
      setConfirmed(true);
    }
  };

  const applyPreset = (s, n) => {
    setSymbol(s);
    setName(n);
    setQuery(s);
    setConfirmed(true);
    setShowDrop(false);
    setSuggestions([]);
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  return (
    <>
      {/* Category selector */}
      {!editingAsset && (
        <div className="form-group">
          <label className="form-label">ประเภทสินทรัพย์</label>
          <div className="category-selector">
            {[
              { key: "stock", emoji: "🇺🇸", label: "หุ้น" },
              { key: "gold", emoji: "🥇/🛢️", label: "ทองคำ/น้ำมัน" },
              { key: "crypto", emoji: "🪙", label: "คริปโต" },
              { key: "fiat", emoji: "💵", label: "เงินสด" }
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                className={`category-btn${type === c.key ? " active" : ""} ripple-btn`}
                onClick={() => pickCategory(c.key)}
              >
                <span className="category-emoji">{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {type === "gold" && !editingAsset && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">เลือกประเภทโภคภัณฑ์</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#F1F5F9",
              padding: 4,
              borderRadius: 12,
              gap: 4
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSymbol("GC=F");
                setName("Spot Gold (ทองคำตลาดโลก)");
                setQuery("GC=F");
                setConfirmed(true);
              }}
              style={{
                height: 38,
                borderRadius: 10,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: symbol === "GC=F" ? "var(--primary)" : "transparent",
                color: symbol === "GC=F" ? "white" : "var(--text-muted)",
                transition: "var(--transition)"
              }}
            >
              🥇 ทองคำ (Spot Gold)
            </button>
            <button
              type="button"
              onClick={() => {
                setSymbol("CL=F");
                setName("Crude Oil (น้ำมันดิบตลาดโลก)");
                setQuery("CL=F");
                setConfirmed(true);
              }}
              style={{
                height: 38,
                borderRadius: 10,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: symbol === "CL=F" ? "var(--primary)" : "transparent",
                color: symbol === "CL=F" ? "white" : "var(--text-muted)",
                transition: "var(--transition)"
              }}
            >
              🛢️ น้ำมัน (Crude Oil)
            </button>
          </div>
        </div>
      )}

      {/* Symbol search OR confirmed chip */}
      {type === "fiat" ? (
        <div className="form-group" style={{ position: "relative" }}>
          <label className="form-label">สกุลเงินสด</label>
          <div style={{ position: "relative" }}>
            <Search
              size={17}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94A3B8",
                pointerEvents: "none"
              }}
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 44 }}
              placeholder="พิมพ์รหัสหรือชื่อสกุลเงิน เช่น THB, USD, JPY, EUR..."
              value={currencyQuery}
              onChange={(e) => {
                setCurrencyQuery(e.target.value);
                setShowCurrencyDrop(true);
              }}
              onFocus={() => setShowCurrencyDrop(true)}
              onBlur={() => {
                setTimeout(() => setShowCurrencyDrop(false), 200);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredCurrencies.length > 0) {
                    const c = filteredCurrencies[0];
                    setSymbol(c.code);
                    setName(c.name);
                    setCurrencyQuery(c.code);
                    setShowCurrencyDrop(false);
                    setConfirmed(true);
                  }
                }
              }}
              disabled={editingAsset}
            />
          </div>

          {symbol && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--primary)",
                background: "var(--primary-light)",
                padding: "6px 12px",
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              💵 เลือกแล้ว: <strong>{symbol}</strong> - {name}
            </div>
          )}

          {showCurrencyDrop && (
            <div className="suggestions-dropdown" style={{ maxHeight: 220, overflowY: "auto", zIndex: 1000 }}>
              {filteredCurrencies.length === 0 ? (
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center"
                  }}
                >
                  ไม่พบสกุลเงินที่ค้นหา
                </div>
              ) : (
                filteredCurrencies.map((c) => (
                  <div
                    key={c.code}
                    className="suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSymbol(c.code);
                      setName(c.name);
                      setCurrencyQuery(c.code);
                      setShowCurrencyDrop(false);
                      setConfirmed(true);
                    }}
                    style={{
                      padding: "10px 14px",
                      cursor: "pointer",
                      background: symbol === c.code ? "var(--primary-light)" : "transparent",
                      fontWeight: symbol === c.code ? 700 : 500
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                      <span style={{ color: symbol === c.code ? "var(--primary)" : "var(--text-main)" }}>
                        <strong>{c.code}</strong>
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.name}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">
            {!editingAsset
              ? type === "stock"
                ? "ค้นหาหุ้น (ชื่อย่อหรือชื่อบริษัท)"
                : type === "crypto"
                  ? "ค้นหาเหรียญ (เช่น Bitcoin, SOL)"
                  : "ทองคำตลาดโลก"
              : "สินทรัพย์"}
          </label>

          {confirmed || editingAsset ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--primary-light)",
                border: "1.5px solid var(--primary)",
                borderRadius: 16,
                padding: "10px 14px"
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: 15 }}>{getDisplaySymbol(symbol)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{name}</div>
              </div>
              {!editingAsset && (
                <button
                  type="button"
                  className="btn-close"
                  onClick={clearSymbol}
                  style={{ background: "rgba(82,54,255,0.1)", color: "var(--primary)" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={17}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                    pointerEvents: "none"
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: 44 }}
                  placeholder={
                    type === "stock"
                      ? "พิมพ์ชื่อหุ้น เช่น Apple, NVDA, PTT, CPALL…"
                      : type === "crypto"
                        ? "พิมพ์ เช่น Bitcoin, ETH, SOL…"
                        : "GC=F"
                  }
                  value={query}
                  autoFocus
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setConfirmed(false);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowDrop(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowDrop(false), 180);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (suggestions.length > 0) {
                        pickSuggestion(suggestions[0]);
                      }
                    }
                  }}
                />
                {searching && (
                  <div
                    className="spinner sm"
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}
                  />
                )}
              </div>

              {showDrop && suggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.map((item) => (
                    <div
                      key={item.symbol}
                      className="suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickSuggestion(item);
                      }}
                    >
                      <div className="suggestion-left">
                        <span className="suggestion-symbol">{getDisplaySymbol(item.symbol)}</span>
                        <span className="suggestion-name">{item.name}</span>
                      </div>
                      <div className="suggestion-right">
                        <span className="suggestion-exchange">{item.exchange}</span>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>
                          {item.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!editingAsset && !confirmed && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {type === "crypto" && (
                <>
                  {[
                    ["BTC-USD", "Bitcoin"],
                    ["ETH-USD", "Ethereum"],
                    ["SOL-USD", "Solana"],
                    ["BNB-USD", "BNB"]
                  ].map(([s, n]) => (
                    <button
                      key={s}
                      type="button"
                      className="ripple-btn"
                      style={{
                        height: 28,
                        borderRadius: 8,
                        padding: "0 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#FFF7ED",
                        border: "1px solid #FED7AA",
                        cursor: "pointer",
                        fontFamily: "inherit"
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyPreset(s, n);
                      }}
                    >
                      {s.split("-")[0]}
                    </button>
                  ))}
                </>
              )}
              {type === "gold" && (
                <button
                  type="button"
                  className="ripple-btn"
                  style={{
                    height: 28,
                    borderRadius: 8,
                    padding: "0 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--gold-light)",
                    border: "1px solid #FCD34D",
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyPreset("GC=F", "Spot Gold");
                  }}
                >
                  GC=F Spot Gold 🥇
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transaction Type Selector */}
      {confirmed && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">ประเภทรายการ</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              background: "#F1F5F9",
              padding: 4,
              borderRadius: 12,
              gap: 4
            }}
          >
            <button
              type="button"
              onClick={() => setTxType("BUY")}
              style={{
                height: 38,
                borderRadius: 10,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: txType === "BUY" ? (type === "fiat" ? "var(--primary)" : "var(--gain)") : "transparent",
                color: txType === "BUY" ? "white" : "var(--text-muted)",
                transition: "var(--transition)"
              }}
            >
              {type === "fiat" ? "📥 ฝากเงินสด" : "🟢 ซื้อ (Buy)"}
            </button>
            <button
              type="button"
              onClick={() => setTxType("SELL")}
              style={{
                height: 38,
                borderRadius: 10,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: txType === "SELL" ? "var(--loss)" : "transparent",
                color: txType === "SELL" ? "white" : "var(--text-muted)",
                transition: "var(--transition)"
              }}
            >
              {type === "fiat" ? "📤 ถอนเงินสด" : "🔴 ขาย (Sell)"}
            </button>
          </div>
        </div>
      )}

      {/* Qty & Price inputs */}
      {type === "fiat" ? (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label className="form-label">จำนวนเงินสด</label>
            {currencyRateLoading && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <span className="spinner sm" style={{ width: 12, height: 12, borderWidth: "1.5px" }} />{" "}
                ดึงอัตราแลกเปลี่ยนปัจจุบัน...
              </span>
            )}
          </div>
          <input
            ref={qtyInputRef}
            type="number"
            step="any"
            min="0.01"
            className="form-input"
            placeholder={`กรอกจำนวนเงินสด (${symbol || "สกุลเงิน"})`}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            autoFocus
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">จำนวน (หน่วย)</label>
            <input
              ref={qtyInputRef}
              type="number"
              step="any"
              min="0.000001"
              className="form-input"
              placeholder="เช่น 10, 1.5"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              ราคาต่อหน่วย
              <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 4 }}>
                {symbol.includes(".BK") ? "(THB)" : "(USD)"}
              </span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              className="form-input"
              placeholder={symbol.includes(".BK") ? "บาท/หุ้น" : "USD/unit"}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      {/* Purchase Date & Time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            วันที่ทำรายการ <span style={{ fontSize: 10, color: "var(--text-faint)" }}>(Log ประวัติ)</span>
          </label>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            เวลาที่ทำรายการ <span style={{ fontSize: 10, color: "var(--text-faint)" }}>(ระบุเวลา น.)</span>
          </label>
          <input type="time" className="form-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
        <label className="form-label">
          {type === "fiat" ? "ธนาคาร" : "โบรกเกอร์"}{" "}
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
            {type === "fiat" ? "(เช่น กสิกรไทย, SCB, etc.)" : "(เช่น Dime!, Webull, etc.)"}
          </span>
        </label>
        <input
          type="text"
          className="form-input"
          placeholder={type === "fiat" ? "พิมพ์ธนาคารที่ฝากเงิน" : "พิมพ์โบรกเกอร์ที่ซื้อขาย"}
          value={broker}
          onChange={(e) => setBroker(e.target.value)}
        />
      </div>
    </>
  );
}
