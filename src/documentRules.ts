export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'text/plain': '.txt'
};

export const isAllowedDocumentType = (mimeType: string) => Object.prototype.hasOwnProperty.call(ALLOWED_DOCUMENT_TYPES, mimeType);

export const isSafeDocumentName = (fileName: string) => {
  const normalized = fileName.trim();
  return normalized.length > 0 && normalized.length <= 255 && !/[\\/\0]/.test(normalized);
};

export const validateDocumentPayload = (input: { fileName: string; mimeType: string; fileSize: number }) => {
  const errors: string[] = [];
  if (!isSafeDocumentName(input.fileName)) errors.push('Document file name is invalid.');
  if (!isAllowedDocumentType(input.mimeType)) errors.push('Unsupported document type. Allowed types are PDF, JPEG, PNG, WebP, and text files.');
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > DOCUMENT_MAX_BYTES) errors.push('Document size must be between 1 byte and 5 MB.');
  return { valid: errors.length === 0, errors };
};
