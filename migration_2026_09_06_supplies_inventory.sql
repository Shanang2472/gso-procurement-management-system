-- Consumable supplies inventory ledger.
-- Apply after migration_2026_08_28.sql.
USE `procurement_management_ocr`;

CREATE TABLE IF NOT EXISTS inventory_items (
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

CREATE TABLE IF NOT EXISTS inventory_transactions (
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
