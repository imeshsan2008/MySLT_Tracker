importScripts('slt_utils.js');

async function injectIntoOpenMySLTTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://myslt.slt.lk/*" });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['page_hook.js'],
          world: 'MAIN'
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['slt_utils.js', 'content.js']
        });
      } catch {
        // Ignore tabs that cannot be scripted
      }
    }
  } catch {
    // Ignore tab query errors
  }
}

chrome.runtime.onInstalled.addListener(() => injectIntoOpenMySLTTabs());

chrome.runtime.onStartup.addListener(() => injectIntoOpenMySLTTabs());

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === "fetchMySLTData") {
    handleFetchMySLTData(request)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (request?.action === "openDashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?fullscreen=1') })
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
async function handleFetchMySLTData(request) {
  const stored = await chrome.storage.local.get(['sltToken', 'sltPhone', 'sltAcc']);
  const token = request.token || stored.sltToken;
  const phone = request.phone || stored.sltPhone;
  const acc = request.acc ?? stored.sltAcc ?? '';

  if (!token || !phone) {
    throw new Error("Missing token or subscriber phone.");
  }

  return MySLTUtils.fetchAllMySLTData(token, phone, acc);
}
