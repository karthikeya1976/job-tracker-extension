const API_BASE = 'http://localhost:3001/api';

// Update badge on install and every time the browser starts
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'applicationDetected') {
    chrome.storage.session.set({ pendingApplication: message.data });
  }
  if (message.action === 'updateBadge') {
    updateBadge();
  }
});

// Badge logic:
//   no apps at all  → "0"  (slate)
//   apps, no offers → ""   (hidden — nothing to highlight)
//   has offers      → offer count (green)
async function updateBadge() {
  try {
    const { sessionToken } = await chrome.storage.local.get('sessionToken');
    if (!sessionToken) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const res = await fetch(`${API_BASE}/applications`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    if (!res.ok) throw new Error('fetch failed');

    const apps   = await res.json();
    const offers = apps.filter(a => a.status === 'offer').length;

    if (apps.length === 0) {
      chrome.action.setBadgeText({ text: '0' });
      chrome.action.setBadgeBackgroundColor({ color: '#475569' });
    } else if (offers > 0) {
      chrome.action.setBadgeText({ text: String(offers) });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Backend offline — clear badge silently
    chrome.action.setBadgeText({ text: '' });
  }
}
