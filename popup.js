const {
  normalizeToken,
  formatPhoneParams,
  escapeHtml,
  fetchAllMySLTData,
  extractBillInfo,
  formatGb,
  collectPackages,
  calculateTotals
} = window.MySLTUtils;

function populateSetupInputs(data) {
  const tokenInput = document.getElementById('tokenInput');
  const phoneInput = document.getElementById('phoneInput');
  const accInput = document.getElementById('accInput');
  if (tokenInput) tokenInput.value = data?.sltToken || '';
  if (phoneInput) phoneInput.value = data?.sltPhone || '';
  if (accInput) accInput.value = data?.sltAcc || '';
}

function updateAccountBadge(acc, phone) {
  const badge = document.getElementById('accountBadge');
  if (!badge) return;
  const cleanAcc = String(acc || '').trim();
  const { telephoneNo } = formatPhoneParams(phone);
  if (cleanAcc) {
    badge.textContent = telephoneNo ? `Acc: ${cleanAcc} • ${telephoneNo}` : `Acc: ${cleanAcc}`;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function renderBillInfo(billRes, billEl, billMetaEl) {
  const { displayAmount, metaParts } = extractBillInfo(billRes);
  billEl.textContent = displayAmount;

  if (!billMetaEl) return;
  if (metaParts.length > 0) {
    billMetaEl.innerHTML = metaParts.map(part => `<span>${escapeHtml(part)}</span>`).join('');
    billMetaEl.style.display = 'flex';
  } else {
    billMetaEl.style.display = 'none';
  }
}

async function initPopup() {
  const setupBox = document.getElementById('setupBox');
  const totalBillEl = document.getElementById('totalBill');
  const usageContainer = document.getElementById('usageContainer');
  const refreshBtn = document.getElementById('refreshBtn');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const billMetaEl = document.getElementById('billMeta');
  const summaryCard = document.getElementById('summaryCard');

  if (!setupBox || !totalBillEl || !usageContainer || !refreshBtn || !saveBtn) {
    console.error('Missing required elements in popup.html.');
    return;
  }

  const isFullscreenPage = new URLSearchParams(window.location.search).get('fullscreen') === '1';
  if (isFullscreenPage) {
    document.body.classList.add('fullscreen-mode');
    if (fullscreenBtn) {
      fullscreenBtn.title = 'Toggle Browser Fullscreen';
    }
  }

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', async () => {
      if (!isFullscreenPage) {
        await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?fullscreen=1') });
        return;
      }
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Ignore fullscreen API rejection if blocked by user gesture policy
      }
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
      const isHidden = setupBox.style.display === 'none' || setupBox.style.display === '';
      if (isHidden) {
        try {
          const data = await chrome.storage.local.get(['sltToken', 'sltPhone', 'sltAcc']);
          populateSetupInputs(data);
        } catch {
          // Ignore storage read failure when opening setup form manually
        }
        setupBox.style.display = 'block';
      } else {
        setupBox.style.display = 'none';
      }
    });
  }

  refreshBtn.addEventListener('click', async () => {
    const freshData = await chrome.storage.local.get(['sltToken', 'sltPhone', 'sltAcc']);
    if (freshData.sltToken && freshData.sltPhone && freshData.sltAcc) {
      fetchMySLTData(freshData.sltToken, freshData.sltPhone, freshData.sltAcc);
    } else {
      setupBox.style.display = 'block';
      totalBillEl.textContent = "Setup Required";
    }
  });

  saveBtn.addEventListener('click', async () => {
    const token = normalizeToken(document.getElementById('tokenInput')?.value);
    const phone = document.getElementById('phoneInput')?.value.trim() || '';
    const acc = document.getElementById('accInput')?.value.trim() || '';
    if (token && phone && acc) {
      await chrome.storage.local.set({ sltToken: token, sltPhone: phone, sltAcc: acc });
      setupBox.style.display = 'none';
      fetchMySLTData(token, phone, acc);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await chrome.storage.local.remove(['sltToken', 'sltPhone', 'sltAcc']);
      populateSetupInputs({});
      updateAccountBadge('', '');
      setupBox.style.display = 'block';
      totalBillEl.textContent = "Setup Required";
      if (billMetaEl) billMetaEl.style.display = 'none';
      if (summaryCard) summaryCard.style.display = 'none';
      usageContainer.innerHTML = `<p class="status-msg">Settings reset. Open <a href="https://myslt.slt.lk/" target="_blank" rel="noreferrer">myslt.slt.lk</a> to test auto-detect, or enter credentials above.</p>`;
    });
  }

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes.sltToken && !changes.sltPhone && !changes.sltAcc) return;

    try {
      const latest = await chrome.storage.local.get(['sltToken', 'sltPhone', 'sltAcc']);
      const activeId = document.activeElement?.id;
      const isEditingSetup = activeId === 'tokenInput' || activeId === 'phoneInput' || activeId === 'accInput';
      if (!isEditingSetup) {
        populateSetupInputs(latest);
      }

      if (latest.sltToken && latest.sltPhone && latest.sltAcc) {
        if (setupBox.style.display !== 'none' || totalBillEl.textContent === 'Setup Required') {
          setupBox.style.display = 'none';
          fetchMySLTData(latest.sltToken, latest.sltPhone, latest.sltAcc);
        }
      } else {
        updateAccountBadge(latest.sltAcc || '', latest.sltPhone || '');
      }
    } catch {
      // Ignore transient storage read failures
    }
  });

  try {
    const data = await chrome.storage.local.get(['sltToken', 'sltPhone', 'sltAcc']);

    if (!data.sltToken || !data.sltPhone || !data.sltAcc) {
      populateSetupInputs(data);
      setupBox.style.display = 'block';
      totalBillEl.textContent = "Setup Required";
      usageContainer.innerHTML = `<p class="status-msg">Open <a href="https://myslt.slt.lk/" target="_blank" rel="noreferrer">https://myslt.slt.lk/</a> and sign in to auto-detect your account, or enter your credentials above.</p>`;
    } else {
      fetchMySLTData(data.sltToken, data.sltPhone, data.sltAcc);
    }
  } catch (err) {
    totalBillEl.textContent = "Error";
    usageContainer.innerHTML = `<p class="status-msg">Error: ${escapeHtml(err.message)}</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup);
} else {
  initPopup();
}

async function fetchMySLTData(token, phone, acc) {
  const container = document.getElementById('usageContainer');
  const billEl = document.getElementById('totalBill');
  const billMetaEl = document.getElementById('billMeta');
  const setupBox = document.getElementById('setupBox');
  const summaryCard = document.getElementById('summaryCard');

  if (!container || !billEl) {
    console.error('Missing usageContainer or totalBill element in popup.html.');
    return;
  }

  const cleanToken = normalizeToken(token);
  const { subscriberID } = formatPhoneParams(phone);
  const cleanAcc = String(acc || '').trim();

  updateAccountBadge(cleanAcc, phone);
  billEl.textContent = "Fetching...";
  if (billMetaEl) billMetaEl.style.display = 'none';
  if (summaryCard) summaryCard.style.display = 'none';
  container.innerHTML = `<p class="status-msg">Connecting to MySLT server...</p>`;

  try {
    const { usageRes, extraRes, vasRes, billRes } = await fetchAllMySLTData(cleanToken, phone, cleanAcc);

    renderBillInfo(billRes, billEl, billMetaEl);

    const allPackages = collectPackages(usageRes, extraRes, vasRes);

    if (allPackages.length === 0) {
      if (summaryCard) summaryCard.style.display = 'none';
      const apiErrMsg = usageRes.data?.errorMessage || usageRes.data?.errorMessege || usageRes.data?.errorShow || usageRes.data?.message;
      if (usageRes.status === 401 || usageRes.status === 403) {
        if (setupBox) {
          populateSetupInputs({ sltToken: cleanToken, sltPhone: phone, sltAcc: cleanAcc });
          setupBox.style.display = 'block';
        }
        container.innerHTML = `<p class="status-msg">Token එක expire වී හෝ invalid වී ඇත (HTTP ${usageRes.status}). නව Token එකක් ඇතුළත් කරන්න.</p>`;
      } else if (!usageRes.ok) {
        const msg = usageRes.error || apiErrMsg || 'Unable to fetch usage data';
        container.innerHTML = `<p class="status-msg">API Error (${escapeHtml(usageRes.status || 'Network')}): ${escapeHtml(msg)}</p>`;
      } else if (usageRes.data?.isSuccess === false || apiErrMsg) {
        container.innerHTML = `<p class="status-msg">${escapeHtml(apiErrMsg || 'API returned no data')}</p>`;
      } else {
        container.innerHTML = `<p class="status-msg">දත්ත හමු නොවීය (${escapeHtml(subscriberID)}). Token එක expire වී තිබිය හැක.</p>`;
      }
      return;
    }

    if (summaryCard) {
      const totals = calculateTotals(allPackages);
      const bundle = usageRes.ok ? usageRes.data?.dataBundle : null;
      const pkgName = bundle?.my_package_info?.package_name || 'MySLT Usage';
      const status = bundle?.status ? ` • ${bundle.status}` : '';
      const reportedTime = bundle?.reported_time || bundle?.my_package_info?.reported_time || '';
      const limitLabel = totals.hasUnlimited
        ? (totals.totalLimitGB > 0 ? `${formatGb(totals.totalLimitGB)} + Unl.` : 'Unlimited')
        : formatGb(totals.totalLimitGB);

      summaryCard.innerHTML = `
        <div class="summary-top">
          <span class="summary-pkg">${escapeHtml(`${pkgName}${status}`)}</span>
          ${reportedTime ? `<span class="summary-meta">${escapeHtml(reportedTime)}</span>` : ''}
        </div>
        <div class="summary-grid">
          <div class="summary-stat">
            <span class="summary-stat-label">Total Used</span>
            <span class="summary-stat-value">${escapeHtml(formatGb(totals.totalUsedGB))}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Remaining</span>
            <span class="summary-stat-value">${escapeHtml(formatGb(totals.totalRemainingGB))}</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-label">Total Limit</span>
            <span class="summary-stat-value">${escapeHtml(limitLabel)}</span>
          </div>
        </div>
      `;
      summaryCard.style.display = 'block';
    }

    container.innerHTML = '';
    allPackages.forEach(pkg => {
      const card = document.createElement('div');
      card.className = 'usage-card';
      card.innerHTML = `
        <div class="usage-header">
          <div class="pkg-title-group">
            <span class="pkg-name">${escapeHtml(pkg.name)}</span>
            ${pkg.subLabel ? `<span class="pkg-sub">${escapeHtml(pkg.subLabel)}</span>` : ''}
          </div>
          ${pkg.validTill ? `<span class="valid-till">${escapeHtml(pkg.validTill)}</span>` : ''}
        </div>
        <div class="progress-bg">
          <div class="progress-fill ${pkg.isLow ? 'low' : ''}" style="width: ${pkg.isUnlimited ? 100 : pkg.percent}%;"></div>
        </div>
        <div class="usage-footer">
          <span>${escapeHtml(pkg.usedText)}</span>
          <span>${pkg.isUnlimited ? 'Unlimited' : `${pkg.percent}% Left`}</span>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    billEl.textContent = "Error";
    if (billMetaEl) billMetaEl.style.display = 'none';
    if (summaryCard) summaryCard.style.display = 'none';
    container.innerHTML = `<p class="status-msg">Error: ${escapeHtml(err.message)}</p>`;
  }
}
