# Wholesale & Retail Baking POS — Complete Architecture & Developer Runbook

This document is the complete guide for the **Wholesale & Retail Baking Supplies Inventory Management, Quotation Maker & Billing System**. If you clone or transfer this codebase to another laptop or development machine, this guide explains how the entire system works, how to run it, and where every feature lives.

---

## 1. High-Level Technology Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Electron Desktop Shell (main.js)                     │
│  - Single Instance Lock    - Port Conflict Auto-Kill (Port 5000)       │
│  - Hardware Accel Disabled - Auto-Healing Child Process Fork           │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       Frontend (client/src)          │  │     Backend (server/server.js)│
│  - React 19 + Vite                   │  │  - Express.js on :5000       │
│  - Vanilla CSS System (2500+ lines)  │  │  - REST API & Static Serving │
│  - Dual Pricing Engine (Home / Shop) │  │  - Transactional SQLite 3    │
│  - Quotations & Estimate Drawer      │  │  - WAL Checkpointing         │
│  - POS Keyboard Engine (F2-F5)       │  │  - Non-destructive Migrations│
│  - PDF/Excel Export & 80mm Receipts  │  │                              │
└──────────────────────────────────────┘  └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │ Embedded SQLite Database     │
                                          │  - Dual Stock (GST/Non-GST)  │
                                          │  - Dual Pricing (Home/Shop)  │
                                          │  - Quotations & Items        │
                                          │  - Automated VACUUM Backups  │
                                          └──────────────────────────────┘
```

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Desktop Shell** | Electron v31.0 | Manages backend lifecycle, window state, port conflict auto-kill |
| **Backend** | Express v4.21 (Node.js) | Runs locally on port `5000`, exposes `/api` endpoints, serves frontend static build |
| **Database** | SQLite 3 (WAL Mode) | Embedded relational database with atomic transactions, non-destructive schema migrations |
| **Frontend** | React 19 + Vite 8 | Single Page Application with React Router v7 and custom Vanilla CSS design system |
| **Wholesale Engine** | Dual Pricing & Units | Toggle `Home` (Retail) vs `Shop` (Wholesale) with dynamic cart price recalculations |
| **Quotation Maker** | Estimates & Proformas | Generates quotes (`QTN-XXXXX`) without deducting stock; convert & edit into tax invoices |
| **Hardware / POS** | 80mm Thermal Printer | USB Barcode scanner input, 80mm thermal receipt & quotation print slips |
| **Reporting** | SheetJS (XLSX) & jsPDF | Client-side export to Excel spreadsheets and formatted PDF reports |

---

## 2. Setup & Running on a New Laptop

### Prerequisites
- **Node.js**: v18.x or v20.x installed ([nodejs.org](https://nodejs.org))
- **Git** & **Windows PowerShell / Terminal**
- *Note*: No MongoDB or external database installation is required. Everything runs locally on embedded SQLite.

### Quick Installation

Open a terminal in the project root directory:

```bash
# 1. Install root dependencies (Electron & packagers)
npm install

# 2. Install backend dependencies (Express, SQLite3, Cors)
cd server
npm install
cd ..

# 3. Install frontend dependencies (React, Vite, jsPDF, XLSX)
cd client
npm install
cd ..
```

### Running the Application

Choose one of two workflows:

#### Option A: Full Desktop App (Electron Mode — Recommended)
```bash
npm start
```
*What happens*:
1. Electron checks if port `5000` is free (auto-terminates any stale processes using `netstat` and `taskkill`).
2. Electron forks `server/server.js` as a background child process.
3. Electron polls `http://127.0.0.1:5000/api/health` until ready.
4. Electron opens the desktop window loaded with the POS interface.

#### Option B: Browser Development Mode (Fast Hot Reload)
Run the backend and frontend separately in two terminal tabs:

**Terminal 1 (Backend on Port 5000):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend on Port 3000 with Hot Reload):**
```bash
cd client
npm run dev
```
Open your browser to `http://localhost:3000`. Vite automatically proxies `/api` calls to `http://localhost:5000`.

---

## 3. Database Seeding & Test Data

The application includes pre-built seeding scripts in `server/seeds/`:

```bash
# Populate wholesale baking inventory (Maida 50kg, Whipping Cream, Morde Compound, Cake Boxes, etc.)
cd server
node seeds/seed_baking.js
```

Other available scripts in `server/seeds/`:
- `npm run seed`: Seeds 2,000 generic retail items.
- `node seeds/seed_sales_heavy.js`: Populates extensive historical sales data for stress-testing reports and dashboards.
- `node seeds/check_sales.js`: Diagnostic script verifying tax calculations and sales ledger sums.

---

## 4. Credentials & Hidden Access

