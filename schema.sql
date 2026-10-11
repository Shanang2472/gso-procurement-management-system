-- GSO Procurement Management System Database Schema (MySQL Compatible)
-- Adhering strictly to RA 9184 and Philippine COA Guidelines

-- Database name must match the system database used by the app
CREATE DATABASE IF NOT EXISTS `procurement_management_ocr` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `procurement_management_ocr`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS supplier_quotation_items;
DROP TABLE IF EXISTS supplier_delivery_confirmations;
DROP TABLE IF EXISTS supplier_quotation_revisions;
DROP TABLE IF EXISTS supplier_email_verifications;
DROP TABLE IF EXISTS supplier_quotations;
DROP TABLE IF EXISTS rfq_supplier_invitations;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS document_records;
DROP TABLE IF EXISTS document_signatures;
DROP TABLE IF EXISTS finance_reconciliation_exceptions;
DROP TABLE IF EXISTS budget_allotments;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS philgeps_postings;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS inventory_assets;
DROP TABLE IF EXISTS asset_movements;
DROP TABLE IF EXISTS iirup_items;
DROP TABLE IF EXISTS iirup_records;
DROP TABLE IF EXISTS ris_items;
DROP TABLE IF EXISTS ris_records;
DROP TABLE IF EXISTS iar_items;
DROP TABLE IF EXISTS iar_records;
DROP TABLE IF EXISTS notices_to_proceed;
DROP TABLE IF EXISTS po_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS notices_of_award;
DROP TABLE IF EXISTS bac_resolutions;
DROP TABLE IF EXISTS abstract_bids;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS rfq_items;
DROP TABLE IF EXISTS rfq_records;
DROP TABLE IF EXISTS pr_items;
DROP TABLE IF EXISTS purchase_requests;
DROP TABLE IF EXISTS ppmp_items;
DROP TABLE IF EXISTS departments;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Departments / Offices
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    head_name VARCHAR(150) NOT NULL,
    head_designation VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed departments
INSERT INTO departments (name, code, head_name, head_designation) VALUES
('Mayor\'s Office', 'MO', 'Hon. Johnielle Keith Pasion Nieto', 'Municipal Mayor'),
('Budget Office', 'MBO', 'Engr. Roberto D. Santos', 'Municipal Budget Officer'),
('Accounting Office', 'MACCT', 'Mrs. Teresa V. Jose', 'Municipal Accountant'),
('General Services Office', 'GSO', 'Mr. Arthur N. Ramos', 'General Services Officer'),
('Municipal Health Office', 'MHO', 'Dr. Elena S. Perez', 'Municipal Health Officer'),
('Engineering Office', 'ME', 'Engr. Manuel C. Aquino', 'Municipal Engineer');

-- Seed users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) DEFAULT NULL UNIQUE,
    role ENUM('End User', 'GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'Supplier') NOT NULL,
    department_id INT DEFAULT NULL,
    supplier_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, username, password_hash, salt, name, role, department_id, created_at) VALUES
(1, 'enduser', '15b4baa52c9496ead5adf3920985f7573cc8b44b68d38b10b6661e265c2ee00e', 'salt1', 'Dr. Elena Perez', 'End User', 5, '2026-07-07 03:28:32'),
(2, 'gso', '5858e9b0276f27e634ebde78dd72de0541c97e045acd0d7806e0cc6b219bf619', 'salt2', 'Arthur N. Ramos', 'GSO Officer', 4, '2026-07-07 03:28:32'),
(3, 'bac', '2b64380d55fdca8924072e14fb144f53856c64f5dc9787b71b80557f22b3cc40', 'salt3', 'Atty. Susan Cruz', 'BAC Secretariat', NULL, '2026-07-07 03:28:32'),
(4, 'budget', '1bca546aa483661f915983d206bc54058f91aa8a8551fa0d983bb47bcd4ae771', 'salt4', 'Engr. Roberto D. Santos', 'Budget Officer', 2, '2026-07-07 03:28:32'),
(5, 'mayor', '18a5ad040093142c283378380dfe7ca9b48ecc683f0f5e966daf2f6243f358a8', 'salt5', 'Hon. Johnielle Keith Pasion Nieto', 'Mayor', 1, '2026-07-07 03:28:32');

