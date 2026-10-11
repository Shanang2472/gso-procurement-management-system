import assert from 'node:assert/strict';
import { DOCUMENT_MAX_BYTES, validateDocumentPayload } from './documentRules.ts';

assert.equal(validateDocumentPayload({ fileName: 'purchase-order.pdf', mimeType: 'application/pdf', fileSize: 1024 }).valid, true);
assert.equal(validateDocumentPayload({ fileName: 'malware.exe', mimeType: 'application/x-msdownload', fileSize: 1024 }).valid, false);
assert.equal(validateDocumentPayload({ fileName: 'large.pdf', mimeType: 'application/pdf', fileSize: DOCUMENT_MAX_BYTES + 1 }).valid, false);
assert.equal(validateDocumentPayload({ fileName: '../private.pdf', mimeType: 'application/pdf', fileSize: 1024 }).valid, false);

console.log('Document rule tests passed.');
