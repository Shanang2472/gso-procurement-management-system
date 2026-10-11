-- Phase 4 finance reconciliation and payment controls migration.

CREATE TABLE IF NOT EXISTS budget_allotments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id INT NOT NULL,
    fiscal_year INT NOT NULL,
    allotment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_budget_allotment (department_id, fiscal_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS finance_reconciliation_exceptions (
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