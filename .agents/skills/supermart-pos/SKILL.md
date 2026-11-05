---
name: supermart-pos
description: >-
  Comprehensive architectural blueprint, developer runbook, database schema reference,
  and troubleshooting guide for the SuperMart POS desktop application. Use this skill
  whenever inspecting, developing, debugging, extending, or migrating the POS software
  on any machine.
---

# SuperMart POS — Complete Architecture & Developer Runbook

This document is the single source of truth for **SuperMart POS**, an offline-first Supermarket Point-of-Sale desktop system. If you clone or transfer this codebase to another laptop or development machine, this guide explains how the entire system works, how to run it, and where every feature lives.

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
│  - POS Keyboard Engine (F2-F5)       │  │  - Transactional SQLite 3    │
│  - PDF/Excel Export & 80mm Receipts  │  │  - WAL Checkpointing         │
└──────────────────────────────────────┘  └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │ Embedded SQLite Database     │
                                          │  - Dual Stock (GST/Non-GST)  │
                                          │  - Live DB in AppData        │
                                          │  - Automated VACUUM Backups  │
                                          └──────────────────────────────┘
```

| Layer | Technology | Key Details |
| :--- | :--- | :--- |
| **Desktop Shell** | Electron v31.0 | Manages backend lifecycle, window state, port conflict auto-kill |
| **Backend** | Express v4.21 (Node.js) | Runs locally on port `5000`, exposes `/api` endpoints, serves frontend static build |
| **Database** | SQLite 3 (WAL Mode) | Embedded relational database with atomic transactions & WAL checkpoints |
| **Frontend** | React 19 + Vite 8 | Single Page Application with React Router v7 and custom Vanilla CSS design system |
| **Hardware / POS** | 80mm Thermal Printer | USB Barcode scanner input, 80mm thermal receipt generation with print stylesheets |
| **Reporting** | SheetJS (XLSX) & jsPDF | Client-side export to Excel spreadsheets and formatted PDF reports |

---

## 2. Setup & Running on a New Laptop

### Prerequisites
- **Node.js**: v18.x or v20.x installed ([nodejs.org](https://nodejs.org))
- **Git** & **Windows PowerShell / Terminal**
- *Note*: No MongoDB or external database installation is required. Everything runs locally on embedded SQLite.

### Quick Installation

Open a terminal in the root directory and install dependencies:

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

Choose one of two workflows depending on your development needs:

#### Option A: Full Desktop App (Electron Mode — Recommended)
```bash
npm start
```
*What happens*:
1. Electron checks if port `5000` is free (auto-terminates any stale processes using `netstat` and `taskkill`).
2. Electron forks `server/server.js` as a background child process.
3. Electron polls `http://127.0.0.1:5000/api/health` until ready.
4. Electron opens the desktop window loaded with the POS interface.

