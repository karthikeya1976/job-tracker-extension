const API_BASE = 'http://localhost:3001/api';

// ─── Company name normalization (mirrors backend/utils/normalize.js) ───────────
const STRIP_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'co',
  'technologies', 'technology', 'services', 'solutions',
  'consulting', 'group', 'company', 'the', 'and'
]);

function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !STRIP_SUFFIXES.has(w))
    .join(' ')
    .trim();
}

async function hashCompanyName(name) {
  const normalized = normalizeCompanyName(name);
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// ─── Rating display ────────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: '#34d399', label: 'Usually responds quickly' },
  B: { color: '#60a5fa', label: 'Generally responsive' },
  C: { color: '#fbbf24', label: 'Mixed response history' },
  D: { color: '#f97316', label: 'Slow to respond' },
  F: { color: '#f87171', label: 'Frequently ghosts applicants' },
};

function showRating(data) {
  const el = document.getElementById('company-rating');
  if (!data || !data.grade || data.grade === '?' || !data.score) {
    el.style.display = 'none';
    return;
  }
  const config = GRADE_CONFIG[data.grade];
  el.style.display = 'block';
  el.innerHTML = `
    <span class="rating-grade" style="color:${config.color}">★ ${data.grade}</span>
    <span class="rating-detail">${Math.round(data.responseRate * 100)}% respond · ${data.avgDays}d avg</span>
    <span class="rating-label">${config.label}</span>
  `;
}

let ratingTimer;
function onCompanyInput(value) {
  clearTimeout(ratingTimer);
  const el = document.getElementById('company-rating');
  if (value.length < 3) { el.style.display = 'none'; return; }

  ratingTimer = setTimeout(async () => {
    try {
      const id = await hashCompanyName(value);
      const res = await fetch(`${API_BASE}/companies/${id}/rating`);
      showRating(await res.json());
    } catch {
      el.style.display = 'none';
    }
  }, 600);
}

// ─── Fill popup fields from extracted job info ────────────────────────────────
function fillFields(info) {
  if (!info?.role && !info?.company) return false;
  if (info.role)    document.getElementById('role').value    = info.role;
  if (info.company) {
    document.getElementById('company').value = info.company;
    onCompanyInput(info.company);
  }
  return !!(info.role || info.company);
}

// ─── Inline extractor — passed to scripting.executeScript (no outer scope) ───
// Must be a self-contained function: no closures, no imports.
function extractJobInfoInline() {
  const info = { role: '', company: '' };

  // JSON-LD (works on most job boards)
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw  = JSON.parse(el.textContent);
      const data = Array.isArray(raw) ? raw.find(i => i['@type'] === 'JobPosting') : raw;
      if (data?.['@type'] === 'JobPosting') {
        info.role    = data.title || '';
        info.company = data.hiringOrganization?.name || '';
        if (info.role) { clean(); return info; }
      }
    } catch {}
  }

  const h = window.location.hostname;

  if (h.includes('linkedin.com')) {
    info.role =
      document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.innerText ||
      document.querySelector('.jobs-unified-top-card__job-title h1')?.innerText ||
      document.querySelector('h1.t-24')?.innerText ||
      document.querySelector('h1[class*="job-title"]')?.innerText || '';
    info.company =
      document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText ||
      document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText ||
      document.querySelector('.jobs-unified-top-card__company-name a')?.innerText ||
      document.querySelector('a[class*="company-name"]')?.innerText || '';
  } else if (h.includes('indeed.com')) {
    info.role =
      document.querySelector('h1[data-testid="jobsearch-JobInfoHeader-title"]')?.innerText ||
      document.querySelector('[class*="jobTitle"] h1')?.innerText || '';
    info.company =
      document.querySelector('[data-company-name]')?.dataset.companyName ||
      document.querySelector('[class*="companyName"]')?.innerText || '';
  } else if (h.includes('greenhouse.io')) {
    info.role    = document.querySelector('#header h1')?.innerText || '';
    info.company = document.querySelector('.company-name')?.innerText || '';
  } else if (h.includes('lever.co')) {
    info.role    = document.querySelector('.posting-headline h2')?.innerText || document.querySelector('h2')?.innerText || '';
    info.company = document.querySelector('.main-header-text .large-category-label')?.innerText || '';
  } else if (h.includes('workday') || h.includes('myworkdayjobs')) {
    info.role    = document.querySelector('[data-automation-id="jobPostingHeader"]')?.innerText || '';
    info.company = document.querySelector('[data-automation-id="company"]')?.innerText || '';
  } else if (h.includes('smartrecruiters.com')) {
    info.role    = document.querySelector('h1.job-title')?.innerText || '';
    info.company = document.querySelector('.company-name')?.innerText || '';
  }

  // Generic fallback
  if (!info.role) info.role = document.querySelector('h1')?.innerText?.trim() || '';

  function clean() {
    info.role    = (info.role    || '').replace(/\s+/g, ' ').trim().substring(0, 100);
    info.company = (info.company || '').replace(/\s+/g, ' ').trim().substring(0, 100);
  }
  clean();
  return info;
}

