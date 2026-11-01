# Google My Business Lead Scraper & Manager (Chrome Extension)

An automated Chrome extension to extract leads directly from Google Maps / Google My Business search results, track metrics in real time, manage leads in a full-screen interactive dashboard, and handle paid recharges via **Razorpay**.

## 🚀 Features

- **Automated Lead Extraction**: Auto-scrolls Google Maps search results and extracts:
  - Business Name & Category
  - Star Rating & Total Review Count
  - Website URL (clean links without Google redirect parameters)
  - Phone Number
  - Physical Address
  - Direct Google Maps Link
- **Credits & Monetization System**:
  - **9 + 1 Free Leads Trial**: Every user starts with 10 free leads.
  - **₹35 INR Recharge**: After the 10 free leads, users recharge via **Razorpay** for ₹35 INR to unlock +50 leads.
  - Automatic credit enforcement: pauses scraping when credits hit 0 and notifies user.
  - Dedicated Payment Portal (`payment.html`) with Razorpay checkout, instant UPI, payment ID verification, and test mode simulation.
- **Floating Progress Counter**: Real-time on-page badge showing scraping status, remaining credits, and a quick recharge button.
- **Deduplication**: Automatically filters out duplicate businesses.
- **Selection & Tick Markers**:
  - Individual tick checkboxes for each lead row.
  - "Select All" checkbox in the table header.
  - Selected count badge and highlighted rows.
  - **Export Selected CSV**: Export only ticked leads directly to CSV.
- **Batch Approve & Reject Actions**:
  - **Approve All / Reject All**: One-click actions in both Dashboard and Popup.
  - **Approve Selected / Reject Selected**: Apply status in bulk to only ticked rows.
- **Dedicated Dashboard (`dashboard.html`)**:
  - Live KPI stats (Credits Remaining, Total Leads, Leads with Websites, Leads with Phone, Approved, Pending, Rejected).
  - Search & multi-parameter filter (Search query, Status filter, Website presence filter, Phone presence filter).
  - Inline status management (`Approved`, `Pending`, `Rejected`).
  - Batch Email Scanner: Visits extracted websites to find email addresses via `mailto:` links and regex pattern matching.
  - Export to CSV (Export Selected, Filtered, or All leads).
  - Clear leads database.

## 💳 Razorpay Setup & Payment Flow

1. **Free Tier**: Users can extract up to 10 leads (9 + 1 free) without paying.
2. **Recharge Flow**:
   - Click **Recharge (₹35 Razorpay)** in the popup, dashboard, or on-screen scraper badge.
   - You can configure your own **Razorpay Payment Link** in the settings section of `payment.html`.
   - Users can pay via UPI (Google Pay, PhonePe, Paytm), Cards, or NetBanking.
   - Enter the Razorpay Payment ID to verify, or use the **Instant Test Mode Simulation** button for rapid testing.

## 📦 Installation & Setup

1. Clone or download this repository.
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select this directory.
5. Pin the extension to your toolbar.

## 📖 How to Use

1. Go to [Google Maps](https://www.google.com/maps).
2. Search for any business niche and location (e.g., *"Dentists in Chicago"* or *"Real estate agents in Austin"*).
3. Click the extension icon in the toolbar.
4. Click **Auto-Extract All Leads**.
5. When finished, click **Check Extracted Websites (Dashboard)** to view, filter, select with tick markers, and export your leads to CSV.
