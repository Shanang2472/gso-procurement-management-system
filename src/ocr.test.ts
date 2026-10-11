import assert from 'node:assert/strict';
import { extractDocumentText } from './ocr.ts';

const result = await extractDocumentText(Buffer.from('Purchase Request OCR text'), 'text/plain');
assert.equal(result.status, 'Completed');
assert.equal(result.text, 'Purchase Request OCR text');
assert.equal(result.pages, 1);

const skipped = await extractDocumentText(Buffer.from('binary'), 'application/octet-stream');
assert.equal(skipped.status, 'Skipped');

console.log('OCR tests passed.');
