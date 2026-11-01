// popup.js - Handles Popup UI, Scraping triggers, counters, and redirection to Dashboard

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const tabStatusText = document.getElementById('tab-status-text');
  const gmapsShortcut = document.getElementById('gmaps-shortcut');

  const countTotal = document.getElementById('count-total');
  const countWebsites = document.getElementById('count-websites');
  const countPhones = document.getElementById('count-phones');
  const countApproved = document.getElementById('count-approved');

  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnQuickExport = document.getElementById('btn-quick-export');
  const btnClearLeads = document.getElementById('btn-clear-leads');
  const instructionsBox = document.getElementById('instructions-box');

  let currentTab = null;

  // 1. Initial Data Load & Storage Updates
  await refreshStats();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.leads) {
      refreshStats();
    }
  });

  // 2. Check Active Tab Status
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (currentTab && currentTab.url && isGoogleMapsUrl(currentTab.url)) {
      statusDot.classList.add('active');
      statusDot.style.background = '#22c55e';
      tabStatusText.textContent = 'Google Maps detected';
      gmapsShortcut.innerHTML = '<span style="color:#22c55e; font-weight:600;">● Ready</span>';

      // Check if already scraping on this tab
      chrome.tabs.sendMessage(currentTab.id, { action: 'get_status' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded yet; will be injected when Start is clicked
          return;
        }
        if (response && response.isScraping) {
          setScrapingUIState(true);
        }
      });
    } else {
      statusDot.classList.remove('active');
      statusDot.style.background = '#f59e0b';
      tabStatusText.textContent = 'Not on Google Maps';
      gmapsShortcut.innerHTML = '<a href="#" id="link-open-maps" style="color:#38bdf8; text-decoration:underline; font-size:11px; font-weight:600;">Open Maps</a>';
      
      const linkOpenMaps = document.getElementById('link-open-maps');
      if (linkOpenMaps) {
        linkOpenMaps.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: 'https://www.google.com/maps' });
        });
      }
    }
  } catch (err) {
    console.error('Error querying tab:', err);
    tabStatusText.textContent = 'Ready';
  }

  // 3. Start Scraping Button
  btnStart.addEventListener('click', async () => {
    if (!currentTab || !isGoogleMapsUrl(currentTab.url)) {
      const confirmOpen = confirm('Please open Google Maps and search for a category (e.g. "Dentists in Dallas") first.\n\nOpen Google Maps now?');
      if (confirmOpen) {
        chrome.tabs.create({ url: 'https://www.google.com/maps' });
      }
      return;
    }

    setScrapingUIState(true);

    // Try sending message to content script
    try {
      chrome.tabs.sendMessage(currentTab.id, { action: 'start_scraping' }, async (response) => {
        if (chrome.runtime.lastError) {
          // If script wasn't injected yet, inject it manually
          try {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content.js']
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(currentTab.id, { action: 'start_scraping' });
            }, 300);
          } catch (scriptErr) {
            console.error('Failed to inject content script:', scriptErr);
            alert('Could not start scraping. Please refresh the Google Maps tab and try again.');
            setScrapingUIState(false);
          }
        }
      });
    } catch (e) {
      console.error(e);
      setScrapingUIState(false);
    }
  });

  // 4. Stop Scraping Button
  btnStop.addEventListener('click', () => {
    if (currentTab && currentTab.id) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'stop_scraping' }, () => {
        setScrapingUIState(false);
      });
    } else {
      setScrapingUIState(false);
    }
  });

  // 5. Open Dashboard Button (Redirect to Full Dashboard)
  btnOpenDashboard.addEventListener('click', () => {
    const dashboardUrl = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.create({ url: dashboardUrl });
  });

  // 6. Quick Export CSV Button
  btnQuickExport.addEventListener('click', async () => {
    const data = await chrome.storage.local.get({ leads: [] });
    const leads = data.leads || [];

    if (leads.length === 0) {
      alert('No leads to export! Extract some leads first.');
      return;
    }

    downloadLeadsCSV(leads);
  });

  // 7. Clear All Leads Button
  btnClearLeads.addEventListener('click', async () => {
    const data = await chrome.storage.local.get({ leads: [] });
    const count = (data.leads || []).length;

    if (count === 0) {
      alert('There are no leads to clear.');
      return;
    }

    if (confirm(`Are you sure you want to permanently delete all ${count} extracted leads?`)) {
      await chrome.storage.local.set({ leads: [] });
      await refreshStats();
    }
  });

  // 8. Listen for Live Progress Messages from Content Script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'lead_extracted') {
      if (message.totalCount !== undefined) {
        countTotal.textContent = message.totalCount;
      }
      refreshStats();
    } else if (message.action === 'scraping_finished' || message.action === 'scraping_stopped') {
      setScrapingUIState(false);
      refreshStats();
    }
  });

  // Helper Functions
  function isGoogleMapsUrl(url) {
    if (!url) return false;
    return url.includes('google.com/maps') || url.includes('maps.google.com');
  }

  function setScrapingUIState(isExtracting) {
    if (isExtracting) {
      btnStart.style.display = 'none';
      btnStop.style.display = 'flex';
      instructionsBox.innerHTML = '<span style="color:#22c55e; font-weight:600;">⚡ Scraping in progress...</span> Google Maps is auto-scrolling and extracting leads.';
    } else {
      btnStart.style.display = 'flex';
      btnStop.style.display = 'none';
      instructionsBox.innerHTML = '<strong>How to use:</strong> Open Google Maps, search for any business niche (e.g. <em>"Dentists in Miami"</em>), then click <strong>Auto-Extract All Leads</strong>.';
    }
  }

  async function refreshStats() {
    try {
      const data = await chrome.storage.local.get({ leads: [] });
      const leads = data.leads || [];

      countTotal.textContent = leads.length;
      countWebsites.textContent = leads.filter(l => Boolean(l.website || (l.url && !l.url.includes('google.com/maps')))).length;
      countPhones.textContent = leads.filter(l => Boolean(l.phone)).length;
      countApproved.textContent = leads.filter(l => l.status === 'Approved').length;
    } catch (err) {
      console.error('Error refreshing stats:', err);
    }
  }

  function downloadLeadsCSV(leads) {
    const headers = ['Business Name', 'Category', 'Rating', 'Reviews Count', 'Phone', 'Website', 'Address', 'Status', 'Extracted At', 'Google Maps URL'];
    
    const escapeCsv = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

    const rows = leads.map(l => [
      escapeCsv(l.business || l.name),
      escapeCsv(l.category),
      escapeCsv(l.rating),
      escapeCsv(l.reviews),
      escapeCsv(l.phone),
      escapeCsv(l.website || (l.url && !l.url.includes('google.com/maps') ? l.url : '')),
      escapeCsv(l.address),
      escapeCsv(l.status || 'Pending'),
      escapeCsv(l.extractedAt || l.timestamp),
      escapeCsv(l.mapsUrl || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gmb_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
});
