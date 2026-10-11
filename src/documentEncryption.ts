import crypto from 'crypto';

const ENCRYPTION_VERSION = 1;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function getEncryptionKey() {
  const configured = process.env.DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!configured && process.env.NODE_ENV !== 'production') {
    return crypto.createHash('sha256').update('gso-development-document-encryption-key').digest();
  }
  if (!configured) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  return key.length === 32 ? key : null;
}

export function encryptDocument(buffer: Buffer) {
  const key = getEncryptionKey();
  if (!key) throw new Error('DOCUMENT_ENCRYPTION_KEY is not configured or is not a valid 32-byte key.');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { version: ENCRYPTION_VERSION, data: Buffer.concat([iv, authTag, ciphertext]) };
}

export function decryptDocument(buffer: Buffer, version: number) {
  if (Number(version || 0) !== ENCRYPTION_VERSION) return buffer;
  const key = getEncryptionKey();
  if (!key) throw new Error('DOCUMENT_ENCRYPTION_KEY is required to read encrypted documents.');
  if (buffer.length <= IV_BYTES + AUTH_TAG_BYTES) throw new Error('Encrypted document payload is invalid.');
  const iv = buffer.subarray(0, IV_BYTES);
  const authTag = buffer.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buffer.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function hasDocumentEncryptionKey() {
  return getEncryptionKey() !== null;
}
