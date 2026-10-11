-- End-to-end procurement record seed.
-- Prerequisites: schema.sql, migration_2026_08_28.sql,
-- migration_2026_09_06_supplies_inventory.sql, and
-- migration_2026_09_06_workflow_alignment.sql have been applied.
-- This is a one-time seed record. Several child tables do not enforce
-- document-level uniqueness, so do not run it repeatedly without cleanup.

USE `procurement_management_ocr`;

SET FOREIGN_KEY_CHECKS = 1;
START TRANSACTION;

-- Resolve existing master data without relying on auto-increment values.
SET @dept_id = (SELECT id FROM departments WHERE code = 'MHO' LIMIT 1);
SET @gso_dept_id = (SELECT id FROM departments WHERE code = 'GSO' LIMIT 1);
SET @end_user_id = (SELECT id FROM users WHERE username = 'enduser' LIMIT 1);
SET @gso_user_id = (SELECT id FROM users WHERE username = 'gso' LIMIT 1);
SET @budget_user_id = (SELECT id FROM users WHERE username = 'budget' LIMIT 1);
SET @mayor_user_id = (SELECT id FROM users WHERE username = 'mayor' LIMIT 1);

-- 1. Planning: PPMP and approved Purchase Request.
INSERT INTO ppmp_items (
  department_id, year, category, description, unit, unit_cost,
  q1_qty, q2_qty, q3_qty, q4_qty, total_qty, total_cost,
  mode_of_procurement, source_of_funds
) VALUES (
  @dept_id, 2026, 'Equipment',
  'Portable Ultrasound Diagnostic System with convex and linear probes',
  'unit', 245000.00, 0, 1, 0, 0, 1, 245000.00,
  'Public Bidding', 'General Fund'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @ppmp_id = LAST_INSERT_ID();

INSERT INTO purchase_requests (
  pr_no, date, department_id, section, purpose,
  requested_by_name, requested_by_designation,
  approved_by_name, approved_by_designation, status,
  alobs_number, alobs_date, mode_of_procurement, remarks
) VALUES (
  'PR-2026-09-0101', '2026-09-01', @dept_id, 'Rural Health Unit',
  'Provision of a portable ultrasound system for maternal, emergency, and community diagnostic services.',
  'Dr. Elena S. Perez', 'Municipal Health Officer',
  'Hon. Johnielle Keith Pasion Nieto', 'Municipal Mayor', 'Approved',
  'ALOBS-26-09-0199', '2026-09-02', 'Public Bidding',
  'Included in the approved 2026 PPMP; budget certification completed.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @pr_id = LAST_INSERT_ID();

INSERT INTO pr_items (
  pr_id, ppmp_item_id, item_no, unit, description, quantity, unit_cost, total_cost
) VALUES (
  @pr_id, @ppmp_id, 1, 'unit',
  'Portable Ultrasound Diagnostic System with convex and linear probes',
  1, 245000.00, 245000.00
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @pr_item_id = LAST_INSERT_ID();

-- 2. RFQ/solicitation and PhilGEPS posting.
INSERT INTO rfq_records (
  rfq_no, pr_id, open_date, close_date, status, terms_and_conditions
) VALUES (
  'RFQ-2026-09-0101', @pr_id, '2026-09-03', '2026-09-17', 'Closed',
  'Complete technical specifications required. Delivery within 30 calendar days from NTP. Price validity: 60 calendar days. Warranty: at least one year. Supplier must submit current registration, tax clearance, and eligibility documents.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @rfq_id = LAST_INSERT_ID();

INSERT INTO rfq_items (rfq_id, pr_item_id, item_no, unit, description, quantity)
VALUES (@rfq_id, @pr_item_id, 1, 'unit',
  'Portable Ultrasound Diagnostic System with convex and linear probes', 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @rfq_item_id = LAST_INSERT_ID();

INSERT INTO suppliers (name, address, tin, contact_person, contact_no, email)
VALUES ('HealthTech Diagnostic Solutions, Inc.', '88 Bonifacio Avenue, Quezon City',
  '123-456-789-000', 'Rafael M. Dizon', '0917-555-0188', 'bids@healthtechdiagnostic.ph')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @supplier_id = LAST_INSERT_ID();

INSERT INTO philgeps_postings (
  ref_no, title, associated_type, associated_id, publish_date, closing_date,
  status, xml_payload, api_response
) VALUES (
  'PHILGEPS-2026-09-0101',
  'Procurement of Portable Ultrasound Diagnostic System',
  'rfq', @rfq_id, '2026-09-03', '2026-09-17', 'Closed',
  '<posting><reference>PHILGEPS-2026-09-0101</reference><status>Closed</status></posting>',
  '{"status":"PUBLISHED","reference":"PHILGEPS-2026-09-0101"}'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @posting_id = LAST_INSERT_ID();

-- 3. Bidding/abstract and BAC award/resolution.
INSERT INTO abstract_bids (
  rfq_id, supplier_id, pr_item_id, offered_unit_price, offered_total_price,
  is_compliant, is_lowest_bidder, remarks
) VALUES (
  @rfq_id, @supplier_id, @pr_item_id, 238500.00, 238500.00,
  TRUE, TRUE, 'Lowest Calculated and Responsive Bid; eligibility, technical, and financial documents verified.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @bid_id = LAST_INSERT_ID();

INSERT INTO bac_resolutions (
  resolution_no, rfq_id, date_passed, winning_supplier_id, type_of_bidding,
  justification, status
) VALUES (
  'BAC-2026-0098', @rfq_id, '2026-09-19', @supplier_id,
  'Public Bidding',
  'After evaluation of eligibility, technical, and financial submissions, HealthTech Diagnostic Solutions, Inc. was determined to have the Lowest Calculated and Responsive Bid at PHP 238,500.00.',
  'Signed'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @resolution_id = LAST_INSERT_ID();

INSERT INTO notices_of_award (
  noa_no, bac_resolution_id, rfq_id, supplier_id, date_issued, status
) VALUES (
  'NOA-2026-0082', @resolution_id, @rfq_id, @supplier_id, '2026-09-21', 'Accepted'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @noa_id = LAST_INSERT_ID();

-- 4. Contract/PO and Notice to Proceed.
INSERT INTO purchase_orders (
  po_no, pr_id, noa_id, supplier_id, po_date, mode_of_procurement,
  delivery_place, delivery_term, payment_term, penalty_clause, status
) VALUES (
  'PO-2026-09-0101', @pr_id, @noa_id, @supplier_id, '2026-09-23',
  'Public Bidding', 'Municipal Health Office Supply Room',
  '30 Calendar Days upon receipt of NTP', 'Within 30 days after complete delivery and acceptance',
  'A penalty of one-tenth (1/10) of one percent (1%) of the value of delayed goods for every day of delay shall be imposed.',
  'Signed'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @po_id = LAST_INSERT_ID();

INSERT INTO po_items (po_id, pr_item_id, quantity, unit_cost, total_cost)
VALUES (@po_id, @pr_item_id, 1, 238500.00, 238500.00)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @po_item_id = LAST_INSERT_ID();

INSERT INTO notices_to_proceed (
  ntp_no, po_id, date_issued, delivery_period_days, status
) VALUES ('NTP-2026-0071', @po_id, '2026-09-24', 30, 'Completed')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @ntp_id = LAST_INSERT_ID();

-- 5. Delivery, inspection, acceptance, and property tag.
INSERT INTO iar_records (
  iar_no, po_id, invoice_no, invoice_date, date_inspected, date_accepted,
  inspection_remarks, acceptance_remarks, status, inspected_by, accepted_by
) VALUES (
  'IAR-2026-10-0101', @po_id, 'HTDS-INV-2026-1044', '2026-10-20',
  '2026-10-21', '2026-10-21',
  'Serial number HTDS-US-2601044, probes, battery, charger, and accessories verified against specifications and found operational.',
  'Accepted and received in good condition for municipal use; recorded by the GSO Supply Office.',
  'Completed', 'LGU Inspection Committee', 'Arthur N. Ramos'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @iar_id = LAST_INSERT_ID();

INSERT INTO iar_items (iar_id, po_item_id, quantity_delivered, is_accepted)
VALUES (@iar_id, @po_item_id, 1, TRUE)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @iar_item_id = LAST_INSERT_ID();

INSERT INTO inventory_assets (
  iar_item_id, property_no, description, unit, cost, date_acquired, type,
  assigned_to_user_id, receiver_name, receiver_designation, issuer_name, status
) VALUES (
  @iar_item_id, 'LGU-2026-0101',
  'Portable Ultrasound Diagnostic System - Serial HTDS-US-2601044',
  'unit', 238500.00, '2026-10-21', 'PAR', @dept_id,
  'Dr. Elena S. Perez', 'Municipal Health Officer', 'Arthur N. Ramos', 'Active'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @asset_id = LAST_INSERT_ID();

-- 6. Payment and disbursement supporting documents.
INSERT INTO payments (
  po_id, payment_no, payment_date, amount, payment_method, reference_no,
  status, prepared_by, checked_by, remarks
) VALUES (
  @po_id, 'DV-2026-10-0101', '2026-10-28', 238500.00, 'Government Check',
  'LDDAP-ADA-2026-10-7781', 'Completed', 'Mrs. Teresa V. Jose',
  'Engr. Roberto D. Santos', 'Complete supporting documents: PO, NOA, NTP, IAR, invoice, and acceptance documents.'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @payment_id = LAST_INSERT_ID();

INSERT INTO payment_documents (payment_id, document_type, document_no, notes)
VALUES
  (@payment_id, 'Disbursement Voucher', 'DV-2026-10-0101', 'Certified complete and properly supported.'),
  (@payment_id, 'Invoice', 'HTDS-INV-2026-1044', 'Supplier invoice matched with accepted delivery.'),
  (@payment_id, 'LDDAP-ADA', 'LDDAP-ADA-2026-10-7781', 'Payment released through authorized government disbursement.'),
  (@payment_id, 'Certificate of Completion', 'COC-2026-10-0101', 'Issued after full delivery and acceptance.');

-- 7. Inventory receipt and RIS issuance to the requesting office.
INSERT INTO ris_records (
  ris_no, department_id, requisitioner_name, requisitioner_designation,
  issued_by, date_issued, purpose, status
) VALUES (
  'RIS-2026-10-0101', @dept_id, 'Dr. Elena S. Perez', 'Municipal Health Officer',
  'Arthur N. Ramos', '2026-10-23',
  'Issuance for maternal, emergency, and community diagnostic services.', 'Issued'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @ris_id = LAST_INSERT_ID();

INSERT INTO ris_items (ris_id, asset_id, quantity)
VALUES (@ris_id, @asset_id, 1)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @ris_item_id = LAST_INSERT_ID();

INSERT INTO asset_movements (
  asset_id, movement_type, from_department_id, to_department_id,
  reference_table, reference_id, performed_by, movement_date, remarks
) VALUES (
  @asset_id, 'ISSUED', @gso_dept_id, @dept_id, 'ris_records', @ris_id,
  'Arthur N. Ramos', '2026-10-23', 'Issued under RIS-2026-10-0101.'
);

-- 8. IIRUP record for the later unserviceable-property lifecycle.
INSERT INTO iirup_records (
  iirup_no, department_id, inspection_date, prepared_by, reason,
  disposal_method, coa_authority_no, status
) VALUES (
  'IIRUP-2031-0001', @dept_id, '2031-06-15', 'Arthur N. Ramos',
  'Unit is beyond economical repair after repeated failures; inspection committee confirmed that repair is no longer practical.',
  'Destruction', 'COA-RO3-2031-044', 'Approved'
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @iirup_id = LAST_INSERT_ID();

INSERT INTO iirup_items (iirup_id, asset_id, condition_notes, appraised_value)
VALUES (
  @iirup_id, @asset_id,
  'Non-functional display and failed probe interface; serial number remains verifiable. Recommended for disposal after COA authority.',
  15000.00
)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @iirup_item_id = LAST_INSERT_ID();

UPDATE inventory_assets SET status = 'Condemned' WHERE id = @asset_id;

INSERT INTO asset_movements (
  asset_id, movement_type, from_department_id, to_department_id,
  reference_table, reference_id, performed_by, movement_date, remarks
) VALUES (
  @asset_id, 'DISPOSED', @dept_id, NULL, 'iirup_records', @iirup_id,
  'Arthur N. Ramos', '2031-06-30', 'Disposed under approved IIRUP and COA authority COA-RO3-2031-044.'
);

-- 9. Consumable/inventory ledger entry linked to the accepted IAR.
INSERT INTO inventory_items (item_code, description, category, unit, reorder_level)
VALUES ('MED-EQUIP-US-2601', 'Portable Ultrasound Diagnostic System', 'Equipment', 'unit', 0)
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);
SET @inventory_item_id = LAST_INSERT_ID();

INSERT INTO inventory_transactions (
  inventory_item_id, transaction_type, quantity, unit_cost,
  to_department_id, reference_table, reference_id, performed_by,
  transaction_date, remarks
) VALUES (
  @inventory_item_id, 'RECEIVE', 1, 238500.00, @gso_dept_id,
  'iar_records', @iar_id, 'Arthur N. Ramos', '2026-10-21',
  'Received from completed IAR-2026-10-0101 before property issuance.'
);

-- 10. Compliance/audit trail for the full record.
INSERT INTO audit_logs (
  table_name, record_id, action, old_value, new_value, user_role, user_name
) VALUES
  ('purchase_requests', @pr_id, 'CREATE', NULL, 'Approved', 'End User', 'Dr. Elena S. Perez'),
  ('purchase_requests', @pr_id, 'STATUS_CHANGE', 'Pending', 'Budget_Review', 'Budget Officer', 'Engr. Roberto D. Santos'),
  ('purchase_requests', @pr_id, 'STATUS_CHANGE', 'Budget_Review', 'GSO_Review', 'GSO Officer', 'Arthur N. Ramos'),
  ('purchase_requests', @pr_id, 'STATUS_CHANGE', 'GSO_Review', 'Approved', 'Mayor', 'Hon. Johnielle Keith Pasion Nieto'),
  ('rfq_records', @rfq_id, 'STATUS_CHANGE', 'Draft', 'Published', 'BAC Secretariat', 'Atty. Susan Cruz'),
  ('rfq_records', @rfq_id, 'STATUS_CHANGE', 'Published', 'Closed', 'BAC Secretariat', 'Atty. Susan Cruz'),
  ('bac_resolutions', @resolution_id, 'CREATE', NULL, 'Signed', 'BAC Secretariat', 'Atty. Susan Cruz'),
  ('purchase_orders', @po_id, 'STATUS_CHANGE', 'Draft', 'Signed', 'GSO Officer', 'Arthur N. Ramos'),
  ('iar_records', @iar_id, 'STATUS_CHANGE', 'Submitted', 'Completed', 'GSO Officer', 'Arthur N. Ramos'),
  ('payments', @payment_id, 'STATUS_CHANGE', 'Pending', 'Completed', 'Finance Officer', 'Mrs. Teresa V. Jose'),
  ('inventory_assets', @asset_id, 'STATUS_CHANGE', 'Active', 'Condemned', 'GSO Officer', 'Arthur N. Ramos');

INSERT INTO notifications (user_id, department_id, target_role, title, message, type, is_read)
VALUES (
  @end_user_id, @dept_id, 'End User', 'Procurement Record Completed',
  'PR-2026-09-0101 completed the procurement, delivery, payment, property issuance, and audit trail workflow.',
  'success', FALSE
);

COMMIT;

-- Verification query: returns the complete trace using document numbers.
SELECT
  pr.pr_no, ppmp.description AS planned_item, rfq.rfq_no, p.ref_no AS philgeps_ref,
  br.resolution_no, noa.noa_no, po.po_no, ntp.ntp_no, iar.iar_no,
  pa.payment_no, ia.property_no, ris.ris_no, iirup.iirup_no, po.status AS po_status,
  pa.status AS payment_status, ia.status AS asset_status
FROM purchase_requests pr
JOIN pr_items pri ON pri.pr_id = pr.id
JOIN ppmp_items ppmp ON ppmp.id = pri.ppmp_item_id
JOIN rfq_records rfq ON rfq.pr_id = pr.id
JOIN philgeps_postings p ON p.associated_id = rfq.id AND p.associated_type = 'rfq'
JOIN bac_resolutions br ON br.rfq_id = rfq.id
JOIN notices_of_award noa ON noa.bac_resolution_id = br.id
JOIN purchase_orders po ON po.noa_id = noa.id
JOIN notices_to_proceed ntp ON ntp.po_id = po.id
JOIN iar_records iar ON iar.po_id = po.id
JOIN iar_items iari ON iari.iar_id = iar.id
JOIN inventory_assets ia ON ia.iar_item_id = iari.id
JOIN payments pa ON pa.po_id = po.id
JOIN ris_items risi ON risi.asset_id = ia.id
JOIN ris_records ris ON ris.id = risi.ris_id
JOIN iirup_items iiri ON iiri.asset_id = ia.id
JOIN iirup_records iirup ON iirup.id = iiri.iirup_id
WHERE pr.pr_no = 'PR-2026-09-0101';
