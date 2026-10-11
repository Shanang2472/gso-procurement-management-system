import { execute, query } from './mysql.js';
import crypto from 'crypto';

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function hashPasswordScrypt(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: `scrypt$${derivedKey.toString('base64url')}`,
    salt
  };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (storedHash.startsWith('scrypt$')) {
    const encodedKey = storedHash.slice('scrypt$'.length);
    try {
      const expected = Buffer.from(encodedKey, 'base64url');
      const actual = crypto.scryptSync(password, salt, expected.length);
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

type TableName = string;

function assertSafeTableName(table: string): asserts table is TableName {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
}



export class DatabaseMySQL {
  async getTable<T = any>(table: TableName): Promise<T[]> {
    assertSafeTableName(table);
    // Avoid template-string backticks that were confusing the TS parser in this repo.
    const sql = 'SELECT * FROM `' + table + '`';
    return query<T>(sql);
  }

  async getById<T = any>(table: TableName, id: number): Promise<T | null> {
    assertSafeTableName(table);
    const sql = 'SELECT * FROM `' + table + '` WHERE id = ? LIMIT 1';
    const rows = await query<T>(sql, [id]);
    return rows.length ? rows[0] : null;
  }

  async insert<T = any>(table: TableName, value: Record<string, any>): Promise<T> {
    assertSafeTableName(table);

    const keys = Object.keys(value);
    if (keys.length === 0) throw new Error('Insert requires at least one column');

    // Column identifiers: validate each key
    for (const k of keys) {
      assertSafeTableName(k);
    }

    const columns = keys.map(k => '`' + k + '`').join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const sql = 'INSERT INTO `' + table + '` (' + columns + ') VALUES (' + placeholders + ')';
    const params = keys.map(k => value[k]);

    const insertId = await execute(sql, params);
    const row = await this.getById<T>(table, insertId);
    if (!row) throw new Error(`Insert succeeded but row not found for table ${table} id=${insertId}`);
    return row;
  }

  async update<T = any>(table: TableName, id: number, updates: Record<string, any>): Promise<T | null> {
    assertSafeTableName(table);

    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getById<T>(table, id);

    for (const k of keys) {
      assertSafeTableName(k);
    }

    const setClause = keys.map(k => '`' + k + '` = ?').join(', ');
    const params = keys.map(k => updates[k]);
    params.push(id);

    const sql = 'UPDATE `' + table + '` SET ' + setClause + ' WHERE id = ?';
    await execute(sql, params);
    return this.getById<T>(table, id);
  }

  async delete(table: TableName, id: number): Promise<boolean> {
    assertSafeTableName(table);
    const sql = 'DELETE FROM `' + table + '` WHERE id = ?';
    await execute(sql, [id]);
    return true;
  }

  async deleteWhere<T = any>(table: TableName, column: string, value: T): Promise<boolean> {
    assertSafeTableName(table);
    assertSafeTableName(column);
    const sql = 'DELETE FROM `' + table + '` WHERE `' + column + '` = ?';
    await execute(sql, [value]);
    return true;
  }


  async logAudit(
    tableName: string,
    recordId: number,
    action: string,
    oldValue: string | null,
    newValue: string | null,
    userRole: string = 'Staff',
    userName: string = 'LGU Officer'
  ) {
    await this.insert('audit_logs', {
      table_name: tableName,
      record_id: recordId,
      action,
      old_value: oldValue,
      new_value: newValue,
      user_role: userRole,
      user_name: userName,
      timestamp: new Date().toISOString()
    } as any);
  }
}

export const db = new DatabaseMySQL();

