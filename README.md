<p align="center">
  <img src="icons/icon128.png" alt="MySLT Tracker Icon" width="96" height="96">
</p>

<h1 align="center">MySLT Tracker — V1.0.0</h1>

<p align="center">
  <strong>Version V1.0.0</strong> • Open-source Chrome Manifest V3 extension to monitor your SLT broadband data usage, add-ons, and billing details directly in your browser — with <strong>zero data collection</strong> and <strong>no external servers</strong>.
</p>

> [!IMPORTANT]
> **Notice & Feedback — Tested on SLT Fibre Only**
>
> This extension is currently tested on **SLT Fibre** connections only. If it works on **ADSL** or **4G**, or if you find any bugs or have feedback, please send a message!
>
> **[WhatsApp (+94 76 890 2513)](https://wa.me/94768902513)**

---

## Installation

### Method 1: Install from ZIP (Recommended for Chrome)
1. Download [`SLT_Tracker_V1.0.0.zip`](SLT_Tracker_V1.0.0.zip) from this repository and extract it to a permanent folder on your computer.
2. Open Chrome (or Brave / Edge) and go to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.

### Method 2: Install Using [`SLT_Tracker_V1.0.0.crx`](SLT_Tracker_V1.0.0.crx)
> **Important Note on Chrome Security:** Modern Chrome blocks installing `.crx` files downloaded outside the Chrome Web Store directly (`"CRX_REQUIRED_PROOF_MISSING"` or off-store restrictions). Use the extraction steps below if drag-and-drop is blocked.

#### Option A — Universal Method (Works in Chrome, Brave & Edge)
1. Download [`SLT_Tracker_V1.0.0.crx`](SLT_Tracker_V1.0.0.crx) (or [`SLT_Tracker_V1.0.0.zip`](SLT_Tracker_V1.0.0.zip)) from this repository.
2. Rename the file extension from `.crx` to `.zip` (for example, `SLT_Tracker_V1.0.0.crx` -> `SLT_Tracker_V1.0.0.zip`) and extract it into a folder.
3. If the extracted folder contains a `_metadata` folder, delete `_metadata`.
4. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the extracted folder.

#### Option B — Direct Drag-and-Drop (Works on browsers/builds that allow developer `.crx` install)
1. Download [`SLT_Tracker_V1.0.0.crx`](SLT_Tracker_V1.0.0.crx) to your computer first (do not click it directly inside the GitHub page).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Drag and drop `SLT_Tracker_V1.0.0.crx` from File Explorer onto the `chrome://extensions` page and click **Add extension** if prompted. (If blocked by Chrome, follow **Option A** above.)

### How to Pack / Convert This Extension to `.crx`
1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Pack extension**.
3. For **Extension root directory**, select the folder containing `manifest.json` (leave **Private key file** blank the first time).
4. Click **Pack extension** — Chrome generates both a `.crx` package and a `.pem` private key file.
5. **Never upload or commit the `.pem` key file to GitHub** (keep it private on your computer for future updates). Only share or attach the `.crx` file (for example, in **GitHub Releases**).

---

## Privacy & Chrome Web Store Pages

- **Zero Data Collection:** This extension never collects, logs, sells, or shares your personal information, tokens, or usage statistics.
- **100% Local Execution:** Your Bearer token, telephone number, and account number are stored strictly on your device using `chrome.storage.local`.
- **Direct API Requests Only:** Every network request goes directly from your browser to official SLT endpoints (`https://omniscapp.slt.lk/slt/ext/api/*`). There is no backend, proxy, analytics, or third-party tracking.
- **Fully Auditable:** Inspect every line of code in this repository before installing.

### Web Store Listing URLs (GitHub Pages `/docs`)
Enable **Settings -> Pages -> Branch: `main` -> Folder: `/docs`** in your GitHub repository to serve these static HTML pages live for the Chrome Web Store Developer Dashboard:

| Page | Source File | Live GitHub Pages URL |
| --- | --- | --- |
| **Extension Overview / Homepage** | [`docs/index.html`](docs/index.html) | `https://imeshsan2008.github.io/MySLT_Tracker/` |
| **Privacy Policy (Required for Web Store)** | [`docs/privacy.html`](docs/privacy.html) | `https://imeshsan2008.github.io/MySLT_Tracker/privacy.html` |
| **Support & FAQ** | [`docs/support.html`](docs/support.html) | `https://imeshsan2008.github.io/MySLT_Tracker/support.html` |

---

## Features

- **Auto-Detects Any SLT Package:** Dynamically detects whatever MySLT package your account is subscribed to along with every active quota bucket and add-on. *(Currently tested on **SLT Fibre** only — **ADSL** and **4G/LTE** testers welcome!)*
- **Unified Data Usage Totals:** Combines usage across your main package, Bonus Data, Free Data (`Mid Night Thriller`, `12AM - 7AM`), Extra GB bundles, and VAS Data bundles into **Total Used**, **Remaining** (labeled with which package holds the remaining GB), and **Total Limit** metrics (including `+ Unl.` when an unlimited bucket is active).
- **Billing & Next Bill Countdown:** Shows your outstanding balance / credit, last bill amount, payment due date, last payment details, and a **Next Bill** countdown to the 1st of the next cycle (`YYYY/MM/01`).
- **Popup & Full-Screen Dashboard:** View a compact summary from the browser toolbar popup or expand into a full-screen dashboard (`popup.html?fullscreen=1`) for a multi-column layout.
- **MySLT Portal Top Banner:** When browsing `https://myslt.slt.lk/`, displays a dismissible top summary bar with account info, total GB usage, per-package chips, bill summary, and quick **Copy Token**, refresh, and full-screen actions.
- **Auto-Capture, Manual Setup & Reset:** Automatically reads `slt_accessToken` and `selectedAcc` from browser `localStorage` (as well as active portal requests) when you visit `https://myslt.slt.lk/`, or lets you configure/reset credentials anytime in settings (`⚙`).
- **Automatic Number Formatting:** Accepts `0XXXXXXXXX`, `94XXXXXXXXX`, or 9-digit numbers and maps them between `telephoneNo` and `subscriberID` automatically.

---

## Usage

### Option 1: Automatic Capture via MySLT Portal (Recommended)
1. Open [https://myslt.slt.lk/](https://myslt.slt.lk/) and sign in to your SLT account.
2. The extension automatically reads `slt_accessToken` and `selectedAcc` from `localStorage` (and captures telephone/account info from portal requests), saves them locally to `chrome.storage.local`, and displays the top summary banner with a **Copy Token** button.
3. Afterwards, click the **MySLT Tracker** toolbar icon anytime to check your usage and bill without keeping the portal open.

### Option 2: Manual Setup
1. Click the **MySLT Tracker** extension icon (or click **⚙ Settings**).
2. Either click **Copy Token** on the `https://myslt.slt.lk/` top banner, or retrieve your credentials from browser Local Storage (see steps below).
3. Enter your **Bearer Token**, **Telephone No** (e.g., `0112345678` or `94112345678`), and **Account No** (e.g., `0012345678`), then click **Save & Connect**.
4. Use **Reset Settings** inside **⚙ Settings** anytime to clear saved credentials and re-test auto-detection.

#### How to Get Token, Telephone No & Account No from Local Storage
1. Open [https://myslt.slt.lk/](https://myslt.slt.lk/) and log in to your account.
2. Open Chrome DevTools (`F12` or `Ctrl+Shift+I`, or right-click -> **Inspect**).
3. Open the **Application** tab (click `>>` if it is collapsed).
4. In the left sidebar, expand **Local Storage** and select `https://myslt.slt.lk`.
5. Locate and copy your details:
   - **`slt_accessToken` (Bearer Token):** Copy this value without any `bearer ` prefix.
   - **`selectedAcc` (Account / Telephone No):** Check `selectedAcc` for your active account/telephone value (if it only shows one of them, copy the other from your MySLT portal dashboard or `omniscapp.slt.lk` query params in the **Network** tab).
   - **`x-ibm-client-id`:** Not needed — the extension already includes the required `X-IBM-Client-Id` header automatically in `slt_utils.js`.
   - **Tip (Console):** In DevTools **Console** on `https://myslt.slt.lk/`, running `Object.entries(localStorage)` displays all stored keys and values at once.

> **Security Warning:** Never share your Bearer token publicly or commit it to GitHub — treat it like a password.
>
> **Note:** When your MySLT Bearer token expires (`HTTP 401` / `403`), open `https://myslt.slt.lk/` briefly to refresh the captured token automatically, or paste a new token in settings.

---

## Permissions Explained

| Permission / Host | Purpose |
| --- | --- |
| `storage` | Saves your token, telephone number, and account number locally in `chrome.storage.local`. |
| `scripting` | Injects the portal banner scripts into already-open `https://myslt.slt.lk/*` tabs on install or browser startup. |
| `declarativeNetRequestWithHostAccess` | Applies `rules.json` to set required `Origin` and `Referer` headers on `https://omniscapp.slt.lk/slt/ext/api/` requests. |
| `https://omniscapp.slt.lk/*` | Allows direct read requests to SLT usage, Extra GB, VAS bundle, and billing APIs. |
| `https://myslt.slt.lk/*` | Allows auto-capturing session details and rendering the top usage banner on the MySLT web portal. |

---

## Project Structure

```text
.
├── README.md                # Documentation & installation guide
├── docs/                    # GitHub Pages site for Chrome Web Store URLs
│   ├── index.html           # Extension homepage / Web Store overview
│   ├── privacy.html         # Chrome Web Store Privacy Policy
│   ├── support.html         # Support, testing status & FAQ
│   ├── style.css            # Shared page stylesheet
│   └── assets/icon128.png   # Site icon asset
├── icons/
│   └── icon128.png          # Extension icon
├── SLT_Tracker_V1.0.0.crx   # Packed Chrome extension (.crx)
└── SLT_Tracker_V1.0.0.zip          # Source archive containing:
    ├── manifest.json   # Chrome Extension Manifest V3 configuration
    ├── background.js   # Service worker for tab script injection and background fetches
    ├── slt_utils.js    # Shared API client, phone normalization, bill parsing, and GB totals
    ├── popup.html      # Extension popup and full-screen dashboard markup
    ├── popup.js        # Popup & dashboard rendering, setup/reset form, and refresh logic
    ├── popup.css       # Popup and responsive full-screen styles
    ├── page_hook.js    # MAIN-world fetch/XHR/storage hook for auto-capturing MySLT session info
    ├── content.js      # Content script that renders the fixed Shadow DOM top bar on myslt.slt.lk
    ├── rules.json      # declarativeNetRequest header rules for omniscapp.slt.lk
    └── icons/          # Extension icons (16x16, 48x48, 128x128)
```

---

## Notice & Feedback

> **Tested on SLT Fibre Only**

This extension is currently tested on **SLT Fibre** connections only. If it works on **ADSL** or **4G**, or if you find any bugs or have feedback, please send a message!

- **WhatsApp:** **[WhatsApp (+94 76 890 2513)](https://wa.me/94768902513)**
- **GitHub:** Open an issue or pull request in this repository.

---

## Disclaimer

This is an independent, community-built open-source browser extension and is not affiliated with, endorsed by, or officially connected to Sri Lanka Telecom (SLT).

---

<p align="center">
  Developed by <a href="https://imeshsan2008.is-a.dev/">imeshsan2008</a>
</p>