| Feature | Value | Details |
| :--- | :--- | :--- |
| **Emergency Support Contact** | **`9360480902`** | Displayed on error fallback screens with call/WhatsApp buttons and auto-clipboard diagnostics. |
| **Admin Login Passcode** | `admin123` | Default passcode for POS terminal login (no email needed). |
| **Custom Passcode Env** | `ADMIN_DELETE_PASSWORD` | Set in `.env` to override the default passcode. |
| **Invoice Cancellation** | Requires admin passcode | Prevents cashiers from cancelling invoices without manager authorization. |
| **Hidden Settings Page** | **`Ctrl + Shift + S`** | Settings is hidden from the sidebar to prevent cashier tampering. Press `Ctrl + Shift + S` anywhere in the app to access Store Profile, Printer Paper Size (80mm/58mm), and Backup config. |

---

## 5. Wholesale Baking Shop Features & Architecture

### 1. Dual Pricing Engine (Home vs Shop)
Every product has two distinct price points:
- **`retailPrice` (Home)**: For home bakers and retail walk-ins buying 1 or 2 items.
- **`wholesalePrice` (Shop)**: Discounted bulk pricing for commercial bakeries, cafes, and wholesale clients.
- **Interactive Price Tier Toggle**: Located in the Billing header (`🏠 Home / Retail` vs `🏢 Shop / Wholesale`).
- **Dynamic Price Recalculation**: Toggling tiers instantly recalculates all item unit prices, taxes, and grand totals in the active cart.
- **Customer Auto-Detection**: Selecting or looking up a customer tagged as `Shop` automatically switches the billing tier to Wholesale.

### 2. Quotation Maker & Editable Conversion Workflow
Wholesale buyers frequently request formal price estimates before ordering.
- **Save as Quotation**: Cashiers can build a cart and click **"Save as Quotation"**.
- **No Stock Deduction**: Quotations are saved under `QTN-XXXXX` format without reducing product stock.
- **Quotations Slide-Over Drawer**: Cashiers can press the **"📋 Quotations"** button in Billing to open the drawer of saved draft quotations.
- **Load into Bill / Bill Now**: Clicking "Bill Now" loads the quotation items directly into the Billing screen cart.
- **Full In-Flight Editing**: Cashiers can freely add more items, remove items, adjust quantities, change the price tier, and checkout as a final tax invoice.
- **Automatic Status Sync**: Upon checkout, the linked quotation is marked as `Converted` and stores the generated `convertedInvoiceNo`.
- **Quotations Page (`/quotations`)**: Complete management interface to search, filter by status (Draft, Converted, Expired), and print thermal quotation slips.

### 3. Units of Measure (UOM) for Baking Supplies
Baking ingredients are sold in varied commercial packaging:
- Supported units: `Kg`, `Gm`, `Pcs`, `Box`, `Bag`, `Liter`, `Pack`, `Tub`, `Tin`, `Bucket`.
- Decimals are fully supported for bulk weights (e.g., `2.5 Kg`).
- `minWholesaleQty` can be specified per product (e.g. minimum 5 boxes for wholesale price).

### 4. Customer Segmentation
- Customers are segmented into **Home Bakers / Retail** and **Commercial Bakeries / Wholesale Shops**.
- Wholesale accounts support `gstin` and `address` fields for GST B2B compliance and delivery slips.

---

## 6. Complete Database Schema

