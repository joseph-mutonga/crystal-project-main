# 💎 Crystal Crest — Luxury Beauty & Cosmetics Web Application

Crystal Crest is an end-to-end luxury beauty cosmetics and spa booking e-commerce platform built for both mobile and desktop experiences, featuring automated M-Pesa STK Push payments, in-store cashier POS, and an intelligent skincare AI consultant (**Cresti**).

---

## ✨ Features

- **📱 Mobile-First Responsive Design**:
  - Compact 2-column mobile product grid with instant wishlist overlay.
  - 100% zero horizontal scroll guarantee across 320px–428px viewports.
  - Persistent bottom mobile navigation (Shop, Spa, Cresti AI, Bag, Account).
  - Slide-over Cart & Private Wishlist drawers.

- **💳 Payments & M-Pesa Integration**:
  - Automated Safaricom M-Pesa STK Push with Daraja production gateway.
  - Direct Co-operative Bank PayBill integration (**Paybill: 400200**, **Account: 104514**) with instant SMS code verification.
  - Real-time payment polling, callbacks, and receipt generation.

- **🚚 Localized Delivery & Free Pickup**:
  - **Store Pickup**: FREE (KSh 0) at Crystal Crest Flagship Boutique (Opposite Crapas Hotel, Kajiado Town).
  - **Doorstep Delivery**: Flat KSh 100 delivery exclusively around Kajiado Town & environs.

- **🛍️ POS & Staff Portals**:
  - **Cashier Portal** (`/cashier/login.html`): Add products with live camera/file picture uploads, barcode/search catalog, instant POS checkout with receipt printing, and spa booking management.
  - **Admin Management Portal** (`/admin/dashboard.html`): Analytics, sales reports, inventory control, cashier management, customer records, and system settings.

- **🤖 Cresti AI Beauty Consultant**:
  - Built-in AI skincare & beauty formulation concierge powered by Google Gemini.

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MySQL](https://dev.mysql.com/downloads/) (v8.0+)

### 2. Installation
```bash
# Clone the repository
git clone <your-repository-url>
cd crystal-crest

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=crystal_crest
JWT_SECRET=your_jwt_secret_key

# Admin PIN change email (Gmail SMTP with an App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=admin@gmail.com
SMTP_PASS=your_google_app_password
SMTP_FROM="Crystal Crest <admin@gmail.com>"

# Payments
PAYMENTS_MODE=live
MPESA_ENV=production
MPESA_SHORTCODE=400200
MPESA_ACCOUNT_REFERENCE=104514
MPESA_PASSKEY=your_daraja_passkey
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_CALLBACK_URL=https://your-domain.com

# AI Assistant
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Running the Server
```bash
# Start development server
npm run dev
# or
npm start
```
The server will start listening on `0.0.0.0:3000` and display your local and Wi-Fi network URLs.

---

## 📂 Project Structure

```
crystal-crest/
├── database/            # MySQL schema & migrations
├── public/              # Front-end static assets & pages
│   ├── admin/           # Admin Dashboard pages & scripts
│   ├── cashier/         # Cashier POS portal pages & scripts
│   ├── css/             # Tailored Vanilla CSS & design tokens
│   ├── images/          # Product photos and brand assets
│   ├── js/              # Client-side JavaScript modules
│   │   ├── pages/       # Page-specific controllers
│   │   └── shared/      # Shared stores (Cart, UI, ApiService, Cresti)
│   ├── index.html       # Homepage & Hero Showcase
│   ├── shop.html        # 2-column mobile catalog & search
│   ├── product.html     # Product detail page
│   ├── checkout.html    # 3-step checkout wizard
│   ├── spa.html         # Luxury Spa booking page
│   └── account.html     # Customer profile & orders
├── scripts/             # Automated test suites
└── server/              # Node.js / Express backend
    ├── config/          # Database connection
    ├── middleware/      # Auth & permissions
    ├── routes/          # REST API endpoints
    └── store/           # Cache and state stores
```

---

## 📄 License
All rights reserved © Crystal Crest Luxury Cosmetics.
