import assert from 'node:assert/strict';
import { normalizeSupplierProfile, validateSupplierProfile } from './supplierPortalRules.ts';

const validProfile = normalizeSupplierProfile({
  name: 'Example Supplier Corporation',
  address: '1 Main Street',
  tin: '123-456-789-000',
  contact_person: 'Maria Santos',
  contact_no: '09171234567',
  email: 'maria@example.test'
});
assert.equal(validateSupplierProfile(validProfile).valid, true);

const invalidProfile = validateSupplierProfile(normalizeSupplierProfile({
  name: '',
  address: '',
  tin: '',
  contact_person: '',
  contact_no: '',
  email: 'invalid-email'
}));
assert.equal(invalidProfile.valid, false);
assert.equal(invalidProfile.errors.length, 6);

console.log('Supplier portal rule tests passed.');