```sql
-- 1. Products: Dual inventory tracking & Dual Pricing
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  variant TEXT DEFAULT '',
  barcode TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  purchasePrice REAL NOT NULL,
  sellingPrice REAL NOT NULL,        -- Baseline/Retail selling price
  retailPrice REAL DEFAULT 0,        -- Home baker / Retail price
  wholesalePrice REAL DEFAULT 0,     -- Commercial bakery / Wholesale price
  unit TEXT DEFAULT 'Pcs',           -- UOM: Kg, Gm, Pcs, Box, Bag, Liter, Pack, Tub, Tin, Bucket
  minWholesaleQty REAL DEFAULT 1,    -- Minimum order quantity for wholesale tier
  stock INTEGER DEFAULT 0,           -- Total available (gstStock + nonGstStock)
  gstStock INTEGER DEFAULT 0,        -- Stock acquired from GST suppliers
  nonGstStock INTEGER DEFAULT 0,     -- Stock acquired from Non-GST suppliers
  gstRate INTEGER DEFAULT 18,        -- 0, 5, 12, 18, or 28%
  image TEXT DEFAULT '',             -- Local disk path: /uploads/products/prod_timestamp_random.jpg
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers: Customer registry with account type
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  mobile TEXT UNIQUE NOT NULL,
  customerType TEXT DEFAULT 'Home',  -- 'Home' (retail) or 'Shop' (commercial bakery)
  address TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Quotations (Estimates): Generates quotes without altering stock
CREATE TABLE quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotationNo TEXT UNIQUE NOT NULL,  -- QTN-00001 format
  customerMobile TEXT DEFAULT '',
  customerName TEXT DEFAULT '',
  customerType TEXT DEFAULT 'Home',  -- 'Home' or 'Shop'
  subtotal REAL NOT NULL,
  taxAmount REAL NOT NULL,
  grandTotal REAL NOT NULL,
  status TEXT DEFAULT 'Draft',       -- 'Draft', 'Converted', 'Expired'
  convertedInvoiceNo TEXT DEFAULT '',-- Linked tax invoice when converted to bill
  validUntil TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotationId INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
  productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
  productName TEXT NOT NULL,
  variant TEXT DEFAULT '',
  unit TEXT DEFAULT 'Pcs',
  barcode TEXT DEFAULT '',
  quantity REAL NOT NULL,
  priceType TEXT DEFAULT 'Home',     -- 'Home' or 'Shop'
  price REAL NOT NULL,
  gstRate INTEGER DEFAULT 0,
  taxAmount REAL NOT NULL,
  total REAL NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. Suppliers: Categorized into GST vs Non-GST suppliers
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  supplierType TEXT CHECK(supplierType IN ('GST', 'Non-GST')) DEFAULT 'GST',
  contactPerson TEXT DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5. Purchases: Inward stock invoices
CREATE TABLE purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchaseNumber TEXT UNIQUE NOT NULL,
  supplierId INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchaseTaxType TEXT CHECK(purchaseTaxType IN ('GST', 'Non-GST')) DEFAULT 'GST',
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  total REAL NOT NULL,
  paymentMethod TEXT CHECK(paymentMethod IN ('Cash', 'Bank Transfer', 'UPI', 'Credit')) DEFAULT 'Cash',
  status TEXT CHECK(status IN ('Received', 'Returned', 'Partially Returned')) DEFAULT 'Received',
  invoiceDate TEXT DEFAULT CURRENT_TIMESTAMP,
  notes TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchaseId INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
  productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
  productName TEXT NOT NULL,
  variant TEXT DEFAULT '',
  barcode TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  purchasePrice REAL NOT NULL,
  sellingPrice REAL NOT NULL,
  gstRate INTEGER DEFAULT 18,
  total REAL NOT NULL
);

-- 6. Sales & Items: Retail invoices with audit partition fields & tier
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoiceNo TEXT UNIQUE NOT NULL,       -- e.g. 'INV-00042'
  customerMobile TEXT DEFAULT '',
  customerName TEXT DEFAULT '',
  paymentMethod TEXT DEFAULT 'Cash Tendered',
  amountPaid REAL DEFAULT 0,
  changeReturned REAL DEFAULT 0,
  subtotal REAL NOT NULL,
  gstSubtotal REAL DEFAULT 0,
  nonGstSubtotal REAL DEFAULT 0,
  taxAmount REAL DEFAULT 0,
  cgstAmount REAL DEFAULT 0,
  sgstAmount REAL DEFAULT 0,
  grandTotal REAL NOT NULL,
  reportGstTax REAL DEFAULT 0,          -- Official tax attributable to GST stock
  reportNonGstAmount REAL DEFAULT 0,    -- Revenue attributable to Non-GST stock
  priceTier TEXT DEFAULT 'Home',        -- 'Home' or 'Shop'
  quotationId INTEGER DEFAULT NULL,     -- Source quotation if converted
  quotationNo TEXT DEFAULT '',
  status TEXT CHECK(status IN ('Completed', 'Cancelled', 'Returned', 'Partially Returned')) DEFAULT 'Completed',
  returnReason TEXT DEFAULT '',
  returnedAmount REAL DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  saleId INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  productId INTEGER REFERENCES products(id) ON DELETE SET NULL,
  productName TEXT NOT NULL,
  variant TEXT DEFAULT '',
  barcode TEXT NOT NULL,
  quantity REAL NOT NULL,
  gstQuantity REAL DEFAULT 0,
  nonGstQuantity REAL DEFAULT 0,
  price REAL NOT NULL,
  purchasePrice REAL DEFAULT 0,
  priceType TEXT DEFAULT 'Home',
  unit TEXT DEFAULT 'Pcs',
  total REAL NOT NULL,
  gstRate INTEGER DEFAULT 18,
  taxAmount REAL DEFAULT 0,
  reportGstTax REAL DEFAULT 0,
  reportNonGstAmount REAL DEFAULT 0,
  returnedQuantity REAL DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 7. Counters & Settings
CREATE TABLE counters (
  id TEXT PRIMARY KEY,
  seq INTEGER DEFAULT 0
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  storeName TEXT DEFAULT 'SuperMart Baking Supplies',
  storeAddress TEXT DEFAULT '123, Bakery Lane, Market Road',
  storePhone TEXT DEFAULT '+91 9876543210',
  storeGstin TEXT DEFAULT '36AAACG1234A1Z5',
  receiptFooter TEXT DEFAULT 'Thank you for choosing us for your baking supplies!',
  defaultPaymentMethod TEXT DEFAULT 'Cash Tendered',
  defaultGstRate INTEGER DEFAULT 18,
  backupRetention INTEGER DEFAULT 5,
  autoPrint INTEGER DEFAULT 0,
  barcodeAutoSubmit INTEGER DEFAULT 1,
  storeLogo TEXT DEFAULT '',
  printerName TEXT DEFAULT '',
  paperSize TEXT DEFAULT '80mm',
  backupPath TEXT DEFAULT ''
);
```

