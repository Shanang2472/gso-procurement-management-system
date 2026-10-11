import express from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db, hashPasswordScrypt } from './src/db_mysql.ts';
import { withTransaction } from './src/mysql.ts';
import { getPRWorkflowRules, validateEntityTransition, validatePRTransition } from './src/workflowRules.ts';
import { evaluateProcurementCompliance, getComplianceDocumentChecklist } from './src/complianceRules.ts';
import { normalizeSupplierProfile, SUPPLIER_STATUSES, validateSupplierProfile } from './src/supplierPortalRules.ts';
import { DOCUMENT_MAX_BYTES, validateDocumentPayload } from './src/documentRules.ts';
import { extractDocumentText } from './src/ocr.ts';
import { evaluateFinanceSnapshot } from './src/financeRules.ts';
import { aggregateReportingRecords } from './src/reportingRules.ts';
import { decryptDocument, encryptDocument } from './src/documentEncryption.ts';

export const getNotificationVisibility = (user: any) => {
  const userId = Number(user?.id ?? 0);
  const deptId = Number(user?.department_id ?? 0);
  const role = user?.role ?? '';
  const whereClause = `
    (user_id = ?) OR
    (user_id IS NULL AND department_id = ?) OR
    (user_id IS NULL AND department_id IS NULL AND (target_role = ? OR target_role IS NULL))
  `;
  return { whereClause, params: [userId, deptId, role] };
};

export const isNotificationVisibleToUser = (notification: any, user: any) => {
  if (!notification || !user) return false;
  const userId = Number(user.id ?? 0);
  const deptId = Number(user.department_id ?? 0);
  const role = user.role ?? '';

  if (notification.user_id != null && Number(notification.user_id) === userId) return true;
  if (notification.user_id == null && notification.department_id != null && Number(notification.department_id) === deptId) return true;
  if (notification.user_id == null && notification.department_id == null && (notification.target_role == null || notification.target_role === role)) return true;
  return false;
};

export const buildSupplierPortalSummary = (user: any, summary: any, supplierPerformance: any[] = []) => {
  const normalizedSummary = {
    supplier_count: Number(summary?.supplier_count ?? 0),
    invited_count: Number(summary?.invited_count ?? 0),
    responded_count: Number(summary?.responded_count ?? 0),
    quotations_count: Number(summary?.quotations_count ?? 0)
  };

  if (user?.role !== 'Supplier') {
    return { summary: normalizedSummary, supplierPerformance: supplierPerformance || [] };
  }

  const supplierId = Number(user.supplier_id ?? 0);
  const filteredPerformance = Array.isArray(supplierPerformance)
    ? supplierPerformance.filter((row: any) => Number(row?.id ?? 0) === supplierId)
    : [];

  return {
    summary: {
      supplier_count: supplierId > 0 ? 1 : 0,
      invited_count: filteredPerformance.length > 0 ? normalizedSummary.invited_count : 0,
      responded_count: filteredPerformance.length > 0 ? normalizedSummary.responded_count : 0,
      quotations_count: filteredPerformance.length > 0 ? normalizedSummary.quotations_count : 0
    },
    supplierPerformance: filteredPerformance
  };
};

