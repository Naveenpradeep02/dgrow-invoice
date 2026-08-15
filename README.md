# 📑 D-GROW Invoice & Financial Document Management System

> **Enterprise-Grade Invoicing, GST Billing, Client Portal & Financial Auditing System**  
> Tailored specifically for **D-GROW Marketing Agency**.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Technology Stack & Packages](#-technology-stack--packages)
3. [Complete Directory & File Structure](#-complete-directory--file-structure)
4. [Database Architecture & Schema](#-database-architecture--schema)
5. [Authentication & Role-Based Access Control (RBAC)](#-authentication--role-based-access-control-rbac)
6. [Complete REST API Endpoints & Routes](#-complete-rest-api-endpoints--routes)
7. [Frontend Architecture & Pages](#-frontend-architecture--pages)
8. [Core Feature & Business Logic](#-core-feature--business-logic)
9. [PDF Generation Engine](#-pdf-generation-engine)
10. [Environment Variables & Configuration](#-environment-variables--configuration)
11. [Installation & Setup Guide](#-installation--setup-guide)
12. [Testing & Verification](#-testing--verification)

---

## 🏢 Project Overview

The **D-GROW Invoice System** is a full-stack financial billing and accounting platform built to streamline the invoicing lifecycle, tax compliance (GST/HSN/SAC), client subscriptions/presets, payment tracking, and financial auditing.

### Key Capabilities
- **Multi-Role Portal**: Dedicated dashboards and views for **Admin** (Agency Owners), **Auditors** (Accountants & Tax Reviewers), and **Clients** (Direct access to billing).
- **Automated Consecutive Invoicing**: Financial year-aware sequence generation (`INV-YYYY-YY/XXXX` or `INVXXXX`).
- **GST & Non-GST Compliance**: Dynamic Intra-State (CGST + SGST) vs Inter-State (IGST) split, HSN/SAC code mapping, mathematical round-offs, and Indian Currency Words conversion.
- **Client Preset Packages**: Auto-populate pre-negotiated line items and sub-bullet deliverables when selecting clients.
- **Dynamic PDF Vector Engine**: High-fidelity PDF output rendered using `PDFKit` matching official agency branding, signatures, and UPI QR codes.
- **Comprehensive Audit Trail**: Real-time logging of all invoice creations, edits, cancellations, logins, and downloads.

---

## 🛠 Technology Stack & Packages

### 1. Backend Stack
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js (v4.19.2)
- **Database Driver**: `mysql2` (v3.9.7) with Connection Pooling & Transaction wrappers
- **Authentication**: `jsonwebtoken` (v9.0.2) + `bcryptjs` (v2.4.3) password hashing
- **PDF Vector Engine**: `pdfkit` (v0.15.0)
- **Environment Management**: `dotenv` (v16.4.5)
- **CORS**: `cors` (v2.8.5)

### 2. Frontend Stack
- **Core**: Vanilla JavaScript (ES6+ Native Modules & Fetch API)
- **Styling**: Vanilla CSS (Custom Design System, CSS Variables, Responsive Grid & Flexbox, Glassmorphism, Micro-animations)
- **Icons**: FontAwesome 6 / SVG icons
- **Fonts**: Google Fonts (`Inter`, `Plus Jakarta Sans`)

---

## 📁 Complete Directory & File Structure

```text
Dgital bill/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # Database pool connection & transaction abstraction
│   │   │   └── schema.sql           # MySQL DDL schema and initial seed data
│   │   ├── controllers/
│   │   │   ├── auditController.js    # Audit log queries and invoice-specific timelines
│   │   │   ├── authController.js     # User login, JWT token issuance, seed accounts
│   │   │   ├── clientController.js   # Client master CRUD + preset services logic
│   │   │   ├── invoiceController.js  # Invoice creation, edit, cancel, numbering, listing
│   │   │   ├── paymentController.js  # Payment recording and balance recalculations
│   │   │   ├── reportController.js   # KPI aggregation, sales summaries, GST reports
│   │   │   ├── serviceController.js  # Services and SAC catalog management
│   │   │   └── settingsController.js # Agency profile and default invoice terms config
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # Bearer JWT token verification & user context injection
│   │   │   └── roleMiddleware.js     # RBAC middleware (ADMIN, AUDITOR, CLIENT)
│   │   ├── routes/
│   │   │   ├── auditRoutes.js        # /api/audit-logs
│   │   │   ├── authRoutes.js         # /api/auth
│   │   │   ├── clientRoutes.js       # /api/clients
│   │   │   ├── invoiceRoutes.js      # /api/invoices
│   │   │   ├── paymentRoutes.js      # /api/payments
│   │   │   ├── reportRoutes.js       # /api/reports
│   │   │   ├── serviceRoutes.js      # /api/services
│   │   │   └── settingsRoutes.js     # /api/settings
│   │   ├── services/
│   │   │   ├── auditService.js       # Asynchronous audit event recorder
│   │   │   ├── pdfService.js         # PDFKit invoice vector layout generator
│   │   │   ├── taxService.js         # GST, IGST/CGST/SGST, subtotal, and round-off calculator
│   │   │   └── wordsService.js       # Indian numbering system to English words converter
│   │   └── utils/
│   │
│   ├── .env                         # Server & database environment variables
│   ├── package.json                 # Backend dependencies and execution scripts
│   ├── server.js                    # Express app entry point, static serving & error handlers
│   ├── test_complete_audit.js       # Test suite for audit trails
│   ├── test_frontend_static.js      # Test suite for static assets & pages
│   ├── test_suite.js                # Full integration test suite
│   └── update_address.js            # Agency address update helper script
│
├── frontend/
│   ├── admin/
│   │   ├── audit.html               # System-wide audit log viewer
│   │   ├── client-edit.html         # Client master creator & preset services editor
│   │   ├── clients.html             # Client listing and management table
│   │   ├── create-invoice.html      # Dynamic invoice creator & editor (GST/Non-GST)
│   │   ├── dashboard.html           # Admin executive overview with financial KPIs & charts
│   │   ├── invoice-view.html        # Interactive invoice preview & PDF printing view
│   │   ├── invoices.html            # Invoice directory with search & status filters
│   │   ├── payments.html            # Payment ledger and transaction recording modal
│   │   ├── reports.html             # Sales, GST (GSTR-1 format), and outstanding dues reports
│   │   ├── services.html            # Service items & HSN/SAC rate catalog
│   │   └── settings.html            # Agency profile, bank details & invoice terms editor
│   │
│   ├── auditor/
│   │   ├── audit-log.html           # Auditor compliance log inspector
│   │   ├── dashboard.html           # Auditor dashboard with summary analytics
│   │   ├── invoice-view.html        # Read-only invoice review view
│   │   ├── invoices.html            # Auditor invoice listing with month/year filters
│   │   └── reports.html             # Tax audit & GST reconciliation report views
│   │
│   ├── client/
│   │   ├── dashboard.html           # Client self-service billing overview
│   │   └── invoice-view.html        # Client invoice viewer & direct PDF download
│   │
│   ├── assets/                      # Agency logos, stamp/signature graphics, placeholders
│   ├── css/
│   │   └── style.css                # Global design system, typography, colors, layout rules
│   │
│   ├── js/
│   │   ├── api.js                   # Universal fetch client with automatic Bearer token
│   │   ├── audit.js                 # Audit log UI rendering and filtering
│   │   ├── auth.js                  # Login/Logout handlers, session checks, role redirects
│   │   ├── clients.js               # Client master management and preset rows script
│   │   ├── dashboard.js             # KPI cards loader and recent invoice cards
│   │   ├── invoice.js               # Invoice builder, line-item math, live tax calculations
│   │   ├── payments.js              # Payment recording UI and settlement calculations
│   │   ├── reports.js               # Report generation (Sales/GST/Outstanding) and CSV export
│   │   ├── services.js              # Service catalog management script
│   │   └── settings.js              # Agency settings and terms sync logic
│   │
│   ├── index.html                   # Entry point (auto-redirects to login or dashboard)
│   ├── login.html                   # Premium login portal with role selection
│   └── .htaccess                    # Web server URL rewrites and routing rules
│
├── .htaccess                        # Root Apache rewrite rules
└── README.md                        # Complete project documentation
```

---

## 🗄 Database Architecture & Schema

The database is built on relational integrity with foreign keys, cascaded deletions where applicable, and indexed lookups.

```
                  ┌──────────────┐
                  │    roles     │
                  └──────┬───────┘
                         │ 1:N
                  ┌──────▼───────┐
                  │    users     │◀──────────────┐
                  └──────┬───────┘               │ 1:N
                         │ 1:N                   │
         ┌───────────────┼────────────────┐      │
         │               │                │      │
  ┌──────▼───────┐ 1:N ┌─▼──────────────┐ │ ┌────┴────────┐
  │   clients    │────▶│   invoices     │─┼─│ audit_logs  │
  └──────────────┘     └─┬────────────┬─┘ │ └─────────────┘
                         │ 1:N        │ 1:N
                  ┌──────▼──────┐   ┌─▼──────────────┐
                  │invoice_items│   │    payments    │
                  └─────────────┘   └────────────────┘
```

### Table Breakdown

#### 1. `roles`
Defines permission levels in the system.
- `id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(50), UNIQUE) — Values: `'ADMIN'`, `'CLIENT'`, `'AUDITOR'`

#### 2. `clients`
Client master data with billing, GST, and preset packages.
- `id` (INT, PK, AUTO_INCREMENT)
- `company_name` (VARCHAR(255), NOT NULL)
- `contact_person` (VARCHAR(150))
- `mobile` (VARCHAR(20), NOT NULL)
- `email` (VARCHAR(150), UNIQUE, NOT NULL)
- `address` (TEXT, NOT NULL)
- `city` (VARCHAR(100))
- `state` (VARCHAR(100), DEFAULT 'Tamil Nadu')
- `pincode` (VARCHAR(10))
- `gstin` (VARCHAR(20))
- `pan` (VARCHAR(20))
- `billing_address` (TEXT)
- `shipping_address` (TEXT)
- `preset_services_json` (TEXT) — Predefined service line items & rates for this client
- `status` (ENUM('ACTIVE', 'INACTIVE'), DEFAULT 'ACTIVE')
- `created_at`, `updated_at` (TIMESTAMP)

#### 3. `users`
System accounts for Admins, Auditors, and Client users.
- `id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(150), NOT NULL)
- `email` (VARCHAR(150), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL)
- `role_id` (INT, FK -> `roles.id`)
- `client_id` (INT, NULL, FK -> `clients.id`) — Links client users to their client master
- `status` (ENUM('ACTIVE', 'INACTIVE'), DEFAULT 'ACTIVE')
- `created_at`, `updated_at` (TIMESTAMP)

#### 4. `services`
Master catalog of agency services with SAC/HSN codes and default rates.
- `id` (INT, PK, AUTO_INCREMENT)
- `name` (VARCHAR(255), NOT NULL)
- `description` (TEXT)
- `hsn_sac` (VARCHAR(20), DEFAULT '998311')
- `default_rate` (DECIMAL(12,2), DEFAULT 0.00)
- `default_gst_rate` (DECIMAL(5,2), DEFAULT 18.00)
- `unit` (VARCHAR(50), DEFAULT 'Service')
- `status` (ENUM('ACTIVE', 'INACTIVE'), DEFAULT 'ACTIVE')
- `created_at`, `updated_at` (TIMESTAMP)

#### 5. `tax_rates`
Available tax slab definitions.
- `id` (INT, PK, AUTO_INCREMENT)
- `rate_percentage` (DECIMAL(5,2), UNIQUE) — e.g., `0.00`, `5.00`, `12.00`, `18.00`, `28.00`
- `description` (VARCHAR(100))
- `is_active` (BOOLEAN, DEFAULT TRUE)

#### 6. `company_settings`
Agency profile, branding, bank details, and signatory info.
- `id` (INT, PK, DEFAULT 1)
- `company_name` (VARCHAR(255), DEFAULT 'D-GROW MARKETING AGENCY')
- `logo_url` (TEXT)
- `gstin` (VARCHAR(20), DEFAULT '33OUUPS5195G1ZJ')
- `address`, `city`, `state`, `pincode`, `phone`, `email`, `website`
- `bank_name`, `account_number`, `ifsc_code`, `banking_name`, `branch_name`, `gpay_number`
- `authorized_person` (DEFAULT 'Srija R'), `signature_title` (DEFAULT 'Proprietrix')

#### 7. `invoice_terms`
Standard terms & conditions printed on invoices.
- `id` (INT, PK, DEFAULT 1)
- `scope_of_work`, `payment_terms`, `ownership_usage`, `confidentiality`, `cancellation_policy`, `notes`

#### 8. `invoice_sequences`
Atomic consecutive invoice numbering counter per financial year.
- `id` (INT, PK, AUTO_INCREMENT)
- `prefix` (VARCHAR(20), DEFAULT 'INV')
- `financial_year` (VARCHAR(20), DEFAULT '2026-27')
- `last_number` (INT, DEFAULT 0)

#### 9. `invoices`
Primary financial document entity.
- `id` (INT, PK, AUTO_INCREMENT)
- `invoice_number` (VARCHAR(50), UNIQUE, NOT NULL)
- `invoice_type` (ENUM('GST', 'NON_GST'), DEFAULT 'GST')
- `client_id` (INT, FK -> `clients.id`)
- `client_snapshot_json` (LONGTEXT, NOT NULL) — Immutable client details at time of generation
- `place_of_supply` (VARCHAR(100), DEFAULT 'Tamil Nadu (33)')
- `invoice_date` (DATE, NOT NULL)
- `due_date` (DATE, NOT NULL)
- `payment_terms_text` (VARCHAR(255))
- `subtotal`, `discount`, `taxable_amount` (DECIMAL(12,2))
- `cgst_rate`, `cgst_amount`, `sgst_rate`, `sgst_amount` (DECIMAL(12,2))
- `igst_rate`, `igst_amount` (DECIMAL(12,2))
- `round_off` (DECIMAL(12,2))
- `grand_total` (DECIMAL(12,2))
- `amount_in_words` (VARCHAR(255))
- `status` (ENUM('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'), DEFAULT 'ISSUED')
- `notes` (TEXT)
- `created_by` (INT, FK -> `users.id`)
- `created_at`, `updated_at` (TIMESTAMP)

#### 10. `invoice_items`
Individual line items inside an invoice.
- `id` (INT, PK, AUTO_INCREMENT)
- `invoice_id` (INT, FK -> `invoices.id` ON DELETE CASCADE)
- `service_id` (INT, NULL, FK -> `services.id` ON DELETE SET NULL)
- `description` (TEXT, NOT NULL) — Contains main title and bullet sub-details
- `hsn_sac` (VARCHAR(20), DEFAULT '998311')
- `quantity` (DECIMAL(10,2), DEFAULT 1.00)
- `rate` (DECIMAL(12,2), DEFAULT 0.00)
- `discount` (DECIMAL(12,2), DEFAULT 0.00)
- `gst_rate` (DECIMAL(5,2), DEFAULT 18.00)
- `taxable_amount`, `tax_amount`, `total_amount` (DECIMAL(12,2))
- `item_order` (INT, DEFAULT 1)

#### 11. `payments`
Recorded payment transactions against invoices.
- `id` (INT, PK, AUTO_INCREMENT)
- `invoice_id` (INT, FK -> `invoices.id`)
- `payment_date` (DATE, NOT NULL)
- `amount` (DECIMAL(12,2), NOT NULL)
- `payment_mode` (ENUM('Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other'))
- `reference_number` (VARCHAR(100))
- `notes` (TEXT)
- `created_by` (INT, FK -> `users.id`)
- `created_at` (TIMESTAMP)

#### 12. `audit_logs`
Immutable compliance audit trail.
- `id` (INT, PK, AUTO_INCREMENT)
- `user_id` (INT, NULL), `user_email` (VARCHAR(150)), `user_role` (VARCHAR(50))
- `action` (ENUM('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'ISSUE', 'CANCEL', 'PAYMENT', 'DOWNLOAD', 'EXPORT'))
- `entity_type` (ENUM('INVOICE', 'CLIENT', 'SERVICE', 'PAYMENT', 'SETTINGS', 'USER'))
- `entity_id` (VARCHAR(100))
- `old_data` (LONGTEXT, NULL), `new_data` (LONGTEXT, NULL)
- `ip_address` (VARCHAR(45)), `user_agent` (TEXT)
- `created_at` (TIMESTAMP)

---

## 🔐 Authentication & Role-Based Access Control (RBAC)

### 1. Authentication Flow
1. User enters credentials on `login.html`.
2. Backend verifies `email` and compares `password` with bcrypt hash (`bcryptjs.compare`).
3. If verified, backend issues a signed **JWT Token** containing:
   ```json
   {
     "id": 1,
     "name": "D-GROW Admin",
     "email": "admin@dgrow.com",
     "role": "ADMIN",
     "client_id": null,
     "exp": 1755255000
   }
   ```
4. Token is saved in `localStorage.setItem('token', token)` and user metadata in `localStorage.setItem('user', JSON.stringify(user))`.
5. Frontend automatically sends header `Authorization: Bearer <token>` on all API requests using `apiFetch()` in `frontend/js/api.js`.

### 2. Role Permissions Matrix

| Resource / Action | ADMIN | AUDITOR | CLIENT |
| :--- | :---: | :---: | :---: |
| **View Dashboard** | Full KPI Dashboard | Financial & Tax Summary | Client-Only Invoices & Dues |
| **Create/Edit Invoices** | ✅ Full Access | ❌ Read Only | ❌ No Access |
| **Cancel Invoices** | ✅ Allowed | ❌ Read Only | ❌ No Access |
| **View Invoices** | ✅ All Invoices | ✅ All Invoices | 🔒 Only Own Invoices |
| **Download PDF** | ✅ All Invoices | ✅ All Invoices | 🔒 Only Own Invoices |
| **Record Payments** | ✅ Full Access | ❌ Read Only | ❌ No Access |
| **Client Master Management** | ✅ Create / Update | 👁 View Only | ❌ No Access |
| **Service Catalog** | ✅ Create / Update | 👁 View Only | ❌ No Access |
| **Company Settings & Terms**| ✅ Update | 👁 View Only | ❌ No Access |
| **Financial / GST Reports** | ✅ Full Access | ✅ Full Access | 🔒 Own Outstanding Only |
| **Audit Logs** | ✅ Full Access | ✅ Full Access | ❌ No Access |

### 3. Pre-Seeded Default Accounts

| Role | Email | Default Password |
| :--- | :--- | :--- |
| **Admin** | `admin@dgrow.com` | `admin123` |
| **Client (Marks Biotech)** | `client@marksbiotech.com` | `client123` |
| **Auditor** | `auditor@dgrow.com` | `auditor123` |

---

## 🌐 Complete REST API Endpoints & Routes

### Base URL: `/api`

### 1. Authentication Routes (`/api/auth`)
- `POST /api/auth/login` — Public. Authenticates user and returns JWT token & role.
- `GET /api/auth/me` — Protected (`authenticateToken`). Returns current user session.

### 2. Client Management Routes (`/api/clients`)
- `GET /api/clients` — Protected (`ADMIN`, `AUDITOR`). Fetch all clients (supports `?search=` filter).
- `GET /api/clients/:id` — Protected (`ADMIN`, `AUDITOR`, `CLIENT`). Fetch single client details and preset services.
- `POST /api/clients` — Protected (`ADMIN`). Create new client with preset services.
- `PUT /api/clients/:id` — Protected (`ADMIN`). Update client master details, address, and presets.

### 3. Service Catalog Routes (`/api/services`)
- `GET /api/services` — Protected (`ADMIN`, `AUDITOR`). Fetch list of all active services.
- `POST /api/services` — Protected (`ADMIN`). Add new service with HSN/SAC code and default rate.
- `PUT /api/services/:id` — Protected (`ADMIN`). Update existing service details.

### 4. Invoice Routes (`/api/invoices`)
- `GET /api/invoices/next-number` — Protected (`ADMIN`). Get auto-incremented invoice number for current FY.
- `GET /api/invoices` — Protected. Fetch invoices with status/client/date filtering (clients see only their own).
- `GET /api/invoices/:id` — Protected. Fetch invoice header, items, payments, client snapshot, and company details.
- `GET /api/invoices/:id/pdf` — Protected. Stream dynamic vector PDF directly into browser.
- `POST /api/invoices` — Protected (`ADMIN`). Create invoice, compute taxes, save client snapshot, and update sequence.
- `PUT /api/invoices/:id` — Protected (`ADMIN`). Update editable invoice.
- `POST /api/invoices/:id/cancel` — Protected (`ADMIN`). Void/cancel invoice with audit log justification.

### 5. Payment Routes (`/api/payments`)
- `GET /api/payments` — Protected. Fetch payment history (supports `?invoice_id=` filter).
- `POST /api/payments` — Protected (`ADMIN`). Record payment (UPI, Bank Transfer, Cash, etc.) and update invoice status (`PAID` / `PARTIALLY_PAID`).

### 6. Reports & Analytics Routes (`/api/reports`)
- `GET /api/reports/kpis` — Protected. High-level KPI metrics (Total Invoiced, Total Collected, Outstanding, GST Liability).
- `GET /api/reports/sales` — Protected (`ADMIN`, `AUDITOR`). Sales breakdown grouped by month, client, or type.
- `GET /api/reports/gst` — Protected (`ADMIN`, `AUDITOR`). GSTR-1 compliant report with Taxable, CGST, SGST, IGST sums.
- `GET /api/reports/outstanding` — Protected (`ADMIN`, `AUDITOR`, `CLIENT`). List of unpaid & overdue invoices with aging.

### 7. Company Settings & Terms (`/api/settings`)
- `GET /api/settings` — Protected. Fetch agency profile, bank details, and invoice terms.
- `PUT /api/settings/company` — Protected (`ADMIN`). Update agency name, GSTIN, address, bank accounts, signature.
- `PUT /api/settings/terms` — Protected (`ADMIN`). Update standard terms & conditions.

### 8. Audit Logs (`/api/audit-logs`)
- `GET /api/audit-logs` — Protected (`ADMIN`, `AUDITOR`). Fetch system activity logs with action and entity filters.
- `GET /api/audit-logs/invoice/:invoiceId` — Protected (`ADMIN`, `AUDITOR`). Fetch lifecycle history of a specific invoice.

### 9. System Health (`/api/health`)
- `GET /api/health` — Public. Returns system status, active database driver, and server timestamp.

---

## 🖥 Frontend Architecture & Pages

The frontend is structured into 3 distinct role zones with modular Javascript and dedicated style sheets:

### 1. Admin Portal (`/frontend/admin/`)
- `dashboard.html` — Executive dashboard featuring 4 live KPI metric cards, quick actions, and recent invoice activity.
- `create-invoice.html` — Dynamic invoice creation wizard:
  - Client selector with auto-filling address, GSTIN, and auto-inserting preset package items.
  - Multi-line service builder with sub-bullet deliverable item rows.
  - Live client-side tax computation before submission.
  - GST vs Non-GST toggle.
- `invoices.html` — Complete searchable invoice table with status badges (`PAID`, `PARTIALLY_PAID`, `ISSUED`, `CANCELLED`), quick payment recorder modal, and PDF triggers.
- `invoice-view.html` — High-fidelity in-browser invoice sheet matching printed format with Print and PDF download buttons.
- `clients.html` & `client-edit.html` — Master client directory with preset services configuration builder.
- `payments.html` — Complete ledger of all received payments, search by reference number, and invoice links.
- `reports.html` — Financial analysis tabbed interface (Sales Analytics, GSTR-1 Tax Summary, Outstanding Receivables) with CSV export.
- `services.html` — Services catalog with HSN/SAC codes, default rates, and GST rates.
- `settings.html` — Agency profile configuration, bank accounts, UPI setup, and invoice terms.
- `audit.html` — Visual timeline of all user actions across the application.

### 2. Auditor Portal (`/frontend/auditor/`)
- `dashboard.html` — Financial health overview for accounting and audit review.
- `invoices.html` — Filterable invoice review table with Month/Year picker.
- `invoice-view.html` — Read-only verification view.
- `reports.html` — Tax filing reconciliation reports (GSTR-1, CGST/SGST/IGST breakdown).
- `audit-log.html` — Compliance audit trails with old-value vs new-value JSON diffs.

### 3. Client Portal (`/frontend/client/`)
- `dashboard.html` — Client overview showing their specific total billed, total paid, pending balances, and invoice list.
- `invoice-view.html` — Clean view of their invoice with direct download button.

---

## ⚙ Core Feature & Business Logic

### 1. Sequential Invoice Auto-Numbering
- Invoices are automatically numbered sequentially per financial year.
- Query checks `invoice_sequences` table inside a transaction with lock to prevent race conditions.
- Format: `INV-YYYY-YY/XXXX` (e.g. `INV-2026-27/0026`) or `INV0026`.

### 2. GST & Tax Calculation Engine (`taxService.js`)
1. **Intra-State vs Inter-State Logic**:
   - The engine compares the `place_of_supply` with the agency's registered state (`Tamil Nadu`).
   - **Intra-State**: If `place_of_supply` contains "Tamil Nadu", the tax is split into **CGST (9%)** and **SGST (9%)**.
   - **Inter-State**: If outside Tamil Nadu, tax is levied as **IGST (18%)**.
2. **Line Item Math**:
   - `lineGross = quantity * rate`
   - `lineTaxable = lineGross - discount`
   - `lineTax = (lineTaxable * gstRate) / 100`
   - `lineTotal = lineTaxable + lineTax`
3. **Rounding & Currency Words**:
   - `roundOff = roundedGrandTotal - rawGrandTotal`
   - `amount_in_words` is calculated using the Indian Numbering System (Lakhs & Crores via `wordsService.js`).

### 3. Client Snapshot Pattern
- When an invoice is created, a complete JSON snapshot of the client's current details (Company name, address, GSTIN, PAN) is frozen into `invoices.client_snapshot_json`.
- **Reason**: Future modifications to the client master will never alter historical, legally issued tax invoices.

### 4. Client Preset Services
- Clients can have preset monthly packages (e.g., SEO, Meta Ads, WhatsApp API) stored in `preset_services_json`.
- Selecting a client in `create-invoice.html` automatically renders these preset line items and sub-bullet deliverables, saving time and preventing manual entry errors.

---

## 📄 PDF Generation Engine (`pdfService.js`)

The PDF engine uses `PDFKit` to produce crisp, publication-ready vector documents:
- **Clean Layout**: Professional margins, agency header, and official GST tax invoice title.
- **Client & Invoice Metadata**: Two-column layout with Billed To, GSTIN, Invoice No, Date, Due Date, and Place of Supply.
- **Itemized Table with Sub-bullets**: Supports multi-line descriptions with bullet points (`•`) for granular deliverables.
- **Tax Breakdown**: Clear subtotal, CGST, SGST, IGST, Round Off, and Grand Total boxes.
- **Amount in Words**: Formal Indian Rupee text representation.
- **Bank & UPI Payment Details**: HDFC Bank transfer details + GPay number.
- **Terms & Signatory Box**: Standard terms & conditions printed alongside the authorized signature block for `Srija R (Proprietrix)`.

---

## 🔧 Environment Variables & Configuration

Create a `.env` file inside the `backend/` directory:

```env
# Server Port
PORT=5000

# Database Configuration (MySQL)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=dgrow_invoice

# JWT Security
JWT_SECRET=dgrow_super_secret_jwt_key_2026_marketing_agency
```

---

## 🚀 Installation & Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or higher)
- [MySQL](https://www.mysql.com/) Server (v8.0 or higher) or XAMPP / WAMP / MariaDB

### 1. Clone the Repository
```bash
git clone https://github.com/Naveenpradeep02/dgrow-invoice.git
cd dgrow-invoice
```

### 2. Configure Database
Create a database named `dgrow_invoice` in MySQL:
```sql
CREATE DATABASE dgrow_invoice CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend Setup
```bash
cd backend
npm install
```

Configure your MySQL credentials in `backend/.env`.

### 4. Run the Application
```bash
# Start server in production mode
npm start

# Or start server in development mode (auto-reload)
npm run dev
```

### 5. Access the Web App
Open your browser and navigate to:
```text
http://localhost:5000
```
- The backend will automatically initialize all tables and seed default users on the first run.
- Log in with `admin@dgrow.com` / `admin123`.

---

## 🧪 Testing & Verification

The repository includes standalone automated test suites:

```bash
# Run full integration test suite (Auth, Invoicing, Tax Math, PDF Generation)
node backend/test_suite.js

# Run audit trail verification test
node backend/test_complete_audit.js

# Run frontend static routing verification
node backend/test_frontend_static.js
```

---

## 📄 License & Attribution

- **Project**: D-GROW Invoice & Financial Document Management System
- **Owner**: D-GROW Marketing Agency
- **Proprietrix / Authorized Signatory**: Srija R
- **License**: Proprietary / ISC
