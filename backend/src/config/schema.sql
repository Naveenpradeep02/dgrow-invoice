-- =========================================================
-- D-GROW INVOICE SYSTEM - MYSQL DATABASE SCHEMA DDL
-- Agency: D-GROW Marketing Agency
-- =========================================================

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(150),
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100) DEFAULT 'Tamil Nadu',
  pincode VARCHAR(10),
  gstin VARCHAR(20),
  pan VARCHAR(20),
  billing_address TEXT,
  shipping_address TEXT,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  client_id INT NULL,
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Services Table
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hsn_sac VARCHAR(20) DEFAULT '998311',
  default_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  default_gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  unit VARCHAR(50) DEFAULT 'Service',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Tax Rates Table
CREATE TABLE IF NOT EXISTS tax_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rate_percentage DECIMAL(5,2) NOT NULL UNIQUE,
  description VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Company Settings Table
CREATE TABLE IF NOT EXISTS company_settings (
  id INT PRIMARY KEY DEFAULT 1,
  company_name VARCHAR(255) NOT NULL DEFAULT 'D-GROW MARKETING AGENCY',
  logo_url TEXT,
  gstin VARCHAR(20) DEFAULT '33OUUPS5195G1ZJ',
  address TEXT NOT NULL,
  city VARCHAR(100) DEFAULT 'Valasaravakkam, Chennai',
  state VARCHAR(100) DEFAULT 'Tamil Nadu',
  pincode VARCHAR(10) DEFAULT '600087',
  phone VARCHAR(100) DEFAULT '+91 9600401582 | +91 7373509585',
  email VARCHAR(150) DEFAULT 'dgrowmarkting@gmail.com',
  website VARCHAR(150) DEFAULT 'www.dgrowmarketing.com',
  bank_name VARCHAR(150) DEFAULT 'HDFC Bank',
  account_number VARCHAR(50) DEFAULT '50200090154952',
  ifsc_code VARCHAR(30) DEFAULT 'HDFC0000444',
  banking_name VARCHAR(150) DEFAULT 'D Grow Marketing Agency',
  branch_name VARCHAR(100) DEFAULT 'Velachery',
  gpay_number VARCHAR(30) DEFAULT '7373509585',
  upi_id VARCHAR(100) DEFAULT '7373509585@okbizaxis',
  authorized_person VARCHAR(100) DEFAULT 'Srija R',
  signature_title VARCHAR(100) DEFAULT 'Proprietrix',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Invoice Terms Table
CREATE TABLE IF NOT EXISTS invoice_terms (
  id INT PRIMARY KEY DEFAULT 1,
  scope_of_work TEXT,
  payment_terms TEXT,
  ownership_usage TEXT,
  confidentiality TEXT,
  cancellation_policy TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Invoice Sequences Table
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prefix VARCHAR(20) DEFAULT 'INV',
  financial_year VARCHAR(20) DEFAULT '2026-27',
  last_number INT DEFAULT 25,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  invoice_type ENUM('GST', 'GST_CLIENT', 'NON_GST') DEFAULT 'GST',
  client_id INT NOT NULL,
  client_snapshot_json LONGTEXT NOT NULL,
  place_of_supply VARCHAR(100) DEFAULT 'Tamil Nadu (33)',
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_terms_text VARCHAR(255) DEFAULT '100% payment in advance',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cgst_rate DECIMAL(5,2) DEFAULT 9.00,
  cgst_amount DECIMAL(12,2) DEFAULT 0.00,
  sgst_rate DECIMAL(5,2) DEFAULT 9.00,
  sgst_amount DECIMAL(12,2) DEFAULT 0.00,
  igst_rate DECIMAL(5,2) DEFAULT 0.00,
  igst_amount DECIMAL(12,2) DEFAULT 0.00,
  round_off DECIMAL(12,2) DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount_in_words VARCHAR(255) NOT NULL,
  status ENUM('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') DEFAULT 'ISSUED',
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_invoice_num (invoice_number),
  INDEX idx_client (client_id),
  INDEX idx_status (status),
  INDEX idx_date (invoice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  service_id INT NULL,
  description TEXT NOT NULL,
  hsn_sac VARCHAR(20) DEFAULT '998311',
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12,2) DEFAULT 0.00,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  item_order INT DEFAULT 1,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode ENUM('Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Other') DEFAULT 'UPI',
  reference_number VARCHAR(100),
  notes TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_pay_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_email VARCHAR(150),
  user_role VARCHAR(50),
  action ENUM('LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'ISSUE', 'CANCEL', 'PAYMENT', 'DOWNLOAD', 'EXPORT') NOT NULL,
  entity_type ENUM('INVOICE', 'CLIENT', 'SERVICE', 'PAYMENT', 'SETTINGS', 'USER') NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  old_data LONGTEXT NULL,
  new_data LONGTEXT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================
-- SEED DEFAULT DATA
-- =========================================================

-- Seed Roles
INSERT IGNORE INTO roles (id, name) VALUES (1, 'ADMIN'), (2, 'CLIENT'), (3, 'AUDITOR'), (4, 'MARKETING');

-- Seed Tax Rates
INSERT IGNORE INTO tax_rates (id, rate_percentage, description, is_active) VALUES
(1, 0.00, 'Exempted / Zero Tax', 1),
(2, 5.00, '5% GST', 1),
(3, 12.00, '12% GST', 1),
(4, 18.00, '18% Standard GST', 1),
(5, 28.00, '28% GST', 1);

-- Seed Company Settings
INSERT INTO company_settings (id, company_name, logo_url, gstin, address, city, state, pincode, phone, email, website, bank_name, account_number, ifsc_code, banking_name, branch_name, gpay_number, authorized_person, signature_title)
VALUES (
  1,
  'D-GROW MARKETING AGENCY',
  '/assets/dgrow-logo.png',
  '33OUUPS5195G1ZJ',
  'SF No: 14/3, Plot No. 141, Radha Ave Main Rd, Ganga Nagar, Valasaravakkam',
  'Chennai',
  'Tamil Nadu',
  '600087',
  '+91 9600401582 | +91 7373509585',
  'dgrowmarkting@gmail.com',
  'www.dgrowmarketing.com',
  'HDFC Bank',
  '50200090154952',
  'HDFC0000444',
  'D Grow Marketing Agency',
  'Velachery',
  '7373509585',
  'Srija R',
  'Proprietrix'
) ON DUPLICATE KEY UPDATE company_name=VALUES(company_name);

-- Seed Default Terms
INSERT INTO invoice_terms (id, scope_of_work, payment_terms, ownership_usage, confidentiality, cancellation_policy, notes)
VALUES (
  1,
  '1. Services include the specific digital marketing services mentioned in the invoice',
  '1. Full payment should be made every month in advance.',
  '1. The client receives ownership rights to the final deliverables upon full payment.\n2. The service provider retains the right to use completed work for portfolio and marketing purposes.',
  '1. Both parties agree to keep confidential any proprietary information shared during the project.',
  '1. The client will be billed for any work completed up to the cancellation date.',
  'Thanks for your business!'
) ON DUPLICATE KEY UPDATE scope_of_work=VALUES(scope_of_work), payment_terms=VALUES(payment_terms), ownership_usage=VALUES(ownership_usage), confidentiality=VALUES(confidentiality), cancellation_policy=VALUES(cancellation_policy);

-- Seed Invoice Sequence
INSERT INTO invoice_sequences (id, prefix, financial_year, last_number)
VALUES (1, 'INV', '2026-27', 0)
ON DUPLICATE KEY UPDATE prefix=VALUES(prefix);

-- Seed Sample Client (Marks Biotech)
INSERT INTO clients (id, company_name, contact_person, mobile, email, address, city, state, pincode, gstin, pan)
VALUES (
  1,
  'Marks Biotech',
  'Dr. Marks',
  '+91 9819893250',
  'contact@marksbiotech.com',
  '104/5, 6th street, S-1, 2nd floor, The Brown CLS Building, Radha Avenue, Valasaravakkam',
  'Chennai',
  'Tamil Nadu',
  '600087',
  NULL,
  'AAACM1234F'
) ON DUPLICATE KEY UPDATE company_name=VALUES(company_name);

-- 15. Enquiries Table
CREATE TABLE IF NOT EXISTS enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  mobile VARCHAR(30) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  source ENUM('WEBSITE', 'CALL', 'GMB', 'ADS', 'MARKETING_PERSON', 'OTHER') NOT NULL DEFAULT 'WEBSITE',
  marketing_person VARCHAR(150) NULL,
  services_interested TEXT NULL,
  estimated_budget DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('NEW', 'IN_DISCUSSION', 'QUOTATION_SENT', 'NEGOTIATION', 'ONBOARDED', 'LOST') NOT NULL DEFAULT 'NEW',
  notes TEXT NULL,
  converted_client_id INT NULL,
  onboarded_at DATETIME NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL,
  INDEX idx_enq_status (status),
  INDEX idx_enq_source (source),
  INDEX idx_enq_date (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Enquiry Timeline / Interaction History Table
CREATE TABLE IF NOT EXISTS enquiry_timeline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enquiry_id INT NOT NULL,
  event_type ENUM('NOTE', 'CALL', 'NEGOTIATION', 'STATUS_CHANGE', 'QUOTATION', 'ONBOARDED') NOT NULL DEFAULT 'NOTE',
  title VARCHAR(255) NOT NULL,
  details TEXT NULL,
  created_by_name VARCHAR(150) DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE,
  INDEX idx_timeline_enq (enquiry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. 3-Tier Multi-Package Proposals Table
CREATE TABLE IF NOT EXISTS package_proposals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposal_code VARCHAR(50) NOT NULL UNIQUE,
  share_token VARCHAR(100) NOT NULL UNIQUE,
  client_id INT DEFAULT NULL,
  client_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(150) DEFAULT NULL,
  mobile VARCHAR(30) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  title VARCHAR(255) DEFAULT 'Digital Marketing Growth Proposal',
  valid_until DATE DEFAULT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  billing_cycle VARCHAR(50) DEFAULT 'Monthly',
  packages_json LONGTEXT NOT NULL,
  selected_package_index INT DEFAULT NULL,
  selected_package_name VARCHAR(100) DEFAULT NULL,
  confirmed_at DATETIME DEFAULT NULL,
  client_confirmed_ip VARCHAR(50) DEFAULT NULL,
  status ENUM('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'CONVERTED') DEFAULT 'SENT',
  converted_quotation_id INT DEFAULT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_token (share_token),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_number VARCHAR(50) NOT NULL UNIQUE,
  client_id INT DEFAULT NULL,
  client_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(150) DEFAULT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  gstin VARCHAR(20) DEFAULT NULL,
  is_lead TINYINT(1) DEFAULT 1,
  quote_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  negotiation_percent DECIMAL(5,2) DEFAULT 0.00,
  negotiation_amount DECIMAL(12,2) DEFAULT 0.00,
  taxable_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  gst_amount DECIMAL(12,2) DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('DRAFT','SENT','NEGOTIATING','APPROVED','CONVERTED','REJECTED') DEFAULT 'SENT',
  items_json LONGTEXT NOT NULL,
  notes TEXT DEFAULT NULL,
  converted_invoice_id INT DEFAULT NULL,
  created_by INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_quote_client (client_id),
  INDEX idx_quote_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

