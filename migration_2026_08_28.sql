-- Apply to an existing procurement_management_ocr database.
-- Back up the database before running migrations.
USE `procurement_management_ocr`;

ALTER TABLE purchase_requests
  MODIFY status ENUM('Draft', 'Submitted', 'Pending', 'Budget_Review', 'GSO_Review', 'For_Approval', 'Approved', 'Returned', 'For_Correction', 'Disapproved', 'Cancelled')
  NOT NULL DEFAULT 'Pending';

CREATE TABLE IF NOT EXISTS ris_records (
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

CREATE TABLE IF NOT EXISTS ris_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ris_id INT NOT NULL,
  asset_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  FOREIGN KEY (ris_id) REFERENCES ris_records(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES inventory_assets(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_ris_asset (ris_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS iirup_records (
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

CREATE TABLE IF NOT EXISTS iirup_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  iirup_id INT NOT NULL,
  asset_id INT NOT NULL,
  condition_notes TEXT NOT NULL,
  appraised_value DECIMAL(15, 2) DEFAULT NULL,
  FOREIGN KEY (iirup_id) REFERENCES iirup_records(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES inventory_assets(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_iirup_asset (iirup_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_movements (
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

CREATE TABLE IF NOT EXISTS notifications (
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

CREATE TABLE IF NOT EXISTS payments (
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

CREATE TABLE IF NOT EXISTS payment_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  document_no VARCHAR(150) NOT NULL,
  document_url VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  INDEX idx_payment_document_payment (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

