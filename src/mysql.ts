import mysql, { type Pool } from 'mysql2/promise';
import { config } from 'dotenv';
import { runtimeConfig } from './config.js';

config({ path: ['.env.local', '.env'] });

const HOST = runtimeConfig.database.host;
const PORT = runtimeConfig.database.port;
const USER = runtimeConfig.database.user;
const PASSWORD = process.env.MYSQL_PASSWORD ?? '';
const DATABASE = runtimeConfig.database.database;

export let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      database: DATABASE,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0
    });
  }
  return pool;
}

export async function testConnection(): Promise<void> {
  const p = getPool();
  const connection = await p.getConnection();
  connection.release();
}

export async function getHealthSnapshot() {
  const startedAt = Date.now();
  await query('SELECT 1 AS ok');
  return { database: 'ok', latency_ms: Date.now() - startedAt, database_name: DATABASE };
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params: any[] = []): Promise<number> {
  const p = getPool();
  const [result]: any = await p.execute(sql, params);
  return typeof result?.insertId === 'number' ? result.insertId : 0;
}

export async function withTransaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

