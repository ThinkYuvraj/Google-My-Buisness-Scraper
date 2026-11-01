// popup.js - Handles Popup UI, Scraping triggers, counters, batch approval, credits & Razorpay

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('status-dot');
  const tabStatusText = document.getElementById('tab-status-text');
  const gmapsShortcut = document.getElementById('gmaps-shortcut');

  const countTotal = document.getElementById('count-total');
  const countWebsites = document.getElementById('count-websites');
  const countApproved = document.getElementById('count-approved');
  const countRejected = document.getElementById('count-rejected');
  const countCredits = document.getElementById('count-credits');

  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const btnOpenRecharge = document.getElementById('btn-open-recharge');
  const btnQuickRecharge = document.getElementById('btn-quick-recharge');
  const btnPopupApproveAll = document.getElementById('btn-popup-approve-all');
  const btnPopupRejectAll = document.getElementById('btn-popup-reject-all');
  const btnQuickExport = document.getElementById('btn-quick-export');
  const btnClearLeads = document.getElementById('btn-clear-leads');
  const instructionsBox = document.getElementById('instructions-box');

  let currentTab = null;
  let availableCredits = typeof CONFIG !== 'undefined' && CONFIG.FREE_TRIAL_LEADS ? CONFIG.FREE_TRIAL_LEADS : 10;

  // 1. Initial Data Load & Storage Updates
  await refreshStats();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.leads || changes.credits)) {
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

      chrome.tabs.sendMessage(currentTab.id, { action: 'get_status' }, (response) => {
        if (chrome.runtime.lastError) {
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

  // 3. Start Scraping Button (Enforces 10 Free leads / Credit limit)
  btnStart.addEventListener('click', async () => {
    if (!currentTab || !isGoogleMapsUrl(currentTab.url)) {
      const confirmOpen = confirm('Please open Google Maps and search for a category (e.g. "Dentists in Dallas") first.\n\nOpen Google Maps now?');
      if (confirmOpen) {
        chrome.tabs.create({ url: 'https://www.google.com/maps' });
      }
      return;
    }

    if (availableCredits <= 0) {
      const wantPay = confirm(
        '⚠️ You have 0 credits remaining (10 free leads trial used).\n\n' +
        'Recharge credits for ₹35 INR to unlock +50 leads?\n\n' +
        'Click OK to open Razorpay payment page.'
      );
      if (wantPay) {
        chrome.tabs.create({ url: chrome.runtime.getURL('payment.html') });
      }
      return;
    }

    setScrapingUIState(true);

    try {
      chrome.tabs.sendMessage(currentTab.id, { action: 'start_scraping' }, async (response) => {
        if (chrome.runtime.lastError) {
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

  // 5. Open Dashboard Button
  btnOpenDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // 6. Open Recharge / Razorpay Payment
  if (btnOpenRecharge) {
    btnOpenRecharge.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('payment.html') });
    });
  }
  if (btnQuickRecharge) {
    btnQuickRecharge.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('payment.html') });
    });
  }

  // 7. Approve All Leads from Popup
  if (btnPopupApproveAll) {
    btnPopupApproveAll.addEventListener('click', async () => {
      const data = await chrome.storage.local.get({ leads: [] });
      const leads = data.leads || [];
      if (leads.length === 0) {
        alert('No leads to approve.');
        return;
      }

      leads.forEach(l => { l.status = 'Approved'; });
      await chrome.storage.local.set({ leads });
      await refreshStats();
    });
  }

  // 8. Reject All Leads from Popup
  if (btnPopupRejectAll) {
    btnPopupRejectAll.addEventListener('click', async () => {
      const data = await chrome.storage.local.get({ leads: [] });
      const leads = data.leads || [];
      if (leads.length === 0) {
        alert('No leads to reject.');
        return;
      }

      leads.forEach(l => { l.status = 'Rejected'; });
      await chrome.storage.local.set({ leads });
      await refreshStats();
    });
  }

  // 9. Quick Export CSV Button
  btnQuickExport.addEventListener('click', async () => {
    const data = await chrome.storage.local.get({ leads: [] });
    const leads = data.leads || [];

    if (leads.length === 0) {
      alert('No leads to export! Extract some leads first.');
      return;
    }

    downloadLeadsCSV(leads);
  });

  // 10. Clear All Leads Button
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

  // 11. Listen for Live Progress & Payment Open Requests
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'lead_extracted') {
      if (message.totalCount !== undefined) {
        countTotal.textContent = message.totalCount;
      }
      if (message.creditsRemaining !== undefined) {
        availableCredits = message.creditsRemaining;
        if (countCredits) countCredits.textContent = availableCredits;
      }
      refreshStats();
    } else if (message.action === 'scraping_finished' || message.action === 'scraping_stopped') {
      setScrapingUIState(false);
      refreshStats();
    } else if (message.action === 'credits_exhausted') {
      setScrapingUIState(false);
      refreshStats();
      chrome.tabs.create({ url: chrome.runtime.getURL('payment.html') });
    } else if (message.action === 'open_payment') {
      chrome.tabs.create({ url: chrome.runtime.getURL('payment.html') });
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
      const defaultTrial = typeof CONFIG !== 'undefined' && CONFIG.FREE_TRIAL_LEADS ? CONFIG.FREE_TRIAL_LEADS : 10;
      const data = await chrome.storage.local.get({
        leads: [],
        credits: defaultTrial
      });
      const leads = data.leads || [];
      availableCredits = data.credits !== undefined ? data.credits : defaultTrial;

      countTotal.textContent = leads.length;
      countWebsites.textContent = leads.filter(l => Boolean(l.website || (l.url && !l.url.includes('google.com/maps')))).length;
      countApproved.textContent = leads.filter(l => l.status === 'Approved').length;
      if (countRejected) {
        countRejected.textContent = leads.filter(l => l.status === 'Rejected').length;
      }
      if (countCredits) {
        countCredits.textContent = availableCredits;
        if (availableCredits <= 0) {
          countCredits.style.background = '#ef4444';
        } else {
          countCredits.style.background = '#2563eb';
        }
      }
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
