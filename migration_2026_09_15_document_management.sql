-- Phase 3 document and attachment management migration.

CREATE TABLE IF NOT EXISTS document_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(80) NOT NULL DEFAULT 'procurement',
    record_id INT NOT NULL DEFAULT 0,
    document_type VARCHAR(80) NOT NULL DEFAULT 'Attachment',
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) DEFAULT NULL,
    file_size INT NOT NULL DEFAULT 0,
    checksum VARCHAR(128) DEFAULT NULL,
    metadata TEXT DEFAULT NULL,
    mime_type VARCHAR(120) DEFAULT NULL,
    file_data MEDIUMBLOB DEFAULT NULL,
    extracted_text LONGTEXT DEFAULT NULL,
    version INT NOT NULL DEFAULT 1,
    status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
    created_by VARCHAR(120) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_document_record (table_name, record_id),
    INDEX idx_document_checksum (checksum)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE document_records ADD COLUMN mime_type VARCHAR(120) NULL;
ALTER TABLE document_records ADD COLUMN file_data MEDIUMBLOB NULL;
ALTER TABLE document_records ADD COLUMN extracted_text LONGTEXT NULL;
ALTER TABLE document_records ADD COLUMN ocr_status VARCHAR(20) NOT NULL DEFAULT 'Pending';
ALTER TABLE document_records ADD COLUMN encryption_version INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS document_signatures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    signature_hash VARCHAR(128) NOT NULL,
    signer_id INT NULL,
    signer_name VARCHAR(150) NOT NULL,
    signer_role VARCHAR(100) NOT NULL,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_document_signature (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;