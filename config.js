// ==============================================================================
// 💳 RAZORPAY & PRICING CONFIGURATION
// ==============================================================================
// Add your Razorpay credentials and pricing settings here.
// Whenever you change these values, reload the extension in chrome://extensions.
// ==============================================================================

const CONFIG = {
  // 1. YOUR RAZORPAY PAYMENT LINK (Recommended & Easiest)
  // Go to: Razorpay Dashboard -> Payment Links -> Create Payment Link for ₹35
  // Example: "https://rzp.io/l/your_payment_link"
  RAZORPAY_PAYMENT_LINK: "https://rzp.io/l/your_payment_link",

  // 2. YOUR RAZORPAY KEY ID (Optional for Standard Checkout)
  // Go to: Razorpay Dashboard -> Settings -> API Keys -> Generate Key
  // Starts with "rzp_test_..." for testing or "rzp_live_..." for production
  RAZORPAY_KEY_ID: "rzp_test_YOUR_KEY_HERE",

  // 3. PRICING & CREDIT SETTINGS
  PACK_PRICE_INR: 35,          // Amount the user pays: ₹35 INR
  LEADS_PER_PACK: 50,          // Leads added to balance per ₹35 payment

  // 4. FREE TRIAL SETTINGS
  FREE_TRIAL_LEADS: 10,        // 9 + 1 free leads for every new user

  // 5. BUSINESS / BRAND DETAILS
  BUSINESS_NAME: "GMB Lead Extractor",
  BUSINESS_DESCRIPTION: "Unlock 50 Leads for ₹35 INR",
  SUPPORT_EMAIL: "support@example.com"
};

// Export for Node/CommonJS if used in build scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
