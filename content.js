(function () {
  if (typeof window.__mysltContentCleanup === 'function') {
    window.__mysltContentCleanup();
  }

  const HOST_ID = 'myslt-ext-topbar-host';
  const MSG_SOURCE = 'myslt-tracker-ext';

  const state = {
    token: '',
    phone: '',
    acc: '',
    usageRes: null,
    extraRes: null,
    vasRes: null,
    billRes: null,
    dismissed: false,
    loading: false,
    renderScheduled: false,
    copiedUntil: 0,
    copyErrorUntil: 0,
    copyResetTimer: null,
    originalBodyPaddingTop: null
  };

  function waitForBody() {
    if (document.body) return Promise.resolve(document.body);
    return new Promise(resolve => {
      const check = () => {
        if (document.body) {
          observer.disconnect();
          resolve(document.body);
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener('DOMContentLoaded', check, { once: true });
    });
  }

  function scheduleRender() {
    if (state.renderScheduled || state.dismissed) return;
    state.renderScheduled = true;
    queueMicrotask(() => {
      state.renderScheduled = false;
      renderTopBar();
    });
  }

  async function syncStorage(partial) {
    const update = {};
    if (partial.token) update.sltToken = MySLTUtils.normalizeToken(partial.token);
    if (partial.phone) update.sltPhone = String(partial.phone).trim();
    if (partial.acc) update.sltAcc = String(partial.acc).trim();
    if (Object.keys(update).length > 0) {
      try {
        await chrome.storage.local.set(update);
      } catch {
        // Ignore storage write errors if extension context invalidated
      }
    }
  }

  function captureFromLocalStorage() {
    let extracted = { token: '', phone: '', acc: '' };
    try {
      extracted = MySLTUtils.extractPortalStorageData(window.localStorage);
    } catch {
      return { changed: false, tokenChanged: false };
    }

    const update = {};
    let tokenChanged = false;

    if (extracted.token && extracted.token !== state.token) {
      state.token = extracted.token;
      update.token = extracted.token;
      tokenChanged = true;
    }
    if (extracted.phone && extracted.phone !== state.phone) {
      state.phone = extracted.phone;
      update.phone = extracted.phone;
    }
    if (extracted.acc && extracted.acc !== state.acc) {
      state.acc = extracted.acc;
      update.acc = extracted.acc;
    }

    const changed = Object.keys(update).length > 0;
    if (changed) {
      syncStorage(update);
    }
    return { changed, tokenChanged };
  }

  async function copyTextToClipboard(text) {
    if (!text) return false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback to textarea copy below
      }
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  async function handleCopyToken() {
    captureFromLocalStorage();
    const ok = await copyTextToClipboard(state.token);
    const now = Date.now();
    state.copiedUntil = ok ? now + 2000 : 0;
    state.copyErrorUntil = ok ? 0 : now + 2000;
    if (state.copyResetTimer) {
      clearTimeout(state.copyResetTimer);
    }
    state.copyResetTimer = setTimeout(() => {
      state.copyResetTimer = null;
      scheduleRender();
    }, 2050);
    scheduleRender();
  }

  function handleLocalStorageSync() {
    const { changed } = captureFromLocalStorage();
    if (state.token && state.phone && (changed || !state.usageRes)) {
      fetchFromBackground(changed);
    }
    if (state.usageRes || state.token) {
      scheduleRender();
    }
  }

  function onWindowMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== MSG_SOURCE) return;
    const msg = event.data;

    if (msg.type === 'CAPTURE_AUTH') {
      if (msg.token) state.token = MySLTUtils.normalizeToken(msg.token);
      if (msg.phone) state.phone = String(msg.phone).trim();
      if (msg.acc) state.acc = String(msg.acc).trim();
      syncStorage(msg);
      if (!state.usageRes && state.token && state.phone) {
        fetchFromBackground(false);
      }
      if (state.usageRes || state.token) scheduleRender();
    } else if (msg.type === 'CAPTURE_STORAGE') {
      handleLocalStorageSync();
    } else if (msg.type === 'CAPTURE_API' && msg.endpoint) {
      state[msg.endpoint] = {
        ok: msg.status >= 200 && msg.status < 300,
        status: msg.status,
        data: msg.data,
        error: null
      };
      if (state.usageRes || state.token) scheduleRender();
    }
  }

  window.addEventListener('message', onWindowMessage);

  async function fetchFromBackground(force) {
    if (state.loading) return;
    captureFromLocalStorage();

    if (!state.token || !state.phone) {
      try {
        const stored = await chrome.storage.local.get(['sltToken', 'sltPhone', 'sltAcc']);
        state.token = state.token || stored.sltToken || '';
        state.phone = state.phone || stored.sltPhone || '';
        state.acc = state.acc || stored.sltAcc || '';
      } catch {
        return;
      }
    }

    if (!state.token || !state.phone) {
      if (state.token) scheduleRender();
      return;
    }
    if (!force && state.usageRes) return;

    state.loading = true;
    if (force || !state.usageRes) scheduleRender();

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetchMySLTData',
        token: state.token,
        phone: state.phone,
        acc: state.acc
      });

      if (response?.success && response.data) {
        const d = response.data;
        if (d.usageRes?.ok) {
          state.usageRes = d.usageRes;
          state.extraRes = d.extraRes;
          state.vasRes = d.vasRes;
          state.billRes = d.billRes;
        }
      }
    } catch {
      // Ignore transient runtime messaging errors
    } finally {
      state.loading = false;
      if (state.usageRes || state.token) scheduleRender();
    }
  }

  function restoreBodyPadding() {
    if (document.body && state.originalBodyPaddingTop !== null) {
      document.body.style.paddingTop = state.originalBodyPaddingTop;
      state.originalBodyPaddingTop = null;
    }
  }

  function applyBodyOffset(host, body) {
    if (!body || !host.getBoundingClientRect) return;
    const height = Math.round(host.getBoundingClientRect().height || 0);
    if (height > 0) {
      if (state.originalBodyPaddingTop === null) {
        state.originalBodyPaddingTop = body.style.paddingTop || '';
      }
      body.style.paddingTop = `${height}px`;
    }
  }

  function ensureHost() {
    const root = document.documentElement || document.body;
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; z-index: 2147483647 !important; width: 100% !important; display: block !important;';
      host.attachShadow({ mode: 'open' });
      root.appendChild(host);
    }
    return host;
  }

  function removeTopBarHost() {
    restoreBodyPadding();
    document.getElementById(HOST_ID)?.remove();
  }

  function formatBreakdownLabel(pkg) {
    if (pkg.isUnlimited) {
      const usedText = MySLTUtils.formatGb(pkg.usedGB);
      return pkg.validTill ? `${pkg.name} (${pkg.validTill}): ${usedText}` : `${pkg.name}: ${usedText}`;
    }
    return `${pkg.name}: ${MySLTUtils.formatGb(pkg.usedGB)} / ${MySLTUtils.formatGb(pkg.limitGB)}`;
  }

  async function renderTopBar() {
    if (state.dismissed) return;

    const allPackages = state.usageRes?.ok
      ? MySLTUtils.collectPackages(state.usageRes, state.extraRes, state.vasRes)
      : [];
    const hasUsage = allPackages.length > 0;
    if (!hasUsage && !state.token) {
      removeTopBarHost();
      return;
    }

    const body = await waitForBody();
    if (state.dismissed) return;

    const host = ensureHost();
    const shadow = host.shadowRoot;
    const now = Date.now();
    const isCopied = state.copiedUntil > now;
    const isCopyError = !isCopied && state.copyErrorUntil > now;
    const copyBtnClass = isCopied ? 'pill-btn copied' : (isCopyError ? 'pill-btn error' : 'pill-btn');
    const copyBtnText = isCopied ? 'Copied ✓' : (isCopyError ? 'Copy Failed' : 'Copy Token');

    let pkgName = '';
    let statsHtml = '';
    let chipsHtml = '';

    if (hasUsage) {
      const totals = MySLTUtils.calculateTotals(allPackages);
      const bundle = state.usageRes.data?.dataBundle;
      pkgName = bundle?.my_package_info?.package_name || '';
      const limitLabel = totals.hasUnlimited
        ? (totals.totalLimitGB > 0 ? `${MySLTUtils.formatGb(totals.totalLimitGB)} + Unl.` : 'Unlimited')
        : MySLTUtils.formatGb(totals.totalLimitGB);

      const billInfo = MySLTUtils.extractBillInfo(state.billRes);
      const nextBillLabel = `${billInfo.nextBill.dateStr} (${billInfo.nextBill.daysLeft}d)`;
      chipsHtml = allPackages
        .map(pkg => `<span class="chip">${MySLTUtils.escapeHtml(formatBreakdownLabel(pkg))}</span>`)
        .join('');

      statsHtml = `
        <span class="stat primary">Total Used: ${MySLTUtils.escapeHtml(MySLTUtils.formatGb(totals.totalUsedGB))}</span>
        <span class="stat">Remaining: <strong>${MySLTUtils.escapeHtml(MySLTUtils.formatGb(totals.totalRemainingGB))}</strong></span>
        <span class="stat">Total Limit: <strong>${MySLTUtils.escapeHtml(limitLabel)}</strong></span>
        ${state.billRes?.ok ? `<span class="stat">Bill: <strong>${MySLTUtils.escapeHtml(billInfo.displayAmount)}</strong></span>` : ''}
        <span class="stat">Next Bill: <strong>${MySLTUtils.escapeHtml(nextBillLabel)}</strong></span>
      `;
    } else {
      const statusText = state.loading
        ? 'Token Synced • Loading usage...'
        : (!state.phone ? 'Token Synced • Open Usage tab to sync phone' : 'Token Synced');
      statsHtml = `<span class="stat">${MySLTUtils.escapeHtml(statusText)}</span>`;
    }

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          display: block;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .bar {
          background: linear-gradient(90deg, #00468c, #0077c2);
          color: #ffffff;
          padding: 7px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.22);
          font-size: 12px;
          line-height: 1.3;
          box-sizing: border-box;
          flex-wrap: wrap;
        }
        .left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .brand {
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.2px;
        }
        .meta-pill {
          background: rgba(255, 255, 255, 0.16);
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
        }
        .stats {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .stat {
          background: rgba(255, 255, 255, 0.15);
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          white-space: nowrap;
        }
        .stat.primary {
          background: #ffffff;
          color: #00468c;
          font-weight: 700;
          font-size: 12px;
        }
        .stat strong {
          font-weight: 700;
        }
        .chips {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .chip {
          background: rgba(15, 23, 42, 0.22);
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 11px;
          color: #e2e8f0;
          white-space: nowrap;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }
        button {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        button:hover {
          background: rgba(255, 255, 255, 0.34);
        }
        .pill-btn {
          width: auto;
          border-radius: 999px;
          padding: 0 10px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }
        .pill-btn.copied {
          background: #22c55e;
          color: #ffffff;
        }
        .pill-btn.error {
          background: #ef4444;
          color: #ffffff;
        }
      </style>
      <div class="bar">
        <div class="left">
          <span class="brand">MySLT Total</span>
          ${state.acc ? `<span class="meta-pill">Acc: ${MySLTUtils.escapeHtml(state.acc)}</span>` : ''}
          ${pkgName ? `<span class="meta-pill">${MySLTUtils.escapeHtml(pkgName)}</span>` : ''}
        </div>
        <div class="stats">${statsHtml}</div>
        ${chipsHtml ? `<div class="chips">${chipsHtml}</div>` : ''}
        <div class="actions">
          ${state.token ? `<button id="mysltCopyTokenBtn" class="${copyBtnClass}" title="Copy slt_accessToken">${copyBtnText}</button>` : ''}
          <button id="mysltExpandBtn" title="Open Full Screen Dashboard">⛶</button>
          <button id="mysltRefreshBtn" title="Refresh Total Usage">${state.loading ? '…' : '↻'}</button>
          <button id="mysltCloseBtn" title="Hide Bar">✕</button>
        </div>
      </div>
    `;

    shadow.getElementById('mysltCopyTokenBtn')?.addEventListener('click', () => {
      handleCopyToken();
    });
    shadow.getElementById('mysltExpandBtn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openDashboard' }).catch(() => {});
    });
    shadow.getElementById('mysltRefreshBtn')?.addEventListener('click', () => {
      captureFromLocalStorage();
      fetchFromBackground(true);
    });
    shadow.getElementById('mysltCloseBtn')?.addEventListener('click', () => {
      state.dismissed = true;
      restoreBodyPadding();
      host.remove();
    });

    applyBodyOffset(host, body);
  }

  function onWindowStorageEvent(event) {
    if (event.storageArea !== window.localStorage) return;
    handleLocalStorageSync();
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== 'local') return;
    let changed = false;

    if ('sltToken' in changes) {
      state.token = changes.sltToken.newValue || '';
      if (!state.token) {
        state.usageRes = null;
        state.extraRes = null;
        state.vasRes = null;
        state.billRes = null;
      }
      changed = true;
    }
    if ('sltPhone' in changes) {
      state.phone = changes.sltPhone.newValue || '';
      changed = true;
    }
    if ('sltAcc' in changes) {
      state.acc = changes.sltAcc.newValue || '';
      changed = true;
    }

    if (changed) {
      if (!state.token && !state.usageRes) {
        removeTopBarHost();
      } else {
        scheduleRender();
      }
    }
  }

  window.addEventListener('storage', onWindowStorageEvent);
  chrome.storage.onChanged.addListener(onStorageChanged);

  captureFromLocalStorage();
  if (state.token) {
    scheduleRender();
  }

  const timerId = setTimeout(() => {
    if (!state.usageRes && !state.dismissed) {
      fetchFromBackground(false);
    }
  }, 150);

  window.__mysltContentCleanup = () => {
    clearTimeout(timerId);
    if (state.copyResetTimer) {
      clearTimeout(state.copyResetTimer);
      state.copyResetTimer = null;
    }
    window.removeEventListener('message', onWindowMessage);
    window.removeEventListener('storage', onWindowStorageEvent);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    removeTopBarHost();
  };
})();
