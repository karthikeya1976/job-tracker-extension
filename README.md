# Job Tracker

A Chrome extension that automatically detects and logs job applications, syncs status updates from Gmail using AI classification, and surfaces crowdsourced company responsiveness ratings — all without leaving your browser.

---

## Features

### Chrome Extension
- **Auto-detection** — content scripts extract company name and role from LinkedIn, Greenhouse, Lever, Workday, and Indeed job pages automatically
- **One-click logging** — bookmark a job for later or mark it as applied with a single click
- **Company ratings** — live A–F grade shown in the popup as you type a company name, based on how quickly that company responds to applicants
- **Dashboard** — full table of all applications with search, status filter, sort, and color-coded status badges
- **Status management** — update application status inline (saved → applied → assessment → interview → offer → rejected)
- **Stale detection** — applications stuck at "applied" for more than 14 days are highlighted amber
- **Gmail sync** — authenticates with your Google account and fetches job-related emails; AI classifies each email and auto-updates the matching application status
- **CSV export** — download all applications as a spreadsheet in one click
- **Privacy-first** — company names are SHA-256 hashed before leaving your browser; the server never sees raw names

### Backend API
- **Ratings engine** — Node.js + Express + SQLite service that aggregates opt-in application outcomes into a weighted score (response rate, ghosting rate, interview rate, average days to respond)
- **AI email classification** — `POST /api/classify` proxies email subject + snippet to Claude (Haiku) and returns a single intent label: `rejected`, `interview`, `assessment`, `acknowledged`, or `unknown`
- **Batch lookups** — `GET /api/companies/batch` fetches ratings for all companies in the dashboard in one request

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              Chrome Extension               │
│                                             │
│  content.js  ──►  background.js             │
│  (job page)       (service worker)          │
│                         │                  │
│  popup.js  ◄────────────┘                  │
│  (log app, show rating)                    │
│                                             │
│  dashboard.js  (view all, sync Gmail)       │
│  email.js      (Gmail OAuth + AI classify)  │
└────────────────────┬────────────────────────┘
                     │ HTTP (localhost:3000)
┌────────────────────▼────────────────────────┐
│              Backend (Node.js)              │
│                                             │
│  POST /api/events          (submit outcome) │
│  POST /api/classify        (AI via Claude)  │
│  GET  /api/companies/:id/rating             │
│  GET  /api/companies/batch                  │
│                                             │
│  SQLite  ◄──  better-sqlite3                │
│  Claude Haiku  ◄──  @anthropic-ai/sdk       │
└─────────────────────────────────────────────┘
```

---

## Project Structure

```
job-tracker-extension/
├── manifest.json        # MV3 extension config
├── content.js           # Job info extraction on job pages
├── background.js        # Service worker — stores pending applications
├── popup.html/js        # Extension popup (log + bookmark)
├── dashboard.html/js    # Full application dashboard
├── dashboard.css        # Dashboard styles
├── email.js             # Gmail OAuth + email sync + AI classification
└── backend/
    ├── server.js         # Express entry point (port 3000)
    ├── db.js             # SQLite setup
    ├── routes/
    │   └── companies.js  # All API routes incl. /classify
    └── utils/
        └── normalize.js  # Company name normalization + hashing
```

---

## Setup

### Prerequisites
- Node.js 18+
- Chrome browser
- An [Anthropic API key](https://console.anthropic.com/) (for AI email classification)
- A Google Cloud project with Gmail API enabled (for Gmail sync)

### 1. Backend

```bash
cd backend
npm install
ANTHROPIC_API_KEY=your_key_here node server.js
```

The API will be available at `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/health
# {"ok":true}
```

### 2. Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the root `job-tracker-extension/` folder
4. The Job Tracker icon will appear in your toolbar

### 3. Gmail Sync (optional)

Gmail sync requires your own Google Cloud OAuth credentials:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable the **Gmail API**
3. OAuth consent screen → External → add scope `gmail.readonly`
4. Credentials → OAuth 2.0 Client ID → **Chrome Extension** → paste your extension ID
5. Copy the client ID into `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/gmail.readonly"]
   }
   ```
6. Reload the extension

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/events` | Submit an application outcome (opt-in crowdsourcing) |
| `POST` | `/api/classify` | Classify an email with AI → returns `{ label }` |
| `GET` | `/api/companies/:id/rating` | Rating for one hashed company ID |
| `GET` | `/api/companies/batch?ids=a,b,c` | Batch ratings (max 50) |
| `GET` | `/health` | Health check |

### Company ID

Company names are normalized (lowercased, punctuation stripped, common suffixes removed) then SHA-256 hashed. The first 16 hex characters form the ID. This means the server never stores or receives raw company names.

```
"Infineon Technologies Inc" → "infineon" → a3f9c1b2e4d87650
```

### Rating Formula

Ratings are only calculated when a company has ≥ 15 events older than 30 days:

```
score = responseRate×0.40 + (1−ghostingRate)×0.30 + interviewRate×0.20 + daysScore×0.10
grade = A (≥4.5) | B (≥3.5) | C (≥2.5) | D (≥1.5) | F
```

---

## Supported Job Sites

| Site | Auto-fill | Apply detection |
|------|-----------|-----------------|
| LinkedIn | ✓ | ✓ |
| Greenhouse | ✓ | ✓ |
| Lever | ✓ | ✓ |
| Workday | ✓ | ✓ |
| Indeed | ✓ | ✓ |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension | Chrome MV3, Vanilla JS, Web Crypto API |
| Backend | Node.js, Express 5, better-sqlite3 |
| AI | Claude Haiku (`@anthropic-ai/sdk`) |
| Auth | Google OAuth 2.0 via `chrome.identity` |
| Storage | `chrome.storage.local` (extension), SQLite (backend) |

---

## Privacy

- Company names are hashed client-side before any network request
- Gmail tokens are never sent to the backend — classification only receives email subject and snippet
- Crowdsourced data submission is opt-in (unchecked by default)
- No user accounts, no tracking, no analytics
