const API = 'http://localhost:3001';

const btn       = document.getElementById('connect-btn');
const input     = document.getElementById('token-input');
const errEl     = document.getElementById('connect-error');
const successEl = document.getElementById('connect-success');

btn.dataset.label = 'Connect';

function setLoading(loading) {
  btn.disabled  = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span>' : btn.dataset.label;
}

function showError(msg) {
  errEl.textContent  = msg;
  errEl.hidden       = false;
  successEl.hidden   = true;
}

function showSuccess(msg) {
  successEl.textContent = msg;
  successEl.hidden      = false;
  errEl.hidden          = true;
}

btn.addEventListener('click', async () => {
  const token = input.value.trim();
  if (!token) { showError('Please paste your token first.'); return; }

  errEl.hidden = true;
  setLoading(true);

  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (!res.ok) { showError(data.error || 'Invalid token — please generate a new one.'); return; }

    await chrome.storage.local.set({ sessionToken: token, currentUser: data });
    showSuccess(`Connected as ${data.name}! Redirecting…`);
    setTimeout(() => { window.location.href = chrome.runtime.getURL('dashboard.html'); }, 800);
  } catch {
    showError('Cannot reach server. Make sure the Job Tracker backend is running on port 3001.');
  } finally {
    setLoading(false);
  }
});

// If already connected, skip straight to dashboard
(async () => {
  const { sessionToken } = await chrome.storage.local.get('sessionToken');
  if (!sessionToken) return;
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (res.ok) window.location.href = chrome.runtime.getURL('dashboard.html');
  } catch {
    // Server offline — stay on connect page
  }
})();