-- 2. PPMP Items (Project Procurement Management Plan)
CREATE TABLE ppmp_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    year INT NOT NULL,
    category ENUM('Supplies', 'Equipment', 'Infra') NOT NULL,
    description TEXT NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_cost DECIMAL(15, 2) NOT NULL,
    q1_qty INT NOT NULL DEFAULT 0,
    q2_qty INT NOT NULL DEFAULT 0,
    q3_qty INT NOT NULL DEFAULT 0,
    q4_qty INT NOT NULL DEFAULT 0,
    total_qty INT NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    mode_of_procurement VARCHAR(100) NOT NULL,
    source_of_funds VARCHAR(100) NOT NULL DEFAULT 'General Fund',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    INDEX idx_ppmp_dept_year (department_id, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed PPMP Items
INSERT INTO ppmp_items (department_id, year, category, description, unit, unit_cost, q1_qty, q2_qty, q3_qty, q4_qty, total_qty, total_cost, mode_of_procurement, source_of_funds) VALUES
(5, 2026, 'Supplies', 'Medical Grade Disposable Facemasks (50pcs/box)', 'box', 150.00, 100, 100, 100, 100, 400, 60000.00, 'Shopping', 'General Fund'),
(5, 2026, 'Equipment', 'Defibrillator Automated External (AED)', 'unit', 120000.00, 1, 0, 0, 0, 1, 120000.00, 'Small Value Procurement', 'General Fund'),
(1, 2026, 'Supplies', 'Premium A4 Copy Paper 80gsm', 'ream', 220.00, 50, 50, 50, 50, 200, 44000.00, 'Shopping', 'General Fund'),
(1, 2026, 'Equipment', 'Heavy Duty Office Laptop i7 16GB RAM', 'unit', 65000.00, 2, 0, 1, 0, 3, 195000.00, 'Small Value Procurement', 'General Fund'),
(6, 2026, 'Infra', 'Rehabilitation of Municipal Hall Lobby', 'lot', 450000.00, 0, 1, 0, 0, 1, 450000.00, 'Public Bidding', 'Special Education Fund');

-- 3. Purchase Requests (Appendix 60 format)
CREATE TABLE purchase_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pr_no VARCHAR(100) NOT NULL UNIQUE, -- Format: YYYY-MM-XXXX
    date DATE NOT NULL,
    department_id INT NOT NULL,
    section VARCHAR(150) DEFAULT 'Main',
    purpose TEXT NOT NULL,
    requested_by_name VARCHAR(150) NOT NULL,
    requested_by_designation VARCHAR(150) NOT NULL,
    approved_by_name VARCHAR(150) NOT NULL,
    approved_by_designation VARCHAR(150) NOT NULL,
    status ENUM('Draft', 'Submitted', 'Pending', 'Budget_Review', 'GSO_Review', 'For_Approval', 'Approved', 'Returned', 'For_Correction', 'Disapproved', 'Cancelled', 'Completed') NOT NULL DEFAULT 'Draft',
    alobs_number VARCHAR(100) DEFAULT NULL, -- Obligation Slip
    alobs_date DATE DEFAULT NULL,
    mode_of_procurement VARCHAR(100) DEFAULT NULL, -- Determined by GSO
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    INDEX idx_pr_no (pr_no),
    INDEX idx_pr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed PRs
INSERT INTO purchase_requests (pr_no, date, department_id, section, purpose, requested_by_name, requested_by_designation, approved_by_name, approved_by_designation, status, alobs_number, alobs_date, mode_of_procurement) VALUES
('2026-07-0001', '2026-07-01', 5, 'Clinic', 'For emergency response units in various barangays.', 'Dr. Elena S. Perez', 'Municipal Health Officer', 'Hon. Johnielle Keith Pasion Nieto', 'Municipal Mayor', 'Approved', 'ALOBS-26-07-0105', '2026-07-02', 'Small Value Procurement'),
('2026-07-0002', '2026-07-03', 1, 'Administrative', 'To upgrade executive staff computers for efficient report writing.', 'Hon. Johnielle Keith Pasion Nieto', 'Municipal Mayor', 'Hon. Johnielle Keith Pasion Nieto', 'Municipal Mayor', 'Budget_Review', NULL, NULL, NULL);

-- 4. PR Items
CREATE TABLE pr_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pr_id INT NOT NULL,
    ppmp_item_id INT DEFAULT NULL,
    item_no INT NOT NULL,
    unit VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (ppmp_item_id) REFERENCES ppmp_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed PR items
INSERT INTO pr_items (pr_id, ppmp_item_id, item_no, unit, description, quantity, unit_cost, total_cost) VALUES
(1, 2, 1, 'unit', 'Defibrillator Automated External (AED)', 1, 120000.00, 120000.00),
(2, 4, 1, 'unit', 'Heavy Duty Office Laptop i7 16GB RAM', 2, 65000.00, 130000.00);

-- 5. RFQ Records (Request for Quotation)
CREATE TABLE rfq_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_no VARCHAR(100) NOT NULL UNIQUE, -- Format: RFQ-YYYY-MM-XXXX
    pr_id INT NOT NULL,
    open_date DATE NOT NULL,
    close_date DATE NOT NULL,
    status ENUM('Draft', 'Published', 'Closed') NOT NULL DEFAULT 'Draft',
    terms_and_conditions TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
    INDEX idx_rfq_no (rfq_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed RFQ
INSERT INTO rfq_records (rfq_no, pr_id, open_date, close_date, status, terms_and_conditions) VALUES
('RFQ-2026-07-0001', 1, '2026-07-03', '2026-07-10', 'Published', '1. All entries must be typewritten or legibly written.\n2. Delivery period within 15 calendar days.\n3. Warranty shall be for a period of six (6) months for supplies & materials, one (1) year for equipment.\n4. Price validity shall be for a period of 60 calendar days.');

-- 6. RFQ Items
CREATE TABLE rfq_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL,
    pr_item_id INT NOT NULL,
    item_no INT NOT NULL,
    unit VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    quantity INT NOT NULL,
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (pr_item_id) REFERENCES pr_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed RFQ Items
INSERT INTO rfq_items (rfq_id, pr_item_id, item_no, unit, description, quantity) VALUES
(1, 1, 1, 'unit', 'Defibrillator Automated External (AED)', 1);

-- 7. Suppliers
CREATE TABLE suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    tin VARCHAR(50) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    contact_no VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    performance_rating INT DEFAULT 0,
    performance_notes TEXT DEFAULT NULL,
    supplier_status VARCHAR(40) NOT NULL DEFAULT 'Active',
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    compliance_notes TEXT DEFAULT NULL,
    approved_at TIMESTAMP NULL,
    approved_by VARCHAR(150) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD CONSTRAINT fk_users_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- Seed Suppliers
INSERT INTO suppliers (name, address, tin, contact_person, contact_no, email) VALUES
('Manila Medical Equipment Corp.', '124 Rizal Ave, Manila', '111-222-333-000', 'Juan Dela Cruz', '0917-123-4567', 'juan@manilamedical.com'),
('Northern Health Supplies Inc.', '45 Sessions Road, Baguio City', '444-555-666-000', 'Maria Santos', '0918-987-6543', 'maria@northernhealth.ph'),
('Apex Diagnostics Philippines', '789 EDSA, Quezon City', '777-888-999-000', 'David Lim', '0922-333-4444', 'sales@apexdiag.ph');

-- 8. Abstract of Canvass (AOC Bids)
CREATE TABLE abstract_bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL,
    supplier_id INT NOT NULL,
    pr_item_id INT NOT NULL,
    offered_unit_price DECIMAL(15, 2) NOT NULL,
    offered_total_price DECIMAL(15, 2) NOT NULL,
    is_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    is_lowest_bidder BOOLEAN NOT NULL DEFAULT FALSE,
    remarks TEXT DEFAULT NULL,
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (pr_item_id) REFERENCES pr_items(id) ON DELETE CASCADE,
    INDEX idx_abstract_rfq (rfq_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rfq_supplier_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL,
    supplier_id INT NOT NULL,
    status ENUM('Invited', 'Accepted', 'Responded', 'Declined', 'Expired') NOT NULL DEFAULT 'Invited',
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_rfq_supplier_invitation (rfq_id, supplier_id),
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplier_quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL,
    supplier_id INT NOT NULL,
    submitted_by_user_id INT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('Submitted', 'Withdrawn', 'Disqualified') NOT NULL DEFAULT 'Submitted',
    remarks TEXT DEFAULT NULL,
    UNIQUE KEY uq_supplier_quotation (rfq_id, supplier_id),
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (submitted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplier_quotation_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    pr_item_id INT NOT NULL,
    offered_unit_price DECIMAL(15, 2) NOT NULL,
    offered_total_price DECIMAL(15, 2) NOT NULL,
    is_compliant BOOLEAN NOT NULL DEFAULT TRUE,
    remarks TEXT DEFAULT NULL,
    UNIQUE KEY uq_supplier_quotation_item (quotation_id, pr_item_id),
    FOREIGN KEY (quotation_id) REFERENCES supplier_quotations(id) ON DELETE CASCADE,
    FOREIGN KEY (pr_item_id) REFERENCES pr_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplier_email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    email VARCHAR(150) NOT NULL,
    code_hash VARCHAR(128) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    verified_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_supplier_verification (supplier_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplier_quotation_revisions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    revision_no INT NOT NULL,
    payload TEXT NOT NULL,
    submitted_by_user_id INT DEFAULT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_quotation_revision (quotation_id, revision_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE supplier_delivery_confirmations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    supplier_id INT NOT NULL,
    confirmation_no VARCHAR(100) NOT NULL UNIQUE,
    delivery_date DATE NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
    remarks TEXT DEFAULT NULL,
    created_by_user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed AOC bids for AED
INSERT INTO abstract_bids (rfq_id, supplier_id, pr_item_id, offered_unit_price, offered_total_price, is_compliant, is_lowest_bidder, remarks) VALUES
(1, 1, 1, 118000.00, 118000.00, TRUE, TRUE, 'Compliant with all technical specs.'),
(1, 2, 1, 119500.00, 119500.00, TRUE, FALSE, 'Compliant. Slower delivery terms.'),
(1, 3, 1, 125000.00, 125000.00, FALSE, FALSE, 'Disqualified. Price exceeds Approved Budget for Contract (ABC) of 120,000.00');

-- 9. BAC Resolutions
CREATE TABLE bac_resolutions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resolution_no VARCHAR(100) NOT NULL UNIQUE, -- Format: BAC-YYYY-XXXX
    rfq_id INT NOT NULL,
    date_passed DATE NOT NULL,
    winning_supplier_id INT NOT NULL,
    type_of_bidding VARCHAR(150) NOT NULL,
    justification TEXT NOT NULL,
    status ENUM('Draft', 'Approved', 'Signed') NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (winning_supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed BAC Resolution
INSERT INTO bac_resolutions (resolution_no, rfq_id, date_passed, winning_supplier_id, type_of_bidding, justification, status) VALUES
('BAC-2026-0089', 1, '2026-07-12', 1, 'Alternative Mode - Small Value Procurement', 'Manila Medical Equipment Corp. submitted the Lowest Calculated and Responsive Bid (LCRB) complying with all required technical specifications.', 'Signed');

-- 10. Notices of Award (NOA)
CREATE TABLE notices_of_award (
    id INT AUTO_INCREMENT PRIMARY KEY,
    noa_no VARCHAR(100) NOT NULL UNIQUE, -- Format: NOA-YYYY-XXXX
    bac_resolution_id INT NOT NULL,
    rfq_id INT NOT NULL,
    supplier_id INT NOT NULL,
    date_issued DATE NOT NULL,
    status ENUM('Issued', 'Accepted') NOT NULL DEFAULT 'Issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bac_resolution_id) REFERENCES bac_resolutions(id) ON DELETE RESTRICT,
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed NOA
INSERT INTO notices_of_award (noa_no, bac_resolution_id, rfq_id, supplier_id, date_issued, status) VALUES
('NOA-2026-0045', 1, 1, 1, '2026-07-14', 'Accepted');

-- 11. Purchase Orders (Appendix 61 format)
CREATE TABLE purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_no VARCHAR(100) NOT NULL UNIQUE, -- Format: PO-YYYY-MM-XXXX
    pr_id INT NOT NULL,
    noa_id INT NOT NULL,
    supplier_id INT NOT NULL,
    po_date DATE NOT NULL,
    mode_of_procurement VARCHAR(150) NOT NULL,
    delivery_place VARCHAR(255) NOT NULL DEFAULT 'Municipal Hall, Supply Office',
    delivery_term VARCHAR(150) NOT NULL DEFAULT '15 Calendar Days upon receipt of NTP',
    payment_term VARCHAR(150) NOT NULL DEFAULT 'Charge Account (COA standard)',
    penalty_clause TEXT NOT NULL,
    status ENUM('Draft', 'Issued', 'Signed', 'Partially_Delivered', 'Fully_Delivered', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pr_id) REFERENCES purchase_requests(id) ON DELETE RESTRICT,
    FOREIGN KEY (noa_id) REFERENCES notices_of_award(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    INDEX idx_po_no (po_no),
    INDEX idx_po_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed PO
INSERT INTO purchase_orders (po_no, pr_id, noa_id, supplier_id, po_date, mode_of_procurement, penalty_clause, status) VALUES
('PO-2026-07-0001', 1, 1, 1, '2026-07-15', 'Small Value Procurement', 'In case of failure to make the full delivery within the time specified above, a penalty of one-tenth (1/10) of one percent for every day of delay shall be imposed on the undelivered item/s.', 'Signed');

-- 12. PO Items
CREATE TABLE po_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    pr_item_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(15, 2) NOT NULL,
    total_cost DECIMAL(15, 2) NOT NULL,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (pr_item_id) REFERENCES pr_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed PO items
INSERT INTO po_items (po_id, pr_item_id, quantity, unit_cost, total_cost) VALUES
(1, 1, 1, 118000.00, 118000.00);

-- 13. Notices to Proceed (NTP)
CREATE TABLE notices_to_proceed (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ntp_no VARCHAR(100) NOT NULL UNIQUE, -- Format: NTP-YYYY-XXXX
    po_id INT NOT NULL,
    date_issued DATE NOT NULL,
    delivery_period_days INT NOT NULL DEFAULT 15,
    status ENUM('Issued', 'Active', 'Completed') NOT NULL DEFAULT 'Issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed NTP
INSERT INTO notices_to_proceed (ntp_no, po_id, date_issued, delivery_period_days, status) VALUES
('NTP-2026-0038', 1, '2026-07-16', 15, 'Active');

-- 14. Inspection and Acceptance Reports (Appendix 62 format)
CREATE TABLE iar_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iar_no VARCHAR(100) NOT NULL UNIQUE, -- Format: IAR-YYYY-MM-XXXX
    po_id INT NOT NULL,
    invoice_no VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    date_inspected DATE DEFAULT NULL,
    date_accepted DATE DEFAULT NULL,
    inspection_remarks TEXT DEFAULT NULL,
    acceptance_remarks TEXT DEFAULT NULL,
    status ENUM('Draft', 'Submitted', 'Partial', 'Completed') NOT NULL DEFAULT 'Draft',
    inspected_by VARCHAR(150) NOT NULL DEFAULT 'LGU Inspection Committee',
    accepted_by VARCHAR(150) NOT NULL DEFAULT 'Municipal Supply Officer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    INDEX idx_iar_no (iar_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed IAR
INSERT INTO iar_records (iar_no, po_id, invoice_no, invoice_date, date_inspected, date_accepted, inspection_remarks, acceptance_remarks, status) VALUES
('IAR-2026-07-0001', 1, 'INV-998822', '2026-07-20', '2026-07-21', '2026-07-21', 'All components verified brand new, working, and matching required medical-grade specifications.', 'Inspected, accepted and turned over to GSO Inventory.', 'Completed');

-- 15. IAR Items
CREATE TABLE iar_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iar_id INT NOT NULL,
    po_item_id INT NOT NULL,
    quantity_delivered INT NOT NULL,
    is_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (iar_id) REFERENCES iar_records(id) ON DELETE CASCADE,
    FOREIGN KEY (po_item_id) REFERENCES po_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed IAR Items
INSERT INTO iar_items (iar_id, po_item_id, quantity_delivered, is_accepted) VALUES
(1, 1, 1, TRUE);

-- 16. Inventory Assets (ICS / PAR)
CREATE TABLE inventory_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iar_item_id INT NOT NULL,
    property_no VARCHAR(100) NOT NULL UNIQUE, -- Format: LGU-YEAR-XXXX
    description TEXT NOT NULL,
    unit VARCHAR(50) NOT NULL,
    cost DECIMAL(15, 2) NOT NULL,
    date_acquired DATE NOT NULL,
    type ENUM('ICS', 'PAR') NOT NULL, -- ICS < 50,000 | PAR >= 50,000
    assigned_to_user_id INT NOT NULL, -- Department ID
    receiver_name VARCHAR(150) NOT NULL,
    receiver_designation VARCHAR(150) NOT NULL,
    issuer_name VARCHAR(150) NOT NULL DEFAULT 'Arthur N. Ramos', -- GSO Officer
    status ENUM('Active', 'Condemned', 'Transferred') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (iar_item_id) REFERENCES iar_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_to_user_id) REFERENCES departments(id) ON DELETE RESTRICT,
    INDEX idx_prop_no (property_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16b. Consumable supplies inventory ledger
CREATE TABLE inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_code VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Supplies',
    unit VARCHAR(50) NOT NULL,
    reorder_level DECIMAL(15, 3) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory_items_active (active),
    INDEX idx_inventory_items_description (description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_item_id INT NOT NULL,
    transaction_type ENUM('RECEIVE', 'ISSUE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'DISPOSAL') NOT NULL,
    quantity DECIMAL(15, 3) NOT NULL,
    unit_cost DECIMAL(15, 2) DEFAULT NULL,
    from_department_id INT DEFAULT NULL,
    to_department_id INT DEFAULT NULL,
    reference_table VARCHAR(100) DEFAULT NULL,
    reference_id INT DEFAULT NULL,
    performed_by VARCHAR(150) NOT NULL,
    transaction_date DATE NOT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (from_department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (to_department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    INDEX idx_inventory_transactions_item (inventory_item_id),
    INDEX idx_inventory_transactions_to_department (to_department_id),
    INDEX idx_inventory_transactions_from_department (from_department_id),
    INDEX idx_inventory_transactions_date (transaction_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16c. Requisition and Issuance Slips
CREATE TABLE ris_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ris_no VARCHAR(100) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    requisitioner_name VARCHAR(150) NOT NULL,
    requisitioner_designation VARCHAR(150) NOT NULL,
    issued_by VARCHAR(150) NOT NULL,
    date_issued DATE NOT NULL,
    purpose TEXT NOT NULL,
    status ENUM('Draft', 'Issued', 'Returned', 'Cancelled') NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ris_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ris_id INT NOT NULL,
    asset_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (ris_id) REFERENCES ris_records(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES inventory_assets(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_ris_asset (ris_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16c. Inventory and Inspection Reports of Unserviceable Property
CREATE TABLE iirup_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iirup_no VARCHAR(100) NOT NULL UNIQUE,
    department_id INT NOT NULL,
    inspection_date DATE NOT NULL,
    prepared_by VARCHAR(150) NOT NULL,
    reason TEXT NOT NULL,
    disposal_method ENUM('Public Auction', 'Negotiated Sale', 'Donation', 'Destruction', 'Transfer') DEFAULT NULL,
    coa_authority_no VARCHAR(100) DEFAULT NULL,
    status ENUM('Draft', 'Submitted', 'Approved', 'Disposed', 'Cancelled') NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE iirup_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    iirup_id INT NOT NULL,
    asset_id INT NOT NULL,
    condition_notes TEXT NOT NULL,
    appraised_value DECIMAL(15, 2) DEFAULT NULL,
    FOREIGN KEY (iirup_id) REFERENCES iirup_records(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES inventory_assets(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_iirup_asset (iirup_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16d. Immutable asset movement history
CREATE TABLE asset_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    movement_type ENUM('ISSUED', 'TRANSFERRED', 'RETURNED', 'DISPOSAL_REQUESTED', 'DISPOSED') NOT NULL,
    from_department_id INT DEFAULT NULL,
    to_department_id INT DEFAULT NULL,
    reference_table VARCHAR(100) DEFAULT NULL,
    reference_id INT DEFAULT NULL,
    performed_by VARCHAR(150) NOT NULL,
    movement_date DATE NOT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES inventory_assets(id) ON DELETE RESTRICT,
    FOREIGN KEY (from_department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (to_department_id) REFERENCES departments(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Assets
INSERT INTO inventory_assets (iar_item_id, property_no, description, unit, cost, date_acquired, type, assigned_to_user_id, receiver_name, receiver_designation, status) VALUES
(1, 'LGU-2026-0001', 'Defibrillator Automated External (AED) - Serial SN-AED99881', 'unit', 118000.00, '2026-07-21', 'PAR', 5, 'Dr. Elena S. Perez', 'Municipal Health Officer', 'Active');

-- 17. Audit Logs (Audit Trail)
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'
    old_value TEXT DEFAULT NULL,
    new_value TEXT DEFAULT NULL,
    user_role VARCHAR(100) NOT NULL DEFAULT 'GSO Staff',
    user_name VARCHAR(150) NOT NULL DEFAULT 'System Admin',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Audit logs
INSERT INTO audit_logs (table_name, record_id, action, old_value, new_value, user_role, user_name) VALUES
('purchase_requests', 1, 'STATUS_CHANGE', 'Pending', 'Budget_Review', 'Budget Officer', 'Engr. Roberto D. Santos'),
('purchase_requests', 1, 'STATUS_CHANGE', 'Budget_Review', 'GSO_Review', 'GSO Procurement Officer', 'Mr. Arthur N. Ramos'),
('purchase_requests', 1, 'STATUS_CHANGE', 'GSO_Review', 'Approved', 'Municipal Mayor', 'Hon. Johnielle Keith Pasion Nieto'),
('purchase_orders', 1, 'STATUS_CHANGE', 'Draft', 'Signed', 'General Services Officer', 'Mr. Arthur N. Ramos'),
('iar_records', 1, 'STATUS_CHANGE', 'Draft', 'Completed', 'GSO Supply Officer', 'Mr. Arthur N. Ramos');

-- 18. System Settings
CREATE TABLE system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    system_name VARCHAR(150) NOT NULL,
    municipal_name VARCHAR(200) NOT NULL,
    province_name VARCHAR(200) NOT NULL,
    mayor_name VARCHAR(200) NOT NULL,
    gso_officer_name VARCHAR(200) NOT NULL,
    budget_officer_name VARCHAR(200) NOT NULL,
    accountant_name VARCHAR(200) NOT NULL,
    bac_chairman_name VARCHAR(200) NOT NULL,
    treasurer_name VARCHAR(200) NOT NULL,
    penalty_clause_text TEXT NOT NULL,
    logo_data LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed System Settings
INSERT INTO system_settings (
    id,
    system_name,
    municipal_name,
    province_name,
    mayor_name,
    gso_officer_name,
    budget_officer_name,
    accountant_name,
    bac_chairman_name,
    treasurer_name,
    penalty_clause_text
) VALUES (
    1,
    'GovProcure MS',
    'MUNICIPALITY OF SAN JOSE',
    'Province of Bulacan',
    'HON. Johnielle Keith Pasion Nieto',
    'Arthur N. Ramos',
    'Engr. Roberto D. Santos',
    'Mrs. Teresa V. Jose',
    'Atty. Susan Cruz',
    'Mr. Arthur N. Ramos',
    'A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed.'
);

-- 19. PhilGEPS Postings
CREATE TABLE philgeps_postings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ref_no VARCHAR(100) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    associated_type VARCHAR(100) NOT NULL,
    associated_id INT NOT NULL,
    publish_date DATE NOT NULL,
    closing_date DATE NOT NULL,
    status VARCHAR(100) NOT NULL,
    xml_payload TEXT NOT NULL,
    api_response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20. Payments
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    payment_no VARCHAR(100) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    payment_method VARCHAR(100) NOT NULL DEFAULT 'Transfer',
    reference_no VARCHAR(150) DEFAULT NULL,
    status ENUM('Pending', 'For_Verification', 'Approved', 'Disbursed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    prepared_by VARCHAR(150) NOT NULL,
    checked_by VARCHAR(150) DEFAULT NULL,
    remarks TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    INDEX idx_payment_po (po_id),
    INDEX idx_payment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payment_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    document_no VARCHAR(150) DEFAULT NULL,
    document_url VARCHAR(255) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE budget_allotments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    fiscal_year INT NOT NULL,
    allotment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_budget_allotment (department_id, fiscal_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE finance_reconciliation_exceptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pr_id INT NOT NULL,
    code VARCHAR(80) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'Open',
    resolved_by VARCHAR(150) DEFAULT NULL,
    resolved_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_finance_exception_pr (pr_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 20a. Procurement Documents and Attachments
CREATE TABLE document_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(80) NOT NULL DEFAULT 'procurement',
    record_id INT NOT NULL DEFAULT 0,
    document_type VARCHAR(80) NOT NULL DEFAULT 'Attachment',
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) DEFAULT NULL,
    file_size INT NOT NULL DEFAULT 0,
    checksum VARCHAR(128) DEFAULT NULL,
    metadata TEXT DEFAULT NULL,
    mime_type VARCHAR(120) DEFAULT NULL,
    file_data MEDIUMBLOB DEFAULT NULL,
    encryption_version INT NOT NULL DEFAULT 0,
    extracted_text LONGTEXT DEFAULT NULL,
    ocr_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    version INT NOT NULL DEFAULT 1,
    status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
    created_by VARCHAR(120) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_document_record (table_name, record_id),
    INDEX idx_document_checksum (checksum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE document_signatures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    signature_hash VARCHAR(128) NOT NULL,
    signer_id INT DEFAULT NULL,
    signer_name VARCHAR(150) NOT NULL,
    signer_role VARCHAR(100) NOT NULL,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_document_signature (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 21. Notifications
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    user_name VARCHAR(150) DEFAULT NULL,
    department_id INT DEFAULT NULL,
    target_role VARCHAR(100) DEFAULT NULL,
    title VARCHAR(200) NOT NULL DEFAULT 'System Notification',
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_notif_user (user_id),
    INDEX idx_notif_dept (department_id),
    INDEX idx_notif_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Notifications
INSERT INTO notifications (user_id, department_id, target_role, title, message, type, is_read) VALUES
(1, 5, 'End User', 'PR Status Update', 'Your Purchase Request PR-2026-07-0001 has been approved by the Municipal Mayor.', 'success', FALSE),
(2, 4, 'GSO Officer', 'New Delivery Pending Inspection', 'Purchase Order PO-2026-07-0001 delivery has arrived for inspection.', 'info', FALSE);