#### Option B: Browser-Only Development Mode (Fast Hot Reload)
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
# Populate 2,000 realistic supermarket products with barcodes, categories, and stock
cd server
npm run seed
```

Other available scripts in `server/seeds/`:
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

## 5. Directory & File Structure

```text
Billing/
├── .agents/
│   └── skills/
│       └── supermart-pos/
│           └── SKILL.md            # Antigravity IDE auto-discovered skill
├── client/                         # React 19 + Vite Frontend
│   ├── dist/                       # Production frontend build output
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── DashboardLayout.jsx  # Main shell, handles Ctrl+Shift+S shortcut
│   │   │   │   └── Sidebar.jsx          # Collapsible navigation with live Indian clock
│   │   ├── context/
│   │   │   └── AuthContext.jsx          # Manages login state & session token in localStorage
│   │   ├── pages/
│   │   │   ├── Billing.jsx              # Core POS Cashier Engine (F2-F5, scanner, held bills)
│   │   │   ├── Dashboard.jsx            # KPI cards, daily profit, historical date picker
│   │   │   ├── Products.jsx             # Product CRUD, barcode auto-generator
│   │   │   ├── SalesHistory.jsx         # Invoices list, reprint, returns & admin cancellation
│   │   │   ├── Purchases.jsx            # Inward supplier purchase orders (GST & Non-GST)
│   │   │   ├── Suppliers.jsx            # Supplier directory (GST vs Non-GST type)
│   │   │   ├── Customers.jsx            # Customer directory with mobile phone lookup
│   │   │   ├── Reports.jsx              # 8 business reports with Excel & PDF export
│   │   │   ├── LowStock.jsx             # Inventory alert screen (< 10 units)
│   │   │   ├── Settings.jsx             # Store metadata, logo, backup paths, printer size
│   │   │   └── Login.jsx                # Passcode numeric keypad login
│   │   ├── services/
│   │   │   └── api.js                   # Axios client with 401 interceptor & Bearer header
│   │   ├── App.jsx                      # Route definitions
│   │   ├── index.css                    # Custom 2,540-line Vanilla CSS design system
│   │   └── main.jsx                     # Vite React entry point
│   ├── package.json
│   └── vite.config.js                   # Proxy /api to :5000, basicSsl plugin
│
├── server/                         # Express Backend & SQLite Database
│   ├── config/
│   │   └── db.js                        # SQLite connection, WAL mode, schema tables, VACUUM backups
│   ├── middleware/
│   │   └── auth.js                      # Bearer token validation
│   ├── routes/
│   │   ├── auth.js                      # POST /login, GET /me
│   │   ├── dashboard.js                 # Daily sales, net profit, retained tax calculations
│   │   ├── products.js                  # Products CRUD, /barcode/:code, /low-stock
│   │   ├── sales.js                     # Checkout, FIFO inventory reduction, returns, cancel
│   │   ├── purchases.js                 # Inward inventory, supplier linking, purchase returns
│   │   ├── suppliers.js                 # Supplier directory CRUD
│   │   ├── customers.js                 # Customer registry & auto-lookup
│   │   ├── reports.js                   # Sales, GST, Non-GST, Stock, Ledgers (batched queries)
│   │   └── settings.js                  # Store profile, logo, hardware settings
│   ├── seeds/                           # Mock data generators (products, sales, checks)
│   ├── database.sqlite                  # Local dev SQLite database file
│   ├── package.json
│   └── server.js                        # Express server entry point, port conflict killer, shutdown
│
├── dist-desktop/                        # Electron packager build output (executable & installer)
├── backup.bat                           # Windows batch script to copy DB to external drive
├── main.js                              # Electron main process (lifecycle, port killer, auto-heal)
├── package.json                         # Root package.json (Electron build scripts)
├── README.md                            # High-level overview
└── SKILLS.md                            # Universal reference document for any editor
```

---

## 6. Database Engine & Schema Reference

### Storage Engine Details
- **Engine**: SQLite 3 with **WAL (Write-Ahead Logging)** enabled (`PRAGMA journal_mode=WAL;`).
- **Location**:
  - Development: `server/database.sqlite`
  - Electron Packaged: `C:\Users\<User>\AppData\Roaming\supermart-desktop-pos\database.sqlite`
- **WAL Checkpointing**: Every 5 completed invoices, `sales.js` executes `PRAGMA wal_checkpoint(TRUNCATE)` to merge the `-wal` log into the main database file.

### Complete Schema

```sql
-- 1. Products: Supports dual inventory tracking (GST vs Non-GST stock) & Dual Pricing (Home vs Shop)
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  variant TEXT DEFAULT '',
  barcode TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  purchasePrice REAL NOT NULL,
  sellingPrice REAL NOT NULL,        -- Baseline/Retail selling price
  retailPrice REAL DEFAULT 0,        -- Home baker / Retail walk-in price
  wholesalePrice REAL DEFAULT 0,     -- Commercial bakery / Shop wholesale price
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

