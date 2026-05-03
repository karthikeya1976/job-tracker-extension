// When popup opens, ask content script for the job title
let currentTabUrl = '';

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl = tab.url || '';
  // Pre-fill from auto-detected application (if background script caught an Apply click)
const { pendingApplication } = await chrome.storage.session.get('pendingApplication');
if (pendingApplication) {
  if (pendingApplication.role) document.getElementById('role').value = pendingApplication.role;
  if (pendingApplication.company) document.getElementById('company').value = pendingApplication.company;
  await chrome.storage.session.remove('pendingApplication');
}


  // Ask content script to extract job title from the page
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobInfo' });
    if (response && response.role) {
      document.getElementById('role').value = response.role;
    }
    if (response && response.company) {
      document.getElementById('company').value = response.company;
    }
  } catch (e) {
    // Content script not on this page — that's fine
  }
});

document.getElementById('save').addEventListener('click', async () => {
  const company = document.getElementById('company').value.trim();
  const role = document.getElementById('role').value.trim();

  if (!company || !role) {
    alert('Please fill in both fields');
    return;
  }

  // Save to Chrome's local storage
  const application = {
    id: Date.now().toString(),      // Simple unique ID using timestamp
    company,
    role,
    appliedAt: new Date().toISOString(),
    status: 'applied',
    url: currentTabUrl
  };

  // Get existing applications, add new one
  const { applications = [] } = await chrome.storage.local.get('applications');
  applications.push(application);
  await chrome.storage.local.set({ applications });

  document.getElementById('status').style.display = 'block';
  setTimeout(() => window.close(), 1000);
  
});
document.getElementById('view-all').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

