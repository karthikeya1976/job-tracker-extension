// Gets a Gmail OAuth token using Chrome's identity API
async function getGmailToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

// Fetches emails from Gmail matching job application keywords
async function fetchJobEmails(token) {
  const query = encodeURIComponent(
    'subject:(application OR interview OR unfortunately OR "next steps" OR "thank you for applying") newer_than:90d'
  );

  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);

  const data = await res.json();
  if (!data.messages) return [];

  // Fetch full details for each message in parallel
  const emails = await Promise.all(
    data.messages.map(msg => fetchEmailDetail(token, msg.id))
  );

  return emails.filter(Boolean);
}

// Fetches subject, sender, and snippet for a single email
async function fetchEmailDetail(token, messageId) {
  const res = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const headers = data.payload.headers;

  return {
    id: messageId,
    subject: headers.find(h => h.name === 'Subject')?.value || '',
    from: headers.find(h => h.name === 'From')?.value || '',
    snippet: data.snippet || '',
    date: new Date(parseInt(data.internalDate)).toISOString()
  };
}

// Main export — called from dashboard when user clicks "Sync Gmail"
async function syncGmail() {
  const statusEl = document.getElementById('gmail-status');

  try {
    statusEl.textContent = 'Connecting to Gmail...';
    const token = await getGmailToken();

    statusEl.textContent = 'Fetching emails...';
    const emails = await fetchJobEmails(token);

    statusEl.textContent = `Fetched ${emails.length} emails. Classifying with AI...`;

    const { applications = [] } = await chrome.storage.local.get('applications');
    const result = matchEmailsToApplications(emails, applications);

    await chrome.storage.local.set({ applications: result.updated });
    statusEl.textContent = `Done — ${result.changedCount} application${result.changedCount !== 1 ? 's' : ''} updated.`;

    // Reload the table to reflect changes
    setTimeout(() => location.reload(), 1500);

  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

// Generic words that appear in many company names — skip these when matching
const SKIP_WORDS = new Set([
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'technologies', 'technology',
  'services', 'solutions', 'consulting', 'group', 'company', 'co', 'the'
]);

function getCompanyKeywords(companyName) {
  return companyName.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !SKIP_WORDS.has(word));
}

async function matchEmailsToApplications(emails, applications) {
  let changedCount = 0;

  const updated = await Promise.all(applications.map(async app => {
    const keywords = getCompanyKeywords(app.company);
    if (keywords.length === 0) return app;

    const match = emails.find(email => {
      const fromLower = email.from.toLowerCase();
      const subjectLower = email.subject.toLowerCase();
      return keywords.some(word =>
        fromLower.includes(word) || subjectLower.includes(word)
      );
    });

    if (!match) return app;

    const newStatus = await classifyEmail(match.subject, match.snippet);
    if (!newStatus || newStatus === app.status) return app;

    changedCount++;
    return { ...app, status: newStatus, updatedAt: match.date };
  }));

  return { updated, changedCount };
}

// Calls backend ML classification, falls back to regex when server is offline
async function classifyEmail(subject, snippet) {
  try {
    const res = await fetch('http://localhost:3000/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, snippet })
    });
    if (!res.ok) throw new Error(`classify ${res.status}`);
    const { label } = await res.json();
    // 'acknowledged' and 'unknown' don't map to a stored status
    if (label === 'rejected' || label === 'interview' || label === 'assessment') return label;
    return null;
  } catch {
    return classifyEmailFallback(subject, snippet);
  }
}

function classifyEmailFallback(subject, body) {
  const text = (subject + ' ' + body).toLowerCase();
  if (/unfortunately|not moving forward|other candidates|not selected|decided to move forward with other|position has been filled/.test(text))
    return 'rejected';
  if (/interview|schedule a call|speak with you|meet with|next steps|hiring manager/.test(text))
    return 'interview';
  if (/assessment|coding challenge|take-home|technical test|hacker ?rank|code ?signal/.test(text))
    return 'assessment';
  return null;
}
