// Google Maps / Google My Business Lead Scraper Content Script with Credit & Payment Check

let isScraping = false;
let shouldStop = false;
let scrapedCount = 0;
let floatingBadge = null;
let currentCredits = typeof CONFIG !== 'undefined' && CONFIG.FREE_TRIAL_LEADS ? CONFIG.FREE_TRIAL_LEADS : 10;

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start_scraping') {
    if (!isScraping) {
      startScraping();
      sendResponse({ status: 'started' });
    } else {
      sendResponse({ status: 'already_running' });
    }
    return true;
  } else if (request.action === 'stop_scraping') {
    shouldStop = true;
    isScraping = false;
    updateBadge('Stopped', false);
    sendResponse({ status: 'stopped' });
    return true;
  } else if (request.action === 'get_status') {
    sendResponse({ isScraping, scrapedCount, credits: currentCredits });
    return true;
  }
});

// Create or update on-screen status badge with live credit counter
function createFloatingBadge() {
  if (document.getElementById('gmb-scraper-badge')) return;

  floatingBadge = document.createElement('div');
  floatingBadge.id = 'gmb-scraper-badge';
  floatingBadge.style.cssText = `
    position: fixed;
    top: 75px;
    right: 20px;
    z-index: 999999;
    background: #1e293b;
    color: #ffffff;
    padding: 12px 18px;
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s ease;
    border: 1px solid #334155;
  `;

  floatingBadge.innerHTML = `
    <div style="width: 10px; height: 10px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite;" id="gmb-badge-dot"></div>
    <div>
      <div style="font-weight: 700; font-size: 13px;" id="gmb-badge-title">GMB Scraper Active</div>
      <div style="color: #94a3b8; font-size: 11px;" id="gmb-badge-subtitle">
        Extracted: <strong id="gmb-badge-count" style="color:#38bdf8;">0</strong> leads •
        Credits: <strong id="gmb-badge-credits" style="color:#4ade80;">10</strong> left
      </div>
    </div>
    <div style="display:flex; gap:6px; margin-left: 6px;">
      <button id="gmb-badge-recharge" style="background: #2563eb; border: none; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;">Recharge ₹35</button>
      <button id="gmb-badge-stop" style="background: #ef4444; border: none; color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: 600;">Stop</button>
    </div>
  `;

  document.body.appendChild(floatingBadge);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }
  `;
  document.head.appendChild(style);

  document.getElementById('gmb-badge-stop').addEventListener('click', () => {
    shouldStop = true;
    isScraping = false;
    updateBadge('Extraction Stopped', false);
    chrome.runtime.sendMessage({ action: 'scraping_stopped', count: scrapedCount });
  });

  document.getElementById('gmb-badge-recharge').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_payment' });
  });
}

function updateBadge(title, isRunning = true) {
  const titleEl = document.getElementById('gmb-badge-title');
  const countEl = document.getElementById('gmb-badge-count');
  const creditsEl = document.getElementById('gmb-badge-credits');
  const dotEl = document.getElementById('gmb-badge-dot');

  if (titleEl) titleEl.innerText = title;
  if (countEl) countEl.innerText = scrapedCount;
  if (creditsEl) creditsEl.innerText = currentCredits;
  if (dotEl) {
    dotEl.style.background = isRunning ? '#22c55e' : (currentCredits <= 0 ? '#ef4444' : '#f59e0b');
    dotEl.style.animation = isRunning ? 'pulse 1.5s infinite' : 'none';
  }
}

// Find scrollable container for Google Maps search results
function getFeedContainer() {
  let feed = document.querySelector('div[role="feed"]');
  if (feed) return feed;

  feed = document.querySelector('div[aria-label*="Results for" i], div[aria-label*="Resultados" i]');
  if (feed) return feed;

  const candidates = document.querySelectorAll('div.m6QErb.DxyBCb.kA9KIf.dS8AEf.ecceSd, div.m6QErb[aria-label]');
  for (const c of candidates) {
    if (c.scrollHeight > 500 && c.querySelectorAll('a.hfpxzc, div.Nv2PK').length > 0) {
      return c;
    }
  }

  const placeLink = document.querySelector('a.hfpxzc');
  if (placeLink) {
    let parent = placeLink.parentElement;
    while (parent && parent !== document.body) {
      if (parent.scrollHeight > parent.clientHeight && parent.clientHeight > 300) {
        return parent;
      }
      parent = parent.parentElement;
    }
  }

  return null;
}

// Extract lead information from a DOM card element
function parseBusinessCard(card) {
  try {
    const linkEl = card.querySelector('a.hfpxzc');
    const nameEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall, [role="heading"]');
    const name = linkEl?.getAttribute('aria-label') || nameEl?.textContent?.trim() || '';

    if (!name) return null;

    const mapsUrl = linkEl?.href || '';

    const ratingEl = card.querySelector('.MW4etd, span[aria-label*="stars" i], span[aria-label*="étoiles" i]');
    const rating = ratingEl?.textContent?.trim() || '';

    const reviewsEl = card.querySelector('.UY7F9, span[aria-label*="reviews" i], span[aria-label*="avis" i]');
    let reviews = reviewsEl?.textContent?.trim() || '';
    reviews = reviews.replace(/[()]/g, '');

    let website = '';
    const websiteEl = card.querySelector('a[data-value="Website"], a[aria-label*="Website" i], a[aria-label*="Site web" i], a.lcr4fd');
    if (websiteEl && websiteEl.href && !websiteEl.href.includes('google.com/maps')) {
      website = websiteEl.href;
    }

    let category = '';
    let address = '';
    let phone = '';

    const textLines = card.querySelectorAll('.W4Efsd');
    const allTextBlocks = [];
    textLines.forEach(line => {
      const spans = line.querySelectorAll('span');
      spans.forEach(s => {
        const txt = s.textContent.trim();
        if (txt && !txt.includes('·') && txt.length > 1) {
          allTextBlocks.push(txt);
        }
      });
    });

    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}/;
    for (const block of allTextBlocks) {
      if (!phone && phoneRegex.test(block) && block.replace(/\D/g, '').length >= 7) {
        phone = block.match(phoneRegex)[0].trim();
      }
    }

    if (textLines.length > 0) {
      const firstLineSpans = textLines[0].querySelectorAll('span');
      if (firstLineSpans.length > 0) {
        const potentialCat = firstLineSpans[0].textContent.trim();
        if (potentialCat && !potentialCat.match(/^\d/) && potentialCat !== rating) {
          category = potentialCat;
        }
      }
    }

    for (const block of allTextBlocks) {
      if (block !== name && block !== category && block !== phone && !block.includes('Open') && !block.includes('Closed') && !block.includes('hours') && block.length > 4) {
        if (!address) {
          address = block;
        }
      }
    }

    if (website && website.includes('google.com/url?')) {
      try {
        const urlParams = new URL(website).searchParams;
        website = urlParams.get('q') || website;
      } catch (e) {}
    }

    return {
      name,
      business: name,
      category,
      rating,
      reviews,
      phone,
      website,
      url: website || mapsUrl,
      mapsUrl,
      address,
      status: 'Pending',
      extractedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error parsing card:', err);
    return null;
  }
}

// Main Scraping Loop with Credit Check
async function startScraping() {
  // 1. Verify credits before starting
  const defaultTrial = typeof CONFIG !== 'undefined' && CONFIG.FREE_TRIAL_LEADS ? CONFIG.FREE_TRIAL_LEADS : 10;
  const creditData = await new Promise(res => chrome.storage.local.get({ credits: defaultTrial, leadsUsed: 0 }, res));
  currentCredits = creditData.credits !== undefined ? creditData.credits : defaultTrial;

  if (currentCredits <= 0) {
    createFloatingBadge();
    updateBadge('Limit Reached (₹35 for more)', false);
    const wantRecharge = confirm(
      '⚠️ Free limit reached (10 leads trial used).\n\n' +
      'To extract more leads, please recharge for ₹35 INR via Razorpay (+50 leads).\n\n' +
      'Open Razorpay Recharge page now?'
    );
    if (wantRecharge) {
      chrome.runtime.sendMessage({ action: 'open_payment' });
    }
    return;
  }

  isScraping = true;
  shouldStop = false;
  createFloatingBadge();
  updateBadge('Scraping in progress...', true);

  const feed = getFeedContainer();
  if (!feed) {
    alert('Google Maps results container not found! Please search for a business category first (e.g., "plumbers in Chicago") on Google Maps.');
    isScraping = false;
    updateBadge('Error: Feed not found', false);
    return;
  }

  // Load existing leads to avoid duplicates
  const storageData = await new Promise(res => chrome.storage.local.get({ leads: [] }, res));
  const existingLeads = storageData.leads || [];
  const knownKeys = new Set(
    existingLeads.map(l => (l.mapsUrl || (l.name + l.address)).toLowerCase())
  );

  scrapedCount = existingLeads.length;
  updateBadge(`Extracting...`, true);

  let unchangedScrollCount = 0;
  let lastScrollTop = -1;

  while (isScraping && !shouldStop) {
    const cards = feed.querySelectorAll('div.Nv2PK, div[role="article"]');
    let newlyAdded = 0;

    for (const card of cards) {
      if (shouldStop) break;

      // Check remaining credits
      if (currentCredits <= 0) {
        isScraping = false;
        updateBadge('Limit Reached (₹35 for more)', false);
        chrome.runtime.sendMessage({ action: 'credits_exhausted' }).catch(() => {});
        alert('⚠️ Credit limit reached! You have used all available lead credits. Please recharge for ₹35 INR via Razorpay to continue extracting.');
        break;
      }

      const lead = parseBusinessCard(card);
      if (lead && lead.name) {
        const key = (lead.mapsUrl || (lead.name + lead.address)).toLowerCase();
        if (!knownKeys.has(key)) {
          knownKeys.add(key);
          existingLeads.push(lead);
          newlyAdded++;
          currentCredits--;
          scrapedCount = existingLeads.length;

          updateBadge(`Extracting...`, true);
          chrome.runtime.sendMessage({
            action: 'lead_extracted',
            totalCount: scrapedCount,
            creditsRemaining: currentCredits,
            lead: lead
          }).catch(() => {});
        }
      }
    }

    // Save batch to storage and update credits
    if (newlyAdded > 0) {
      await new Promise(res => chrome.storage.local.set({
        leads: existingLeads,
        credits: currentCredits,
        leadsUsed: (creditData.leadsUsed || 0) + newlyAdded
      }, res));
    }

    if (currentCredits <= 0) {
      break;
    }

    // Check if reached end of feed
    const endOfListMsg = document.querySelector('.HlvSq, [aria-label*="end of this list" i]');
    const endText = feed.innerText.includes("You've reached the end of the list") ||
                    feed.innerText.includes("You've reached the end of the results");

    if (endOfListMsg || endText) {
      updateBadge(`Complete! (${scrapedCount} leads)`, false);
      chrome.runtime.sendMessage({ action: 'scraping_finished', count: scrapedCount }).catch(() => {});
      break;
    }

    // Scroll down to load more results
    const currentScroll = feed.scrollTop;
    feed.scrollTop = feed.scrollHeight;

    await new Promise(r => setTimeout(r, 1500));

    if (feed.scrollTop === currentScroll || feed.scrollTop === lastScrollTop) {
      unchangedScrollCount++;
      feed.scrollTop -= 150;
      await new Promise(r => setTimeout(r, 400));
      feed.scrollTop = feed.scrollHeight;

      if (unchangedScrollCount >= 4) {
        updateBadge(`Done (${scrapedCount} leads)`, false);
        chrome.runtime.sendMessage({ action: 'scraping_finished', count: scrapedCount }).catch(() => {});
        break;
      }
    } else {
      unchangedScrollCount = 0;
    }

    lastScrollTop = feed.scrollTop;
  }

  isScraping = false;
  if (currentCredits <= 0) {
    updateBadge(`Limit Reached (₹35 for more)`, false);
  } else {
    updateBadge(`Finished (${scrapedCount} leads)`, false);
  }
}
