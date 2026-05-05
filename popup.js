let currentTabUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab.url || '';

  // Pre-fill from auto-detected application
  const { pendingApplication } = await chrome.storage.session.get('pendingApplication');
  if (pendingApplication) {
    if (pendingApplication.role) document.getElementById('role').value = pendingApplication.role;
    if (pendingApplication.company) document.getElementById('company').value = pendingApplication.company;
    await chrome.storage.session.remove('pendingApplication');
  }

  // Ask content script to extract job info from the page
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobInfo' });
    if (response?.role) document.getElementById('role').value = response.role;
    if (response?.company) document.getElementById('company').value = response.company;
  } catch (e) {
    document.getElementById('not-job-page').style.display = 'block';
  }
});

async function saveApplication(status) {
  const company = document.getElementById('company').value.trim();
  const role = document.getElementById('role').value.trim();

  if (!company || !role) {
    alert('Please fill in both fields');
    return;
  }

  const application = {
    id: Date.now().toString(),
    company,
    role,
    appliedAt: new Date().toISOString(),
    status,
    url: currentTabUrl
  };

  const { applications = [] } = await chrome.storage.local.get('applications');
  applications.push(application);
  await chrome.storage.local.set({ applications });

  const statusEl = document.getElementById('status');
  statusEl.textContent = status === 'saved' ? 'Bookmarked!' : 'Marked as Applied!';
  statusEl.style.color = status === 'saved' ? '#6b7280' : 'green';
  statusEl.style.display = 'block';
  setTimeout(() => window.close(), 1000);
}

document.getElementById('bookmark').addEventListener('click', () => saveApplication('saved'));
document.getElementById('applied').addEventListener('click', () => saveApplication('applied'));

document.getElementById('view-all').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