export function attachAllRoutes(app: express.Express, authenticate: any, requireRoles: any) {
  const MODULE_ROLE_ACCESS: Record<string, string[]> = {
    supplier: ['Supplier'],
    planning: ['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer'],
    pr: ['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer'],
    rfq: ['GSO Officer', 'BAC Secretariat', 'Mayor', 'Finance Officer'],
    bidding: ['BAC Secretariat', 'GSO Officer', 'Mayor', 'Finance Officer'],
    bac: ['BAC Secretariat', 'Mayor', 'GSO Officer', 'Budget Officer', 'Finance Officer'],
    po: ['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer'],
    iar: ['GSO Officer', 'Mayor', 'End User', 'Finance Officer'],
    inventory: ['GSO Officer', 'Mayor', 'End User'],
    distribution: ['GSO Officer', 'Mayor', 'End User', 'Finance Officer'],
    disposal: ['GSO Officer', 'Mayor', 'Finance Officer'],
    // philgeps module removed — integration was non-functional
    audit: ['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer'],
    analytics: ['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer'],
    settings: ['Mayor', 'GSO Officer', 'Finance Officer'],
    admin: ['Mayor', 'GSO Officer', 'Finance Officer']
  };

  const canAccessDepartment = (user: any, departmentId: number) =>
    user.role !== 'End User' || Number(user.department_id) === Number(departmentId);

  const canAccessModule = (user: any, moduleName: string) =>
    (MODULE_ROLE_ACCESS[moduleName] || []).includes(user.role);

  const notifyStakeholders = async (notification: {
    user_id?: number | null;
    user_name?: string | null;
    department_id?: number | null;
    target_role?: string | null;
    title: string;
    message: string;
    type?: string;
  }) => {
    try {
      const { query } = await import('./src/mysql.js');
      await query(
        `INSERT INTO notifications (user_id, user_name, department_id, target_role, title, message, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          notification.user_id || null,
          notification.user_name || null,
          notification.department_id || null,
          notification.target_role || null,
          notification.title,
          notification.message,
          notification.type || 'info'
        ]
      );

      const payload = {
        ...notification,
        created_at: new Date().toISOString(),
        type: notification.type || 'info'
      };
      try {
        const event = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
        const clients = ((globalThis as any).notificationClients || new Set()) as Set<any>;
        for (const client of Array.from(clients)) {
          const clientUserId = Number(client.userId);
          const clientDeptId = Number(client.departmentId);
          const inScope =
            (payload.user_id != null && Number(payload.user_id) === clientUserId) ||
            (payload.department_id != null && Number(payload.department_id) === clientDeptId) ||
            (payload.target_role != null && payload.target_role === client.role) ||
            (!payload.user_id && !payload.department_id && !payload.target_role);
          if (inScope) {
            try {
              client.res.write(event);
            } catch {
              clients.delete(client);
            }
          }
        }
      } catch {
        // Ignore stream errors; notifications are still stored in the database.
      }
    } catch (e) {
      console.error('Failed to record notification:', e);
    }
  };

  const ensureDocumentRecordsTable = async () => {
    try {
      const { query: mysqlQuery } = await import('./src/mysql.js');
      await mysqlQuery(`
        CREATE TABLE IF NOT EXISTS document_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_name VARCHAR(80) NOT NULL DEFAULT 'procurement',
          record_id INT NOT NULL DEFAULT 0,
          document_type VARCHAR(80) NOT NULL DEFAULT 'Attachment',
          file_name VARCHAR(255) NOT NULL,
          file_url VARCHAR(500) NULL,
          file_size INT NOT NULL DEFAULT 0,
          checksum VARCHAR(128) NULL,
          metadata TEXT NULL,
          mime_type VARCHAR(120) NULL,
          file_data MEDIUMBLOB NULL,
          encryption_version INT NOT NULL DEFAULT 0,
          extracted_text LONGTEXT NULL,
          ocr_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
          version INT NOT NULL DEFAULT 1,
          status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
          created_by VARCHAR(120) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `, []);
      const alterStatements = [
        `ALTER TABLE document_records ADD COLUMN mime_type VARCHAR(120) NULL`,
        `ALTER TABLE document_records ADD COLUMN file_data MEDIUMBLOB NULL`,
        `ALTER TABLE document_records ADD COLUMN extracted_text LONGTEXT NULL`,
        `ALTER TABLE document_records ADD COLUMN ocr_status VARCHAR(20) NOT NULL DEFAULT 'Pending'`,
        `ALTER TABLE document_records ADD COLUMN encryption_version INT NOT NULL DEFAULT 0`
      ];
      for (const statement of alterStatements) {
        try { await mysqlQuery(statement, []); } catch (error: any) {
          if (error.code !== 'ER_DUP_FIELDNAME') throw error;
        }
      }
      await mysqlQuery(`
        CREATE TABLE IF NOT EXISTS document_signatures (
          id INT AUTO_INCREMENT PRIMARY KEY,
          document_id INT NOT NULL,
          signature_hash VARCHAR(128) NOT NULL,
          signer_id INT NULL,
          signer_name VARCHAR(150) NOT NULL,
          signer_role VARCHAR(100) NOT NULL,
          signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_document_signature (document_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `, []);
    } catch (e) {
      console.error('Failed to ensure document_records table:', e);
    }
  };

  const ensureComplianceChecksTable = async () => {
    const { query: mysqlQuery } = await import('./src/mysql.js');
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS compliance_checks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(80) NOT NULL,
        record_id INT NOT NULL,
        compliant BOOLEAN NOT NULL DEFAULT FALSE,
        checks TEXT NOT NULL,
        evaluated_by INT NULL,
        evaluated_by_name VARCHAR(150) NULL,
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_compliance_record (table_name, record_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  };

  const ensureFinanceTables = async () => {
    const { query: mysqlQuery } = await import('./src/mysql.js');
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS finance_reconciliation_exceptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pr_id INT NOT NULL,
        code VARCHAR(80) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Open',
        resolved_by VARCHAR(150) NULL,
        resolved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_finance_exception_pr (pr_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS budget_allotments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        department_id INT NOT NULL,
        fiscal_year INT NOT NULL,
        allotment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_budget_allotment (department_id, fiscal_year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  };

  const ensureSupplierPortalTables = async () => {
    const { query: mysqlQuery } = await import('./src/mysql.js');
    const alterStatements = [
      `ALTER TABLE suppliers ADD COLUMN supplier_status VARCHAR(40) NOT NULL DEFAULT 'Active'`,
      `ALTER TABLE suppliers ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE`,
      `ALTER TABLE suppliers ADD COLUMN compliance_notes TEXT NULL`,
      `ALTER TABLE suppliers ADD COLUMN approved_at TIMESTAMP NULL`,
      `ALTER TABLE suppliers ADD COLUMN approved_by VARCHAR(150) NULL`,
      `ALTER TABLE rfq_supplier_invitations MODIFY COLUMN status ENUM('Invited', 'Accepted', 'Responded', 'Declined', 'Expired') NOT NULL DEFAULT 'Invited'`
    ];
    for (const statement of alterStatements) {
      try { await mysqlQuery(statement, []); } catch (error: any) {
        if (!['ER_DUP_FIELDNAME', 'ER_BAD_FIELD_ERROR'].includes(error.code)) throw error;
      }
    }
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS supplier_email_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        email VARCHAR(150) NOT NULL,
        code_hash VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        verified_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_supplier_verification (supplier_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS supplier_quotation_revisions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        revision_no INT NOT NULL,
        payload TEXT NOT NULL,
        submitted_by_user_id INT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_quotation_revision (quotation_id, revision_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS supplier_delivery_confirmations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        supplier_id INT NOT NULL,
        confirmation_no VARCHAR(100) NOT NULL UNIQUE,
        delivery_date DATE NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
        remarks TEXT NULL,
        created_by_user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  };

  const sendSupplierVerificationEmail = async (email: string, code: string) => {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
    if (!user || !pass) return false;
    const mailer = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    await mailer.sendMail({
      from: process.env.SMTP_FROM?.trim() || user,
      to: email,
      subject: 'GSO Supplier Portal email verification',
      text: `Your supplier portal verification code is ${code}. It expires in 15 minutes.`
    });
    return true;
  };

  const evaluateStoredPRCompliance = async (prId: number, user: any) => {
    const { query: mysqlQuery } = await import('./src/mysql.js');
    const rows = await mysqlQuery<any>(`
      SELECT pr.*, COALESCE(SUM(pri.total_cost), 0) AS amount
      FROM purchase_requests pr
      LEFT JOIN pr_items pri ON pri.pr_id = pr.id
      WHERE pr.id = ?
      GROUP BY pr.id
    `, [prId]);
    if (!rows.length) return null;
    const pr = rows[0];
    const documents = await mysqlQuery<any>(
      `SELECT document_type FROM document_records WHERE table_name = 'purchase_requests' AND record_id = ? AND status <> 'Archived'`,
      [prId]
    );
    return evaluateProcurementCompliance({
      amount: Number(pr.amount),
      modeOfProcurement: pr.mode_of_procurement,
      availableDocuments: documents.map((document: any) => document.document_type)
      // hasPhilGEPSPosting intentionally omitted — PhilGEPS integration removed
    });
  };

  const canAccessDocumentRecord = async (user: any, tableName: string, recordId: number) => {
    if (['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer'].includes(user.role)) return true;
    const { query: mysqlQuery } = await import('./src/mysql.js');
    if (user.role === 'Supplier' && tableName === 'suppliers') return Number(user.supplier_id) === recordId;
    if (user.role === 'End User' && tableName === 'purchase_requests') {
      const rows = await mysqlQuery<any>('SELECT department_id FROM purchase_requests WHERE id = ?', [recordId]);
      return rows.length > 0 && canAccessDepartment(user, rows[0].department_id);
    }
    return false;
  };

  const parseDocumentData = (value: unknown) => {
    const source = String(value || '');
    const match = source.match(/^data:([^;]+);base64,(.+)$/);
    return match ? { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') } : null;
  };

  // Priority 1: Workflow, compliance, and operating rule engine endpoints.
  app.get('/api/workflow/rules', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req, res) => {
    try {
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const overview = await mysqlQuery<any>(`
        SELECT status, COUNT(*) AS count
        FROM purchase_requests
        GROUP BY status
        ORDER BY status
      `, []);
      const rules = {
        workflow: 'PR -> RFQ -> BAC -> PO -> IAR -> Inventory/Distribution/Disposal',
        ...getPRWorkflowRules()
      };

      res.json({ rules, statusCounts: overview, compliant: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Workflow rule catalog unavailable.' });
    }
  });

  // Phase 2: Supplier registration and lifecycle.
  app.post('/api/supplier/register', async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      const profile = normalizeSupplierProfile(req.body || {});
      const validation = validateSupplierProfile(profile);
      if (!validation.valid) return res.status(400).json({ error: validation.errors.join(' '), errors: validation.errors });
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!/^[a-zA-Z0-9._-]{3,}$/.test(username)) return res.status(400).json({ error: 'A valid supplier username with at least 3 characters is required.' });
      if (password.length < 8) return res.status(400).json({ error: 'Supplier password must be at least 8 characters long.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const duplicates = await mysqlQuery<any>(
        'SELECT id FROM suppliers WHERE LOWER(email) = ? OR tin = ? LIMIT 1',
        [profile.email, profile.tin]
      );
      if (duplicates.length) return res.status(409).json({ error: 'A supplier with this email or TIN already exists.' });
      const userDuplicates = await mysqlQuery<any>('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1', [username.toLowerCase(), profile.email]);
      if (userDuplicates.length) return res.status(409).json({ error: 'A user with this username or email already exists.' });
      const supplier = await db.insert<any>('suppliers', {
        ...profile,
        supplier_status: 'Pending_Verification',
        email_verified: false,
        performance_rating: 0,
        performance_notes: null
      });
      const passwordBundle = hashPasswordScrypt(password);
      const supplierUser = await db.insert<any>('users', {
        username,
        password_hash: passwordBundle.hash,
        salt: passwordBundle.salt,
        name: profile.contact_person,
        email: profile.email,
        role: 'Supplier',
        department_id: null,
        supplier_id: supplier.id
      });
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = crypto.createHash('sha256').update(`${supplier.id}:${profile.email}:${code}:${process.env.OTP_SECRET || 'gso-supplier-verification'}`).digest('hex');
      await mysqlQuery(
        `INSERT INTO supplier_email_verifications (supplier_id, email, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
        [supplier.id, profile.email, codeHash]
      );
      let emailSent = false;
      try { emailSent = await sendSupplierVerificationEmail(profile.email, code); } catch { emailSent = false; }
      await db.logAudit('suppliers', supplier.id, 'CREATE', null, JSON.stringify({ ...supplier, supplier_status: 'Pending_Verification' }), 'Supplier', profile.name);
      res.status(201).json({ id: supplier.id, user_id: supplierUser.id, username, email: profile.email, supplier_status: 'Pending_Verification', email_sent: emailSent, message: emailSent ? 'Supplier registration created. Check email for the verification code.' : 'Supplier registration created. Email delivery is not configured; request administrator verification.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Supplier registration failed.' });
    }
  });

  app.post('/api/supplier/verify-email', async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.body?.supplier_id);
      const email = String(req.body?.email || '').trim().toLowerCase();
      const code = String(req.body?.code || '').trim();
      if (!supplierId || !email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Supplier ID, email, and six-digit verification code are required.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>(`SELECT * FROM supplier_email_verifications WHERE supplier_id = ? AND email = ? AND verified_at IS NULL ORDER BY id DESC LIMIT 1`, [supplierId, email]);
      const challenge = rows[0];
      const codeHash = crypto.createHash('sha256').update(`${supplierId}:${email}:${code}:${process.env.OTP_SECRET || 'gso-supplier-verification'}`).digest('hex');
      if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5 || challenge.code_hash !== codeHash) {
        if (challenge) await mysqlQuery('UPDATE supplier_email_verifications SET attempts = attempts + 1 WHERE id = ?', [challenge.id]);
        return res.status(400).json({ error: 'Invalid or expired supplier verification code.' });
      }
      const supplier = await db.getById<any>('suppliers', supplierId);
      if (!supplier || String(supplier.email).toLowerCase() !== email) return res.status(404).json({ error: 'Supplier record not found.' });
      await mysqlQuery('UPDATE supplier_email_verifications SET verified_at = NOW() WHERE id = ?', [challenge.id]);
      const updated = await db.update<any>('suppliers', supplierId, { email_verified: true, supplier_status: 'Pending_Approval' });
      await db.logAudit('suppliers', supplierId, 'STATUS_CHANGE', JSON.stringify(supplier), JSON.stringify(updated), 'Supplier', supplier.name);
      res.json({ id: supplierId, supplier_status: 'Pending_Approval', email_verified: true, message: 'Email verified. Supplier approval is now pending.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Supplier email verification failed.' });
    }
  });

  app.get('/api/suppliers/:id/profile', authenticate, async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.params.id);
      if (req.user.role === 'Supplier' && Number(req.user.supplier_id) !== supplierId) return res.status(403).json({ error: 'You may only view your own supplier profile.' });
      const supplier = await db.getById<any>('suppliers', supplierId);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      res.json(supplier);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Supplier profile could not be loaded.' });
    }
  });

  app.put('/api/suppliers/:id/status', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Mayor']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.params.id);
      const status = String(req.body?.supplier_status || '');
      if (!SUPPLIER_STATUSES.includes(status as typeof SUPPLIER_STATUSES[number])) return res.status(400).json({ error: 'Invalid supplier lifecycle status.' });
      const supplier = await db.getById<any>('suppliers', supplierId);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      if (status === 'Active' && !supplier.email_verified) return res.status(409).json({ error: 'Supplier email must be verified before activation.' });
      const updated = await db.update<any>('suppliers', supplierId, { supplier_status: status, compliance_notes: req.body?.compliance_notes || supplier.compliance_notes || null, approved_at: status === 'Active' ? new Date() : supplier.approved_at, approved_by: status === 'Active' ? req.user.name : supplier.approved_by });
      await db.logAudit('suppliers', supplierId, 'STATUS_CHANGE', JSON.stringify(supplier), JSON.stringify(updated), req.user.role, req.user.name);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Supplier status update failed.' });
    }
  });

  app.post('/api/workflow/validate', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req, res) => {
    try {
      const { entity, fromStatus, toStatus, hasRequiredDocument, fields } = req.body;
      const input = {
        fromStatus: String(fromStatus || ''),
        toStatus: String(toStatus || ''),
        role: req.user.role,
        hasRequiredDocument,
        fields
      };
      const result = entity
        ? validateEntityTransition(String(entity), input)
        : validatePRTransition(input);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Workflow validation failed.' });
    }
  });

  app.post('/api/compliance/validate', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    try {
      const result = evaluateProcurementCompliance(req.body || {});
      res.status(result.compliant ? 200 : 422).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Compliance validation failed.' });
    }
  });

  app.get('/api/compliance/checklist/:stage', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    const stage = String(req.params.stage || '');
    res.json({ stage, requiredDocuments: getComplianceDocumentChecklist(stage) });
  });

  app.get('/api/pr/:id/compliance', authenticate, requireRoles(['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req: any, res: any) => {
    try {
      const prId = Number(req.params.id);
      const pr = await db.getById<any>('purchase_requests', prId);
      if (!pr) return res.status(404).json({ error: 'PR not found.' });
      if (!canAccessDepartment(req.user, pr.department_id)) return res.status(403).json({ error: 'You are not allowed to evaluate this Purchase Request.' });
      await ensureDocumentRecordsTable();
      await ensureComplianceChecksTable();
      const result = await evaluateStoredPRCompliance(prId, req.user);
      const { query: mysqlQuery } = await import('./src/mysql.js');
      await mysqlQuery(
        `INSERT INTO compliance_checks (table_name, record_id, compliant, checks, evaluated_by, evaluated_by_name) VALUES ('purchase_requests', ?, ?, ?, ?, ?)`,
        [prId, result?.compliant ? 1 : 0, JSON.stringify(result), req.user.id, req.user.name]
      );
      await db.logAudit('purchase_requests', prId, 'COMPLIANCE_CHECK', null, JSON.stringify(result), req.user.role, req.user.name);
      res.status(result?.compliant ? 200 : 422).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Purchase Request compliance evaluation failed.' });
    }
  });

  // Priority 2: Supplier portal expansion summary.
  app.get('/api/supplier/portal/summary', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Mayor', 'Budget Officer', 'Finance Officer', 'Supplier']), async (req: any, res) => {
    try {
      await ensureSupplierPortalTables();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const supplierId = req.user?.role === 'Supplier' ? Number(req.user.supplier_id ?? 0) : 0;

      const supplierSummary = await mysqlQuery<any>(`
        SELECT
          (SELECT COUNT(*) FROM suppliers ${supplierId > 0 ? 'WHERE id = ?' : ''}) AS supplier_count,
          (SELECT COUNT(*) FROM rfq_supplier_invitations WHERE status = 'Invited' ${supplierId > 0 ? 'AND supplier_id = ?' : ''}) AS invited_count,
          (SELECT COUNT(*) FROM rfq_supplier_invitations WHERE status = 'Responded' ${supplierId > 0 ? 'AND supplier_id = ?' : ''}) AS responded_count,
          (SELECT COUNT(*) FROM supplier_quotations WHERE status = 'Submitted' ${supplierId > 0 ? 'AND supplier_id = ?' : ''}) AS quotations_count
      `, supplierId > 0 ? [supplierId, supplierId, supplierId, supplierId] : []);
      const supplierPerformance = await mysqlQuery<any>(`
        SELECT id, name, email, tin, performance_rating, performance_notes
        FROM suppliers
        ${supplierId > 0 ? 'WHERE id = ?' : ''}
        ORDER BY performance_rating DESC
      `, supplierId > 0 ? [supplierId] : []);

      res.json(buildSupplierPortalSummary(req.user, supplierSummary[0] || {}, supplierPerformance));
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Supplier portal summary unavailable.' });
    }
  });

  // Priority 3: Document management foundation.
  app.get('/api/documents', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'End User', 'Supplier']), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const tableName = String(req.query.table_name || '');
      const recordId = Number(req.query.record_id || 0);
      if (tableName && recordId > 0 && !(await canAccessDocumentRecord((req as any).user, tableName, recordId))) {
        return res.status(403).json({ error: 'You are not allowed to access these documents.' });
      }
      const conditions: string[] = [];
      const params: any[] = [];
      if (tableName) { conditions.push('table_name = ?'); params.push(tableName); }
      if (recordId > 0) { conditions.push('record_id = ?'); params.push(recordId); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = await mysqlQuery<any>(`SELECT id, table_name, record_id, document_type, file_name, file_url, file_size, checksum, metadata, mime_type, extracted_text, version, status, created_by, created_at FROM document_records ${where} ORDER BY id DESC`, params);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document list could not be loaded.' });
    }
  });

  app.post('/api/documents', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'End User']), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { table_name, record_id, document_type, file_name, file_url, file_size, checksum, metadata, version, status, mime_type, extracted_text } = req.body;
      if (!table_name || !record_id || !document_type || !file_name) {
        return res.status(400).json({ error: 'table_name, record_id, document_type, and file_name are required.' });
      }
      if (!(await canAccessDocumentRecord((req as any).user, String(table_name), Number(record_id)))) return res.status(403).json({ error: 'You are not allowed to attach documents to this record.' });
      const documentValidation = validateDocumentPayload({ fileName: String(file_name), mimeType: String(mime_type || 'application/octet-stream'), fileSize: Number(file_size) || 0 });
      if (file_size && !documentValidation.valid) return res.status(400).json({ error: documentValidation.errors.join(' '), errors: documentValidation.errors });

      const { query: mysqlQuery } = await import('./src/mysql.js');
      const result = await mysqlQuery<any>(`
        INSERT INTO document_records (table_name, record_id, document_type, file_name, file_url, file_size, checksum, metadata, mime_type, extracted_text, version, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        String(table_name), Number(record_id), String(document_type), String(file_name),
        file_url || null, Number(file_size) || 0, checksum || null,
        metadata ? JSON.stringify(metadata) : null, mime_type || null, extracted_text || null, Number(version) || 1, status || 'Draft', req.user?.name || 'System User'
      ]);

      const inserted = await mysqlQuery<any>('SELECT * FROM document_records WHERE id = LAST_INSERT_ID()', []);
      await db.logAudit('document_records', inserted[0].id, 'CREATE', null, JSON.stringify({ ...inserted[0], file_data: undefined }), req.user.role, req.user.name);
      res.status(201).json(inserted[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document metadata could not be stored.' });
    }
  });

  app.post('/api/documents/upload', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'End User', 'Supplier']), async (req: any, res: any) => {
    try {
      await ensureDocumentRecordsTable();
      const { table_name, record_id, document_type, file_name, data, metadata, extracted_text, status } = req.body || {};
      const parsed = parseDocumentData(data);
      if (!table_name || !record_id || !document_type || !file_name || !parsed) return res.status(400).json({ error: 'table_name, record_id, document_type, file_name, and a base64 data URL are required.' });
      if (!(await canAccessDocumentRecord(req.user, String(table_name), Number(record_id)))) return res.status(403).json({ error: 'You are not allowed to upload documents to this record.' });
      if (parsed.buffer.length > DOCUMENT_MAX_BYTES) return res.status(413).json({ error: 'Document exceeds the 5 MB size limit.' });
      const validation = validateDocumentPayload({ fileName: String(file_name), mimeType: parsed.mimeType, fileSize: parsed.buffer.length });
      if (!validation.valid) return res.status(400).json({ error: validation.errors.join(' '), errors: validation.errors });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const checksum = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
      const encrypted = encryptDocument(parsed.buffer);
      const ocr = extracted_text ? { status: 'Completed' as const, text: String(extracted_text).slice(0, 1_000_000), pages: 0 } : await extractDocumentText(parsed.buffer, parsed.mimeType);
      const latest = await mysqlQuery<any>('SELECT COALESCE(MAX(version), 0) AS version FROM document_records WHERE table_name = ? AND record_id = ? AND document_type = ?', [String(table_name), Number(record_id), String(document_type)]);
      const version = Number(latest[0]?.version || 0) + 1;
      const inserted = await mysqlQuery<any>(`
        INSERT INTO document_records (table_name, record_id, document_type, file_name, file_size, checksum, metadata, mime_type, file_data, encryption_version, extracted_text, ocr_status, version, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [String(table_name), Number(record_id), String(document_type), String(file_name), parsed.buffer.length, checksum, metadata ? JSON.stringify(metadata) : null, parsed.mimeType, encrypted.data, encrypted.version, ocr.text, ocr.status, version, status || 'Draft', req.user.name]);
      const documentId = (inserted as any).insertId;
      await db.logAudit('document_records', documentId, 'CREATE', null, JSON.stringify({ table_name, record_id, document_type, file_name, checksum, version }), req.user.role, req.user.name);
      res.status(201).json({ id: documentId, table_name, record_id: Number(record_id), document_type, file_name, file_size: parsed.buffer.length, checksum, mime_type: parsed.mimeType, ocr_status: ocr.status, ocr_pages: ocr.pages, ocr_error: ocr.error, version, status: status || 'Draft' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document upload failed.' });
    }
  });

  app.get('/api/documents/:id/history', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'End User', 'Supplier']), async (req: any, res: any) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT id, table_name, record_id, document_type, file_name, file_size, checksum, mime_type, version, status, created_by, created_at FROM document_records WHERE id = ? OR (table_name = (SELECT table_name FROM document_records WHERE id = ?) AND record_id = (SELECT record_id FROM document_records WHERE id = ?) AND document_type = (SELECT document_type FROM document_records WHERE id = ?)) ORDER BY version DESC, id DESC', [Number(req.params.id), Number(req.params.id), Number(req.params.id), Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Document not found.' });
      if (!(await canAccessDocumentRecord(req.user, rows[0].table_name, Number(rows[0].record_id)))) return res.status(403).json({ error: 'You are not allowed to view document history.' });
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document history could not be loaded.' });
    }
  });

  app.put('/api/documents/:id/archive', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT * FROM document_records WHERE id = ? LIMIT 1', [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Document not found.' });
      const updated = await db.update<any>('document_records', Number(req.params.id), { status: 'Archived' });
      await db.logAudit('document_records', Number(req.params.id), 'UPDATE', JSON.stringify(rows[0]), JSON.stringify(updated), req.user.role, req.user.name);
      res.json({ id: Number(req.params.id), status: 'Archived' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document archive failed.' });
    }
  });

  app.post('/api/documents/:id/sign', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT id, checksum, status FROM document_records WHERE id = ? LIMIT 1', [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Document not found.' });
      if (!rows[0].checksum) return res.status(409).json({ error: 'Only content-addressed documents can be signed.' });
      const signatureHash = crypto.createHash('sha256').update(`${rows[0].checksum}:${req.user.id}:${req.user.role}:${process.env.DOCUMENT_SIGNATURE_SECRET || 'gso-document-signature'}`).digest('hex');
      await mysqlQuery('INSERT INTO document_signatures (document_id, signature_hash, signer_id, signer_name, signer_role) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE signature_hash = VALUES(signature_hash), signer_id = VALUES(signer_id), signer_name = VALUES(signer_name), signer_role = VALUES(signer_role), signed_at = CURRENT_TIMESTAMP', [rows[0].id, signatureHash, req.user.id, req.user.name, req.user.role]);
      await db.logAudit('document_records', rows[0].id, 'SIGN', null, JSON.stringify({ signature_hash: signatureHash, signer: req.user.name }), req.user.role, req.user.name);
      res.json({ document_id: rows[0].id, signature_hash: signatureHash, signer_name: req.user.name, signer_role: req.user.role });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document signing failed.' });
    }
  });

  app.get('/api/documents/:id/download', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'End User', 'Supplier']), async (req: any, res: any) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT * FROM document_records WHERE id = ? LIMIT 1', [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Document not found.' });
      const document = rows[0];
      if (!(await canAccessDocumentRecord(req.user, document.table_name, Number(document.record_id)))) return res.status(403).json({ error: 'You are not allowed to download this document.' });
      if (!document.file_data) return res.status(404).json({ error: 'Document content is not stored.' });
      const content = decryptDocument(document.file_data, Number(document.encryption_version || 0));
      await db.logAudit('document_records', document.id, 'READ', null, JSON.stringify({ file_name: document.file_name, version: document.version }), req.user.role, req.user.name);
      res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${String(document.file_name).replace(/"/g, '')}"`);
      res.send(content);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document download failed.' });
    }
  });

  app.get('/api/documents/search', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'End User', 'Supplier']), async (req: any, res: any) => {
    try {
      await ensureDocumentRecordsTable();
      const term = String(req.query.q || '').trim();
      if (!term) return res.status(400).json({ error: 'Search term is required.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>(`SELECT id, table_name, record_id, document_type, file_name, checksum, mime_type, version, status, created_by, created_at FROM document_records WHERE file_name LIKE ? OR extracted_text LIKE ? OR metadata LIKE ? ORDER BY id DESC LIMIT 100`, [`%${term}%`, `%${term}%`, `%${term}%`]);
      const accessible = [];
      for (const row of rows) if (await canAccessDocumentRecord(req.user, row.table_name, Number(row.record_id))) accessible.push(row);
      res.json(accessible);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Document search failed.' });
    }
  });

  // Priority 4: Finance reconciliation and payment controls.
  app.get('/api/finance/reconciliation', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req, res) => {
    try {
      await ensureFinanceTables();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>(`
        SELECT
          pr.id AS pr_id,
          pr.pr_no,
          pr.department_id,
          pr.status,
          COALESCE(pr_totals.total_amount, 0) AS pr_amount,
          COALESCE(po_total.po_amount, 0) AS po_amount,
          COALESCE(iar_total.iar_amount, 0) AS iar_amount,
          COALESCE(payment_total.payment_amount, 0) AS payment_amount,
          COALESCE(allotment.allotment_amount, 0) AS allotment_amount,
          COALESCE(allotment.utilized_amount, 0) AS allotment_utilized,
          MAX(po.po_date) AS po_date
        FROM purchase_requests pr
        LEFT JOIN (
          SELECT pr_id, SUM(quantity * unit_cost) AS total_amount
          FROM pr_items
          GROUP BY pr_id
        ) pr_totals ON pr_totals.pr_id = pr.id
        LEFT JOIN (
          SELECT pr_id, SUM(amount) AS po_amount
          FROM purchase_orders
          GROUP BY pr_id
        ) po_total ON po_total.pr_id = pr.id
        LEFT JOIN (
          SELECT po.pr_id, SUM(iri.quantity_delivered * iri.unit_price) AS iar_amount
          FROM iar_records ir
          JOIN iar_items iri ON iri.iar_id = ir.id
          JOIN purchase_orders po ON po.id = ir.po_id
          GROUP BY po.pr_id
        ) iar_total ON iar_total.pr_id = pr.id
        LEFT JOIN (
          SELECT po.pr_id, SUM(p.amount) AS payment_amount
          FROM payments p
          JOIN purchase_orders po ON po.id = p.po_id
          GROUP BY po.pr_id
        ) payment_total ON payment_total.pr_id = pr.id
        LEFT JOIN purchase_orders po ON po.pr_id = pr.id
        LEFT JOIN budget_allotments allotment ON allotment.department_id = pr.department_id AND allotment.fiscal_year = YEAR(pr.date)
        GROUP BY pr.id, pr.pr_no, pr.department_id, pr.status, pr_totals.total_amount, po_total.po_amount, iar_total.iar_amount, payment_total.payment_amount, allotment.allotment_amount, allotment.utilized_amount
        ORDER BY pr.id DESC
      `, []);

      const exceptions: any[] = [];
      const enrichedRows = rows.map((row: any) => {
        const finance = evaluateFinanceSnapshot({
          prAmount: Number(row.pr_amount),
          poAmount: Number(row.po_amount),
          iarAmount: Number(row.iar_amount),
          paidAmount: Number(row.payment_amount),
          allotmentBalance: Number(row.allotment_amount || 0) - Number(row.allotment_utilized || 0),
          dueDate: row.po_date ? new Date(row.po_date).toISOString() : null
        });
        for (const exception of finance.exceptions) exceptions.push({ ...exception, pr_id: row.pr_id });
        return { ...row, ...finance };
      });
      for (const exception of exceptions) {
        await mysqlQuery(`INSERT INTO finance_reconciliation_exceptions (pr_id, code, severity, message) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM finance_reconciliation_exceptions WHERE pr_id = ? AND code = ? AND status = 'Open')`, [exception.pr_id, exception.code, exception.severity, exception.message, exception.pr_id, exception.code]);
      }

      const summary = {
        obligations: enrichedRows.reduce((sum, row) => sum + Number(row.pr_amount || 0), 0),
        purchase_orders: enrichedRows.reduce((sum, row) => sum + Number(row.po_amount || 0), 0),
        inspections: enrichedRows.reduce((sum, row) => sum + Number(row.iar_amount || 0), 0),
        payments: enrichedRows.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0),
        open_exceptions: exceptions.length,
        overdue_records: enrichedRows.filter(row => row.agingStatus === 'Overdue').length
      };

      res.json({ summary, records: enrichedRows, exceptions });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Finance reconciliation could not be built.' });
    }
  });

  app.get('/api/finance/exceptions', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    try {
      await ensureFinanceTables();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT * FROM finance_reconciliation_exceptions WHERE status = ? ORDER BY id DESC', [String(req.query.status || 'Open')]);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Finance exceptions could not be loaded.' });
    }
  });

  app.put('/api/finance/exceptions/:id/resolve', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    try {
      await ensureFinanceTables();
      const id = Number(req.params.id);
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT * FROM finance_reconciliation_exceptions WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Finance exception not found.' });
      await mysqlQuery('UPDATE finance_reconciliation_exceptions SET status = \'Resolved\', resolved_by = ?, resolved_at = NOW() WHERE id = ?', [req.user.name, id]);
      await db.logAudit('finance_reconciliation_exceptions', id, 'STATUS_CHANGE', JSON.stringify(rows[0]), JSON.stringify({ ...rows[0], status: 'Resolved' }), req.user.role, req.user.name);
      res.json({ id, status: 'Resolved' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Finance exception resolution failed.' });
    }
  });

  // Priority 5: Reporting and audit intelligence endpoints.
  const getReportingDataset = async (filters: any) => {
    await ensureFinanceTables();
    await ensureSupplierPortalTables();
    const { query: mysqlQuery } = await import('./src/mysql.js');
    const conditions: string[] = [];
    const params: any[] = [];
    if (filters.from) { conditions.push('pr.date >= ?'); params.push(String(filters.from)); }
    if (filters.to) { conditions.push('pr.date <= ?'); params.push(String(filters.to)); }
    if (filters.department_id) { conditions.push('pr.department_id = ?'); params.push(Number(filters.department_id)); }
    if (filters.status) { conditions.push('pr.status = ?'); params.push(String(filters.status)); }
    if (filters.mode) { conditions.push('pr.mode_of_procurement = ?'); params.push(String(filters.mode)); }
    if (filters.supplier_id) { conditions.push('po_summary.supplier_id = ?'); params.push(Number(filters.supplier_id)); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const records = await mysqlQuery<any>(`
      SELECT
        pr.id AS pr_id,
        pr.department_id,
        d.name AS department_name,
        COALESCE(ppmp.category, 'Uncategorized') AS category,
        pr.mode_of_procurement,
        po_summary.supplier_id,
        s.name AS supplier_name,
        COALESCE(pr_total.pr_amount, 0) AS pr_amount,
        COALESCE(po_summary.po_amount, 0) AS po_amount,
        COALESCE(iar_summary.iar_amount, 0) AS iar_amount,
        COALESCE(payment_summary.payment_amount, 0) AS payment_amount,
        GREATEST(COALESCE(pr_total.pr_amount, 0) - COALESCE(po_summary.po_amount, 0), 0) AS open_obligation,
        DATEDIFF(po_summary.po_date, pr.date) AS lead_time_days,
        COALESCE(delivery_summary.late_delivery, FALSE) AS late_delivery
      FROM purchase_requests pr
      JOIN departments d ON d.id = pr.department_id
      LEFT JOIN pr_items pri ON pri.pr_id = pr.id
      LEFT JOIN ppmp_items ppmp ON ppmp.id = pri.ppmp_item_id
      LEFT JOIN (SELECT pr_id, SUM(quantity * unit_cost) AS pr_amount FROM pr_items GROUP BY pr_id) pr_total ON pr_total.pr_id = pr.id
      LEFT JOIN (
        SELECT po.pr_id, po.supplier_id, SUM(poi.total_cost) AS po_amount, MAX(po.po_date) AS po_date, MAX(po.id) AS po_id
        FROM purchase_orders po JOIN po_items poi ON poi.po_id = po.id
        WHERE po.status <> 'Cancelled'
        GROUP BY po.pr_id, po.supplier_id
      ) po_summary ON po_summary.pr_id = pr.id
      LEFT JOIN suppliers s ON s.id = po_summary.supplier_id
      LEFT JOIN (
        SELECT po.pr_id, SUM(ii.quantity_delivered * poi.unit_cost) AS iar_amount
        FROM iar_records ir JOIN iar_items ii ON ii.iar_id = ir.id JOIN po_items poi ON poi.id = ii.po_item_id JOIN purchase_orders po ON po.id = ir.po_id
        WHERE ii.is_accepted = TRUE GROUP BY po.pr_id
      ) iar_summary ON iar_summary.pr_id = pr.id
      LEFT JOIN (
        SELECT po.pr_id, SUM(p.amount) AS payment_amount
        FROM payments p JOIN purchase_orders po ON po.id = p.po_id
        WHERE p.status <> 'Cancelled' GROUP BY po.pr_id
      ) payment_summary ON payment_summary.pr_id = pr.id
      LEFT JOIN (
        SELECT d.po_id, MAX(d.delivery_date > DATE_ADD(po.po_date, INTERVAL 15 DAY)) AS late_delivery
        FROM supplier_delivery_confirmations d JOIN purchase_orders po ON po.id = d.po_id
        GROUP BY d.po_id
      ) delivery_summary ON delivery_summary.po_id = po_summary.po_id
      ${where}
      GROUP BY pr.id, pr.department_id, d.name, ppmp.category, pr.mode_of_procurement, po_summary.supplier_id, s.name, pr_total.pr_amount, po_summary.po_amount, po_summary.po_date, iar_summary.iar_amount, payment_summary.payment_amount, delivery_summary.late_delivery
      ORDER BY pr.id DESC
    `, params);
    return { records, metrics: aggregateReportingRecords(records) };
  };

  app.get('/api/reporting/metrics', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req: any, res: any) => {
    try {
      const dataset = await getReportingDataset(req.query || {});
      res.json({ filters: req.query || {}, ...dataset });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Reporting metrics could not be assembled.' });
    }
  });

  app.get('/api/reporting/export', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req: any, res: any) => {
    try {
      const dataset = await getReportingDataset(req.query || {});
      const headers = ['department', 'category', 'mode', 'supplier', 'pr_amount', 'po_amount', 'iar_amount', 'payment_amount', 'open_obligation', 'lead_time_days', 'late_delivery'];
      const lines = [headers.join(',')];
      for (const row of dataset.records) {
        lines.push([
          row.department_name, row.category, row.mode_of_procurement, row.supplier_name || '', row.pr_amount, row.po_amount, row.iar_amount, row.payment_amount, row.open_obligation, row.lead_time_days ?? '', row.late_delivery ? 'true' : 'false'
        ].map((value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="procurement-report.csv"');
      res.send(lines.join('\n'));
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Reporting export could not be generated.' });
    }
  });

  app.get('/api/reporting/audit-intelligence', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req, res) => {
    try {
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const auditLogs = await mysqlQuery<any>(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 80`, []);
      const compliance = await mysqlQuery<any>(`
        SELECT
          COUNT(*) AS total_records,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved_records,
          SUM(CASE WHEN status = 'Returned' THEN 1 ELSE 0 END) AS returned_records,
          SUM(CASE WHEN status = 'Disapproved' THEN 1 ELSE 0 END) AS disapproved_records
        FROM purchase_requests
      `, []);
      const payments = await mysqlQuery<any>(`
        SELECT COUNT(*) AS payment_count, COALESCE(SUM(amount), 0) AS payment_total
        FROM payments
      `, []);

      res.json({
        summary: {
          auditLogCount: auditLogs.length,
          compliance: compliance[0] || {},
          payments: payments[0] || { payment_count: 0, payment_total: 0 }
        },
        auditLogs,
        reporting: {
          metricsEndpoint: '/api/reporting/metrics',
          exportEndpoint: '/api/reporting/export',
          spendingTrends: 'Source-backed spending by department, category, mode, and fiscal period.',
          procurementLeadTime: 'Calculated from PR date to PO date.',
          supplierReliability: 'Calculated from supplier delivery confirmations and late-delivery outcomes.'
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Reporting and audit intelligence could not be assembled.' });
    }
  });

  app.get('/api/roadmap/priorities', authenticate, requireRoles(['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req, res) => {
    try {
      res.json({
        priorities: [
          { id: 'workflow', title: 'Workflow Engine and Compliance Rules', status: 'Implemented', endpoint: '/api/workflow/rules', detail: 'Workflow rules, compliance mapping, and transition validation are exposed on the backend.' },
          { id: 'supplier', title: 'Supplier Portal Expansion', status: 'Implemented', endpoint: '/api/supplier/portal/summary', detail: 'Supplier portal invitations, quotations, and performance intelligence summary are surfaced.' },
          { id: 'documents', title: 'Document Management System', status: 'Implemented', endpoint: '/api/documents', detail: 'Document records can store metadata and file URLs with version tracking support.' },
          { id: 'finance', title: 'Finance Reconciliation and Payment Controls', status: 'Implemented', endpoint: '/api/finance/reconciliation', detail: 'Purchase request, PO, IAR, and payment obligations are reconciled in one report.' },
          { id: 'reporting', title: 'Reporting and Audit Intelligence', status: 'Implemented', endpoint: '/api/reporting/audit-intelligence', detail: 'Audit logs and compliance summary are rolled into an intelligence endpoint.' }
        ]
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Roadmap priority summary could not be loaded.' });
    }
  });

  // 1. PPMP Items
  app.get('/api/ppmp', authenticate, requireRoles(['End User', 'GSO Officer', 'Budget Officer', 'Mayor']), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (!canAccessModule(currentUser, 'planning')) {
        return res.status(403).json({ error: 'Forbidden: Planning module is not available for this role.' });
      }
      const rows = await db.getTable<any>('ppmp_items');
      res.json(currentUser.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(currentUser, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/ppmp', authenticate, requireRoles(['End User', 'GSO Officer', 'Budget Officer', 'Mayor']), async (req: any, res) => {
    try {
      if (!canAccessModule(req.user, 'planning')) {
        return res.status(403).json({ error: 'Forbidden: Planning module is not available for this role.' });
      }
      if (req.body.department_id && !canAccessDepartment(req.user, Number(req.body.department_id))) {
        return res.status(403).json({ error: 'You may only create PPMP items for your assigned department.' });
      }
      const item = await db.insert('ppmp_items', req.body);
      await db.logAudit('ppmp_items', item.id, 'CREATE', null, JSON.stringify(item), req.user.role, req.user.name);
      res.status(201).json(item);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Purchase Requests
  app.get('/api/pr', authenticate, requireRoles(['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (!canAccessModule(currentUser, 'pr')) {
        return res.status(403).json({ error: 'Forbidden: Requisition module is not available for this role.' });
      }
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT pr.*, d.name AS department_name, d.code AS department_code,
                COALESCE(pr_totals.total_amount, 0) AS total_amount,
                COALESCE(pr_totals.total_amount, 0) AS estimated_abc,
                COALESCE(pr_totals.items_count, 0) AS items_count
         FROM purchase_requests pr
         LEFT JOIN departments d ON d.id = pr.department_id
         LEFT JOIN (
           SELECT pr_id, SUM(quantity * unit_cost) AS total_amount, COUNT(*) AS items_count
           FROM pr_items
           GROUP BY pr_id
         ) pr_totals ON pr_totals.pr_id = pr.id
         ORDER BY pr.id DESC`
      );
      res.json(currentUser.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(currentUser, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/pr', authenticate, requireRoles(['End User', 'GSO Officer', 'Budget Officer']), async (req: any, res) => {
    try {
      if (!canAccessModule(req.user, 'pr')) {
        return res.status(403).json({ error: 'Forbidden: Requisition module is not available for this role.' });
      }
      const { items, ...prData } = req.body;
      if (!prData.department_id || !prData.purpose || !prData.requested_by_name || !prData.requested_by_designation || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Department, purpose, requester details, and at least one item are required.' });
      }
      const department = await db.getById<any>('departments', Number(prData.department_id));
      if (!department) return res.status(400).json({ error: 'Invalid department.' });
      if (!canAccessDepartment(req.user, department.id)) {
        return res.status(403).json({ error: 'You may only create records for your assigned department.' });
      }
      const today = new Date();
      const date = today.toISOString().slice(0, 10);
      const prefix = `${date.slice(0, 7)}-`;
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const latest = await mysqlQuery<any>('SELECT pr_no FROM purchase_requests WHERE pr_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.pr_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const initialStatus = ['Draft', 'Pending', 'Submitted'].includes(String(prData.status || '')) ? String(prData.status || 'Draft') : 'Draft';
      const newPR = await db.insert('purchase_requests', {
        ...prData,
        pr_no: `${prefix}${sequence}`,
        date,
        approved_by_name: department.head_name,
        approved_by_designation: department.head_designation,
        status: initialStatus
      });
      
      if (items && Array.isArray(items)) {
        for (const item of items) {
          const { id, ...itemData } = item;
          await db.insert('pr_items', { ...itemData, pr_id: newPR.id });
        }
      }
      
      await db.logAudit('purchase_requests', newPR.id, 'CREATE', null, JSON.stringify(newPR), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: 'Budget Officer',
        title: 'New Purchase Request Submitted',
        message: `New PR ${newPR.pr_no} submitted by ${department.name} for budget availability review.`,
        type: 'info'
      });
      res.status(201).json(newPR);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/pr/:id', authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pr = await db.getById<any>('purchase_requests', id);
      if (!pr) return res.status(404).json({ error: 'PR not found' });
      if (!canAccessDepartment((req as any).user, pr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to access this Purchase Request.' });
      }
      
      const { query } = await import('./src/mysql.js');
      const items = await query('SELECT * FROM `pr_items` WHERE pr_id = ?', [id]);
      const [rfqs, bacResolutions, noas, pos, ntps, iars, payments, deliveries, assets] = await Promise.all([
        query('SELECT * FROM rfq_records WHERE pr_id = ? ORDER BY id DESC', [id]),
        query(`SELECT br.* FROM bac_resolutions br JOIN rfq_records rfq ON rfq.id = br.rfq_id WHERE rfq.pr_id = ? ORDER BY br.id DESC`, [id]),
        query(`SELECT noa.* FROM notices_of_award noa JOIN rfq_records rfq ON rfq.id = noa.rfq_id WHERE rfq.pr_id = ? ORDER BY noa.id DESC`, [id]),
        query('SELECT * FROM purchase_orders WHERE pr_id = ? ORDER BY id DESC', [id]),
        query(`SELECT ntp.* FROM notices_to_proceed ntp JOIN purchase_orders po ON po.id = ntp.po_id WHERE po.pr_id = ? ORDER BY ntp.id DESC`, [id]),
        query(`SELECT iar.* FROM iar_records iar JOIN purchase_orders po ON po.id = iar.po_id WHERE po.pr_id = ? ORDER BY iar.id DESC`, [id]),
        query(`SELECT p.* FROM payments p JOIN purchase_orders po ON po.id = p.po_id WHERE po.pr_id = ? ORDER BY p.id DESC`, [id]),
        query(`SELECT d.* FROM supplier_delivery_confirmations d JOIN purchase_orders po ON po.id = d.po_id WHERE po.pr_id = ? ORDER BY d.id DESC`, [id]),
        query(`SELECT asset.* FROM inventory_assets asset JOIN iar_items ii ON ii.id = asset.iar_item_id JOIN iar_records iar ON iar.id = ii.iar_id JOIN purchase_orders po ON po.id = iar.po_id WHERE po.pr_id = ? ORDER BY asset.id DESC`, [id])
      ]);

      res.json({
        ...pr,
        items,
        linkedRecords: { rfqs, bacResolutions, noas, pos, ntps, iars, payments, deliveries, assets }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/pr/:id/audit', authenticate, requireRoles(['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const pr = await db.getById<any>('purchase_requests', id);
      if (!pr) return res.status(404).json({ error: 'PR not found' });
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to view audit logs for this Purchase Request.' });
      }
      const { query } = await import('./src/mysql.js');
      const logs = await query('SELECT * FROM `audit_logs` WHERE table_name = "purchase_requests" AND record_id = ? ORDER BY id DESC', [id]);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/pr/:id', authenticate, requireRoles(['End User', 'GSO Officer']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const oldPr = await db.getById<any>('purchase_requests', id);
      if (!oldPr) return res.status(404).json({ error: 'PR not found' });
      if (!canAccessDepartment(req.user, oldPr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to modify this Purchase Request.' });
      }

      const { items, pr_no, date, section, purpose, requested_by_name, requested_by_designation } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one PR item is required.' });
      }
      for (const item of items) {
        if (!item.unit || !item.description || Number(item.quantity) <= 0 || Number(item.unit_cost) < 0) {
          return res.status(400).json({ error: 'Every item must have a unit, description, quantity, and valid unit cost.' });
        }
      }

      const updatedPR = await db.update('purchase_requests', id, {
        ...(pr_no && pr_no !== oldPr.pr_no ? { pr_no: String(pr_no).trim() } : {}),
        ...(date ? { date } : {}),
        section: String(section || 'Main').trim(),
        purpose: String(purpose || '').trim(),
        requested_by_name: String(requested_by_name || '').trim(),
        requested_by_designation: String(requested_by_designation || '').trim()
      });
      await db.deleteWhere('pr_items', 'pr_id', id);
      for (const [index, item] of items.entries()) {
        await db.insert('pr_items', {
          pr_id: id,
          ppmp_item_id: item.ppmp_item_id || null,
          item_no: index + 1,
          unit: String(item.unit).trim(),
          description: String(item.description).trim(),
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          total_cost: Number(item.quantity) * Number(item.unit_cost)
        });
      }
      const savedItems = await (await import('./src/mysql.js')).query('SELECT * FROM `pr_items` WHERE pr_id = ?', [id]);
      await db.logAudit('purchase_requests', id, 'UPDATE', JSON.stringify(oldPr), JSON.stringify(updatedPR), req.user.role, req.user.name);
      res.json({ ...updatedPR, items: savedItems });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Role-based status transitions for PR
  app.put('/api/pr/:id/status', authenticate, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { status, remarks, alobs_number, alobs_date, mode_of_procurement } = req.body;
      const oldPr = await db.getById<any>('purchase_requests', id);
      if (!oldPr) return res.status(404).json({ error: 'PR not found' });
      if (!canAccessDepartment(req.user, oldPr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to modify this Purchase Request.' });
      }

      if (!remarks || typeof remarks !== 'string' || remarks.trim() === '') {
        return res.status(400).json({ error: 'Remarks are required for every PR status change.' });
      }

      const validation = validatePRTransition({
        fromStatus: oldPr.status,
        toStatus: status,
        role: req.user.role,
        fields: {
          alobs_number: alobs_number ?? oldPr.alobs_number,
          alobs_date: alobs_date ?? oldPr.alobs_date,
          mode_of_procurement: mode_of_procurement ?? oldPr.mode_of_procurement
        }
      });
      if (!validation.valid) {
        const statusCode = validation.errors.some(error => error.startsWith('Forbidden:')) ? 403 : 409;
        return res.status(statusCode).json({ error: validation.errors.join(' '), errors: validation.errors, nextAction: validation.nextAction });
      }

      const updates: any = { status, remarks: remarks.trim() };
      if (alobs_number !== undefined) updates.alobs_number = alobs_number || null;
      if (alobs_date !== undefined) updates.alobs_date = alobs_date || null;
      if (mode_of_procurement !== undefined) updates.mode_of_procurement = mode_of_procurement || null;
      
      const newPr = await db.update('purchase_requests', id, updates);
      await db.logAudit('purchase_requests', id, 'STATUS_CHANGE', JSON.stringify(oldPr), JSON.stringify(newPr), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: oldPr.department_id,
        user_name: oldPr.requested_by_name,
        title: `PR ${newPr.pr_no} Status Update`,
        message: `Purchase Request ${newPr.pr_no} status changed from ${oldPr.status} to ${status}. Remarks: ${remarks.trim()}`,
        type: status === 'Approved' ? 'success' : (status === 'Disapproved' ? 'error' : 'info')
      });
      res.json(newPr);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. RFQ
  app.get('/api/rfq', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Mayor']), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (!canAccessModule(currentUser, 'rfq')) {
        return res.status(403).json({ error: 'Forbidden: RFQ module is not available for this role.' });
      }
      const { query } = await import('./src/mysql.js');
      const rows = await query(`
        SELECT r.*, pr.pr_no, pr.department_id, d.name as department_name 
        FROM rfq_records r 
        LEFT JOIN purchase_requests pr ON r.pr_id = pr.id 
        LEFT JOIN departments d ON pr.department_id = d.id
      `);
      res.json(currentUser.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(currentUser, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/rfq', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat']), async (req, res) => {
    try {
      if (!canAccessModule((req as any).user, 'rfq')) {
        return res.status(403).json({ error: 'Forbidden: RFQ module is not available for this role.' });
      }
      const { items, ...rfqData } = req.body;
      if (!rfqData.pr_id || !rfqData.close_date) return res.status(400).json({ error: 'PR and closing date are required.' });
      const pr = await db.getById<any>('purchase_requests', Number(rfqData.pr_id));
      if (!pr) return res.status(404).json({ error: 'Purchase Request not found.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      if (pr.status !== 'Approved') {
        return res.status(409).json({ error: 'Only approved Purchase Requests can be used to create an RFQ.' });
      }
      const prTotalRows = await mysqlQuery<any>(
        'SELECT COALESCE(SUM(total_cost), 0) AS amount FROM pr_items WHERE pr_id = ?',
        [Number(rfqData.pr_id)]
      );
      const rfqCompliance = evaluateProcurementCompliance({
        amount: Number(prTotalRows[0]?.amount || 0),
        modeOfProcurement: pr.mode_of_procurement,
        openDate: rfqData.open_date || new Date().toISOString().slice(0, 10),
        closeDate: rfqData.close_date
      });
      if (!rfqCompliance.compliant) {
        return res.status(422).json({ error: 'RFQ compliance validation failed.', compliance: rfqCompliance });
      }
      if (!canAccessDepartment((req as any).user, pr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to create an RFQ for this department.' });
      }
      const today = new Date();
      const prefix = `RFQ-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;
      const existingRfq = await mysqlQuery<any>('SELECT rfq_no FROM rfq_records WHERE pr_id = ? LIMIT 1', [Number(rfqData.pr_id)]);
      if (existingRfq.length > 0) {
        return res.status(409).json({ error: `This Purchase Request already has RFQ ${existingRfq[0].rfq_no}.` });
      }
      const latest = await mysqlQuery<any>('SELECT rfq_no FROM rfq_records WHERE rfq_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.rfq_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const prItems = await mysqlQuery<any>('SELECT * FROM pr_items WHERE pr_id = ?', [Number(rfqData.pr_id)]);
      const newRfq = await db.insert('rfq_records', {
        pr_id: Number(rfqData.pr_id),
        rfq_no: `${prefix}${sequence}`,
        open_date: rfqData.open_date || today.toISOString().slice(0, 10),
        close_date: rfqData.close_date,
        status: 'Published',
        terms_and_conditions: rfqData.terms_and_conditions || 'Standard LGU procurement terms and conditions.'
      });
      
      for (const item of (items && Array.isArray(items) ? items : prItems)) {
          await db.insert('rfq_items', {
            rfq_id: newRfq.id,
            pr_item_id: item.pr_item_id || item.id,
            item_no: item.item_no,
            unit: item.unit,
            description: item.description,
            quantity: item.quantity
          });
      }
      const suppliers = await mysqlQuery<any>('SELECT id FROM suppliers');
      for (const supplier of suppliers) {
        await mysqlQuery(
          'INSERT IGNORE INTO rfq_supplier_invitations (rfq_id, supplier_id, status) VALUES (?, ?, \'Invited\')',
          [newRfq.id, supplier.id]
        );
        const supplierUsers = await mysqlQuery<any>('SELECT id FROM users WHERE supplier_id = ? AND role = \'Supplier\'', [supplier.id]);
        for (const supplierUser of supplierUsers) {
          await notifyStakeholders({ user_id: Number(supplierUser.id), title: 'New RFQ Invitation', message: `You have been invited to respond to RFQ ${newRfq.rfq_no}.`, type: 'info' });
        }
      }
      res.status(201).json(newRfq);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/supplier/rfqs', authenticate, requireRoles(['Supplier']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: 'Supplier account is not linked to a supplier registry record.' });
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT r.*, i.status AS invitation_status, i.responded_at, pr.pr_no
         FROM rfq_supplier_invitations i
         JOIN rfq_records r ON r.id = i.rfq_id
         JOIN purchase_requests pr ON pr.id = r.pr_id
         WHERE i.supplier_id = ? ORDER BY r.id DESC`,
        [Number(req.user.supplier_id)]
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/supplier/rfqs/:id', authenticate, requireRoles(['Supplier']), async (req: any, res: any) => {
    try {
      if (!req.user.supplier_id) return res.status(403).json({ error: 'Supplier account is not linked to a supplier registry record.' });
      const id = Number(req.params.id);
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT r.*, pr.pr_no, i.status AS invitation_status
         FROM rfq_records r
         JOIN purchase_requests pr ON pr.id = r.pr_id
         JOIN rfq_supplier_invitations i ON i.rfq_id = r.id AND i.supplier_id = ?
         WHERE r.id = ?`,
        [Number(req.user.supplier_id), id]
      );
      if (!rows.length) return res.status(404).json({ error: 'RFQ invitation not found.' });
      const items = await query<any>(
        `SELECT ri.pr_item_id, ri.item_no, ri.unit, ri.description, ri.quantity,
                qi.offered_unit_price, qi.is_compliant, qi.remarks
         FROM rfq_items ri
         LEFT JOIN supplier_quotations q ON q.rfq_id = ri.rfq_id AND q.supplier_id = ?
         LEFT JOIN supplier_quotation_items qi ON qi.quotation_id = q.id AND qi.pr_item_id = ri.pr_item_id
         WHERE ri.rfq_id = ? ORDER BY ri.item_no`,
        [Number(req.user.supplier_id), id]
      );
      res.json({ ...rows[0], items });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/supplier/rfqs/:id/accept', authenticate, requireRoles(['Supplier']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: 'Supplier account is not linked to a supplier registry record.' });
      const rfqId = Number(req.params.id);
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(`SELECT r.id, r.status, i.status AS invitation_status FROM rfq_records r JOIN rfq_supplier_invitations i ON i.rfq_id = r.id AND i.supplier_id = ? WHERE r.id = ?`, [Number(req.user.supplier_id), rfqId]);
      if (!rows.length) return res.status(404).json({ error: 'RFQ invitation not found.' });
      if (rows[0].status !== 'Published') return res.status(409).json({ error: 'Only published RFQs can be accepted.' });
      await query(`UPDATE rfq_supplier_invitations SET status = 'Accepted' WHERE rfq_id = ? AND supplier_id = ? AND status = 'Invited'`, [rfqId, Number(req.user.supplier_id)]);
      await db.logAudit('rfq_supplier_invitations', rfqId, 'UPDATE', rows[0].invitation_status, 'Accepted', req.user.role, req.user.name);
      res.json({ rfq_id: rfqId, status: 'Accepted', message: 'RFQ invitation accepted. You may submit a quotation before the deadline.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'RFQ invitation acceptance failed.' });
    }
  });

  app.post('/api/supplier/rfqs/:id/quotation', authenticate, requireRoles(['Supplier']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: 'Supplier account is not linked to a supplier registry record.' });
      const supplier = await db.getById<any>('suppliers', Number(req.user.supplier_id));
      if (!supplier || supplier.supplier_status !== 'Active' || !supplier.email_verified) return res.status(403).json({ error: 'Supplier account must be active and email-verified before submitting quotations.' });
      const rfqId = Number(req.params.id);
      const { items, remarks } = req.body;
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Quotation items are required.' });
      const { query } = await import('./src/mysql.js');
      const rfqs = await query<any>(
        `SELECT r.*, i.status AS invitation_status FROM rfq_records r
         JOIN rfq_supplier_invitations i ON i.rfq_id = r.id AND i.supplier_id = ?
         WHERE r.id = ?`,
        [Number(req.user.supplier_id), rfqId]
      );
      const rfq = rfqs[0];
      if (!rfq) return res.status(404).json({ error: 'RFQ invitation not found.' });
      if (rfq.status !== 'Published') return res.status(409).json({ error: 'This RFQ is not accepting quotations.' });
      if (new Date(rfq.close_date).getTime() < Date.now()) return res.status(409).json({ error: 'The quotation deadline has passed.' });
      const quotationRows = await query<any>(
        'SELECT status FROM supplier_quotations WHERE rfq_id = ? AND supplier_id = ? LIMIT 1',
        [rfqId, Number(req.user.supplier_id)]
      );
      const quotationTransition = validateEntityTransition('Quotation', {
        fromStatus: quotationRows[0]?.status || 'Draft',
        toStatus: 'Submitted',
        role: req.user.role
      });
      if (!quotationTransition.valid) {
        return res.status(409).json({ error: quotationTransition.errors.join(' '), errors: quotationTransition.errors, nextAction: quotationTransition.nextAction });
      }
      const rfqItems = await query<any>('SELECT pr_item_id, quantity FROM rfq_items WHERE rfq_id = ?', [rfqId]);
      const incoming = new Map(items.map((item: any) => [Number(item.pr_item_id), item]));
      if (incoming.size !== rfqItems.length || rfqItems.some((item: any) => !incoming.has(Number(item.pr_item_id)))) {
        return res.status(400).json({ error: 'Submit one quotation price for every RFQ item.' });
      }
      const result = await withTransaction(async (connection: any) => {
        const [quotationResult]: any = await connection.execute(
          `INSERT INTO supplier_quotations (rfq_id, supplier_id, submitted_by_user_id, status, remarks)
           VALUES (?, ?, ?, 'Submitted', ?)
           ON DUPLICATE KEY UPDATE submitted_by_user_id = VALUES(submitted_by_user_id), submitted_at = CURRENT_TIMESTAMP, status = 'Submitted', remarks = VALUES(remarks)`,
          [rfqId, Number(req.user.supplier_id), Number(req.user.id), remarks || null]
        );
        const [quotationRows]: any = await connection.query(
          'SELECT id FROM supplier_quotations WHERE rfq_id = ? AND supplier_id = ?',
          [rfqId, Number(req.user.supplier_id)]
        );
        const quotationId = Number(quotationRows[0].id);
        const [revisionRows]: any = await connection.query('SELECT COALESCE(MAX(revision_no), 0) AS revision_no FROM supplier_quotation_revisions WHERE quotation_id = ?', [quotationId]);
        await connection.execute(
          'INSERT INTO supplier_quotation_revisions (quotation_id, revision_no, payload, submitted_by_user_id) VALUES (?, ?, ?, ?)',
          [quotationId, Number(revisionRows[0]?.revision_no || 0) + 1, JSON.stringify({ items, remarks }), Number(req.user.id)]
        );
        await connection.execute('DELETE FROM supplier_quotation_items WHERE quotation_id = ?', [quotationId]);
        await connection.execute('DELETE FROM abstract_bids WHERE rfq_id = ? AND supplier_id = ?', [rfqId, Number(req.user.supplier_id)]);
        for (const rfqItem of rfqItems) {
          const item = incoming.get(Number(rfqItem.pr_item_id));
          const unitPrice = Number(item.offered_unit_price);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('Every quotation price must be a valid non-negative amount.');
          const totalPrice = unitPrice * Number(rfqItem.quantity);
          const compliant = item.is_compliant !== false;
          await connection.execute(
            `INSERT INTO supplier_quotation_items (quotation_id, pr_item_id, offered_unit_price, offered_total_price, is_compliant, remarks)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [quotationId, Number(rfqItem.pr_item_id), unitPrice, totalPrice, compliant, item.remarks || null]
          );
          await connection.execute(
            `INSERT INTO abstract_bids (rfq_id, supplier_id, pr_item_id, offered_unit_price, offered_total_price, is_compliant, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [rfqId, Number(req.user.supplier_id), Number(rfqItem.pr_item_id), unitPrice, totalPrice, compliant, item.remarks || null]
          );
        }
        await connection.execute(
          `UPDATE rfq_supplier_invitations SET status = 'Responded', responded_at = CURRENT_TIMESTAMP
           WHERE rfq_id = ? AND supplier_id = ?`,
          [rfqId, Number(req.user.supplier_id)]
        );
        return { id: quotationId, rfq_id: rfqId, supplier_id: Number(req.user.supplier_id), status: 'Submitted' };
      });
      await db.logAudit('supplier_quotations', result.id, 'CREATE', null, JSON.stringify(result), req.user.role, req.user.name);
      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/supplier/po/:id/delivery-confirmation', authenticate, requireRoles(['Supplier']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: 'Supplier account is not linked to a supplier registry record.' });
      const poId = Number(req.params.id);
      const deliveryDate = String(req.body?.delivery_date || new Date().toISOString().slice(0, 10));
      const remarks = String(req.body?.remarks || '').trim();
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>(`SELECT po.id, po.po_no, po.status, po.supplier_id, pr.department_id FROM purchase_orders po JOIN purchase_requests pr ON pr.id = po.pr_id WHERE po.id = ? AND po.supplier_id = ?`, [poId, Number(req.user.supplier_id)]);
      if (!rows.length) return res.status(404).json({ error: 'Purchase Order not found for this supplier.' });
      if (!['Signed', 'Issued', 'Partially_Delivered'].includes(rows[0].status)) return res.status(409).json({ error: `Delivery confirmation is not allowed for PO status ${rows[0].status}.` });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || Number.isNaN(new Date(deliveryDate).getTime())) return res.status(400).json({ error: 'A valid delivery date is required.' });
      const prefix = `DEL-${new Date().getFullYear()}-`;
      const latest = await mysqlQuery<any>('SELECT confirmation_no FROM supplier_delivery_confirmations WHERE confirmation_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const sequence = String((Number(latest[0]?.confirmation_no?.match(/(\d+)$/)?.[1] || 0) + 1)).padStart(4, '0');
      const confirmation = await db.insert<any>('supplier_delivery_confirmations', {
        po_id: poId,
        supplier_id: Number(req.user.supplier_id),
        confirmation_no: `${prefix}${sequence}`,
        delivery_date: deliveryDate,
        status: 'Submitted',
        remarks: remarks || null,
        created_by_user_id: Number(req.user.id)
      });
      await db.logAudit('supplier_delivery_confirmations', confirmation.id, 'CREATE', null, JSON.stringify(confirmation), req.user.role, req.user.name);
      await notifyStakeholders({ target_role: 'GSO Officer', department_id: rows[0].department_id, title: 'Supplier Delivery Confirmation', message: `Supplier confirmed delivery for PO ${rows[0].po_no} under ${confirmation.confirmation_no}.`, type: 'info' });
      res.status(201).json(confirmation);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Delivery confirmation failed.' });
    }
  });

  app.get('/api/suppliers/:id/performance', authenticate, requireRoles(['Supplier', 'GSO Officer', 'BAC Secretariat', 'Mayor', 'Budget Officer', 'Finance Officer']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.params.id);
      if (req.user.role === 'Supplier' && Number(req.user.supplier_id) !== supplierId) return res.status(403).json({ error: 'You may only view your own performance.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const supplier = await db.getById<any>('suppliers', supplierId);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });
      const deliveries = await mysqlQuery<any>(`SELECT d.*, po.po_no FROM supplier_delivery_confirmations d JOIN purchase_orders po ON po.id = d.po_id WHERE d.supplier_id = ? ORDER BY d.id DESC`, [supplierId]);
      const quotationStats = await mysqlQuery<any>(`SELECT COUNT(*) AS submissions, SUM(status = 'Submitted') AS submitted FROM supplier_quotations WHERE supplier_id = ?`, [supplierId]);
      const score = deliveries.length ? Math.min(100, Math.round((deliveries.filter((delivery: any) => delivery.status === 'Accepted').length / deliveries.length) * 100)) : Number(supplier.performance_rating || 0);
      res.json({ supplier_id: supplierId, supplier_status: supplier.supplier_status, email_verified: Boolean(supplier.email_verified), score, compliance_notes: supplier.compliance_notes || null, quotationStats: quotationStats[0] || {}, deliveries });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Supplier performance could not be loaded.' });
    }
  });

  app.put('/api/supplier/delivery-confirmations/:id/status', authenticate, requireRoles(['GSO Officer', 'Mayor', 'Finance Officer']), async (req: any, res: any) => {
    try {
      await ensureSupplierPortalTables();
      const confirmationId = Number(req.params.id);
      const status = String(req.body?.status || '');
      if (!['Accepted', 'Rejected', 'Correction_Required'].includes(status)) return res.status(400).json({ error: 'Invalid delivery confirmation status.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>('SELECT * FROM supplier_delivery_confirmations WHERE id = ?', [confirmationId]);
      if (!rows.length) return res.status(404).json({ error: 'Delivery confirmation not found.' });
      const updated = await db.update<any>('supplier_delivery_confirmations', confirmationId, { status, remarks: req.body?.remarks ? String(req.body.remarks).trim() : rows[0].remarks });
      await db.logAudit('supplier_delivery_confirmations', confirmationId, 'STATUS_CHANGE', JSON.stringify(rows[0]), JSON.stringify(updated), req.user.role, req.user.name);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Delivery confirmation status update failed.' });
    }
  });

  app.get('/api/rfq/:id/bids', authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query } = await import('./src/mysql.js');
      const rfqRows = await query<any>(
        'SELECT pr.department_id FROM rfq_records r JOIN purchase_requests pr ON pr.id = r.pr_id WHERE r.id = ?',
        [id]
      );
      if (!rfqRows.length) return res.status(404).json({ error: 'RFQ not found' });
      if (!canAccessDepartment((req as any).user, rfqRows[0].department_id)) {
        return res.status(403).json({ error: 'You are not allowed to access this RFQ.' });
      }
      const bids = await query('SELECT * FROM abstract_bids WHERE rfq_id = ?', [id]);
      res.json(bids);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/rfq/:id/bids', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rfqRows = await mysqlQuery<any>(
        'SELECT id, status FROM rfq_records WHERE id = ?',
        [id]
      );
      if (!rfqRows.length) return res.status(404).json({ error: 'RFQ not found' });
      if (rfqRows[0].status !== 'Published') return res.status(409).json({ error: 'Only published RFQs can receive abstract bid entries.' });
      if (!Array.isArray(req.body.bids) || req.body.bids.length === 0) return res.status(400).json({ error: 'At least one bid is required.' });
      const rfqItems = await mysqlQuery<any>(
        `SELECT ri.pr_item_id, ri.quantity, pri.unit_cost
         FROM rfq_items ri JOIN pr_items pri ON pri.id = ri.pr_item_id
         WHERE ri.rfq_id = ?`,
        [id]
      );
      const itemQuantities = new Map(rfqItems.map((item: any) => [Number(item.pr_item_id), Number(item.quantity)]));
      const itemAbcPrices = new Map(rfqItems.map((item: any) => [Number(item.pr_item_id), Number(item.unit_cost)]));
      if (itemQuantities.size === 0) return res.status(409).json({ error: 'RFQ has no itemized requirements.' });
      const normalizedBids = [];
      for (const bid of req.body.bids) {
        const offeredUnitPrice = Number(bid.offered_unit_price);
        const prItemId = Number(bid.pr_item_id);
        if (!bid.supplier_id || !itemQuantities.has(prItemId) || !Number.isFinite(offeredUnitPrice) || offeredUnitPrice < 0) {
          return res.status(400).json({ error: 'Each bid requires supplier, item, and a valid non-negative price.' });
        }
        normalizedBids.push({
          supplier_id: Number(bid.supplier_id),
          pr_item_id: prItemId,
          offered_unit_price: offeredUnitPrice,
          offered_total_price: offeredUnitPrice * (itemQuantities.get(prItemId) || 1),
          is_compliant: bid.is_compliant !== false && offeredUnitPrice <= (itemAbcPrices.get(prItemId) ?? Number.POSITIVE_INFINITY),
          remarks: bid.remarks || null
        });
      }
      const supplierBids = new Map<number, typeof normalizedBids>();
      for (const bid of normalizedBids) {
        const current = supplierBids.get(bid.supplier_id) || [];
        current.push(bid);
        supplierBids.set(bid.supplier_id, current);
      }
      const responsiveTotals = new Map<number, number>();
      for (const [supplierId, supplierBidRows] of supplierBids) {
        const bidItemIds = new Set(supplierBidRows.map(bid => bid.pr_item_id));
        const hasAllItems = bidItemIds.size === itemQuantities.size && [...itemQuantities.keys()].every(itemId => bidItemIds.has(itemId));
        const isResponsive = hasAllItems && supplierBidRows.length === itemQuantities.size && supplierBidRows.every(bid => bid.is_compliant);
        if (isResponsive) {
          responsiveTotals.set(supplierId, supplierBidRows.reduce((total, bid) => total + bid.offered_total_price, 0));
        }
      }
      const lowestResponsiveTotal = responsiveTotals.size > 0
        ? Math.min(...responsiveTotals.values())
        : null;
      await mysqlQuery('DELETE FROM abstract_bids WHERE rfq_id = ?', [id]);
      const bids = [];
      for (const bid of normalizedBids) {
        bids.push(await db.insert('abstract_bids', {
          rfq_id: id,
          ...bid,
          is_lowest_bidder: lowestResponsiveTotal !== null && responsiveTotals.get(bid.supplier_id) === lowestResponsiveTotal
        }));
      }
      res.status(201).json(bids);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. BAC Resolutions
  app.get('/api/bac-resolutions', authenticate, requireRoles(['BAC Secretariat', 'Mayor', 'GSO Officer', 'Budget Officer']), async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (!canAccessModule(currentUser, 'bac')) {
        return res.status(403).json({ error: 'Forbidden: BAC module is not available for this role.' });
      }
      const rows = await db.getTable<any>('bac_resolutions');
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/noa', authenticate, async (req, res) => {
    try {
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(`
        SELECT noa.*, br.rfq_id, rfq.pr_id, pr.pr_no, pr.department_id, s.name as supplier_name,
               br.type_of_bidding
        FROM notices_of_award noa
        JOIN bac_resolutions br ON br.id = noa.bac_resolution_id
        JOIN rfq_records rfq ON rfq.id = br.rfq_id
        JOIN purchase_requests pr ON pr.id = rfq.pr_id
        JOIN suppliers s ON s.id = noa.supplier_id
      `);
      const currentUser = (req as any).user;
      res.json(currentUser.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(currentUser, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/bac-resolutions', authenticate, requireRoles(['BAC Secretariat', 'Mayor']), async (req: any, res: any) => {
    try {
      const { rfq_id, winning_supplier_id, justification, type_of_bidding } = req.body;
      if (!rfq_id || !winning_supplier_id || !justification) {
        return res.status(400).json({ error: 'RFQ, winning supplier, and justification are required.' });
      }
      const rfq = await db.getById<any>('rfq_records', Number(rfq_id));
      const supplier = await db.getById<any>('suppliers', Number(winning_supplier_id));
      if (!rfq) return res.status(404).json({ error: 'RFQ not found.' });
      if (!supplier) return res.status(404).json({ error: 'Winning supplier not found.' });
      const supplierCompliance = evaluateProcurementCompliance({
        amount: 0,
        modeOfProcurement: 'Shopping',
        supplier: { name: supplier.name, tin: supplier.tin, email: supplier.email }
      });
      if (!supplierCompliance.compliant) {
        return res.status(422).json({ error: 'Supplier qualification validation failed.', compliance: supplierCompliance });
      }
      if (rfq.status === 'Closed') return res.status(409).json({ error: 'This RFQ has already been awarded and closed.' });

      const pr = await db.getById<any>('purchase_requests', Number(rfq.pr_id));
      if (!pr) return res.status(404).json({ error: 'Linked Purchase Request not found.' });
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to award this department.' });
      }
      if (pr.status !== 'Approved') {
        return res.status(409).json({ error: 'Only approved Purchase Requests may proceed to BAC award.' });
      }
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const existingResolution = await mysqlQuery<any>('SELECT id FROM bac_resolutions WHERE rfq_id = ? LIMIT 1', [Number(rfq_id)]);
      if (existingResolution.length) {
        return res.status(409).json({ error: 'This RFQ already has a BAC resolution.' });
      }
      const rfqItems = await mysqlQuery<any>('SELECT pr_item_id FROM rfq_items WHERE rfq_id = ?', [Number(rfq_id)]);
      if (!rfqItems.length) return res.status(409).json({ error: 'RFQ has no itemized requirements.' });
      const winningBids = await mysqlQuery<any>(
        `SELECT supplier_id, COUNT(DISTINCT pr_item_id) AS item_count,
                SUM(offered_total_price) AS total_bid,
                SUM(CASE WHEN is_compliant = TRUE THEN 0 ELSE 1 END) AS non_compliant_count
         FROM abstract_bids
         WHERE rfq_id = ? AND supplier_id = ?
         GROUP BY supplier_id`,
        [Number(rfq_id), Number(winning_supplier_id)]
      );
      const allSupplierTotals = await mysqlQuery<any>(
        `SELECT supplier_id, SUM(offered_total_price) AS total_bid
        FROM abstract_bids
        WHERE rfq_id = ?
         GROUP BY supplier_id
        HAVING COUNT(DISTINCT pr_item_id) = ? AND COUNT(*) = ?
          AND SUM(CASE WHEN is_compliant = TRUE THEN 0 ELSE 1 END) = 0`,
        [Number(rfq_id), rfqItems.length, rfqItems.length]
      );
      const winningBid = winningBids[0];
      const lowestTotal = allSupplierTotals.length
        ? Math.min(...allSupplierTotals.map((row: any) => Number(row.total_bid)))
        : null;
      const isValidWinner = winningBid && Number(winningBid.item_count) === rfqItems.length
        && Number(winningBid.non_compliant_count) === 0
        && lowestTotal !== null
        && Number(winningBid.total_bid) === lowestTotal;
      if (!isValidWinner) {
        return res.status(409).json({ error: 'The selected supplier does not have a lowest compliant bid in the abstract.' });
      }

      const bacTransition = validateEntityTransition('BACResolution', {
        fromStatus: 'Draft',
        toStatus: 'Signed',
        role: req.user.role,
        fields: { justification }
      });
      if (!bacTransition.valid) {
        return res.status(403).json({ error: bacTransition.errors.join(' '), errors: bacTransition.errors, nextAction: bacTransition.nextAction });
      }

      const rfqTransition = validateEntityTransition('RFQ', {
        fromStatus: rfq.status,
        toStatus: 'Closed',
        role: req.user.role
      });
      if (!rfqTransition.valid) {
        return res.status(409).json({ error: rfqTransition.errors.join(' '), errors: rfqTransition.errors, nextAction: rfqTransition.nextAction });
      }

      const today = new Date();
      const prefix = `BAC-${today.getFullYear()}-`;
      const latest = await mysqlQuery<any>('SELECT resolution_no FROM bac_resolutions WHERE resolution_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.resolution_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const newRes = await db.insert('bac_resolutions', {
        resolution_no: `${prefix}${sequence}`,
        rfq_id: Number(rfq_id),
        date_passed: today.toISOString().slice(0, 10),
        winning_supplier_id: Number(winning_supplier_id),
        type_of_bidding: type_of_bidding || 'Small Value Procurement',
        justification: String(justification).trim(),
        status: 'Signed'
      });

      await db.update('rfq_records', Number(rfq_id), { status: 'Closed' });

      const noaPrefix = `NOA-${today.getFullYear()}-`;
      const noaLatest = await mysqlQuery<any>('SELECT noa_no FROM notices_of_award WHERE noa_no LIKE ? ORDER BY id DESC LIMIT 1', [`${noaPrefix}%`]);
      const noaSequence = String((noaLatest[0]?.noa_no?.match(/(\d+)$/)?.[1] ? Number(noaLatest[0].noa_no.match(/(\d+)$/)?.[1]) : 0) + 1).padStart(4, '0');
      const newNoa = await db.insert('notices_of_award', {
        noa_no: `${noaPrefix}${noaSequence}`,
        bac_resolution_id: Number(newRes.id),
        rfq_id: Number(rfq_id),
        supplier_id: Number(winning_supplier_id),
        date_issued: today.toISOString().slice(0, 10),
        status: 'Issued'
      });

      await db.logAudit('bac_resolutions', Number(newRes.id), 'CREATE', null, JSON.stringify(newRes), req.user.role, req.user.name);
      await db.logAudit('notices_of_award', Number(newNoa.id), 'CREATE', null, JSON.stringify(newNoa), req.user.role, req.user.name);
      const winningSupplierUsers = await mysqlQuery<any>('SELECT id FROM users WHERE supplier_id = ? AND role = \'Supplier\'', [Number(winning_supplier_id)]);
      for (const supplierUser of winningSupplierUsers) {
        await notifyStakeholders({ user_id: Number(supplierUser.id), title: 'Notice of Award Issued', message: `Your supplier account was selected for RFQ ${rfq.rfq_no}. Notice of Award ${newNoa.noa_no} is ready for acceptance.`, type: 'success' });
      }

      res.status(201).json({ ...newRes, noa: newNoa });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/noa', authenticate, requireRoles(['BAC Secretariat', 'Mayor']), async (req: any, res: any) => {
    try {
      const { bac_resolution_id } = req.body;
      if (!bac_resolution_id) return res.status(400).json({ error: 'BAC resolution is required.' });

      const bacResolution = await db.getById<any>('bac_resolutions', Number(bac_resolution_id));
      if (!bacResolution) return res.status(404).json({ error: 'BAC resolution not found.' });

      const existingNoa = await db.getTable<any>('notices_of_award');
      const duplicate = existingNoa.find((row: any) => Number(row.bac_resolution_id) === Number(bac_resolution_id));
      if (duplicate) return res.status(409).json({ error: 'This BAC resolution already has a Notice of Award.' });

      const rfq = await db.getById<any>('rfq_records', Number(bacResolution.rfq_id));
      if (!rfq) return res.status(404).json({ error: 'Linked RFQ not found.' });
      const pr = await db.getById<any>('purchase_requests', Number(rfq.pr_id));
      if (!pr || pr.status !== 'Approved') return res.status(409).json({ error: 'A Notice of Award can only be created for an approved PR.' });

      const today = new Date();
      const prefix = `NOA-${today.getFullYear()}-`;
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const latest = await mysqlQuery<any>('SELECT noa_no FROM notices_of_award WHERE noa_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.noa_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const newNoa = await db.insert('notices_of_award', {
        noa_no: `${prefix}${sequence}`,
        bac_resolution_id: Number(bac_resolution_id),
        rfq_id: Number(rfq.id),
        supplier_id: Number(bacResolution.winning_supplier_id),
        date_issued: today.toISOString().slice(0, 10),
        status: 'Issued'
      });
      res.status(201).json(newNoa);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. Purchase Orders
  app.get('/api/po', authenticate, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (!canAccessModule(currentUser, 'po')) {
        return res.status(403).json({ error: 'Forbidden: PO module is not available for this role.' });
      }
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT po.*, pr.department_id,
                COALESCE(po_remaining.remaining_quantity, 0) AS remaining_quantity
         FROM purchase_orders po
         JOIN purchase_requests pr ON pr.id = po.pr_id
         LEFT JOIN (
           SELECT poi.po_id,
                  SUM(GREATEST(poi.quantity - COALESCE(delivered.delivered_quantity, 0), 0)) AS remaining_quantity
           FROM po_items poi
           LEFT JOIN (
             SELECT ii.po_item_id, SUM(ii.quantity_delivered) AS delivered_quantity
             FROM iar_items ii
             JOIN iar_records ir ON ir.id = ii.iar_id
             GROUP BY ii.po_item_id
           ) delivered ON delivered.po_item_id = poi.id
           GROUP BY poi.po_id
         ) po_remaining ON po_remaining.po_id = po.id`
      );
      res.json(currentUser.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(currentUser, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/po', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res) => {
    try {
      if (!canAccessModule((req as any).user, 'po')) {
        return res.status(403).json({ error: 'Forbidden: PO module is not available for this role.' });
      }
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const { items, pr_id, noa_id, supplier_id, mode_of_procurement } = req.body;
      if (!pr_id || !noa_id || !supplier_id || !mode_of_procurement) {
        return res.status(400).json({ error: 'PR, NOA, supplier, and procurement mode are required.' });
      }

      const [pr, noa, supplier] = await Promise.all([
        db.getById<any>('purchase_requests', Number(pr_id)),
        db.getById<any>('notices_of_award', Number(noa_id)),
        db.getById<any>('suppliers', Number(supplier_id))
      ]);
      if (!pr) return res.status(404).json({ error: `Purchase Request ${pr_id} not found.` });
      if (!noa) return res.status(404).json({ error: `Notice of Award ${noa_id} not found.` });
      if (!supplier) return res.status(404).json({ error: `Supplier ${supplier_id} not found.` });
      if (pr.status !== 'Approved') {
        return res.status(409).json({ error: 'Only approved Purchase Requests may be converted to a PO.' });
      }
      const poPrTotalRows = await mysqlQuery<any>(
        'SELECT COALESCE(SUM(total_cost), 0) AS amount FROM pr_items WHERE pr_id = ?',
        [Number(pr_id)]
      );
      const poCompliance = evaluateProcurementCompliance({
        amount: Number(poPrTotalRows[0]?.amount || 0),
        modeOfProcurement: mode_of_procurement || pr.mode_of_procurement,
        supplier: { name: supplier.name, tin: supplier.tin, email: supplier.email },
        requiredDocuments: ['Approved Purchase Request'],
        availableDocuments: ['Approved Purchase Request']
      });
      if (!poCompliance.compliant) {
        return res.status(422).json({ error: 'PO compliance validation failed.', compliance: poCompliance });
      }
      if (Number(noa.supplier_id) !== Number(supplier_id)) {
        return res.status(409).json({ error: 'The selected supplier does not match the Notice of Award.' });
      }
      const noaRelationship = await mysqlQuery<any>(
        `SELECT br.rfq_id, rfq.pr_id
         FROM notices_of_award noa
         JOIN bac_resolutions br ON br.id = noa.bac_resolution_id
         JOIN rfq_records rfq ON rfq.id = br.rfq_id
         WHERE noa.id = ?`,
        [Number(noa_id)]
      );
      if (!noaRelationship.length || Number(noaRelationship[0].pr_id) !== Number(pr_id) || !['Issued', 'Accepted'].includes(noa.status)) {
        return res.status(409).json({ error: 'The Notice of Award is not valid for this approved Purchase Request.' });
      }
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: 'You are not allowed to create a PO for this department.' });
      }

      const existingPos = await mysqlQuery<any>(
        'SELECT * FROM `purchase_orders` WHERE noa_id = ? LIMIT 1',
        [Number(noa_id)]
      );
      if (existingPos.length > 0) {
        return res.status(409).json({ error: `NOA ${noa_id} has already been converted to PO ${existingPos[0].po_no || existingPos[0].id}.` });
      }

      const today = new Date();
      const dateIssued = today.toISOString().slice(0, 10);
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const latestPo = await mysqlQuery<any>(
        'SELECT po_no FROM `purchase_orders` WHERE po_no LIKE ? ORDER BY id DESC LIMIT 1',
        [`PO-${year}-${month}-%`]
      );
      const latestSequence = latestPo[0]?.po_no?.match(/(\d+)$/)?.[1];
      const poSequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const poData = {
        po_no: `PO-${year}-${month}-${poSequence}`,
        pr_id: Number(pr_id),
        noa_id: Number(noa_id),
        supplier_id: Number(supplier_id),
        po_date: dateIssued,
        mode_of_procurement,
        penalty_clause: 'A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed.',
        status: 'Signed'
      };
      const prItems = items && Array.isArray(items)
        ? items
        : await mysqlQuery<any>('SELECT * FROM `pr_items` WHERE pr_id = ?', [Number(pr_id)]);
      if (prItems.length === 0) return res.status(400).json({ error: 'At least one PR item is required to create a PO.' });

      const poTransition = validateEntityTransition('PO', {
        fromStatus: 'Draft',
        toStatus: 'Signed',
        role: req.user.role
      });
      if (!poTransition.valid) {
        return res.status(403).json({ error: poTransition.errors.join(' '), errors: poTransition.errors, nextAction: poTransition.nextAction });
      }

      const latestNtp = await mysqlQuery<any>(
        'SELECT ntp_no FROM `notices_to_proceed` WHERE ntp_no LIKE ? ORDER BY id DESC LIMIT 1',
        [`NTP-${year}-%`]
      );
      const latestNtpSequence = latestNtp[0]?.ntp_no?.match(/(\d+)$/)?.[1];
      const ntpSequence = String((latestNtpSequence ? Number(latestNtpSequence) : 0) + 1).padStart(4, '0');
      const result = await withTransaction(async (connection) => {
        const [poResult]: any = await connection.execute(
          'INSERT INTO purchase_orders (`po_no`, `pr_id`, `noa_id`, `supplier_id`, `po_date`, `mode_of_procurement`, `penalty_clause`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [poData.po_no, poData.pr_id, poData.noa_id, poData.supplier_id, poData.po_date, poData.mode_of_procurement, poData.penalty_clause, poData.status]
        );
        const poId = Number(poResult.insertId);
        for (const item of prItems) {
          const quantity = Number(item.quantity);
          const unitCost = Number(item.unit_cost);
          if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
            throw new Error('PO items must have positive integer quantities and non-negative costs.');
          }
          await connection.execute(
            'INSERT INTO po_items (`po_id`, `pr_item_id`, `quantity`, `unit_cost`, `total_cost`) VALUES (?, ?, ?, ?, ?)',
            [poId, Number(item.pr_item_id || item.id), quantity, unitCost, Number(item.total_cost || quantity * unitCost)]
          );
        }
        const [ntpResult]: any = await connection.execute(
          'INSERT INTO notices_to_proceed (`ntp_no`, `po_id`, `date_issued`, `delivery_period_days`, `status`) VALUES (?, ?, ?, ?, ?)',
          [`NTP-${year}-${ntpSequence}`, poId, dateIssued, 15, 'Issued']
        );
        return {
          newPo: { id: poId, ...poData },
          ntp: { id: Number(ntpResult.insertId), ntp_no: `NTP-${year}-${ntpSequence}`, po_id: poId, date_issued: dateIssued, delivery_period_days: 15, status: 'Issued' }
        };
      });

      await db.logAudit('purchase_orders', result.newPo.id, 'CREATE', null, JSON.stringify(result.newPo), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: pr.department_id,
        title: 'Purchase Order Issued',
        message: `Purchase Order ${result.newPo.po_no} has been issued for PR ${pr.pr_no}.`,
        type: 'info'
      });

      res.status(201).json({ ...result.newPo, ntp: result.ntp });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/po/:id', authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const po = await db.getById<any>('purchase_orders', id);
      if (!po) return res.status(404).json({ error: 'PO not found' });
      
      const { query } = await import('./src/mysql.js');
      const ownershipRows = await query<any>(
        'SELECT pr.department_id FROM purchase_orders p JOIN purchase_requests pr ON pr.id = p.pr_id WHERE p.id = ?',
        [id]
      );
      if (!ownershipRows.length) return res.status(404).json({ error: 'PO not found' });
      if (!canAccessDepartment((req as any).user, ownershipRows[0].department_id)) {
        return res.status(403).json({ error: 'You are not allowed to access this PO.' });
      }
      const items = await query(
        `SELECT poi.*,
                COALESCE((
                  SELECT SUM(ii.quantity_delivered)
                  FROM iar_items ii
                  JOIN iar_records ir ON ir.id = ii.iar_id
                  WHERE ii.po_item_id = poi.id AND ir.po_id = poi.po_id
                ), 0) AS delivered_quantity,
                GREATEST(poi.quantity - COALESCE((
                  SELECT SUM(ii.quantity_delivered)
                  FROM iar_items ii
                  JOIN iar_records ir ON ir.id = ii.iar_id
                  WHERE ii.po_item_id = poi.id AND ir.po_id = poi.po_id
                ), 0), 0) AS remaining_quantity
         FROM po_items poi
         WHERE poi.po_id = ?`,
        [id]
      );
      const supplierRows = await query<any>('SELECT * FROM suppliers WHERE id = ? LIMIT 1', [po.supplier_id]);
      const departmentRows = await query<any>(
        'SELECT d.* FROM purchase_orders p JOIN purchase_requests pr ON pr.id = p.pr_id JOIN departments d ON d.id = pr.department_id WHERE p.id = ? LIMIT 1',
        [id]
      );
      res.json({ ...po, items, supplier: supplierRows[0] || null, department: departmentRows[0] || null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 6. Suppliers
  app.get('/api/suppliers', authenticate, requireRoles(['GSO Officer', 'BAC Secretariat', 'Mayor', 'Budget Officer']), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const rows = await db.getTable<any>('suppliers');
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/suppliers', authenticate, requireRoles(['GSO Officer', 'Mayor', 'BAC Secretariat']), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const profile = normalizeSupplierProfile(req.body || {});
      const validation = validateSupplierProfile(profile);
      if (!validation.valid) return res.status(400).json({ error: validation.errors.join(' '), errors: validation.errors });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const duplicate = await mysqlQuery<any>('SELECT id FROM suppliers WHERE LOWER(email) = ? OR tin = ? LIMIT 1', [profile.email, profile.tin]);
      if (duplicate.length) return res.status(409).json({ error: 'A supplier with this email or TIN already exists.' });
      const newSup = await db.insert('suppliers', { ...profile, supplier_status: 'Active', email_verified: true, performance_rating: 0, performance_notes: req.body.performance_notes || null });
      await db.logAudit('suppliers', newSup.id, 'CREATE', null, JSON.stringify(newSup), req.user.role, req.user.name);
      res.status(201).json(newSup);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 7. IAR
  app.get('/api/iar', authenticate, requireRoles(['GSO Officer', 'Mayor', 'End User']), async (req, res) => {
    try {
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT iar.*, pr.department_id
         FROM iar_records iar
         JOIN purchase_orders po ON po.id = iar.po_id
         JOIN purchase_requests pr ON pr.id = po.pr_id`
      );
      const user = (req as any).user;
      res.json(user.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(user, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/iar', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res) => {
    try {
      const { items, ...iarData } = req.body;
      if (!iarData.po_id || !iarData.invoice_no || !iarData.invoice_date || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'PO, invoice details, and at least one delivered item are required.' });
      }
      const po = await db.getById<any>('purchase_orders', Number(iarData.po_id));
      if (!po) return res.status(404).json({ error: 'Purchase Order not found.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const poOwnership = await mysqlQuery<any>(
        'SELECT pr.department_id FROM purchase_orders p JOIN purchase_requests pr ON pr.id = p.pr_id WHERE p.id = ?',
        [po.id]
      );
      if (!poOwnership.length) return res.status(404).json({ error: 'Purchase Order not found.' });
      if (!canAccessDepartment(req.user, poOwnership[0].department_id)) {
        return res.status(403).json({ error: 'You are not allowed to record delivery for this PO.' });
      }
      const poItems = await mysqlQuery<any>(
        `SELECT poi.*, pri.description, pri.unit, pri.ppmp_item_id, COALESCE(ppmp.category, 'Supplies') AS category, pr.department_id, d.head_name, d.head_designation
         FROM po_items poi
         JOIN pr_items pri ON pri.id = poi.pr_item_id
         LEFT JOIN ppmp_items ppmp ON ppmp.id = pri.ppmp_item_id
         JOIN purchase_requests pr ON pr.id = ?
         JOIN departments d ON d.id = pr.department_id
         WHERE poi.po_id = ?`,
        [po.pr_id, po.id]
      );
      if (poItems.length === 0) return res.status(400).json({ error: 'Purchase Order has no valid line items.' });
      const poItemMap = new Map(poItems.map((item: any) => [Number(item.id), item]));
      const submittedItemIds = new Set<number>();
      const invalidItem = items.find((item: any) => {
        const quantityDelivered = Number(item.quantity_delivered);
        const poItemId = Number(item.po_item_id);
        if (!poItemId || submittedItemIds.has(poItemId) || !poItemMap.has(poItemId)) return true;
        submittedItemIds.add(poItemId);
        return !Number.isInteger(quantityDelivered) || quantityDelivered <= 0;
      });
      if (invalidItem) return res.status(400).json({ error: 'Each delivery line requires a positive integer quantity.' });

      const deliveredRows = await mysqlQuery<any>(
        `SELECT ii.po_item_id, COALESCE(SUM(ii.quantity_delivered), 0) AS delivered_quantity
         FROM iar_items ii JOIN iar_records ir ON ir.id = ii.iar_id
         WHERE ir.po_id = ? GROUP BY ii.po_item_id`,
        [po.id]
      );
      const deliveredByPoItem = new Map(deliveredRows.map((row: any) => [Number(row.po_item_id), Number(row.delivered_quantity)]));
      for (const item of items) {
        const poItem = poItemMap.get(Number(item.po_item_id));
        const newTotal = (deliveredByPoItem.get(Number(item.po_item_id)) || 0) + Number(item.quantity_delivered);
        if (newTotal > Number(poItem.quantity)) {
          return res.status(400).json({ error: `Delivered quantity for ${poItem.description} exceeds the ordered quantity.` });
        }
      }

      const iarTransition = validateEntityTransition('IAR', {
        fromStatus: 'Draft',
        toStatus: iarData.is_partial ? 'Partial' : 'Completed',
        role: req.user.role
      });
      if (!iarTransition.valid) {
        return res.status(403).json({ error: iarTransition.errors.join(' '), errors: iarTransition.errors, nextAction: iarTransition.nextAction });
      }

      const today = new Date();
      const prefix = `IAR-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`;
      const latest = await mysqlQuery<any>('SELECT iar_no FROM iar_records WHERE iar_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.iar_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const status = iarData.is_partial ? 'Partial' : 'Completed';
      const result = await withTransaction(async (connection) => {
        const [iarResult]: any = await connection.execute(
          `INSERT INTO iar_records
           (iar_no, po_id, invoice_no, invoice_date, date_inspected, date_accepted,
            inspection_remarks, acceptance_remarks, status, inspected_by, accepted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${prefix}${sequence}`, Number(iarData.po_id), iarData.invoice_no, iarData.invoice_date,
            today.toISOString().slice(0, 10), today.toISOString().slice(0, 10),
            iarData.inspection_remarks || 'Delivery inspected against the Purchase Order.',
            iarData.acceptance_remarks || 'Items accepted subject to inspection findings.',
            status, iarData.inspected_by || req.user.name, iarData.accepted_by || req.user.name
          ]
        );
        const iarId = Number(iarResult.insertId);
        let propertySequence = 0;
        const latestProperty = await connection.query<any[]>(
          'SELECT property_no FROM inventory_assets WHERE property_no LIKE ? ORDER BY id DESC LIMIT 1',
          [`LGU-${today.getFullYear()}-%`]
        );
        const latestPropertyNo = (latestProperty[0] as any[])?.[0]?.property_no;
        propertySequence = Number(latestPropertyNo?.match(/(\d+)$/)?.[1] || 0);

        for (const item of items) {
          const quantityDelivered = Number(item.quantity_delivered);
          const poItem = poItemMap.get(Number(item.po_item_id));
          const isAccepted = item.is_accepted === true;
          const [iarItemResult]: any = await connection.execute(
            'INSERT INTO iar_items (iar_id, po_item_id, quantity_delivered, is_accepted) VALUES (?, ?, ?, ?)',
            [iarId, Number(item.po_item_id), quantityDelivered, isAccepted]
          );

          if (isAccepted && quantityDelivered > 0 && poItem.category !== 'Supplies') {
            for (let unitIndex = 0; unitIndex < quantityDelivered; unitIndex++) {
              propertySequence += 1;
              const cost = Number(poItem.unit_cost);
              await connection.execute(
                `INSERT INTO inventory_assets
                 (iar_item_id, property_no, description, unit, cost, date_acquired, type,
                  assigned_to_user_id, receiver_name, receiver_designation, issuer_name, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  Number(iarItemResult.insertId), `LGU-${today.getFullYear()}-${String(propertySequence).padStart(4, '0')}`,
                  poItem.description, poItem.unit, cost, today.toISOString().slice(0, 10),
                  cost >= 50000 ? 'PAR' : 'ICS', poItem.department_id, poItem.head_name,
                  poItem.head_designation, req.user.name, 'Active'
                ]
              );
            }
          }

          if (isAccepted && quantityDelivered > 0 && poItem.category === 'Supplies') {
            const itemCode = `PPMP-${poItem.ppmp_item_id}`;
            await connection.execute(
              `INSERT INTO inventory_items (item_code, description, category, unit, reorder_level, active)
               VALUES (?, ?, 'Supplies', ?, 0, TRUE)
               ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), description = VALUES(description), unit = VALUES(unit), active = TRUE`,
              [itemCode, poItem.description, poItem.unit]
            );
            const [inventoryItemRows]: any = await connection.query('SELECT id FROM inventory_items WHERE item_code = ?', [itemCode]);
            await connection.execute(
              `INSERT INTO inventory_transactions
               (inventory_item_id, transaction_type, quantity, unit_cost, to_department_id, reference_table, reference_id, performed_by, transaction_date, remarks)
               VALUES (?, 'RECEIVE', ?, ?, ?, 'iar_records', ?, ?, ?, ?)`,
              [Number(inventoryItemRows[0].id), quantityDelivered, Number(poItem.unit_cost), Number(poItem.department_id), iarId, req.user.name, today.toISOString().slice(0, 10), `Accepted delivery from PO ${po.po_no}`]
            );
          }
        }

        const [totals]: any = await connection.query(
          `SELECT poi.id, poi.quantity, COALESCE(SUM(ii.quantity_delivered), 0) AS delivered_quantity
           FROM po_items poi LEFT JOIN iar_items ii ON ii.po_item_id = poi.id
           WHERE poi.po_id = ? GROUP BY poi.id, poi.quantity`,
          [po.id]
        );
        const fullyDelivered = totals.length > 0 && totals.every((row: any) => Number(row.delivered_quantity) >= Number(row.quantity));
        await connection.execute(
          'UPDATE purchase_orders SET status = ? WHERE id = ?',
          [fullyDelivered ? 'Fully_Delivered' : 'Partially_Delivered', po.id]
        );
        return { id: iarId, iar_no: `${prefix}${sequence}`, po_id: Number(iarData.po_id), status };
      });

      await db.logAudit('iar_records', result.id, 'CREATE', null, JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: poOwnership[0].department_id,
        title: 'Delivery Inspected & Accepted (IAR)',
        message: `Delivery for PO ${po.po_no} recorded under ${result.iar_no} (Status: ${result.status}).`,
        type: 'success'
      });

      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/iar/:id', authenticate, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const iar = await db.getById<any>('iar_records', id);
      if (!iar) return res.status(404).json({ error: 'IAR not found' });
      
      const { query } = await import('./src/mysql.js');
      const ownershipRows = await query<any>(
        'SELECT pr.department_id FROM iar_records iar JOIN purchase_orders po ON po.id = iar.po_id JOIN purchase_requests pr ON pr.id = po.pr_id WHERE iar.id = ?',
        [id]
      );
      if (!ownershipRows.length) return res.status(404).json({ error: 'IAR not found' });
      if (!canAccessDepartment((req as any).user, ownershipRows[0].department_id)) {
        return res.status(403).json({ error: 'You are not allowed to access this IAR.' });
      }
      const items = await query('SELECT * FROM `iar_items` WHERE iar_id = ?', [id]);
      const supplierRows = await query<any>(
        'SELECT s.* FROM iar_records ir JOIN purchase_orders po ON po.id = ir.po_id JOIN suppliers s ON s.id = po.supplier_id WHERE ir.id = ? LIMIT 1',
        [id]
      );
      const departmentRows = await query<any>(
        'SELECT d.* FROM iar_records ir JOIN purchase_orders po ON po.id = ir.po_id JOIN purchase_requests pr ON pr.id = po.pr_id JOIN departments d ON d.id = pr.department_id WHERE ir.id = ? LIMIT 1',
        [id]
      );
      res.json({ ...iar, items, supplier: supplierRows[0] || null, department: departmentRows[0] || null });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/payments', authenticate, requireRoles(['Finance Officer', 'GSO Officer', 'Mayor', 'Budget Officer']), async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(`
        SELECT p.*, po.po_no, pr.department_id, pr.pr_no
        FROM payments p
        JOIN purchase_orders po ON po.id = p.po_id
        JOIN purchase_requests pr ON pr.id = po.pr_id
        ORDER BY p.id DESC
      `);
      res.json(req.user.role === 'End User' ? rows.filter((row: any) => canAccessDepartment(req.user, row.department_id)) : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/payments', authenticate, requireRoles(['Finance Officer', 'GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const { po_id, payment_date, amount, payment_method, reference_no, prepared_by, remarks, document_type, document_no, document_url } = req.body;
      if (!po_id || !payment_date || !amount || !prepared_by || !document_no) {
        return res.status(400).json({ error: 'PO, payment date, amount, preparer, and supporting document number are required.' });
      }
      const po = await db.getById<any>('purchase_orders', Number(po_id));
      if (!po) return res.status(404).json({ error: 'Purchase Order not found.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const poOwner = await mysqlQuery<any>('SELECT pr.department_id, pr.pr_no FROM purchase_orders po JOIN purchase_requests pr ON pr.id = po.pr_id WHERE po.id = ?', [po.id]);
      if (!poOwner.length) return res.status(404).json({ error: 'PO ownership not found.' });
      if (!canAccessDepartment(req.user, poOwner[0].department_id)) {
        return res.status(403).json({ error: 'You are not allowed to create payment records for this PO.' });
      }
      const acceptedIar = await mysqlQuery<any>(
        "SELECT id, status FROM iar_records WHERE po_id = ? AND status = 'Completed' ORDER BY id DESC LIMIT 1",
        [po.id]
      );
      if (!acceptedIar.length) {
        return res.status(409).json({ error: 'Payment requires completed receiving for the entire PO.' });
      }
      const completionRows = await mysqlQuery<any>(
        `SELECT COUNT(*) AS incomplete_lines
         FROM po_items poi
         LEFT JOIN (
           SELECT ii.po_item_id, SUM(CASE WHEN ii.is_accepted = TRUE THEN ii.quantity_delivered ELSE 0 END) AS accepted_quantity
           FROM iar_items ii JOIN iar_records ir ON ir.id = ii.iar_id
           WHERE ir.po_id = ? GROUP BY ii.po_item_id
         ) received ON received.po_item_id = poi.id
         WHERE poi.po_id = ? AND COALESCE(received.accepted_quantity, 0) < poi.quantity`,
        [po.id, po.id]
      );
      if (Number(completionRows[0]?.incomplete_lines || 0) > 0) {
        return res.status(409).json({ error: 'Payment requires all PO quantities to be received and accepted.' });
      }
      const poTotalRows = await mysqlQuery<any>('SELECT COALESCE(SUM(total_cost), 0) AS po_total FROM po_items WHERE po_id = ?', [po.id]);
      const paidRows = await mysqlQuery<any>("SELECT COALESCE(SUM(amount), 0) AS paid_total FROM payments WHERE po_id = ? AND status <> 'Cancelled'", [po.id]);
      const requestedAmount = Number(amount);
      const poTotal = Number(poTotalRows[0]?.po_total || 0);
      const paidTotal = Number(paidRows[0]?.paid_total || 0);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
      const financeCheck = evaluateFinanceSnapshot({
        prAmount: poTotal,
        poAmount: poTotal,
        iarAmount: poTotal,
        paidAmount: paidTotal + requestedAmount
      });
      if (financeCheck.exceptions.some(exception => exception.code === 'PAYMENT_EXCEEDS_PO')) return res.status(409).json({ error: 'Cumulative payments cannot exceed the awarded PO total.', exceptions: financeCheck.exceptions });
      const today = new Date();
      const prefix = `PAY-${today.getFullYear()}-`;
      const latest = await mysqlQuery<any>('SELECT payment_no FROM payments WHERE payment_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.payment_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const payment = await db.insert('payments', {
        po_id: Number(po_id),
        payment_no: `${prefix}${sequence}`,
        payment_date,
        amount: Number(amount),
        payment_method: payment_method || 'Transfer',
        reference_no: reference_no || null,
        status: 'For_Verification',
        prepared_by,
        checked_by: req.user.name,
        remarks: remarks || null
      });
      await db.insert('payment_documents', {
        payment_id: payment.id,
        document_type: document_type || 'Payment Support',
        document_no,
        document_url: document_url || null,
        notes: remarks || null
      });
      await db.logAudit('payments', payment.id, 'CREATE', null, JSON.stringify(payment), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: 'Finance Officer',
        title: 'Payment Verification Requested',
        message: `Finance review is required for payment ${payment.payment_no} linked to PO ${po.po_no}.`,
        type: 'info'
      });
      res.status(201).json(payment);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/payments/:id/status', authenticate, requireRoles(['Finance Officer', 'Mayor', 'GSO Officer']), async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const { status, remarks } = req.body;
      const payment = await db.getById<any>('payments', id);
      if (!payment) return res.status(404).json({ error: 'Payment record not found.' });
      const validation = validateEntityTransition('Payment', {
        fromStatus: payment.status,
        toStatus: String(status || ''),
        role: req.user.role,
        fields: { remarks }
      });
      if (!validation.valid) {
        const statusCode = validation.errors.some(error => error.startsWith('Forbidden:')) ? 403 : 409;
        return res.status(statusCode).json({ error: validation.errors.join(' '), errors: validation.errors, nextAction: validation.nextAction });
      }
      const updated = await db.update('payments', id, {
        status,
        checked_by: req.user.name,
        remarks: remarks ? String(remarks).trim() : payment.remarks || null
      });
      await db.logAudit('payments', id, 'STATUS_CHANGE', JSON.stringify(payment), JSON.stringify(updated), req.user.role, req.user.name);
      if (status === 'Completed') {
        const { query: mysqlQuery } = await import('./src/mysql.js');
        const totals = await mysqlQuery<any>(
          `SELECT po.id, po.pr_id, poTotal.po_total, COALESCE(paid.paid_total, 0) AS paid_total
           FROM purchase_orders po
           JOIN (SELECT po_id, SUM(total_cost) AS po_total FROM po_items GROUP BY po_id) poTotal ON poTotal.po_id = po.id
           LEFT JOIN (SELECT po_id, SUM(amount) AS paid_total FROM payments WHERE status = 'Completed' GROUP BY po_id) paid ON paid.po_id = po.id
           WHERE po.id = ?`,
          [payment.po_id]
        );
        if (totals[0] && Number(totals[0].paid_total) >= Number(totals[0].po_total)) {
          await mysqlQuery("UPDATE purchase_orders SET status = 'Completed' WHERE id = ?", [payment.po_id]);
          await mysqlQuery("UPDATE purchase_requests pr JOIN purchase_orders po ON po.pr_id = pr.id SET pr.status = 'Completed' WHERE po.id = ?", [payment.po_id]);
        }
      }
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8. Inventory
  app.get('/api/inventory', authenticate, requireRoles(['GSO Officer', 'Mayor', 'End User']), async (req, res) => {
    try {
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT asset.*, pr.department_id
         FROM inventory_assets asset
         JOIN iar_items ii ON ii.id = asset.iar_item_id
         JOIN iar_records iar ON iar.id = ii.iar_id
         JOIN purchase_orders po ON po.id = iar.po_id
         JOIN purchase_requests pr ON pr.id = po.pr_id`
      );
      const user = (req as any).user;
      res.json(user.role === 'End User'
        ? rows.filter((row: any) => Number(row.assigned_to_user_id) === Number(user.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8a. Consumable supplies inventory ledger
  app.get('/api/supplies/inventory', authenticate, requireRoles(['GSO Officer', 'Mayor', 'End User']), async (req: any, res: any) => {
    try {
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const requestedDepartment = Number(req.query.department_id);
      const departmentId = req.user.role === 'End User'
        ? Number(req.user.department_id)
        : (Number.isInteger(requestedDepartment) && requestedDepartment > 0 ? requestedDepartment : null);
      const params: any[] = [];
      const departmentFilter = departmentId ? 'AND d.id = ?' : '';
      if (departmentId) params.push(departmentId);
      const rows = await mysqlQuery<any>(
        `SELECT i.id, i.item_code, i.description, i.category, i.unit, i.reorder_level, i.active,
                d.id AS department_id, d.name AS department_name, d.code AS department_code,
                COALESCE(SUM(CASE WHEN t.to_department_id = d.id THEN t.quantity ELSE 0 END), 0) AS received_quantity,
                COALESCE(SUM(CASE WHEN t.from_department_id = d.id THEN t.quantity ELSE 0 END), 0) AS issued_quantity,
                COALESCE(SUM(CASE WHEN t.to_department_id = d.id THEN t.quantity ELSE -t.quantity END), 0) AS quantity_on_hand
         FROM inventory_items i
         JOIN departments d ON EXISTS (
           SELECT 1 FROM inventory_transactions department_transactions
           WHERE department_transactions.inventory_item_id = i.id
             AND (department_transactions.to_department_id = d.id OR department_transactions.from_department_id = d.id)
         )
         LEFT JOIN inventory_transactions t ON t.inventory_item_id = i.id
           AND (t.to_department_id = d.id OR t.from_department_id = d.id)
         WHERE i.active = TRUE ${departmentFilter}
         GROUP BY i.id, i.item_code, i.description, i.category, i.unit, i.reorder_level, i.active,
                  d.id, d.name, d.code
         ORDER BY d.name, i.description`,
        params
      );
      res.json(rows.map((row: any) => ({ ...row, quantity_on_hand: Number(row.quantity_on_hand), low_stock: Number(row.quantity_on_hand) <= Number(row.reorder_level) })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/supplies/items', authenticate, requireRoles(['GSO Officer', 'Mayor', 'End User']), async (req: any, res: any) => {
    try {
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const rows = await mysqlQuery<any>(
        `SELECT id, item_code, description, category, unit, reorder_level, active
         FROM inventory_items
         WHERE active = TRUE
         ORDER BY description`
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/supplies/items', authenticate, requireRoles(['GSO Officer']), async (req: any, res: any) => {
    try {
      const { item_code, description, category, unit, reorder_level } = req.body;
      if (!String(item_code || '').trim() || !String(description || '').trim() || !String(unit || '').trim()) {
        return res.status(400).json({ error: 'Item code, description, and unit are required.' });
      }
      const reorderLevel = Number(reorder_level || 0);
      if (!Number.isFinite(reorderLevel) || reorderLevel < 0) return res.status(400).json({ error: 'Reorder level must be non-negative.' });
      const item = await db.insert<any>('inventory_items', {
        item_code: String(item_code).trim(),
        description: String(description).trim(),
        category: String(category || 'Supplies').trim(),
        unit: String(unit).trim(),
        reorder_level: reorderLevel,
        active: true
      });
      await db.logAudit('inventory_items', item.id, 'CREATE', null, JSON.stringify(item), req.user.role, req.user.name);
      res.status(201).json(item);
    } catch (e: any) {
      res.status(e.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: e.code === 'ER_DUP_ENTRY' ? 'Item code already exists.' : e.message });
    }
  });

  app.post('/api/supplies/transactions', authenticate, requireRoles(['GSO Officer']), async (req: any, res: any) => {
    try {
      const { inventory_item_id, transaction_type, quantity, from_department_id, to_department_id, unit_cost, remarks, reference_id } = req.body;
      const itemId = Number(inventory_item_id);
      const amount = Number(quantity);
      const allowedTypes = ['RECEIVE', 'ISSUE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'DISPOSAL'];
      if (!Number.isInteger(itemId) || itemId <= 0 || !allowedTypes.includes(transaction_type) || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Item, valid transaction type, and positive quantity are required.' });
      }
      const fromDepartment = from_department_id ? Number(from_department_id) : null;
      const toDepartment = to_department_id ? Number(to_department_id) : null;
      if (transaction_type === 'RECEIVE' && !toDepartment) return res.status(400).json({ error: 'Receiving requires a destination department.' });
      if (['ISSUE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(transaction_type) && (!fromDepartment || !toDepartment)) {
        return res.status(400).json({ error: 'This stock movement requires both source and destination departments.' });
      }
      if (transaction_type === 'DISPOSAL' && !fromDepartment) return res.status(400).json({ error: 'Disposal requires a source department.' });
      const today = new Date().toISOString().slice(0, 10);
      const result = await withTransaction(async (connection) => {
        const [items]: any = await connection.query('SELECT id FROM inventory_items WHERE id = ? AND active = TRUE FOR UPDATE', [itemId]);
        if (!items.length) throw Object.assign(new Error('Inventory item not found.'), { statusCode: 404 });
        if (fromDepartment) {
          const [balanceRows]: any = await connection.query(
            `SELECT COALESCE(SUM(CASE WHEN to_department_id = ? THEN quantity ELSE -quantity END), 0) AS balance
             FROM inventory_transactions WHERE inventory_item_id = ? AND (to_department_id = ? OR from_department_id = ?)`,
            [fromDepartment, itemId, fromDepartment, fromDepartment]
          );
          if (Number(balanceRows[0]?.balance || 0) < amount) throw Object.assign(new Error('Insufficient stock in the source department.'), { statusCode: 409 });
        }
        const [insertResult]: any = await connection.execute(
          `INSERT INTO inventory_transactions
           (inventory_item_id, transaction_type, quantity, unit_cost, from_department_id, to_department_id, reference_table, reference_id, performed_by, transaction_date, remarks)
           VALUES (?, ?, ?, ?, ?, ?, 'inventory_items', ?, ?, ?, ?)`,
          [itemId, transaction_type, amount, unit_cost ? Number(unit_cost) : null, fromDepartment, toDepartment, reference_id ? Number(reference_id) : null, req.user.name, today, remarks ? String(remarks).trim() : null]
        );
        return { id: Number(insertResult.insertId), inventory_item_id: itemId, transaction_type, quantity: amount, from_department_id: fromDepartment, to_department_id: toDepartment };
      });
      await db.logAudit('inventory_transactions', result.id, 'CREATE', null, JSON.stringify(result), req.user.role, req.user.name);
      res.status(201).json(result);
    } catch (e: any) {
      res.status(e.statusCode || 500).json({ error: e.message });
    }
  });

  // 8b. RIS issuance and asset movements
  app.get('/api/ris', authenticate, requireRoles(['GSO Officer', 'Mayor', 'End User']), async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT r.*, d.name AS department_name,
          ri.asset_id, ri.quantity AS issued_quantity,
          asset.property_no, asset.description, asset.unit, asset.cost,
          asset.date_acquired, asset.type, asset.assigned_to_user_id,
          asset.receiver_name, asset.receiver_designation, asset.status AS asset_status
         FROM ris_records r
         JOIN departments d ON d.id = r.department_id
         LEFT JOIN ris_items ri ON ri.ris_id = r.id
         LEFT JOIN inventory_assets asset ON asset.id = ri.asset_id
         ORDER BY r.id DESC`
      );
      res.json(req.user.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(req.user, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/ris', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const { department_id, requisitioner_name, requisitioner_designation, purpose, items } = req.body;
      if (!department_id || !requisitioner_name || !requisitioner_designation || !purpose || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Department, requisitioner details, purpose, and at least one asset are required.' });
      }
      const department = await db.getById<any>('departments', Number(department_id));
      if (!department) return res.status(400).json({ error: 'Invalid department.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const assetIds = items.map((item: any) => Number(item.asset_id));
      if (assetIds.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(assetIds).size !== assetIds.length) {
        return res.status(400).json({ error: 'RIS contains invalid or duplicate assets.' });
      }
      const assets = await mysqlQuery<any>(
        `SELECT id, status FROM inventory_assets WHERE id IN (${assetIds.map(() => '?').join(', ')})`,
        assetIds
      );
      if (assets.length !== assetIds.length || assets.some((asset: any) => asset.status !== 'Active')) {
        return res.status(409).json({ error: 'Only active inventory assets may be issued through RIS.' });
      }
      const risTransition = validateEntityTransition('RIS', {
        fromStatus: 'Draft',
        toStatus: 'Issued',
        role: req.user.role
      });
      if (!risTransition.valid) {
        return res.status(403).json({ error: risTransition.errors.join(' '), errors: risTransition.errors, nextAction: risTransition.nextAction });
      }
      const today = new Date();
      const prefix = `RIS-${today.getFullYear()}-`;
      const latest = await mysqlQuery<any>('SELECT ris_no FROM ris_records WHERE ris_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.ris_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const result = await withTransaction(async (connection) => {
        const [recordResult]: any = await connection.execute(
          `INSERT INTO ris_records
           (ris_no, department_id, requisitioner_name, requisitioner_designation, issued_by, date_issued, purpose, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Issued')`,
          [`${prefix}${sequence}`, Number(department_id), requisitioner_name, requisitioner_designation, req.user.name, today.toISOString().slice(0, 10), purpose]
        );
        const risId = Number(recordResult.insertId);
        for (const item of items) {
          const quantity = Number(item.quantity || 1);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('RIS quantities must be positive integers.');
          const [assetUpdate]: any = await connection.execute(
            'UPDATE inventory_assets SET assigned_to_user_id = ? WHERE id = ? AND status = \'Active\'',
            [Number(department_id), Number(item.asset_id)]
          );
          if (assetUpdate.affectedRows !== 1) throw new Error('An asset is no longer active and cannot be issued.');
          await connection.execute(
            'INSERT INTO ris_items (ris_id, asset_id, quantity) VALUES (?, ?, ?)',
            [risId, Number(item.asset_id), quantity]
          );
          await connection.execute(
            `INSERT INTO asset_movements
             (asset_id, movement_type, to_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
             VALUES (?, 'ISSUED', ?, 'ris_records', ?, ?, ?, ?)`,
            [Number(item.asset_id), Number(department_id), risId, req.user.name, today.toISOString().slice(0, 10), purpose]
          );
        }
        return { id: risId, ris_no: `${prefix}${sequence}`, department_id: Number(department_id), status: 'Issued' };
      });

      await db.logAudit('ris_records', result.id, 'CREATE', null, JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: Number(department_id),
        title: 'Requisition & Issuance Slip Created (RIS)',
        message: `RIS ${result.ris_no} has been issued for ${department.name}. Requisitioner: ${requisitioner_name}.`,
        type: 'info'
      });

      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/asset-movements/:assetId', authenticate, async (req: any, res: any) => {
    try {
      const assetId = Number(req.params.assetId);
      if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ error: 'Invalid asset ID.' });
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        'SELECT * FROM asset_movements WHERE asset_id = ? ORDER BY id DESC',
        [assetId]
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8c. IIRUP disposal requests
  app.get('/api/iirup', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const rows = await query<any>(
        `SELECT r.*, d.name AS department_name
         FROM iirup_records r JOIN departments d ON d.id = r.department_id
         ORDER BY r.id DESC`
      );
      res.json(req.user.role === 'End User'
        ? rows.filter((row: any) => canAccessDepartment(req.user, row.department_id))
        : rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/iirup', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const { department_id, reason, disposal_method, items } = req.body;
      if (!department_id || !reason || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Department, reason, and at least one asset are required.' });
      }
      const department = await db.getById<any>('departments', Number(department_id));
      if (!department) return res.status(400).json({ error: 'Invalid department.' });
      const allowedMethods = ['Public Auction', 'Negotiated Sale', 'Donation', 'Destruction', 'Transfer'];
      if (disposal_method && !allowedMethods.includes(disposal_method)) return res.status(400).json({ error: 'Invalid disposal method.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const assetIds = items.map((item: any) => Number(item.asset_id));
      if (assetIds.some((id: number) => !Number.isInteger(id) || id <= 0) || new Set(assetIds).size !== assetIds.length) {
        return res.status(400).json({ error: 'IIRUP contains invalid or duplicate assets.' });
      }
      const assets = await mysqlQuery<any>(
        `SELECT id, status, assigned_to_user_id FROM inventory_assets WHERE id IN (${assetIds.map(() => '?').join(', ')})`,
        assetIds
      );
      if (assets.length !== assetIds.length || assets.some((asset: any) => asset.status !== 'Active' || Number(asset.assigned_to_user_id) !== Number(department_id))) {
        return res.status(409).json({ error: 'IIRUP assets must be active assets assigned to the selected department.' });
      }
      const iirupTransition = validateEntityTransition('IIRUP', {
        fromStatus: 'Draft',
        toStatus: 'Submitted',
        role: req.user.role
      });
      if (!iirupTransition.valid) {
        return res.status(403).json({ error: iirupTransition.errors.join(' '), errors: iirupTransition.errors, nextAction: iirupTransition.nextAction });
      }
      const today = new Date();
      const prefix = `IIRUP-${today.getFullYear()}-`;
      const latest = await mysqlQuery<any>('SELECT iirup_no FROM iirup_records WHERE iirup_no LIKE ? ORDER BY id DESC LIMIT 1', [`${prefix}%`]);
      const latestSequence = latest[0]?.iirup_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, '0');
      const result = await withTransaction(async (connection) => {
        const [recordResult]: any = await connection.execute(
          `INSERT INTO iirup_records
           (iirup_no, department_id, inspection_date, prepared_by, reason, disposal_method, status)
           VALUES (?, ?, ?, ?, ?, ?, 'Submitted')`,
          [`${prefix}${sequence}`, Number(department_id), today.toISOString().slice(0, 10), req.user.name, reason, disposal_method || null]
        );
        const iirupId = Number(recordResult.insertId);
        for (const item of items) {
          const conditionNotes = String(item.condition_notes || '').trim();
          if (!conditionNotes) throw new Error('Condition notes are required for every IIRUP asset.');
          const appraisedValue = item.appraised_value === undefined || item.appraised_value === null ? null : Number(item.appraised_value);
          if (appraisedValue !== null && (!Number.isFinite(appraisedValue) || appraisedValue < 0)) throw new Error('Appraised value must be non-negative.');
          await connection.execute(
            'INSERT INTO iirup_items (iirup_id, asset_id, condition_notes, appraised_value) VALUES (?, ?, ?, ?)',
            [iirupId, Number(item.asset_id), conditionNotes, appraisedValue]
          );
          await connection.execute(
            `INSERT INTO asset_movements
              (asset_id, movement_type, from_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
              VALUES (?, 'DISPOSAL_REQUESTED', ?, 'iirup_records', ?, ?, ?, ?)`,
            [Number(item.asset_id), Number(department_id), iirupId, req.user.name, today.toISOString().slice(0, 10), reason]
          );
        }
        return { id: iirupId, iirup_no: `${prefix}${sequence}`, department_id: Number(department_id), status: 'Submitted' };
      });

      await db.logAudit('iirup_records', result.id, 'CREATE', null, JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: 'Mayor',
        title: 'New IIRUP Disposal Request Submitted',
        message: `IIRUP ${result.iirup_no} submitted by ${department.name} for disposal review. Reason: ${reason}.`,
        type: 'info'
      });

      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/iirup/:id/status', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const iirupId = Number(req.params.id);
      const { status, coa_authority_no } = req.body;
      if (!Number.isInteger(iirupId) || iirupId <= 0) return res.status(400).json({ error: 'Invalid IIRUP ID.' });
      const { query: mysqlQuery } = await import('./src/mysql.js');
      const records = await mysqlQuery<any>('SELECT * FROM iirup_records WHERE id = ?', [iirupId]);
      if (!records.length) return res.status(404).json({ error: 'IIRUP record not found.' });
      const record = records[0];
      const validation = validateEntityTransition('IIRUP', {
        fromStatus: record.status,
        toStatus: String(status || ''),
        role: req.user.role,
        fields: { coa_authority_no }
      });
      if (!validation.valid) {
        const statusCode = validation.errors.some(error => error.startsWith('Forbidden:')) ? 403 : 409;
        return res.status(statusCode).json({ error: validation.errors.join(' '), errors: validation.errors, nextAction: validation.nextAction });
      }

      const result = await withTransaction(async (connection) => {
        const updates = status === 'Approved'
          ? [status, coa_authority_no || null, iirupId]
          : [status, coa_authority_no || record.coa_authority_no || null, iirupId];
        const [updateResult]: any = await connection.execute(
          `UPDATE iirup_records SET status = ?, coa_authority_no = ?
           WHERE id = ? AND status = ?`,
          [...updates.slice(0, 2), iirupId, record.status]
        );
        if (updateResult.affectedRows !== 1) throw new Error('IIRUP status changed by another request.');
        const items = await connection.query<any[]>('SELECT asset_id FROM iirup_items WHERE iirup_id = ?', [iirupId]);
        const movementType = status === 'Disposed' ? 'DISPOSED' : 'DISPOSAL_REQUESTED';
        for (const item of (items[0] as any[])) {
          if (status === 'Approved') {
            await connection.execute('UPDATE inventory_assets SET status = \'Condemned\' WHERE id = ? AND status = \'Active\'', [item.asset_id]);
          }
          if (status !== 'Cancelled') {
            await connection.execute(
              `INSERT INTO asset_movements
               (asset_id, movement_type, from_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
               VALUES (?, ?, ?, 'iirup_records', ?, ?, ?, ?)`,
              [item.asset_id, movementType, record.department_id, iirupId, req.user.name, new Date().toISOString().slice(0, 10), coa_authority_no || `IIRUP ${status}`]
            );
          }
        }
        return { id: iirupId, status, coa_authority_no: coa_authority_no || record.coa_authority_no || null };
      });
      await db.logAudit('iirup_records', iirupId, 'STATUS_CHANGE', JSON.stringify(record), JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: record.department_id,
        title: `IIRUP ${record.iirup_no} Status Update`,
        message: `Disposal request ${record.iirup_no} status changed to ${status}.${coa_authority_no ? ` COA Auth: ${coa_authority_no}` : ''}`,
        type: status === 'Approved' || status === 'Disposed' ? 'success' : 'info'
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8d. Inventory Asset Transfer
  app.post('/api/inventory/:id/transfer', authenticate, requireRoles(['GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const assetId = Number(req.params.id);
      const { to_department_id, receiver_name, receiver_designation, remarks } = req.body;
      if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ error: 'Invalid asset ID.' });
      if (!to_department_id || !receiver_name || !receiver_designation) {
        return res.status(400).json({ error: 'Destination department, receiver name, and receiver designation are required.' });
      }
      const department = await db.getById<any>('departments', Number(to_department_id));
      if (!department) return res.status(400).json({ error: 'Invalid destination department.' });

      const asset = await db.getById<any>('inventory_assets', assetId);
      if (!asset) return res.status(404).json({ error: 'Inventory asset not found.' });
      if (asset.status !== 'Active') return res.status(409).json({ error: `Cannot transfer asset with status ${asset.status}.` });

      const today = new Date().toISOString().slice(0, 10);
      const result = await withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE inventory_assets
           SET assigned_to_user_id = ?, receiver_name = ?, receiver_designation = ?, status = 'Active'
           WHERE id = ?`,
          [Number(to_department_id), receiver_name, receiver_designation, assetId]
        );
        await connection.execute(
          `INSERT INTO asset_movements
           (asset_id, movement_type, from_department_id, to_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
           VALUES (?, 'TRANSFERRED', ?, ?, 'inventory_assets', ?, ?, ?, ?)`,
          [assetId, asset.assigned_to_user_id, Number(to_department_id), assetId, req.user.name, today, remarks || 'Custody transfer to new department']
        );
        return { success: true, asset_id: assetId, new_department_id: Number(to_department_id) };
      });

      await db.logAudit('inventory_assets', assetId, 'UPDATE', JSON.stringify(asset), JSON.stringify({ ...asset, assigned_to_user_id: to_department_id, receiver_name, receiver_designation }), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: Number(to_department_id),
        title: 'Asset Transferred to Department',
        message: `Asset ${asset.property_no} (${asset.description}) has been transferred to ${department.name}. Custodian: ${receiver_name}.`,
        type: 'info'
      });

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8e. Inventory Asset Return to GSO Central Storage
  app.post('/api/inventory/:id/return', authenticate, requireRoles(['End User', 'GSO Officer', 'Mayor']), async (req: any, res: any) => {
    try {
      const assetId = Number(req.params.id);
      const { remarks, condition_notes } = req.body;
      if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ error: 'Invalid asset ID.' });

      const asset = await db.getById<any>('inventory_assets', assetId);
      if (!asset) return res.status(404).json({ error: 'Inventory asset not found.' });
      if (asset.status !== 'Active') return res.status(409).json({ error: `Cannot return asset with status ${asset.status}.` });
      if (!canAccessDepartment(req.user, asset.assigned_to_user_id)) {
        return res.status(403).json({ error: 'You may only return assets assigned to your department.' });
      }

      // Department 4 is General Services Office
      const gsoDeptId = 4;
      const today = new Date().toISOString().slice(0, 10);
      const result = await withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE inventory_assets
           SET assigned_to_user_id = ?, receiver_name = 'GSO Central Storage', receiver_designation = 'Property Custodian', status = 'Active'
           WHERE id = ?`,
          [gsoDeptId, assetId]
        );
        await connection.execute(
          `INSERT INTO asset_movements
           (asset_id, movement_type, from_department_id, to_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
           VALUES (?, 'RETURNED', ?, ?, 'inventory_assets', ?, ?, ?, ?)`,
          [assetId, asset.assigned_to_user_id, gsoDeptId, assetId, req.user.name, today, remarks || condition_notes || 'Returned to GSO Central Storage']
        );
        return { success: true, asset_id: assetId, returned_to_department: gsoDeptId };
      });

      await db.logAudit('inventory_assets', assetId, 'UPDATE', JSON.stringify(asset), JSON.stringify({ ...asset, assigned_to_user_id: gsoDeptId, receiver_name: 'GSO Central Storage' }), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: 'GSO Officer',
        title: 'Asset Returned to Storage',
        message: `Asset ${asset.property_no} has been returned to GSO storage by ${req.user.name}.`,
        type: 'info'
      });

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 9. Audit Logs with filter & pagination
  app.get('/api/audit-logs', authenticate, requireRoles(['Mayor', 'GSO Officer', 'BAC Secretariat']), async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const tableName = req.query.table_name as string;
      const action = req.query.action as string;
      const search = req.query.search as string;
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const conditions: string[] = [];
      const params: any[] = [];

      if (tableName) {
        conditions.push('table_name = ?');
        params.push(tableName);
      }
      if (action) {
        conditions.push('action = ?');
        params.push(action);
      }
      if (search) {
        conditions.push('(user_name LIKE ? OR new_value LIKE ? OR old_value LIKE ?)');
        const searchWildcard = `%${search}%`;
        params.push(searchWildcard, searchWildcard, searchWildcard);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = await query(sql, params);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 10. Persistent Notifications
  app.get('/api/notifications', authenticate, async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const { whereClause, params } = getNotificationVisibility(req.user);

      const countRows = await query<any>(
        `SELECT COUNT(*) AS count FROM notifications WHERE is_read = FALSE AND (${whereClause})`,
        params
      );
      const unreadCount = Number(countRows[0]?.count || 0);

      const rows = await query<any>(
        `SELECT * FROM notifications WHERE (${whereClause}) ORDER BY id DESC LIMIT 50`,
        params
      );

      res.json({ count: unreadCount, items: rows, notifications: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/notifications', authenticate, async (req: any, res: any) => {
    try {
      const { user_name, user_id, department_id, target_role, title, message, type } = req.body;
      if (!message) return res.status(400).json({ error: 'Message is required.' });

      const allowedInternalRoles = ['GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer'];
      const targetUserId = user_id ? Number(user_id) : null;
      const requestedTarget = target_role || null;

      if (!allowedInternalRoles.includes(req.user.role)) {
        if (!targetUserId || Number(targetUserId) !== Number(req.user.id)) {
          return res.status(403).json({ error: 'Only staff roles may create outbound notifications.' });
        }
      }

      if (requestedTarget && !allowedInternalRoles.includes(requestedTarget) && ![req.user.role].includes(requestedTarget)) {
        return res.status(400).json({ error: 'Invalid notification target role.' });
      }

      const { query } = await import('./src/mysql.js');
      let resolvedUserId = targetUserId;

      if (!resolvedUserId && user_name) {
        const userMatches = await query<any>('SELECT id FROM users WHERE name = ? OR username = ? LIMIT 1', [user_name, user_name]);
        if (userMatches.length > 0) {
          resolvedUserId = Number(userMatches[0].id);
        }
      }

      if (!allowedInternalRoles.includes(req.user.role) && resolvedUserId && Number(resolvedUserId) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'You may only notify yourself.' });
      }

      await query(
        `INSERT INTO notifications (user_id, user_name, department_id, target_role, title, message, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          resolvedUserId,
          user_name || null,
          department_id ? Number(department_id) : null,
          requestedTarget,
          title || 'Procurement Notification',
          message,
          type || 'info'
        ]
      );

      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/notifications/:id/read', authenticate, async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid notification ID.' });
      const { query } = await import('./src/mysql.js');
      const { whereClause, params } = getNotificationVisibility(req.user);
      const result = await query(`UPDATE notifications SET is_read = TRUE WHERE id = ? AND (${whereClause})`, [id, ...params]);
      if (!result || !(result as any).affectedRows) {
        return res.status(403).json({ error: 'You are not allowed to mark this notification as read.' });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/notifications/read-all', authenticate, async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const { whereClause, params } = getNotificationVisibility(req.user);
      await query(`UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE AND (${whereClause})`, params);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 11. Chatbot
  app.post('/api/chat', authenticate, async (req, res) => {
    try {
      res.json({ reply: 'This is a simulated AI response indicating the backend successfully received your prompt.' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================
  // 12. ADMIN LEDGER EXPORT — Full system snapshot
  // ============================================================
  app.get('/api/ledger/export', authenticate, requireRoles(['Mayor', 'GSO Officer', 'Finance Officer']), async (req: any, res: any) => {
    try {
      const { query } = await import('./src/mysql.js');
      const [
        ppmpItems,
        purchaseRequests,
        prItems,
        rfqRecords,
        suppliers,
        purchaseOrders,
        poItems,
        iarRecords,
        iarItems,
        inventory,
        auditLogs,
        departments,
        systemSettings,
        users,
        bacResolutions
      ] = await Promise.all([
        db.getTable('ppmp_items'),
        db.getTable('purchase_requests'),
        query('SELECT * FROM pr_items ORDER BY pr_id, item_no'),
        db.getTable('rfq_records'),
        db.getTable('suppliers'),
        db.getTable('purchase_orders'),
        query('SELECT * FROM po_items ORDER BY po_id'),
        db.getTable('iar_records'),
        query('SELECT * FROM iar_items ORDER BY iar_id'),
        db.getTable('inventory_assets'),
        query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500'),
        db.getTable('departments'),
        db.getTable('system_settings'),
        query('SELECT id, username, name, role, department_id, created_at FROM users'),
        db.getTable('bac_resolutions')
      ]);

      await db.logAudit('audit_logs', 0, 'LEDGER_EXPORT', null, `Full system ledger exported by ${req.user.name}`, req.user.role, req.user.name);

      res.json({
        exported_at: new Date().toISOString(),
        exported_by: req.user.name,
        exported_by_role: req.user.role,
        ppmpItems,
        purchaseRequests,
        prItems,
        rfqRecords,
        suppliers,
        purchaseOrders,
        poItems,
        iarRecords,
        iarItems,
        inventory,
        auditLogs,
        departments,
        systemSettings: systemSettings[0] || {},
        users,
        bacResolutions
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================
  // 13. ADMIN DELETE ROUTES — Mayor only, with audit logging
  // ============================================================

  // DELETE PPMP Item
  app.delete('/api/ppmp/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { query } = await import('./src/mysql.js');
      const record = await db.getById('ppmp_items', id);
      if (!record) return res.status(404).json({ error: 'PPMP item not found' });
      const references = await query<any>('SELECT COUNT(*) AS count FROM pr_items WHERE ppmp_item_id = ?', [id]);
      if (Number(references[0]?.count || 0) > 0) {
        return res.status(409).json({ error: 'This APP / PPMP item is used by a Purchase Request and cannot be deleted.' });
      }
      await db.logAudit('ppmp_items', id, 'DELETE', JSON.stringify(record), null, req.user.role, req.user.name);
      await db.delete('ppmp_items', id);
      res.json({ success: true, deleted_id: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE Purchase Request (cascade: pr_items)
  app.delete('/api/pr/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { query } = await import('./src/mysql.js');
      const record = await db.getById('purchase_requests', id);
      if (!record) return res.status(404).json({ error: 'Purchase Request not found' });
      if (['Approved', 'Disapproved'].includes((record as any).status)) {
        return res.status(409).json({ error: 'Finalized Purchase Requests cannot be deleted. Use cancellation or archival instead.' });
      }
      const items = await query('SELECT * FROM pr_items WHERE pr_id = ?', [id]);
      await db.logAudit('purchase_requests', id, 'DELETE', JSON.stringify({ ...record, items }), null, req.user.role, req.user.name);
      // Cascade delete child items first
      await query('DELETE FROM pr_items WHERE pr_id = ?', [id]);
      await db.delete('purchase_requests', id);
      res.json({ success: true, deleted_id: id, cascade_deleted_items: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE RFQ Record
  app.delete('/api/rfq/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { query } = await import('./src/mysql.js');
      const record = await db.getById('rfq_records', id);
      if (!record) return res.status(404).json({ error: 'RFQ not found' });
      if (['Published', 'Closed'].includes((record as any).status)) {
        return res.status(409).json({ error: 'Published or closed RFQs cannot be deleted.' });
      }
      await db.logAudit('rfq_records', id, 'DELETE', JSON.stringify(record), null, req.user.role, req.user.name);
      await query('DELETE FROM rfq_items WHERE rfq_id = ?', [id]);
      await query('DELETE FROM abstract_bids WHERE rfq_id = ?', [id]);
      await db.delete('rfq_records', id);
      res.json({ success: true, deleted_id: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE Purchase Order (cascade: po_items)
  app.delete('/api/po/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { query } = await import('./src/mysql.js');
      const record = await db.getById('purchase_orders', id);
      if (!record) return res.status(404).json({ error: 'Purchase Order not found' });
      if (['Issued', 'Signed', 'Partially_Delivered', 'Fully_Delivered'].includes((record as any).status)) {
        return res.status(409).json({ error: 'Issued, signed, or delivered Purchase Orders cannot be deleted.' });
      }
      const items = await query('SELECT * FROM po_items WHERE po_id = ?', [id]);
      await db.logAudit('purchase_orders', id, 'DELETE', JSON.stringify({ ...record, items }), null, req.user.role, req.user.name);
      await query('DELETE FROM po_items WHERE po_id = ?', [id]);
      await db.delete('purchase_orders', id);
      res.json({ success: true, deleted_id: id, cascade_deleted_items: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE IAR Record (cascade: iar_items)
  app.delete('/api/iar/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const { query } = await import('./src/mysql.js');
      const record = await db.getById('iar_records', id);
      if (!record) return res.status(404).json({ error: 'IAR not found' });
      if (['Submitted', 'Partial', 'Completed'].includes((record as any).status)) {
        return res.status(409).json({ error: 'Submitted or completed IAR records cannot be deleted.' });
      }
      const items = await query('SELECT * FROM iar_items WHERE iar_id = ?', [id]);
      await db.logAudit('iar_records', id, 'DELETE', JSON.stringify({ ...record, items }), null, req.user.role, req.user.name);
      await query('DELETE FROM iar_items WHERE iar_id = ?', [id]);
      await db.delete('iar_records', id);
      res.json({ success: true, deleted_id: id, cascade_deleted_items: items.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE Supplier
  app.delete('/api/suppliers/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const record = await db.getById('suppliers', id);
      if (!record) return res.status(404).json({ error: 'Supplier not found' });
      await db.logAudit('suppliers', id, 'DELETE', JSON.stringify(record), null, req.user.role, req.user.name);
      await db.delete('suppliers', id);
      res.json({ success: true, deleted_id: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE Inventory Asset
  app.delete('/api/inventory/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const record = await db.getById('inventory_assets', id);
      if (!record) return res.status(404).json({ error: 'Asset not found' });
      await db.logAudit('inventory_assets', id, 'DELETE', JSON.stringify(record), null, req.user.role, req.user.name);
      await db.delete('inventory_assets', id);
      res.json({ success: true, deleted_id: id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Audit log deletion has been removed.
  // Government audit records must be retained per COA retention policy (minimum 10 years).
  // Use GET /api/audit-logs with date filters and the CSV export on the ledger panel instead.
}
