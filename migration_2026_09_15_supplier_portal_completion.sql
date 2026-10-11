-- Phase 2 supplier portal completion migration.
-- Run against existing MySQL deployments before enabling public supplier registration.

ALTER TABLE suppliers
  ADD COLUMN supplier_status VARCHAR(40) NOT NULL DEFAULT 'Active',
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN compliance_notes TEXT NULL,
  ADD COLUMN approved_at TIMESTAMP NULL,
  ADD COLUMN approved_by VARCHAR(150) NULL;

ALTER TABLE rfq_supplier_invitations
  MODIFY COLUMN status ENUM('Invited', 'Accepted', 'Responded', 'Declined', 'Expired') NOT NULL DEFAULT 'Invited';

CREATE TABLE IF NOT EXISTS supplier_email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NOT NULL,
  email VARCHAR(150) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_supplier_verification (supplier_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_quotation_revisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quotation_id INT NOT NULL,
  revision_no INT NOT NULL,
  payload TEXT NOT NULL,
  submitted_by_user_id INT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_quotation_revision (quotation_id, revision_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_delivery_confirmations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_id INT NOT NULL,
  supplier_id INT NOT NULL,
  confirmation_no VARCHAR(100) NOT NULL UNIQUE,
  delivery_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
  remarks TEXT NULL,
  created_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
