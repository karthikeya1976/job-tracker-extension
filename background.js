// Background service worker
// When a possible application is detected, show a notification
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'applicationDetected') {
    // Store the pending application so popup can pre-fill it
    chrome.storage.session.set({ pendingApplication: message.data });

    // Show browser notification (optional — user must grant permission)
    // chrome.notifications.create({ type: 'basic', title: 'Application detected!', ... })
  }
});
