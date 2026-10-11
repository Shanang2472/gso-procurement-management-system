import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

const requiredTables = [
  'users', 'departments', 'purchase_requests', 'pr_items', 'rfq_records',
  'suppliers', 'purchase_orders', 'po_items', 'iar_records', 'payments',
  'document_records', 'document_signatures', 'budget_allotments',
  'finance_reconciliation_exceptions', 'audit_logs'
];

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'procurement_management_ocr'
});

try {
  const [rows] = await connection.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${requiredTables.map(() => '?').join(',')})`,
    requiredTables
  );
  const found = new Set(rows.map(row => row.TABLE_NAME || row.table_name));
  const missing = requiredTables.filter(table => !found.has(table));
  if (missing.length) {
    console.error(`Database verification failed. Missing tables: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Database verification passed: ${requiredTables.length} required tables present.`);
  }
} finally {
  await connection.end();
}
