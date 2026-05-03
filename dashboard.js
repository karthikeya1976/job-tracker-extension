const STATUS_CLASSES = {
  applied:    'badge-applied',
  interview:  'badge-interview',
  assessment: 'badge-assessment',
  offer:      'badge-offer',
  rejected:   'badge-rejected'
};

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function renderTable(applications) {
  const tbody = document.getElementById('app-body');
  const emptyState = document.getElementById('empty-state');
  const table = document.getElementById('app-table');
  const countEl = document.getElementById('total-count');

  countEl.textContent = `${applications.length} application${applications.length !== 1 ? 's' : ''}`;

  if (applications.length === 0) {
    emptyState.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  table.style.display = 'table';

  tbody.innerHTML = applications.map(app => `
    <tr>
      <td>${app.company}</td>
      <td>${app.role}</td>
      <td>${formatDate(app.appliedAt)}</td>
      <td>
        <span class="badge ${STATUS_CLASSES[app.status] || 'badge-applied'}">
          ${app.status}
        </span>
      </td>
      <td>${app.url ? `<a href="${app.url}" target="_blank">View</a>` : '—'}</td>
    </tr>
  `).join('');
}

async function loadApplications() {
  const { applications = [] } = await chrome.storage.local.get('applications');
  const sorted = [...applications].sort(
    (a, b) => new Date(b.appliedAt) - new Date(a.appliedAt)
  );
  renderTable(sorted);
}

loadApplications();
