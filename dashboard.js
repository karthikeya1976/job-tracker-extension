const STATUSES = ['applied', 'assessment', 'interview', 'offer', 'rejected'];

const STATUS_CLASSES = {
  applied:    'badge-applied',
  interview:  'badge-interview',
  assessment: 'badge-assessment',
  offer:      'badge-offer',
  rejected:   'badge-rejected'
};

// Keep the source-of-truth array in memory so we don't re-fetch on every action
let allApplications = [];

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
    <tr data-id="${app.id}">
      <td>${app.company}</td>
      <td>${app.role}</td>
      <td>${formatDate(app.appliedAt)}</td>
      <td>
        <select class="status-select ${STATUS_CLASSES[app.status] || 'badge-applied'}" data-id="${app.id}">
          ${STATUSES.map(s => `<option value="${s}" ${s === app.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>${app.url ? `<a href="${app.url}" target="_blank">View</a>` : '—'}</td>
      <td>
        <button class="delete-btn" data-id="${app.id}">Delete</button>
      </td>
    </tr>
  `).join('');

  // Attach status change listeners
  tbody.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', (e) => updateStatus(e.target.dataset.id, e.target.value));
  });

  // Attach delete listeners
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => deleteApplication(e.target.dataset.id));
  });
}

async function updateStatus(id, newStatus) {
  allApplications = allApplications.map(app =>
    app.id === id ? { ...app, status: newStatus, updatedAt: new Date().toISOString() } : app
  );
  await chrome.storage.local.set({ applications: allApplications });

  // Update just the select's CSS class without re-rendering the whole table
  const select = document.querySelector(`.status-select[data-id="${id}"]`);
  select.className = `status-select ${STATUS_CLASSES[newStatus] || 'badge-applied'}`;
}

async function deleteApplication(id) {
  if (!confirm('Delete this application?')) return;
  allApplications = allApplications.filter(app => app.id !== id);
  await chrome.storage.local.set({ applications: allApplications });

  // Remove the row from the DOM directly — no need to re-render everything
  document.querySelector(`tr[data-id="${id}"]`).remove();

  const countEl = document.getElementById('total-count');
  countEl.textContent = `${allApplications.length} application${allApplications.length !== 1 ? 's' : ''}`;

  if (allApplications.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('app-table').style.display = 'none';
  }
}

async function loadApplications() {
  const { applications = [] } = await chrome.storage.local.get('applications');
  allApplications = [...applications].sort(
    (a, b) => new Date(b.appliedAt) - new Date(a.appliedAt)
  );
  renderTable(allApplications);
}

loadApplications();