// ─── App count in header ───────────────────────────────────────────────────────
async function loadAppCount(sessionToken) {
  try {
    const res = await fetch(`${API_BASE}/applications`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    if (!res.ok) return;
    const apps = await res.json();
    const countEl = document.getElementById('app-count');
    if (countEl) {
      countEl.textContent = `${apps.length} application${apps.length !== 1 ? 's' : ''}`;
    }
  } catch {
    // server offline — silently skip
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
let currentTabUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard
  const { sessionToken } = await chrome.storage.local.get('sessionToken');
  if (!sessionToken) {
    chrome.tabs.create({ url: chrome.runtime.getURL('auth.html') });
    window.close();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab.url || '';

  loadAppCount(sessionToken);

  const { contributeData } = await chrome.storage.local.get('contributeData');
  document.getElementById('contribute').checked = !!contributeData;

  // Pre-fill from auto-detected application (background stored it on Apply click)
  const { pendingApplication } = await chrome.storage.session.get('pendingApplication');
  if (pendingApplication) {
    if (pendingApplication.role)    document.getElementById('role').value    = pendingApplication.role;
    if (pendingApplication.company) {
      document.getElementById('company').value = pendingApplication.company;
      onCompanyInput(pendingApplication.company);
    }
    await chrome.storage.session.remove('pendingApplication');
  }

  // Ask content script for job info; fall back to executeScript on unsupported pages
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobInfo' });
    fillFields(response);
  } catch {
    // Content script not loaded on this domain — inject extraction inline
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobInfoInline,
      });
      const filled = fillFields(result);
      if (!filled) document.getElementById('not-job-page').style.display = 'block';
    } catch {
      document.getElementById('not-job-page').style.display = 'block';
    }
  }
});

document.getElementById('company').addEventListener('input', e => onCompanyInput(e.target.value));

document.getElementById('contribute').addEventListener('change', async e => {
  await chrome.storage.local.set({ contributeData: e.target.checked });
});

// ─── Save logic ────────────────────────────────────────────────────────────────
async function saveApplication(status) {
  const company = document.getElementById('company').value.trim();
  const role    = document.getElementById('role').value.trim();
  if (!company || !role) { alert('Please fill in both fields'); return; }

  const appliedAt   = Date.now();
  const application = {
    id: appliedAt.toString(),
    company, role,
    appliedAt: new Date(appliedAt).toISOString(),
    status,
    url: currentTabUrl
  };

  const { sessionToken } = await chrome.storage.local.get('sessionToken');
  try {
    const res = await fetch(`${API_BASE}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify(application)
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  } catch (err) {
    alert('Could not save — make sure the backend is running.');
    console.error(err);
    return;
  }

  const { contributeData } = await chrome.storage.local.get('contributeData');
  if (contributeData) {
    submitEvent(company, appliedAt).catch(() => {});
  }

  // Update the badge in the background worker
  chrome.runtime.sendMessage({ action: 'updateBadge' }).catch(() => {});

  const statusEl = document.getElementById('status');
  if (status === 'saved') {
    statusEl.textContent = 'Bookmarked!';
    statusEl.className   = 'bookmarked';
  } else {
    statusEl.textContent = 'Marked as Applied!';
    statusEl.className   = 'success';
  }
  statusEl.style.display = 'block';
  setTimeout(() => window.close(), 1000);
}

async function submitEvent(companyName, appliedAt) {
  await fetch(`${API_BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName,
      appliedAt: Math.floor(appliedAt / 1000),
      outcome: 'pending'
    })
  });
}

document.getElementById('bookmark').addEventListener('click', () => saveApplication('saved'));
document.getElementById('applied').addEventListener('click',  () => saveApplication('applied'));
document.getElementById('view-all').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173/dashboard' });
});
