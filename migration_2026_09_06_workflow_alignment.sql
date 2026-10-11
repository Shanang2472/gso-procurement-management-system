-- Align the live database with the roles used by the current application.
-- Run after backing up procurement_management_ocr.
USE `procurement_management_ocr`;

ALTER TABLE users
    MODIFY COLUMN role ENUM('End User', 'GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer') NOT NULL;

-- Preserve the payment lifecycle while making the transition contract explicit.
ALTER TABLE payments
    MODIFY COLUMN status ENUM('Pending', 'For_Verification', 'Approved', 'Disbursed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending';