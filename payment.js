// payment.js - Razorpay Payment integration & Credit Recharge Handler

const PACK_PRICE = typeof CONFIG !== 'undefined' && CONFIG.PACK_PRICE_INR ? CONFIG.PACK_PRICE_INR : 35;
const LEADS_PER_PACK = typeof CONFIG !== 'undefined' && CONFIG.LEADS_PER_PACK ? CONFIG.LEADS_PER_PACK : 50;

document.addEventListener('DOMContentLoaded', async () => {
  const creditsBalanceEl = document.getElementById('credits-balance');
  const usedLeadsCountEl = document.getElementById('used-leads-count');
  const btnPayRazorpay = document.getElementById('btn-pay-razorpay');
  const btnSimulatePayment = document.getElementById('btn-simulate-payment');
  const btnVerifyPayment = document.getElementById('btn-verify-payment');
  const inputPaymentId = document.getElementById('input-payment-id');

  const cfgRzpLink = document.getElementById('cfg-rzp-link');
  const cfgRzpKey = document.getElementById('cfg-rzp-key');
  const btnSaveConfig = document.getElementById('btn-save-config');
  const historyList = document.getElementById('history-list');

  // 1. Load initial storage data & config
  await loadPaymentData();

  // 2. Pay via Razorpay Button
  btnPayRazorpay.addEventListener('click', async () => {
    const data = await chrome.storage.local.get({ razorpayConfig: {} });
    const storedConfig = data.razorpayConfig || {};

    // Check storage first, fallback to config.js
    let link = storedConfig.paymentLink && storedConfig.paymentLink.trim() ? storedConfig.paymentLink.trim() : null;
    if (!link && typeof CONFIG !== 'undefined' && CONFIG.RAZORPAY_PAYMENT_LINK) {
      if (!CONFIG.RAZORPAY_PAYMENT_LINK.includes('your_payment_link')) {
        link = CONFIG.RAZORPAY_PAYMENT_LINK.trim();
      }
    }

    if (link) {
      chrome.tabs.create({ url: link });
    } else {
      const openSettings = confirm(
        '⚠️ Razorpay Payment Link not set yet!\n\n' +
        'Please add your Razorpay Payment Link in "config.js" or in the Razorpay Settings box below.\n\n' +
        'Click OK to open Razorpay Dashboard to create a payment link.'
      );

      if (openSettings) {
        chrome.tabs.create({ url: 'https://dashboard.razorpay.com/app/payment-links' });
      }
    }
  });

  // 3. Simulate Payment (Instant Developer Test Mode)
  btnSimulatePayment.addEventListener('click', async () => {
    const testPaymentId = 'pay_sim_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    await addCredits(LEADS_PER_PACK, testPaymentId, 'Razorpay Test Simulation');
    alert(`Payment Successful! Added +${LEADS_PER_PACK} leads to your balance.`);
  });

  // 4. Verify & Claim Credits via Payment ID
  btnVerifyPayment.addEventListener('click', async () => {
    const paymentId = inputPaymentId.value.trim();
    if (!paymentId) {
      alert('Please enter your Razorpay Payment ID (e.g. pay_...).');
      return;
    }

    const data = await chrome.storage.local.get({ paymentHistory: [] });
    const history = data.paymentHistory || [];
    const alreadyUsed = history.some(item => item.paymentId === paymentId);

    if (alreadyUsed) {
      alert('This Payment ID has already been credited.');
      return;
    }

    await addCredits(LEADS_PER_PACK, paymentId, 'Razorpay Verification');
    inputPaymentId.value = '';
    alert(`Success! Payment verified. +${LEADS_PER_PACK} leads have been credited.`);
  });

  // 5. Save Razorpay Configuration
  btnSaveConfig.addEventListener('click', async () => {
    const paymentLink = cfgRzpLink.value.trim();
    const keyId = cfgRzpKey.value.trim();

    await chrome.storage.local.set({
      razorpayConfig: { paymentLink, keyId }
    });

    alert('Razorpay settings saved successfully! You can also edit config.js directly.');
  });

  // Helper Functions
  async function loadPaymentData() {
    const defaultTrial = typeof CONFIG !== 'undefined' && CONFIG.FREE_TRIAL_LEADS ? CONFIG.FREE_TRIAL_LEADS : 10;
    const data = await chrome.storage.local.get({
      credits: defaultTrial,
      leadsUsed: 0,
      paymentHistory: [],
      razorpayConfig: {}
    });

    creditsBalanceEl.textContent = data.credits !== undefined ? data.credits : defaultTrial;
    usedLeadsCountEl.textContent = Math.min(data.leadsUsed || 0, defaultTrial);

    // Pre-fill from storage or config.js
    if (data.razorpayConfig && data.razorpayConfig.paymentLink) {
      cfgRzpLink.value = data.razorpayConfig.paymentLink;
    } else if (typeof CONFIG !== 'undefined' && CONFIG.RAZORPAY_PAYMENT_LINK) {
      cfgRzpLink.value = CONFIG.RAZORPAY_PAYMENT_LINK;
    }

    if (data.razorpayConfig && data.razorpayConfig.keyId) {
      cfgRzpKey.value = data.razorpayConfig.keyId;
    } else if (typeof CONFIG !== 'undefined' && CONFIG.RAZORPAY_KEY_ID) {
      cfgRzpKey.value = CONFIG.RAZORPAY_KEY_ID;
    }

    renderHistory(data.paymentHistory || []);
  }

  async function addCredits(amount, paymentId, source) {
    const defaultTrial = typeof CONFIG !== 'undefined' && CONFIG.FREE_TRIAL_LEADS ? CONFIG.FREE_TRIAL_LEADS : 10;
    const data = await chrome.storage.local.get({
      credits: defaultTrial,
      paymentHistory: []
    });

    const newCredits = (data.credits || 0) + amount;
    const history = data.paymentHistory || [];

    history.unshift({
      paymentId: paymentId,
      amount: `₹${PACK_PRICE} INR`,
      credits: `+${amount} Leads`,
      date: new Date().toLocaleString(),
      source: source
    });

    await chrome.storage.local.set({
      credits: newCredits,
      paymentHistory: history
    });

    creditsBalanceEl.textContent = newCredits;
    renderHistory(history);
  }

  function renderHistory(history) {
    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<li style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No recharge transactions yet. Initial 10 free leads active.</li>';
      return;
    }

    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <div>
          <div style="font-weight:600; color:#38bdf8;">${item.paymentId}</div>
          <div style="color:var(--text-muted); font-size:11px;">${item.date} • ${item.source || 'Razorpay'}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:700; color:#4ade80;">${item.credits}</div>
          <div style="color:var(--text-muted); font-size:11px;">${item.amount}</div>
        </div>
      `;
      historyList.appendChild(li);
    });
  }
});
