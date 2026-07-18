# SuperMart POS — Supermarket Billing System

A full-stack Point-of-Sale (POS) application for supermarket billing.

## Tech Stack

- **Frontend**: React.js (Vite), Tailwind CSS v4
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Auth**: JWT

## Quick Start

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on `mongodb://localhost:27017`

### 1. Backend Setup

```bash
cd server
npm install
npm run seed    # Seeds admin user + sample products
npm run dev     # Starts on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd client
npm install
npm run dev     # Starts on http://localhost:3000
```

### 3. Login

- **Email**: admin@supermart.com
- **Password**: admin123

## Features

- ✅ Admin login with JWT authentication
- ✅ Dashboard with stats (Products, Stock, Sales, Low Stock)
- ✅ Product management (CRUD) with auto-barcode generation
- ✅ Barcode-based POS billing (supports USB barcode scanner)
- ✅ Checkout with automatic stock reduction
- ✅ 80mm thermal receipt generation & printing
- ✅ Sales history with search & date filter
- ✅ Low stock alerts (stock < 10)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Admin login |
| GET | /api/auth/me | Current user |
| GET | /api/products | List products |
| POST | /api/products | Add product |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |
| GET | /api/products/barcode/:code | Lookup by barcode |
| GET | /api/products/low-stock | Low stock items |
| POST | /api/sales | Create sale |
| GET | /api/sales | List sales |
| GET | /api/sales/:id | Sale details |
| GET | /api/dashboard | Dashboard stats |
