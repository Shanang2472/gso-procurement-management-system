-- Allow Purchase Requests to include items that are not yet listed in the PPMP.
USE `procurement_management_ocr`;

ALTER TABLE pr_items
    MODIFY COLUMN ppmp_item_id INT DEFAULT NULL;