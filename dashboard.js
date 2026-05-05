const STATUSES = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected'];

const STATUS_CLASSES = {
  saved:      'badge-saved',
  applied:    'badge-applied',
  interview:  'badge-interview',
  assessment: 'badge-assessment',
  offer:      'badge-offer',
  rejected:   'badge-rejected'
};

let allApplications = [];

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function updateStats(applications) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  document.getElementById('stat-total').textContent     = applications.length;
  document.getElementById('stat-saved').textContent     = applications.filter(a => a.status === 'saved').length;
  document.getElementById('stat-interview').textContent = applications.filter(a => a.status === 'interview').length;
  document.getElementById('stat-offer').textContent     = applications.filter(a => a.status === 'offer').length;
  document.getElementById('stat-rejected').textContent  = applications.filter(a => a.status === 'rejected').length;
  document.getElementById('stat-week').textContent      = applications.filter(a => new Date(a.appliedAt) >= oneWeekAgo).length;
}

// Derives a filtered+sorted subset from allApplications — never modifies allApplications
function getFiltered() {
  const search = document.getElementById('search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const order  = document.getElementById('sort-order').value;

  return [...allApplications]
    .filter(app => {
      const matchesSearch = app.company.toLowerCase().includes(search) ||
                            app.role.toLowerCase().includes(search);
      const matchesStatus = status === '' || app.status === status;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const diff = new Date(b.appliedAt) - new Date(a.appliedAt);
      return order === 'newest' ? diff : -diff;
    });
}

function isStale(app) {
  if (app.status !== 'applied') return false;
  const daysSince = (Date.now() - new Date(app.appliedAt)) / (1000 * 60 * 60 * 24);
  return daysSince > 14;
}

function renderTable(applications) {
  const tbody     = document.getElementById('app-body');
  const emptyState = document.getElementById('empty-state');
  const table     = document.getElementById('app-table');
  const countEl   = document.getElementById('total-count');

  countEl.textContent = `${applications.length} application${applications.length !== 1 ? 's' : ''}`;

  if (applications.length === 0) {
    emptyState.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  table.style.display = 'table';

  tbody.innerHTML = applications.map(app => `
    <tr data-id="${app.id}" class="${isStale(app) ? 'stale-row' : ''}">
      <td>
        ${app.company}
        ${isStale(app) ? '<span class="stale-badge">No response</span>' : ''}
        ${companyRatings[app._ratingId] ? `<span class="rating-chip">★ ${companyRatings[app._ratingId].grade}</span>` : ''}
      </td>
      <td>${app.role}</td>
      <td>${formatDate(app.appliedAt)}</td>
      <td>
        <select class="status-select ${STATUS_CLASSES[app.status] || 'badge-applied'}" data-id="${app.id}">
          ${STATUSES.map(s => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${app.url ? `<a href="${app.url}" target="_blank">View</a>` : '—'}</td>
      <td><button class="delete-btn" data-id="${app.id}">Delete</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', e => updateStatus(e.target.dataset.id, e.target.value));
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => deleteApplication(e.target.dataset.id));
  });
}

// Re-derives filtered view and re-renders — called on every filter/search change
function applyFilters() {
  renderTable(getFiltered());
}

async function updateStatus(id, newStatus) {
  allApplications = allApplications.map(app =>
    app.id === id ? { ...app, status: newStatus, updatedAt: new Date().toISOString() } : app
  );
  await chrome.storage.local.set({ applications: allApplications });
  updateStats(allApplications);

  const select = document.querySelector(`.status-select[data-id="${id}"]`);
  select.className = `status-select ${STATUS_CLASSES[newStatus] || 'badge-applied'}`;
}

async function deleteApplication(id) {
  if (!confirm('Delete this application?')) return;
  allApplications = allApplications.filter(app => app.id !== id);
  await chrome.storage.local.set({ applications: allApplications });
  updateStats(allApplications);
  document.querySelector(`tr[data-id="${id}"]`).remove();

  const countEl = document.getElementById('total-count');
  countEl.textContent = `${allApplications.length} application${allApplications.length !== 1 ? 's' : ''}`;

  if (allApplications.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('app-table').style.display = 'none';
  }
}

const API_BASE = 'http://localhost:3000/api';
const STRIP_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'co',
  'technologies', 'technology', 'services', 'solutions',
  'consulting', 'group', 'company', 'the', 'and'
]);

function normalizeCompanyName(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/).filter(w => w.length > 0 && !STRIP_SUFFIXES.has(w)).join(' ').trim();
}

async function hashCompanyName(name) {
  const data = new TextEncoder().encode(normalizeCompanyName(name));
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

// companyRatings maps company_id → { grade, score, responseRate, avgDays }
let companyRatings = {};

async function loadRatings(applications) {
  try {
    const ids = await Promise.all([...new Set(applications.map(a => a.company))]
      .map(async name => ({ name, id: await hashCompanyName(name) })));

    const idList = ids.map(x => x.id).join(',');
    const res    = await fetch(`${API_BASE}/companies/batch?ids=${idList}`);
    const data   = await res.json();

    companyRatings = Object.fromEntries(data.filter(r => r.score).map(r => [r.id, r]));
  } catch {
    companyRatings = {}; // server offline — silently skip
  }
}

async function loadApplications() {
  const { applications = [] } = await chrome.storage.local.get('applications');

  // Attach hashed company ID to each app so renderTable can look up ratings
  allApplications = await Promise.all(applications.map(async app => ({
    ...app,
    _ratingId: await hashCompanyName(app.company)
  })));

  await loadRatings(allApplications);
  updateStats(allApplications);
  renderTable(getFiltered());
}

// Wire up filter controls — each one just calls applyFilters()
function exportCSV() {
  const rows = [
    ['Company', 'Role', 'Date Applied', 'Status', 'URL'],
    ...allApplications.map(a => [
      a.company, a.role,
      new Date(a.appliedAt).toLocaleDateString(),
      a.status, a.url || ''
    ])
  ];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-applications-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('export-csv').addEventListener('click', exportCSV);
document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('filter-status').addEventListener('change', applyFilters);
document.getElementById('sort-order').addEventListener('change', applyFilters);
document.getElementById('sync-gmail').addEventListener('click', syncGmail);

loadApplications();
