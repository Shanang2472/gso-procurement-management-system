import express from 'express';

import { db } from './src/db_mysql.js';
import { authenticate, requireRoles } from './server_mysql.js';

export function attachDepartmentsRoutes(app: express.Express) {
  // Public route: list departments
  app.get('/api/departments', async (_req, res) => {
    try {
      // Return columns expected by frontend: id, name, code, head_name, head_designation
      const rows = await db.getTable<any>('departments');
      res.json(
        rows.map((d: any) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          head_name: d.head_name,
          head_designation: d.head_designation,
          created_at: d.created_at
        }))
      );
    } catch (e: any) {
      console.error('GET /api/departments failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to fetch departments' });
    }
  });

  app.post('/api/departments', authenticate, requireRoles(['Mayor']), async (req: any, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const code = String(req.body?.code || '').trim().toUpperCase();
      const headName = String(req.body?.head_name || '').trim();
      const headDesignation = String(req.body?.head_designation || '').trim();

      if (!name || !code || !headName || !headDesignation) {
        return res.status(400).json({ error: 'Department name, code, head name, and head designation are required.' });
      }
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
        return res.status(400).json({ error: 'Department code may contain only letters, numbers, underscores, and hyphens.' });
      }

      const created = await db.insert<any>('departments', {
        name,
        code,
        head_name: headName,
        head_designation: headDesignation,
        created_at: new Date().toISOString()
      });

      await db.logAudit('departments', created.id, 'CREATE', null, JSON.stringify(created), req.user.role, req.user.name);
      res.status(201).json({
        id: created.id,
        name: created.name,
        code: created.code,
        head_name: created.head_name,
        head_designation: created.head_designation,
        created_at: created.created_at
      });
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A department with that code already exists.' });
      }
      console.error('POST /api/departments failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to create department' });
    }
  });

  app.put('/api/departments/:id', authenticate, requireRoles(['Mayor']), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.getById<any>('departments', id);
      if (!existing) return res.status(404).json({ error: 'Department not found.' });

      const name = String(req.body?.name || '').trim();
      const code = String(req.body?.code || '').trim().toUpperCase();
      const headName = String(req.body?.head_name || '').trim();
      const headDesignation = String(req.body?.head_designation || '').trim();
      if (!name || !code || !headName || !headDesignation) {
        return res.status(400).json({ error: 'Department name, code, head name, and head designation are required.' });
      }
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
        return res.status(400).json({ error: 'Department code may contain only letters, numbers, underscores, and hyphens.' });
      }

      const updated = await db.update<any>('departments', id, { name, code, head_name: headName, head_designation: headDesignation });
      await db.logAudit('departments', id, 'UPDATE', JSON.stringify(existing), JSON.stringify(updated), req.user.role, req.user.name);
      res.json(updated);
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A department with that code already exists.' });
      console.error('PUT /api/departments/:id failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to update department' });
    }
  });

  app.delete('/api/departments/:id', authenticate, requireRoles(['Mayor']), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.getById<any>('departments', id);
      if (!existing) return res.status(404).json({ error: 'Department not found.' });

      const { query } = await import('./src/mysql.js');
      const references = await query<any>(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE department_id = ?) AS users_count,
          (SELECT COUNT(*) FROM ppmp_items WHERE department_id = ?) AS ppmp_count,
          (SELECT COUNT(*) FROM purchase_requests WHERE department_id = ?) AS pr_count,
          (SELECT COUNT(*) FROM ris_records WHERE department_id = ?) AS ris_count,
          (SELECT COUNT(*) FROM iirup_records WHERE department_id = ?) AS iirup_count,
          (SELECT COUNT(*) FROM inventory_assets WHERE assigned_to_user_id = ?) AS assets_count,
          (SELECT COUNT(*) FROM inventory_transactions WHERE from_department_id = ? OR to_department_id = ?) AS transactions_count`,
        [id, id, id, id, id, id, id, id]
      );
      const referenceRow = (references[0] || {}) as Record<string, unknown>;
      const referenceCount = Object.values(referenceRow).reduce<number>((sum, value) => sum + Number(value || 0), 0);
      if (referenceCount > 0) return res.status(409).json({ error: 'This department is already used by system records and cannot be deleted. Reassign or archive its records first.' });

      await db.logAudit('departments', id, 'DELETE', JSON.stringify(existing), null, req.user.role, req.user.name);
      await db.delete('departments', id);
      res.json({ success: true, deleted_id: id });
    } catch (e: any) {
      console.error('DELETE /api/departments/:id failed:', e);
      res.status(500).json({ error: e?.message || 'Failed to delete department' });
    }
  });
}

