USE `procurement_management_ocr`;

ALTER TABLE purchase_requests
  MODIFY status ENUM('Draft', 'Submitted', 'Pending', 'Budget_Review', 'GSO_Review', 'For_Approval', 'Approved', 'Returned', 'For_Correction', 'Disapproved', 'Cancelled', 'Completed') NOT NULL DEFAULT 'Draft';

ALTER TABLE purchase_orders
  MODIFY status ENUM('Draft', 'Issued', 'Signed', 'Partially_Delivered', 'Fully_Delivered', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Draft';