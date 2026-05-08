// ── Job info extractor — runs as injected content script ─────────────────────

function extractJobInfo() {
  const info = { role: '', company: '' };

  // STRATEGY 1: JSON-LD structured data (most reliable — works on many boards)
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw  = JSON.parse(el.textContent);
      const data = Array.isArray(raw)
        ? raw.find(i => i['@type'] === 'JobPosting')
        : raw;
      if (data?.['@type'] === 'JobPosting') {
        info.role    = data.title || '';
        info.company = data.hiringOrganization?.name || '';
        if (info.role) { return clean(info); }
      }
    } catch {}
  }

  // STRATEGY 2: Site-specific selectors
  const h = window.location.hostname;

  if (h.includes('linkedin.com')) {
    info.role =
      document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.innerText ||
      document.querySelector('.jobs-unified-top-card__job-title h1')?.innerText ||
      document.querySelector('h1.t-24')?.innerText ||
      document.querySelector('h1[class*="job-title"]')?.innerText ||
      '';
    info.company =
      document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText ||
      document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText ||
      document.querySelector('.jobs-unified-top-card__company-name a')?.innerText ||
      document.querySelector('.topcard__org-name-link')?.innerText ||
      document.querySelector('a[class*="company-name"]')?.innerText ||
      '';
  }
  else if (h.includes('indeed.com')) {
    info.role =
      document.querySelector('h1.jobsearch-JobInfoHeader-title')?.innerText ||
      document.querySelector('[class*="jobTitle"] h1')?.innerText ||
      document.querySelector('h1[data-testid="jobsearch-JobInfoHeader-title"]')?.innerText ||
      '';
    info.company =
      document.querySelector('[data-company-name]')?.dataset.companyName ||
      document.querySelector('[class*="companyName"] a')?.innerText ||
      document.querySelector('[class*="companyName"]')?.innerText ||
      '';
  }
  else if (h.includes('greenhouse.io')) {
    info.role    = document.querySelector('#header h1.app-title')?.innerText || document.querySelector('#header h1')?.innerText || '';
    info.company = document.querySelector('#header .company-name')?.innerText || document.querySelector('.company-name')?.innerText || '';
  }
  else if (h.includes('lever.co')) {
    info.role    = document.querySelector('.posting-headline h2')?.innerText || document.querySelector('h2')?.innerText || '';
    info.company = document.querySelector('.main-header-text .large-category-label')?.innerText || '';
  }
  else if (h.includes('workday') || h.includes('myworkdayjobs')) {
    info.role    = document.querySelector('[data-automation-id="jobPostingHeader"]')?.innerText || '';
    info.company = document.querySelector('[data-automation-id="company"]')?.innerText || '';
  }
  else if (h.includes('smartrecruiters.com')) {
    info.role    = document.querySelector('h1.job-title')?.innerText || '';
    info.company = document.querySelector('.company-name')?.innerText || '';
  }
  else if (h.includes('ashbyhq.com') || h.includes('jobs.ashby.io')) {
    info.role    = document.querySelector('h1')?.innerText || '';
    info.company = document.querySelector('[class*="company"]')?.innerText || '';
  }

  // STRATEGY 3: Generic fallback — biggest heading on the page
  if (!info.role) {
    info.role = document.querySelector('h1')?.innerText?.trim() || '';
  }

  return clean(info);
}

function clean(info) {
  info.role    = info.role.replace(/\s+/g, ' ').trim().substring(0, 100);
  info.company = info.company.replace(/\s+/g, ' ').trim().substring(0, 100);
  return info;
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getJobInfo') {
    sendResponse(extractJobInfo());
  }
  return true;
});

// ── Auto-detect Apply button clicks ──────────────────────────────────────────
function isApplyButton(el) {
  const text  = (el.innerText || '').toLowerCase();
  const aria  = (el.getAttribute('aria-label') || '').toLowerCase();
  const klass = (el.className || '').toLowerCase();
  const keywords = ['apply now', 'apply for', 'submit application', 'easy apply', 'quick apply', '1-click apply'];
  return keywords.some(k => text.includes(k) || aria.includes(k) || klass.includes('apply'));
}

document.addEventListener('click', (e) => {
  const target = e.target.closest('button, a, [role="button"]');
  if (target && isApplyButton(target)) {
    chrome.runtime.sendMessage({
      action: 'applicationDetected',
      data: { ...extractJobInfo(), url: window.location.href }
    });
  }
}, true);

// ── SPA URL change observer ───────────────────────────────────────────────────
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    if (/\/(application|apply)/.test(location.href)) {
      chrome.runtime.sendMessage({
        action: 'applicationDetected',
        data: { ...extractJobInfo(), url: location.href }
      });
    }
  }
}).observe(document.body, { subtree: true, childList: true });