---

## 7. POS Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`F2`** | **New Bill** | Clears the active cart and starts a fresh transaction. |
| **`F3`** | **Hold Bill** | Parks the current cart and customer details into a held queue in `localStorage`. |
| **`F4`** | **Held Bills Drawer** | Opens the list of parked transactions to resume any bill with a single click. |
| **`F5`** | **Checkout** | Completes transaction, records the sale, updates inventory, and opens receipt. |
| **`Escape`** | **Close Modals** | Dismisses quick-add dialog, held bills drawer, or receipt preview. |
| **`Ctrl + Shift + S`**| **Open Settings** | Hidden shortcut to access store configuration. |

---

## 8. Directory & File Reference

```text
Billing/
├── .agents/skills/supermart-pos/SKILL.md  # Antigravity IDE auto-discovered skill
├── SKILLS.md                             # Universal reference document for any editor / new laptop
├── client/                               # React 19 + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── DashboardLayout.jsx   # Shell with Ctrl+Shift+S shortcut
│   │   │   │   └── Sidebar.jsx           # Sidebar navigation with Quotations link
│   │   │   └── Receipt.jsx               # Thermal slip (Tax Invoice & Quotation)
│   │   ├── pages/
│   │   │   ├── Billing.jsx               # Cashier POS: Home/Shop toggle, Quotations drawer, Save as Quote
│   │   │   ├── Quotations.jsx            # Quotations manager, status filters, Bill Now (convert & edit)
│   │   │   ├── Dashboard.jsx             # KPI cards with Active Quotations widget
│   │   │   ├── Products.jsx              # Product CRUD with Dual Prices (Home/Shop) & UOM
│   │   │   ├── Customers.jsx             # Customer registry with Home vs Shop segmentation
│   │   │   ├── SalesHistory.jsx          # Completed sales, reprint, return & void
│   │   │   ├── Purchases.jsx             # Supplier purchase orders (GST & Non-GST)
│   │   │   ├── Suppliers.jsx             # Supplier directory
│   │   │   ├── Reports.jsx               # 8 business reports with Excel/PDF export
│   │   │   ├── LowStock.jsx              # Low stock alert screen
│   │   │   ├── Settings.jsx              # Store profile, paper size, backup config
│   │   │   └── Login.jsx                 # Passcode numeric keypad login
│   │   ├── App.jsx                       # Route definitions (including /quotations)
│   │   └── index.css                     # Vanilla CSS design system
│   ├── package.json
│   └── vite.config.js
│
├── server/                               # Express Backend & SQLite Database
│   ├── config/
│   │   └── db.js                         # SQLite connection, non-destructive migrations, VACUUM backups
│   ├── routes/
│   │   ├── quotations.js                 # Quotations CRUD & /convert endpoint
│   │   ├── products.js                   # Products CRUD with retailPrice, wholesalePrice, UOM
│   │   ├── sales.js                      # Checkout with priceTier, quotation conversion, inventory deduction
│   │   ├── customers.js                  # Customers CRUD with customerType, address, gstin
│   │   ├── dashboard.js                  # Daily KPIs + pendingQuotationsCount
│   │   ├── purchases.js                  # Inward purchases & supplier linking
│   │   ├── suppliers.js                  # Suppliers directory
│   │   ├── reports.js                    # Business reports & audit ledgers
│   │   ├── settings.js                   # Store settings
│   │   └── auth.js                       # Passcode login & session check
│   ├── seeds/
│   │   ├── seed_baking.js                # Seeds wholesale baking products & sample quotation
│   │   └── seed.js                       # Standard seed script
│   ├── database.sqlite                   # Local SQLite database file
│   ├── package.json
│   └── server.js                         # Express server entry point with /api/quotations mounted
│
├── main.js                               # Electron main process
├── package.json                          # Root package.json
└── README.md                             # Quick overview
```
