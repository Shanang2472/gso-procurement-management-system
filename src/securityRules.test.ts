import assert from 'node:assert/strict';
import { buildSupplierPortalSummary, isNotificationVisibleToUser } from '../server_mysql.routes_patch.ts';

const supplierUser = { id: 7, role: 'Supplier', department_id: 3, supplier_id: 42 };
const staffUser = { id: 99, role: 'GSO Officer', department_id: 4, supplier_id: null };

const summary = {
  supplier_count: 12,
  invited_count: 9,
  responded_count: 4,
  quotations_count: 7
};

const supplierPerformance = [
  { id: 42, name: 'Alpha Supply', email: 'alpha@example.com', tin: '123', performance_rating: 4.8, performance_notes: 'Good' },
  { id: 99, name: 'Beta Supply', email: 'beta@example.com', tin: '456', performance_rating: 4.3, performance_notes: 'Other supplier' }
];

const scoped = buildSupplierPortalSummary(supplierUser, summary, supplierPerformance);
assert.equal(scoped.summary.supplier_count, 1);
assert.deepEqual(scoped.supplierPerformance.map((row: any) => row.id), [42]);

assert.equal(isNotificationVisibleToUser({ user_id: 7 }, supplierUser), true);
assert.equal(isNotificationVisibleToUser({ user_id: 8 }, supplierUser), false);
assert.equal(isNotificationVisibleToUser({ user_id: null, department_id: 4, target_role: 'GSO Officer' }, staffUser), true);
assert.equal(isNotificationVisibleToUser({ user_id: null, department_id: 3, target_role: 'GSO Officer' }, staffUser), false);

console.log('Security rule tests passed.');
