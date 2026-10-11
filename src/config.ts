import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

export const runtimeConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: Number.parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number.parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    database: process.env.MYSQL_DATABASE || 'procurement_management_ocr'
  }
};

export function validateRuntimeConfig() {
  const errors: string[] = [];
  if (!Number.isInteger(runtimeConfig.port) || runtimeConfig.port < 1 || runtimeConfig.port > 65535) errors.push('PORT must be between 1 and 65535.');
  if (!Number.isInteger(runtimeConfig.database.port) || runtimeConfig.database.port < 1 || runtimeConfig.database.port > 65535) errors.push('MYSQL_PORT must be between 1 and 65535.');
  if (!runtimeConfig.database.database) errors.push('MYSQL_DATABASE is required.');
  if (runtimeConfig.nodeEnv === 'production' && !process.env.MYSQL_PASSWORD) errors.push('MYSQL_PASSWORD must be set in production.');
  if (runtimeConfig.nodeEnv === 'production' && !process.env.OTP_SECRET) errors.push('OTP_SECRET must be set in production.');
  if (runtimeConfig.nodeEnv === 'production' && !process.env.DOCUMENT_ENCRYPTION_KEY) errors.push('DOCUMENT_ENCRYPTION_KEY must be set in production.');
  return { valid: errors.length === 0, errors };
}
