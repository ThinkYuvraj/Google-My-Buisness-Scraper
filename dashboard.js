// dashboard.js - Full-featured dashboard for Google My Business leads with selection and batch controls

let allLeads = [];
let filteredLeads = [];
const selectedKeys = new Set();

// Helper to uniquely identify a lead
function getLeadKey(lead) {
  return lead.mapsUrl || `${lead.business || lead.name}_${lead.phone || lead.address || ''}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statWebsites = document.getElementById('stat-websites');
  const statPhones = document.getElementById('stat-phones');
  const statApproved = document.getElementById('stat-approved');
  const statPending = document.getElementById('stat-pending');
  const statRejected = document.getElementById('stat-rejected');

  // Filter Elements
  const filterSearch = document.getElementById('filter-search');
  const filterStatus = document.getElementById('filter-status');
  const filterWebsite = document.getElementById('filter-website');
  const filterPhone = document.getElementById('filter-phone');

  // Table Elements
  const leadsTableBody = document.getElementById('leads-table-body');
  const emptyState = document.getElementById('empty-state');
  const thSelectAll = document.getElementById('th-select-all');

  // Selection Bar Elements
  const selectionBar = document.getElementById('selection-bar');
  const selectedCountEl = document.getElementById('selected-count');
  const btnSelectedNumEl = document.getElementById('btn-selected-num');
  const btnExportSelectedCsv = document.getElementById('btn-export-selected-csv');
  const btnApproveSelected = document.getElementById('btn-approve-selected');
  const btnRejectSelected = document.getElementById('btn-reject-selected');
  const btnDeselectAll = document.getElementById('btn-deselect-all');

  // Header Action Elements
  const btnApproveAll = document.getElementById('btn-approve-all');
  const btnRejectAll = document.getElementById('btn-reject-all');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnClearAll = document.getElementById('btn-clear-all');
  const btnScrapeEmails = document.getElementById('btn-scrape-emails');

  // 1. Initial Data Load
  await loadLeads();

  // 2. Storage Sync (Live updates while scraping in background)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.leads) {
      allLeads = changes.leads.newValue || [];
      applyFilters();
      updateStats();
    }
  });

  // 3. Filter Listeners
  filterSearch.addEventListener('input', applyFilters);
  filterStatus.addEventListener('change', applyFilters);
  filterWebsite.addEventListener('change', applyFilters);
  filterPhone.addEventListener('change', applyFilters);

  // 4. "Select All" Checkbox in Table Header
  thSelectAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    filteredLeads.forEach(lead => {
      const key = getLeadKey(lead);
      if (isChecked) {
        selectedKeys.add(key);
      } else {
        selectedKeys.delete(key);
      }
    });
    updateSelectionUI();
    renderTable(filteredLeads);
  });

  // 5. Bulk Selection Actions
  btnDeselectAll.addEventListener('click', () => {
    selectedKeys.clear();
    updateSelectionUI();
    renderTable(filteredLeads);
  });

  btnApproveSelected.addEventListener('click', async () => {
    if (selectedKeys.size === 0) return;
    allLeads.forEach(lead => {
      if (selectedKeys.has(getLeadKey(lead))) {
        lead.status = 'Approved';
      }
    });
    await chrome.storage.local.set({ leads: allLeads });
    renderTable(filteredLeads);
    updateStats();
  });

  btnRejectSelected.addEventListener('click', async () => {
    if (selectedKeys.size === 0) return;
    allLeads.forEach(lead => {
      if (selectedKeys.has(getLeadKey(lead))) {
        lead.status = 'Rejected';
      }
    });
    await chrome.storage.local.set({ leads: allLeads });
    renderTable(filteredLeads);
    updateStats();
  });

  btnExportSelectedCsv.addEventListener('click', () => {
    const selectedLeads = allLeads.filter(lead => selectedKeys.has(getLeadKey(lead)));
    if (selectedLeads.length === 0) {
      alert('No leads selected.');
      return;
    }
    exportToCSV(selectedLeads, `selected_leads_${selectedLeads.length}`);
  });

  // 6. Global Batch Actions: "Approve All" & "Reject All"
  btnApproveAll.addEventListener('click', async () => {
    const targetLeads = filteredLeads.length > 0 ? filteredLeads : allLeads;
    if (targetLeads.length === 0) {
      alert('No leads available to approve.');
      return;
    }

    if (confirm(`Approve all ${targetLeads.length} visible leads?`)) {
      const targetKeys = new Set(targetLeads.map(getLeadKey));
      allLeads.forEach(lead => {
        if (targetKeys.has(getLeadKey(lead))) {
          lead.status = 'Approved';
        }
      });
      await chrome.storage.local.set({ leads: allLeads });
      renderTable(filteredLeads);
      updateStats();
    }
  });

  btnRejectAll.addEventListener('click', async () => {
    const targetLeads = filteredLeads.length > 0 ? filteredLeads : allLeads;
    if (targetLeads.length === 0) {
      alert('No leads available to reject.');
      return;
    }

    if (confirm(`Reject all ${targetLeads.length} visible leads?`)) {
      const targetKeys = new Set(targetLeads.map(getLeadKey));
      allLeads.forEach(lead => {
        if (targetKeys.has(getLeadKey(lead))) {
          lead.status = 'Rejected';
        }
      });
      await chrome.storage.local.set({ leads: allLeads });
      renderTable(filteredLeads);
      updateStats();
    }
  });

  // 7. Export CSV (Smart export: if items are ticked, prompts or exports selected)
  btnExportCsv.addEventListener('click', () => {
    if (selectedKeys.size > 0) {
      const useSelected = confirm(`You have ${selectedKeys.size} leads selected with tick markers.\n\nClick OK to export only SELECTED leads, or Cancel to export ALL filtered leads.`);
      if (useSelected) {
        const selectedLeads = allLeads.filter(lead => selectedKeys.has(getLeadKey(lead)));
        exportToCSV(selectedLeads, `selected_leads_${selectedLeads.length}`);
        return;
      }
    }

    const dataToExport = filteredLeads.length > 0 ? filteredLeads : allLeads;
    if (dataToExport.length === 0) {
      alert('No leads to export.');
      return;
    }
    exportToCSV(dataToExport, 'leads_export');
  });

  // 8. Clear All Leads
  btnClearAll.addEventListener('click', async () => {
    if (allLeads.length === 0) {
      alert('Dashboard is already empty.');
      return;
    }

    if (confirm(`Are you sure you want to delete all ${allLeads.length} leads? This action cannot be undone.`)) {
      await chrome.storage.local.set({ leads: [] });
      allLeads = [];
      selectedKeys.clear();
      applyFilters();
      updateStats();
      updateSelectionUI();
    }
  });

  // 9. Batch Email Extraction
  btnScrapeEmails.addEventListener('click', async () => {
    const leadsWithWebsites = allLeads.filter(l => (l.website || (l.url && !l.url.includes('google.com/maps'))) && !l.email);

    if (leadsWithWebsites.length === 0) {
      alert('No new leads with websites need email extraction.');
      return;
    }

    const confirmScan = confirm(`Found ${leadsWithWebsites.length} leads with websites. Scan websites in background to find email addresses?`);
    if (!confirmScan) return;

    btnScrapeEmails.disabled = true;
    btnScrapeEmails.innerHTML = `<span>Scanning 0/${leadsWithWebsites.length}...</span>`;

    let foundCount = 0;
    for (let i = 0; i < leadsWithWebsites.length; i++) {
      const item = leadsWithWebsites[i];
      const targetUrl = item.website || item.url;

      btnScrapeEmails.innerHTML = `<span>Scanning ${i + 1}/${leadsWithWebsites.length}...</span>`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(targetUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'text/html,application/xhtml+xml' }
        });
        clearTimeout(timeoutId);

        const html = await res.text();
        const extractedEmail = findEmailInHtml(html);

        if (extractedEmail) {
          item.email = extractedEmail;
          foundCount++;
        }
      } catch (e) {
        // Failed or CORS blocked
      }

      if (i % 5 === 0 || i === leadsWithWebsites.length - 1) {
        await chrome.storage.local.set({ leads: allLeads });
        applyFilters();
      }
    }

    btnScrapeEmails.disabled = false;
    btnScrapeEmails.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      Extract Emails
    `;
    alert(`Email scan completed! Found ${foundCount} email address(es).`);
  });

  // Core Functions
  async function loadLeads() {
    const data = await chrome.storage.local.get({ leads: [] });
    allLeads = data.leads || [];
    applyFilters();
    updateStats();
  }

  function updateStats() {
    statTotal.textContent = allLeads.length;
    statWebsites.textContent = allLeads.filter(l => Boolean(l.website || (l.url && !l.url.includes('google.com/maps')))).length;
    statPhones.textContent = allLeads.filter(l => Boolean(l.phone)).length;
    statApproved.textContent = allLeads.filter(l => l.status === 'Approved').length;
    statPending.textContent = allLeads.filter(l => (l.status || 'Pending') === 'Pending').length;
    if (statRejected) {
      statRejected.textContent = allLeads.filter(l => l.status === 'Rejected').length;
    }
  }

  function updateSelectionUI() {
    const count = selectedKeys.size;
    if (count > 0) {
      selectionBar.style.display = 'flex';
      selectedCountEl.textContent = count;
      btnSelectedNumEl.textContent = count;
    } else {
      selectionBar.style.display = 'none';
    }

    // Update Header Checkbox state
    if (filteredLeads.length === 0) {
      thSelectAll.checked = false;
      thSelectAll.indeterminate = false;
    } else {
      const selectedVisibleCount = filteredLeads.filter(l => selectedKeys.has(getLeadKey(l))).length;
      if (selectedVisibleCount === filteredLeads.length) {
        thSelectAll.checked = true;
        thSelectAll.indeterminate = false;
      } else if (selectedVisibleCount > 0) {
        thSelectAll.checked = false;
        thSelectAll.indeterminate = true;
      } else {
        thSelectAll.checked = false;
        thSelectAll.indeterminate = false;
      }
    }
  }

  function applyFilters() {
    const query = filterSearch.value.trim().toLowerCase();
    const statusVal = filterStatus.value;
    const websiteVal = filterWebsite.value;
    const phoneVal = filterPhone.value;

    filteredLeads = allLeads.filter(lead => {
      // Search text match
      const name = (lead.business || lead.name || '').toLowerCase();
      const category = (lead.category || '').toLowerCase();
      const website = (lead.website || lead.url || '').toLowerCase();
      const phone = (lead.phone || '').toLowerCase();
      const address = (lead.address || '').toLowerCase();
      const email = (lead.email || '').toLowerCase();

      const matchesSearch = !query ||
        name.includes(query) ||
        category.includes(query) ||
        website.includes(query) ||
        phone.includes(query) ||
        address.includes(query) ||
        email.includes(query);

      // Status filter
      const leadStatus = lead.status || 'Pending';
      const matchesStatus = (statusVal === 'All') || (leadStatus === statusVal);

      // Website filter
      const hasWeb = Boolean(lead.website || (lead.url && !lead.url.includes('google.com/maps')));
      let matchesWebsite = true;
      if (websiteVal === 'HasWebsite') matchesWebsite = hasWeb;
      if (websiteVal === 'NoWebsite') matchesWebsite = !hasWeb;

      // Phone filter
      const hasPhone = Boolean(lead.phone);
      let matchesPhone = true;
      if (phoneVal === 'HasPhone') matchesPhone = hasPhone;
      if (phoneVal === 'NoPhone') matchesPhone = !hasPhone;

      return matchesSearch && matchesStatus && matchesWebsite && matchesPhone;
    });

    renderTable(filteredLeads);
    updateSelectionUI();
  }

  function renderTable(leads) {
    leadsTableBody.innerHTML = '';

    if (leads.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    leads.forEach((lead, index) => {
      const key = getLeadKey(lead);
      const isSelected = selectedKeys.has(key);

      const tr = document.createElement('tr');
      if (isSelected) {
        tr.classList.add('selected-row');
      }

      const websiteUrl = lead.website || (lead.url && !lead.url.includes('google.com/maps') ? lead.url : '');
      const displayUrl = websiteUrl ? formatDisplayUrl(websiteUrl) : '';
      const currentStatus = lead.status || 'Pending';

      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="custom-check lead-checkbox" data-key="${escapeHtml(key)}" ${isSelected ? 'checked' : ''}>
        </td>
        <td style="color: #64748b; font-weight: 600;">${index + 1}</td>
        <td>
          <div class="biz-name">
            ${escapeHtml(lead.business || lead.name || 'Unnamed Business')}
            <span class="biz-category">${escapeHtml(lead.category || 'Local Business')}</span>
          </div>
        </td>
        <td>
          ${lead.rating ? `
            <div class="rating-badge">
              ⭐ ${lead.rating}
              ${lead.reviews ? `<span class="reviews-count">(${lead.reviews})</span>` : ''}
            </div>
          ` : '<span style="color:#64748b;">-</span>'}
        </td>
        <td>
          ${websiteUrl ? `
            <a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer" class="link-website" title="${escapeHtml(websiteUrl)}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              ${escapeHtml(displayUrl)}
            </a>
          ` : '<span class="no-website">No website</span>'}
        </td>
        <td>
          ${lead.phone ? `
            <a href="tel:${escapeHtml(lead.phone)}" class="phone-text" style="color:#38bdf8; text-decoration:none;">
              ${escapeHtml(lead.phone)}
            </a>
          ` : '<span style="color:#64748b;">-</span>'}
        </td>
        <td style="max-width: 200px; color:#cbd5e1; font-size: 12px;">
          ${escapeHtml(lead.address || '-')}
        </td>
        <td>
          ${lead.email ? `
            <span class="email-text">
              <a href="mailto:${escapeHtml(lead.email)}" style="color:#a78bfa; text-decoration:none;">${escapeHtml(lead.email)}</a>
            </span>
          ` : '<span style="color:#64748b; font-size:12px;">-</span>'}
        </td>
        <td>
          <select class="status-select status-${currentStatus}">
            <option value="Approved" ${currentStatus === 'Approved' ? 'selected' : ''}>Approved</option>
            <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Rejected" ${currentStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            ${lead.mapsUrl ? `
              <a href="${escapeHtml(lead.mapsUrl)}" target="_blank" class="action-icon-btn" title="View on Google Maps">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </a>
            ` : ''}
            <button class="action-icon-btn delete" title="Delete Lead">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      `;

      // Tick checkbox event
      const chk = tr.querySelector('.lead-checkbox');
      chk.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedKeys.add(key);
          tr.classList.add('selected-row');
        } else {
          selectedKeys.delete(key);
          tr.classList.remove('selected-row');
        }
        updateSelectionUI();
      });

      // Status change event
      const selectEl = tr.querySelector('.status-select');
      selectEl.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        lead.status = newStatus;
        selectEl.className = `status-select status-${newStatus}`;
        await chrome.storage.local.set({ leads: allLeads });
        updateStats();
      });

      // Delete event
      const deleteBtn = tr.querySelector('.action-icon-btn.delete');
      deleteBtn.addEventListener('click', async () => {
        const leadIdx = allLeads.indexOf(lead);
        if (leadIdx > -1) {
          allLeads.splice(leadIdx, 1);
          selectedKeys.delete(key);
          await chrome.storage.local.set({ leads: allLeads });
          applyFilters();
          updateStats();
        }
      });

      leadsTableBody.appendChild(tr);
    });
  }

  function formatDisplayUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '') + (parsed.pathname !== '/' ? parsed.pathname.slice(0, 15) : '');
    } catch {
      return url.slice(0, 25);
    }
  }

  function findEmailInHtml(html) {
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (mailtoMatch && mailtoMatch[1]) {
      return mailtoMatch[1].toLowerCase();
    }

    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
    const matches = html.match(emailRegex);
    if (matches && matches.length > 0) {
      const valid = matches.find(m => !m.match(/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i));
      if (valid) return valid.toLowerCase();
    }
    return '';
  }

  function exportToCSV(leads, filenamePrefix = 'gmb_leads') {
    const headers = ['Business Name', 'Category', 'Rating', 'Reviews Count', 'Phone', 'Website', 'Address', 'Email', 'Status', 'Extracted At', 'Google Maps URL'];
    const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    const rows = leads.map(l => [
      escapeCsv(l.business || l.name),
      escapeCsv(l.category),
      escapeCsv(l.rating),
      escapeCsv(l.reviews),
      escapeCsv(l.phone),
      escapeCsv(l.website || (l.url && !l.url.includes('google.com/maps') ? l.url : '')),
      escapeCsv(l.address),
      escapeCsv(l.email),
      escapeCsv(l.status || 'Pending'),
      escapeCsv(l.extractedAt || l.timestamp),
      escapeCsv(l.mapsUrl || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
