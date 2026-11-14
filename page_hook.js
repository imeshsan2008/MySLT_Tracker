(function () {
  if (window.__mysltHookInstalled) return;
  window.__mysltHookInstalled = true;

  const MSG_SOURCE = 'myslt-tracker-ext';
  const API_MARKER = 'omniscapp.slt.lk/slt/ext/api/';

  function identifyEndpoint(url) {
    const lower = String(url || '').toLowerCase();
    if (!lower.includes(API_MARKER)) return null;
    if (lower.includes('/bbvas/usagesummary')) return 'usageRes';
    if (lower.includes('/bbvas/extragb')) return 'extraRes';
    if (lower.includes('/bbvas/getdashboardvasbundles')) return 'vasRes';
    if (lower.includes('/accountomni/billpaymentrequest')) return 'billRes';
    return null;
  }

  function postToExtension(payload) {
    try {
      window.postMessage({ source: MSG_SOURCE, ...payload }, window.location.origin);
    } catch {
      // Ignore postMessage failures
    }
  }

  function extractAuthHeader(headersObj) {
    if (!headersObj) return '';
    if (typeof Headers !== 'undefined' && headersObj instanceof Headers) {
      return headersObj.get('authorization') || headersObj.get('Authorization') || '';
    }
    if (Array.isArray(headersObj)) {
      const pair = headersObj.find(([k]) => String(k).toLowerCase() === 'authorization');
      return pair ? pair[1] : '';
    }
    if (typeof headersObj === 'object') {
      for (const [k, v] of Object.entries(headersObj)) {
        if (String(k).toLowerCase() === 'authorization') return v;
      }
    }
    return '';
  }

  function captureRequestInfo(url, headersObj) {
    if (!url || !String(url).toLowerCase().includes(API_MARKER)) return;
    try {
      const parsed = new URL(url, window.location.origin);
      const rawAuth = String(extractAuthHeader(headersObj) || '').trim();
      const token = rawAuth ? rawAuth.replace(/^bearer\s+/i, '').trim() : '';
      const phone = parsed.searchParams.get('telephoneNo') || parsed.searchParams.get('subscriberID') || '';
      const acc = parsed.searchParams.get('accountNo') || '';

      if (token || phone || acc) {
        postToExtension({ type: 'CAPTURE_AUTH', token, phone, acc });
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  // Wrap fetch
  const origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      const headers = (init && init.headers) || (input && input.headers) || null;
      captureRequestInfo(url, headers);

      const response = await origFetch.apply(this, arguments);
      const endpoint = identifyEndpoint(url);
      if (endpoint && response && response.ok) {
        response.clone().json().then(data => {
          postToExtension({ type: 'CAPTURE_API', endpoint, status: response.status, data });
        }).catch(() => {});
      }
      return response;
    };
  }

  // Wrap XMLHttpRequest (used by Angular / Axios)
  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._mysltUrl = typeof url === 'string' ? url : String(url || '');
    this._mysltHeaders = {};
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this._mysltHeaders && name) {
      this._mysltHeaders[String(name).toLowerCase()] = value;
    }
    return origSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const url = this._mysltUrl;
    captureRequestInfo(url, this._mysltHeaders);

    const endpoint = identifyEndpoint(url);
    if (endpoint && !this._mysltListenerAttached) {
      this._mysltListenerAttached = true;
      this.addEventListener('load', () => {
        if (this.status >= 200 && this.status < 300) {
          try {
            const data = this.responseType === 'json'
              ? this.response
              : (this.responseText ? JSON.parse(this.responseText) : null);
            if (data) {
              postToExtension({ type: 'CAPTURE_API', endpoint, status: this.status, data });
            }
          } catch {
            // Ignore non-JSON responses
          }
        }
      });
    }

    return origSend.apply(this, arguments);
  };

  // Notify content script when MySLT updates localStorage keys in the same tab
  if (typeof Storage !== 'undefined' && typeof Storage.prototype.setItem === 'function') {
    const watchedKeys = new Set([
      'slt_accessToken', 'selectedAcc', 'access_token', 'accessToken',
      'telephoneNo', 'subscriberID', 'subscriberId', 'accountNo'
    ]);
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const result = origSetItem.apply(this, arguments);
      try {
        if (this === window.localStorage && watchedKeys.has(String(key))) {
          postToExtension({ type: 'CAPTURE_STORAGE', key: String(key) });
        }
      } catch {
        // Ignore storage inspection errors
      }
      return result;
    };
  }
})();
