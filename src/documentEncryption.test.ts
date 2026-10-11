import assert from 'node:assert/strict';
import { decryptDocument, encryptDocument } from './documentEncryption.ts';

const source = Buffer.from('confidential procurement attachment');
const encrypted = encryptDocument(source);
assert.equal(encrypted.version, 1);
assert.notDeepEqual(encrypted.data, source);
assert.deepEqual(decryptDocument(encrypted.data, encrypted.version), source);
assert.deepEqual(decryptDocument(source, 0), source);

console.log('Document encryption tests passed.');
