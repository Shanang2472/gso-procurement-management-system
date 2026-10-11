USE `procurement_management_ocr`;

ALTER TABLE purchase_requests
  MODIFY status ENUM('Draft', 'Submitted', 'Pending', 'Budget_Review', 'GSO_Review', 'For_Approval', 'Approved', 'Returned', 'For_Correction', 'Disapproved', 'Cancelled', 'Completed') NOT NULL DEFAULT 'Draft';

ALTER TABLE purchase_orders
  MODIFY status ENUM('Draft', 'Issued', 'Signed', 'Partially_Delivered', 'Fully_Delivered', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Draft';

ALTER TABLE users
  MODIFY role ENUM('End User', 'GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'Supplier') NOT NULL,
  ADD COLUMN supplier_id INT DEFAULT NULL AFTER department_id,
  ADD INDEX idx_users_supplier (supplier_id);

ALTER TABLE users
  ADD CONSTRAINT fk_users_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS rfq_supplier_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfq_id INT NOT NULL,
    supplier_id INT NOT NULL,
    status ENUM('Invited', 'Responded', 'Declined', 'Expired') NOT NULL DEFAULT 'Invited',
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_rfq_supplier_invitation (rfq_id, supplier_id),
    FOREIGN KEY (rfq_id) REFERENCES rfq_records(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_quotations (
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

CREATE TABLE IF NOT EXISTS supplier_quotation_items (
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