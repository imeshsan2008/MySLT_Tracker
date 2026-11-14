(function (global) {
  const API_BASE = "https://omniscapp.slt.lk/slt/ext/api";
  const CORRECT_CLIENT_ID = "b7402e9d66808f762ccedbe42c20668e";

  function normalizeToken(rawToken) {
    return String(rawToken || '').trim().replace(/^bearer\s+/i, '').trim();
  }

  function safeJsonParse(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed[0] !== '"')) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  function parseTokenValue(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') {
      const parsed = safeJsonParse(raw);
      if (parsed !== null) return parseTokenValue(parsed);
      return normalizeToken(raw);
    }
    if (typeof raw === 'object') {
      const candidate = raw.access_token || raw.accessToken || raw.slt_accessToken || raw.token || raw.jwt || '';
      return typeof candidate === 'string' ? normalizeToken(candidate) : '';
    }
    return '';
  }

  function isLikelySriLankanPhone(raw) {
    const cleaned = String(raw || '').trim().replace(/[\s()-]/g, '');
    return /^(?:\+?94|0)[1-9]\d{8}$/.test(cleaned) || /^[1-9]\d{8}$/.test(cleaned);
  }

  function classifyIdentifier(raw) {
    const str = String(raw || '').trim();
    if (!str) return { phone: '', acc: '' };
    if (isLikelySriLankanPhone(str)) {
      return { phone: str, acc: '' };
    }
    return { phone: '', acc: str };
  }

  function pickFirstField(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (const key of keys) {
      const val = obj[key];
      if (typeof val === 'string' || typeof val === 'number') {
        const str = String(val).trim();
        if (str) return str;
      }
    }
    return '';
  }

  function parseSelectedAcc(raw) {
    if (raw === null || raw === undefined) return { phone: '', acc: '' };

    if (typeof raw === 'string') {
      const parsed = safeJsonParse(raw);
      if (parsed !== null) return parseSelectedAcc(parsed);

      const trimmed = raw.trim();
      if (!trimmed) return { phone: '', acc: '' };
      if (isLikelySriLankanPhone(trimmed)) return { phone: trimmed, acc: '' };

      const parts = trimmed.split(/[\s,|/;:]+/).filter(Boolean);
      if (parts.length > 1) {
        let phone = '';
        let acc = '';
        for (const part of parts) {
          const classified = classifyIdentifier(part);
          if (!phone && classified.phone) phone = classified.phone;
          else if (!acc && classified.acc) acc = classified.acc;
        }
        if (phone || acc) return { phone, acc };
      }

      return classifyIdentifier(trimmed);
    }

    if (Array.isArray(raw)) {
      for (const item of raw) {
        const res = parseSelectedAcc(item);
        if (res.phone || res.acc) return res;
      }
      return { phone: '', acc: '' };
    }

    if (typeof raw === 'object') {
      const phoneKeys = [
        'telephoneNo', 'telephone_no', 'subscriberID', 'subscriberId', 'subscriber_id',
        'phone', 'phoneNo', 'phoneNumber', 'serviceId', 'serviceID', 'serviceNo',
        'tpNo', 'lineNo', 'msisdn', 'contactNo', 'number'
      ];
      const accKeys = [
        'accountNo', 'account_no', 'accNo', 'acc', 'accountNumber', 'account_number',
        'contractNo', 'billingAcc', 'accountId', 'accountID'
      ];

      let phone = pickFirstField(raw, phoneKeys);
      let acc = pickFirstField(raw, accKeys);

      if (!phone || !acc) {
        for (const val of Object.values(raw)) {
          if (val && typeof val === 'object') {
            if (!phone) phone = pickFirstField(val, phoneKeys);
            if (!acc) acc = pickFirstField(val, accKeys);
          }
        }
      }

      if (phone && !acc && !isLikelySriLankanPhone(phone)) {
        acc = phone;
        phone = '';
      }
      return { phone, acc };
    }

    return { phone: '', acc: '' };
  }

  function readStorageKey(storageLike, key) {
    if (!storageLike) return '';
    try {
      if (typeof storageLike.getItem === 'function') {
        return storageLike.getItem(key) || '';
      }
      return storageLike[key] || '';
    } catch {
      return '';
    }
  }

  function extractPortalStorageData(storageLike) {
    const token =
      parseTokenValue(readStorageKey(storageLike, 'slt_accessToken')) ||
      parseTokenValue(readStorageKey(storageLike, 'access_token')) ||
      parseTokenValue(readStorageKey(storageLike, 'accessToken'));

    const fromSelected = parseSelectedAcc(readStorageKey(storageLike, 'selectedAcc'));
    let phone = fromSelected.phone;
    let acc = fromSelected.acc;

    if (!phone) {
      const phoneFallbackKeys = ['telephoneNo', 'subscriberID', 'subscriberId', 'selectedPhone', 'serviceId'];
      for (const key of phoneFallbackKeys) {
        const candidate = readStorageKey(storageLike, key);
        if (candidate) {
          const parsed = parseSelectedAcc(candidate);
          if (parsed.phone) {
            phone = parsed.phone;
            break;
          }
        }
      }
    }

    if (!acc) {
      const accFallbackKeys = ['accountNo', 'accNo', 'account_no'];
      for (const key of accFallbackKeys) {
        const candidate = readStorageKey(storageLike, key);
        if (candidate) {
          const parsed = parseSelectedAcc(candidate);
          acc = parsed.acc || String(candidate).trim();
          if (acc) break;
        }
      }
    }

    return { token, phone, acc };
  }

  function formatPhoneParams(rawPhone) {
    const trimmed = String(rawPhone || '').trim();
    if (!trimmed || !/^[+\d\s()-]+$/.test(trimmed)) {
      return { subscriberID: trimmed, telephoneNo: trimmed };
    }

    const digits = trimmed.replace(/\D/g, '');
    if (/^0\d{9}$/.test(digits)) {
      return { subscriberID: `94${digits.slice(1)}`, telephoneNo: digits };
    }
    if (/^94\d{9}$/.test(digits)) {
      return { subscriberID: digits, telephoneNo: `0${digits.slice(2)}` };
    }
    if (/^\d{9}$/.test(digits)) {
      return { subscriberID: `94${digits}`, telephoneNo: `0${digits}` };
    }

    return { subscriberID: digits || trimmed, telephoneNo: digits || trimmed };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchJson(url, headers) {
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      return { ok: res.ok, status: res.status, data, error: null };
    } catch (err) {
      return { ok: false, status: 0, data: null, error: err.message };
    }
  }

  async function fetchAllMySLTData(token, phone, acc) {
    const cleanToken = normalizeToken(token);
    const { subscriberID, telephoneNo } = formatPhoneParams(phone);
    const cleanAcc = String(acc || '').trim();

    // Origin and Referer are injected via rules.json (declarativeNetRequest)
    const headers = {
      "Authorization": `bearer ${cleanToken}`,
      "X-IBM-Client-Id": CORRECT_CLIENT_ID,
      "Accept": "application/json, text/plain, */*"
    };

    const [usageRes, extraRes, vasRes, billRes] = await Promise.all([
      fetchJson(`${API_BASE}/BBVAS/UsageSummary?subscriberID=${encodeURIComponent(subscriberID)}`, headers),
      fetchJson(`${API_BASE}/BBVAS/ExtraGB?subscriberID=${encodeURIComponent(subscriberID)}`, headers),
      fetchJson(`${API_BASE}/BBVAS/GetDashboardVASBundles?subscriberID=${encodeURIComponent(subscriberID)}`, headers),
      cleanAcc
        ? fetchJson(`${API_BASE}/AccountOMNI/BillPaymentRequest?telephoneNo=${encodeURIComponent(telephoneNo)}&accountNo=${encodeURIComponent(cleanAcc)}`, headers)
        : Promise.resolve({ ok: false, status: 0, data: null, error: null })
    ]);

    return { cleanToken, subscriberID, telephoneNo, cleanAcc, usageRes, extraRes, vasRes, billRes };
  }

  function formatLkr(value) {
    const num = Number(String(value ?? '').replace(/,/g, ''));
    if (!Number.isFinite(num)) return null;
    return `Rs. ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getNextBillDateInfo(lastBillDateStr, now = new Date()) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let target = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const match = String(lastBillDateStr || '').trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (match) {
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      const candidate = new Date(year, monthIndex + 1, 1);
      if (candidate > target) {
        target = candidate;
      }
    }

    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const daysLeft = Math.max(0, Math.round((target - todayStart) / 86400000));

    return {
      dateStr: `${yyyy}/${mm}/${dd}`,
      daysLeft
    };
  }

  function extractBillInfo(billRes, now = new Date()) {
    const billData = billRes?.ok ? billRes.data?.dataBundle : null;
    const inquiry = Array.isArray(billData?.listofbillingInquiryType)
      ? billData.listofbillingInquiryType[0]
      : billData;

    const nextBill = getNextBillDateInfo(inquiry?.lastBillDate, now);

    if (!inquiry) {
      return {
        displayAmount: (billRes?.status === 401 || billRes?.status === 403) ? "Auth Error" : "N/A",
        metaParts: [`Next Bill: ${nextBill.dateStr} (${nextBill.daysLeft}d)`],
        nextBill
      };
    }

    const rawAmount = inquiry.outstandingBalance ?? inquiry.totalPayable ?? inquiry.outstandingAmount ?? inquiry.billAmount ?? inquiry.amount ?? "0.00";
    const numericAmount = Number(String(rawAmount).replace(/,/g, ''));
    const formatted = formatLkr(rawAmount);
    const displayAmount = formatted !== null
      ? (numericAmount < 0 ? `${formatted} (Credit)` : formatted)
      : String(rawAmount);

    const metaParts = [];
    const lastBillFormatted = inquiry.billAmount !== undefined ? formatLkr(inquiry.billAmount) : null;
    if (lastBillFormatted) metaParts.push(`Bill: ${lastBillFormatted}`);
    if (inquiry.paymentDueDate) metaParts.push(`Due: ${inquiry.paymentDueDate}`);
    const lastPaidFormatted = inquiry.lastPaymentAmount !== undefined ? formatLkr(inquiry.lastPaymentAmount) : null;
    if (lastPaidFormatted) {
      metaParts.push(`Paid: ${lastPaidFormatted}${inquiry.lastPaymentDate ? ` (${inquiry.lastPaymentDate})` : ''}`);
    }
    metaParts.push(`Next Bill: ${nextBill.dateStr} (${nextBill.daysLeft}d)`);

    return { displayAmount, metaParts, nextBill };
  }

  function toGB(value, unit) {
    const num = parseFloat(value || 0);
    if (!Number.isFinite(num)) return 0;
    switch (String(unit || 'GB').toUpperCase()) {
      case 'TB': return num * 1024;
      case 'MB': return num / 1024;
      case 'KB': return num / (1024 * 1024);
      default: return num;
    }
  }

  function formatGb(value) {
    const rounded = Math.round(value * 100) / 100;
    return `${rounded} GB`;
  }

  function hasSummaryData(summary) {
    if (!summary || typeof summary !== 'object') return false;
    const limit = parseFloat(summary.limit || 0);
    const used = parseFloat(summary.used || 0);
    return limit > 0 || used > 0;
  }

  function isUsageItem(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return (
      obj.used !== undefined ||
      obj.usage !== undefined ||
      obj.used_volume !== undefined ||
      obj.limit !== undefined ||
      obj.quota !== undefined ||
      obj.total !== undefined ||
      obj.remaining !== undefined ||
      obj.balance !== undefined
    );
  }

  function findUsageArrays(node, depth = 0) {
    if (!node || depth > 4) return [];
    if (Array.isArray(node)) {
      const direct = node.filter(isUsageItem);
      if (direct.length > 0) return direct;
      return node.flatMap(item => findUsageArrays(item, depth + 1));
    }
    if (typeof node === 'object') {
      if (Array.isArray(node.usageDetails)) {
        return node.usageDetails.filter(isUsageItem);
      }
      const items = [];
      for (const val of Object.values(node)) {
        if (val && typeof val === 'object') {
          items.push(...findUsageArrays(val, depth + 1));
        }
      }
      return items;
    }
    return [];
  }

  function extractDetailList(res, nestedKey) {
    if (!res?.ok || !res.data?.dataBundle) return [];
    const bundle = res.data.dataBundle;
    if (Array.isArray(bundle.usageDetails)) return bundle.usageDetails;
    if (nestedKey && Array.isArray(bundle[nestedKey]?.usageDetails)) return bundle[nestedKey].usageDetails;
    return findUsageArrays(bundle);
  }

  function formatPkg(item, fallbackName = "Data Package", overrides = {}) {
    const name = item.name || item.package_name || item.bundle_name || item.bundleName || item.vas_name || item.vasName || item.title || fallbackName;
    const rawLimit = item.limit ?? item.quota ?? item.total ?? item.volume ?? 0;
    const used = parseFloat(item.used ?? item.usage ?? item.used_volume ?? 0);
    const limit = parseFloat(rawLimit ?? 0);
    const remaining = Math.max(0, parseFloat(item.remaining ?? item.balance ?? (limit - used)));
    const unit = item.volume_unit || item.unit || "GB";
    const expiry = item.expiry_date || item.expire_date || item.valid_till || item.validTill;
    const validTill = overrides.validTill ?? (expiry ? `Valid: ${expiry}` : "");
    const subLabel = overrides.subLabel || "";
    const isUnlimited = rawLimit === null || rawLimit === "Unlimited" || (limit === 0 && used > 0);

    let percent = 0;
    if (!isUnlimited && limit > 0) {
      percent = typeof item.percentage === 'number'
        ? Math.max(0, Math.min(100, Math.round(item.percentage)))
        : Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
    }

    const usedGB = toGB(used, unit);
    const limitGB = isUnlimited ? 0 : toGB(limit, unit);
    const remainingGB = isUnlimited ? 0 : toGB(remaining, unit);

    return {
      name,
      subLabel,
      usedText: isUnlimited ? `${used} ${unit} USED OF UNLIMITED` : `${used} ${unit} USED OF ${limit} ${unit}`,
      percent,
      isUnlimited,
      isLow: !isUnlimited && percent <= 20,
      validTill,
      usedGB,
      limitGB,
      remainingGB
    };
  }

  function collectPackages(usageRes, extraRes, vasRes) {
    const allPackages = [];
    const bundle = usageRes?.ok ? usageRes.data?.dataBundle : null;

    const myDetails = Array.isArray(bundle?.my_package_info?.usageDetails)
      ? bundle.my_package_info.usageDetails
      : [];
    if (myDetails.length > 0) {
      myDetails.forEach(i => allPackages.push(formatPkg(i, bundle?.my_package_info?.package_name || 'Package Data')));
    } else if (hasSummaryData(bundle?.my_package_summary)) {
      allPackages.push(formatPkg(bundle.my_package_summary, bundle?.my_package_info?.package_name || 'Package Data'));
    }

    if (hasSummaryData(bundle?.bonus_data_summary)) {
      allPackages.push(formatPkg(bundle.bonus_data_summary, 'Bonus Data'));
    }

    if (hasSummaryData(bundle?.free_data_summary)) {
      allPackages.push(formatPkg(bundle.free_data_summary, 'Mid Night Thriller', {
        subLabel: 'Free Data',
        validTill: '12AM - 7AM'
      }));
    }

    const extraDetails = extractDetailList(extraRes, 'extra_gb_info');
    if (extraDetails.length > 0) {
      extraDetails.forEach(i => allPackages.push(formatPkg(i, 'Extra GB')));
    } else if (hasSummaryData(bundle?.extra_gb_data_summary)) {
      allPackages.push(formatPkg(bundle.extra_gb_data_summary, 'Extra GB Data'));
    }

    const vasDetails = extractDetailList(vasRes, 'vas_data_info');
    if (vasDetails.length > 0) {
      vasDetails.forEach(i => allPackages.push(formatPkg(i, 'VAS Data')));
    } else if (hasSummaryData(bundle?.vas_data_summary)) {
      allPackages.push(formatPkg(bundle.vas_data_summary, 'VAS Data'));
    }

    return allPackages;
  }

  function calculateTotals(packages) {
    let totalUsedGB = 0;
    let totalLimitGB = 0;
    let totalRemainingGB = 0;
    let hasUnlimited = false;

    packages.forEach(pkg => {
      totalUsedGB += pkg.usedGB;
      if (pkg.isUnlimited) {
        hasUnlimited = true;
      } else {
        totalLimitGB += pkg.limitGB;
        totalRemainingGB += pkg.remainingGB;
      }
    });

    return { totalUsedGB, totalLimitGB, totalRemainingGB, hasUnlimited };
  }

  const exported = {
    API_BASE,
    CORRECT_CLIENT_ID,
    normalizeToken,
    parseTokenValue,
    classifyIdentifier,
    parseSelectedAcc,
    extractPortalStorageData,
    formatPhoneParams,
    escapeHtml,
    fetchJson,
    fetchAllMySLTData,
    formatLkr,
    getNextBillDateInfo,
    extractBillInfo,
    toGB,
    formatGb,
    hasSummaryData,
    isUsageItem,
    findUsageArrays,
    extractDetailList,
    formatPkg,
    collectPackages,
    calculateTotals
  };

  global.MySLTUtils = exported;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
