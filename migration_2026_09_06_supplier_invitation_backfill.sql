USE `procurement_management_ocr`;

INSERT IGNORE INTO rfq_supplier_invitations (rfq_id, supplier_id, status)
SELECT r.id, s.id, 'Invited'
FROM rfq_records r
CROSS JOIN suppliers s;