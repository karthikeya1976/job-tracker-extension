// Listens for messages from popup
// ============================================
// JOB INFO EXTRACTOR
// Tries multiple strategies in order of reliability
// ============================================

function extractJobInfo() {
  const info = { role: '', company: '' };

  // STRATEGY 1: JSON-LD structured data (most reliable)
  // Many job sites embed machine-readable data in script tags
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data['@type'] === 'JobPosting') {
        info.role = data.title || '';
        info.company = data.hiringOrganization?.name || '';
        if (info.role) return info; // Found it! Stop searching.
      }
    } catch (e) { /* Invalid JSON, skip */ }
  }

  // STRATEGY 2: Site-specific selectors
  const hostname = window.location.hostname;

  if (hostname.includes('linkedin.com')) {
    info.role = document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.innerText
             || document.querySelector('.jobs-unified-top-card__job-title h1')?.innerText
             || document.querySelector('h1.t-24')?.innerText
             || '';
    info.company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText
                || document.querySelector('.jobs-unified-top-card__company-name a')?.innerText
                || document.querySelector('.topcard__org-name-link')?.innerText
                || '';
  }
  else if (hostname.includes('greenhouse.io')) {
    info.role = document.querySelector('#header h1.app-title')?.innerText || '';
    info.company = document.querySelector('#header .company-name')?.innerText || '';
  }
  else if (hostname.includes('lever.co')) {
    info.role = document.querySelector('.posting-headline h2')?.innerText || '';
    info.company = document.querySelector('.main-header-text .large-category-label')?.innerText || '';
  }

  // STRATEGY 3: Generic fallback — look for the biggest heading
  if (!info.role) {
    info.role = document.querySelector('h1')?.innerText?.trim() || '';
  }

  // Clean up: remove newlines and extra spaces
  info.role = info.role.replace(/\s+/g, ' ').trim().substring(0, 100);
  info.company = info.company.replace(/\s+/g, ' ').trim().substring(0, 100);

  return info;
}

// Listen for popup asking for job info
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getJobInfo') {
    sendResponse(extractJobInfo());
  }
  return true;
});
// ============================================
// AUTO-DETECTION: Watch for Apply button clicks
// ============================================

function isApplyButton(element) {
  const text = element.innerText?.toLowerCase() || '';
  const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
  const classList = element.className?.toLowerCase() || '';

  const applyKeywords = ['apply now', 'apply for', 'submit application',
                          'easy apply', 'quick apply', '1-click apply'];

  return applyKeywords.some(keyword =>
    text.includes(keyword) || ariaLabel.includes(keyword) || classList.includes('apply')
  );
}

// Watch for clicks on apply buttons
document.addEventListener('click', (event) => {
  const target = event.target.closest('button, a, [role="button"]');
  if (target && isApplyButton(target)) {
    const jobInfo = extractJobInfo();
    // Notify background script that user may be applying
    chrome.runtime.sendMessage({
      action: 'applicationDetected',
      data: { ...jobInfo, url: window.location.href }
    });
  }
}, true); // 'true' = capture phase, catches events before they're processed

// Also watch for URL changes (Single Page Apps like LinkedIn change URL without reload)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    if (window.location.href.includes('/application') ||
        window.location.href.includes('/apply')) {
      const jobInfo = extractJobInfo();
      chrome.runtime.sendMessage({
        action: 'applicationDetected',
        data: { ...jobInfo, url: window.location.href }
      });
    }
  }
});
urlObserver.observe(document.body, { subtree: true, childList: true });
