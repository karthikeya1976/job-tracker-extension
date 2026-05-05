const API_BASE = 'http://localhost:3000/api';

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
  A: { color: '#15803d', label: 'Usually responds quickly' },
  B: { color: '#1d4ed8', label: 'Generally responsive' },
  C: { color: '#a16207', label: 'Mixed response history' },
  D: { color: '#c2410c', label: 'Slow to respond' },
  F: { color: '#b91c1c', label: 'Frequently ghosts applicants' },
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
      el.style.display = 'none'; // server offline — silently skip
    }
  }, 600);
}

// ─── Opt-in state ─────────────────────────────────────────────────────────────
let currentTabUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab.url || '';

  // Restore opt-in preference
  const { contributeData } = await chrome.storage.local.get('contributeData');
  document.getElementById('contribute').checked = !!contributeData;

  // Pre-fill from auto-detected application
  const { pendingApplication } = await chrome.storage.session.get('pendingApplication');
  if (pendingApplication) {
    if (pendingApplication.role) document.getElementById('role').value = pendingApplication.role;
    if (pendingApplication.company) {
      document.getElementById('company').value = pendingApplication.company;
      onCompanyInput(pendingApplication.company);
    }
    await chrome.storage.session.remove('pendingApplication');
  }

  // Ask content script to extract job info from the page
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobInfo' });
    if (response?.role) document.getElementById('role').value = response.role;
    if (response?.company) {
      document.getElementById('company').value = response.company;
      onCompanyInput(response.company);
    }
  } catch {
    document.getElementById('not-job-page').style.display = 'block';
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

  const appliedAt = Date.now();
  const application = {
    id: appliedAt.toString(),
    company, role,
    appliedAt: new Date(appliedAt).toISOString(),
    status,
    url: currentTabUrl
  };

  const { applications = [] } = await chrome.storage.local.get('applications');
  applications.push(application);
  await chrome.storage.local.set({ applications });

  // Fire-and-forget event submission — never blocks the save
  const { contributeData } = await chrome.storage.local.get('contributeData');
  if (contributeData) {
    submitEvent(company, appliedAt).catch(() => {});
  }

  const statusEl = document.getElementById('status');
  statusEl.textContent = status === 'saved' ? 'Bookmarked!' : 'Marked as Applied!';
  statusEl.style.color  = status === 'saved' ? '#6b7280' : 'green';
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
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