-- 2. Customers: Auto-registered on checkout or managed with account type
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

-- 4. Purchases: Inward stock invoices
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
  gstRate INTEGER DEFAULT 12,
  total REAL NOT NULL
);

-- 5. Sales & Items: Retail invoices with audit partition fields
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
  quantity INTEGER NOT NULL,
  gstQuantity INTEGER DEFAULT 0,
  nonGstQuantity INTEGER DEFAULT 0,
  price REAL NOT NULL,
  purchasePrice REAL DEFAULT 0,
  total REAL NOT NULL,
  gstRate INTEGER DEFAULT 12,
  taxAmount REAL DEFAULT 0,
  reportGstTax REAL DEFAULT 0,
  reportNonGstAmount REAL DEFAULT 0,
  returnedQuantity INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 6. Counters & Settings
CREATE TABLE counters (
  id TEXT PRIMARY KEY,
  seq INTEGER DEFAULT 0
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  storeName TEXT DEFAULT 'SuperMart',
  storeAddress TEXT DEFAULT '123, Main Street, City',
  storePhone TEXT DEFAULT '+91 9876543210',
  storeGstin TEXT DEFAULT '00AAAAA0000A0Z0',
  receiptFooter TEXT DEFAULT 'Thank you for shopping with us!',
  defaultPaymentMethod TEXT DEFAULT 'Cash Tendered',
  defaultGstRate INTEGER DEFAULT 12,
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

## 7. Core Business Logic & Inventory Rules

### The Dual-Stock FIFO Taxation Engine
Indian retail stores frequently procure goods from both GST-registered distributors and local Non-GST vendors. This system manages both under one unified barcode catalog:

1. **Inward Stock Routing**:
   - Purchase from GST Supplier $\rightarrow$ increments `gstStock`
   - Purchase from Non-GST Supplier $\rightarrow$ increments `nonGstStock`
   - Combined total: `stock = gstStock + nonGstStock`

2. **Customer Checkout (FIFO)**:
   - Customers receive an official retail receipt with standard GST tax rates (split 50/50 into CGST and SGST).
   - The inventory deduction algorithm in `server/routes/sales.js` automatically allocates stock via **FIFO**:
     $$\text{allocGst} = \min(\text{requestedQty}, \text{currentGstStock})$$
     $$\text{allocNonGst} = \text{requestedQty} - \text{allocGst}$$
   - Stock values are updated atomically within an SQLite transaction.

3. **Accounting & Tax Partitioning**:
   - `reportGstTax`: Genuine tax payable to the government for goods sold out of GST stock.
   - `reportNonGstAmount`: Sale revenue from non-GST stock.
   - **Dashboard Profit Metric**: Sum of $(\text{Selling Price} - \text{Purchase Price}) \times \text{Sold Qty}$ plus the collected tax retained by the store on non-GST stock.

4. **Return & Cancellation Logic**:
   - **Returns**: Restores stock in reverse order (GST stock replenished first, remainder to non-GST stock).
   - **Cancellations**: Requires admin passcode verification, voids the invoice, and restores all item quantities into their respective pools.

---

## 8. POS Keyboard Shortcuts & Terminal Features

Located in [`client/src/pages/Billing.jsx`](file:///c:/Users/sures/Downloads/Billing/client/src/pages/Billing.jsx):

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **`F2`** | **New Bill** | Clears the active cart and starts a fresh transaction. |
| **`F3`** | **Hold Bill** | Parks the current cart and customer details into a held queue in `localStorage`. |
| **`F4`** | **Held Bills Drawer** | Opens the list of parked transactions to resume any bill with a single click. |
| **`F5`** | **Checkout** | Completes transaction, records the sale, updates inventory, and opens receipt. |
| **`Escape`** | **Close Modals** | Dismisses quick-add dialog, held bills drawer, or receipt preview. |
| **`Ctrl + Shift + S`**| **Open Settings** | Hidden shortcut to access store configuration. |

### Additional Billing Features
- **Barcode Auto-Focus**: Whenever a cashier scans a product or starts typing alphanumeric characters, focus automatically jumps to the barcode input.
- **Voice Typing**: Web Speech API integration allows cashiers to click the microphone and speak customer names for quick entry.
- **Held Bills System**: Allows a cashier to park an active customer's items when they forget a wallet or need to pick up another item, service the next customer, and resume the original bill instantly.
- **Customer Auto-Lookup**: Typing a 3+ digit mobile number displays instant suggestion dropdowns of existing customers.

---

## 9. Thermal Printing & Receipt Generation

Located in [`client/src/components/Receipt.jsx`](file:///c:/Users/sures/Downloads/Billing/client/src/components/Receipt.jsx):
- Optimized for standard **80mm thermal receipt printers** (also supports 58mm via settings).
- Automatically retrieves store name, address, phone, GSTIN, and custom footer message from `/api/settings`.
- Formats date and time into Indian Standard Time (`DD/MM/YYYY HH:MM`).
- Clean itemization table: Product Name + Variant, Qty, Rate, Line Total.
- Totals block: Subtotal, CGST, SGST, and Grand Total.
- CSS `@media print` rules in `client/src/index.css` strip all navigation, sidebars, and buttons, printing only the thermal slip.

---

## 10. Disaster Recovery & Backup Pipeline

1. **SQLite Atomic Compaction (`VACUUM INTO`)**:
   - Every startup (after 10s delay) and shutdown, the backend executes `db.run('VACUUM INTO ?', [backupFile])`.
   - Copies both the active database and uncommitted WAL entries into a clean standalone `.sqlite` file without locking the POS.
   - Stored in `server/backups/backup_YYYY-MM-DD_HH-mm-ss.sqlite`.
   - Automatically prunes older backups according to `backupRetention` (default: 5 most recent).
2. **On-Demand Compaction**:
   - `POST /api/sales/backup` triggers immediate manual compaction.
3. **External USB Backup (`backup.bat`)**:
   - Root `backup.bat` script copies the live database from `%APPDATA%\supermart-desktop-pos\database.sqlite` directly to an external USB or secondary hard drive (e.g. `D:\SuperMart_Backups`).

---

## 11. Packaging & Distribution

To generate a standalone Windows desktop executable:

```bash
# Build frontend and package standalone folder into dist-desktop/
npm run pack

# Or build NSIS installer .exe
npm run dist
```

Build settings are configured in root [`package.json`](file:///c:/Users/sures/Downloads/Billing/package.json):
- Name: `SuperMart POS`
- App ID: `com.supermart.pos`
- Target: 64-bit Windows (`win32-x64`)
- Output: `dist-desktop/`

---

## 12. Troubleshooting on a New Laptop

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Port 5000 in use** | A previous Node process or Windows service is listening on 5000. | The app auto-kills conflicting processes. If running manually, execute `netstat -ano \| findstr :5000` and `taskkill /F /PID <pid>`. |
| **`sqlite3` native rebuild error** | Node.js version mismatch between local environment and Electron. | Run `npm rebuild` in both root and `server/` directory. Use Node v18 or v20 LTS. |
| **Database appears empty on Electron launch** | Electron loads the database from `%APPDATA%\supermart-desktop-pos\database.sqlite`, whereas standalone backend loads from `server/database.sqlite`. | Run `cd server && npm run seed` to populate whichever database file your current mode is pointing to. |
| **References to MongoDB in old docs** | Legacy documentation remnants. | Ignore MongoDB references; the application uses embedded SQLite 3 exclusively. |
| **Settings page not found in menu** | Settings is intentionally omitted from the sidebar. | Press **`Ctrl + Shift + S`** anywhere in the interface or navigate directly to `/settings`. |
