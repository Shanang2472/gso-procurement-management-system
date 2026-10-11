import assert from 'node:assert/strict';
import { aggregateReportingRecords } from './reportingRules.ts';

const result = aggregateReportingRecords([
  { department_name: 'Health', category: 'Equipment', mode_of_procurement: 'Public Bidding', supplier_name: 'A', po_amount: 100, lead_time_days: 10, open_obligation: 20, late_delivery: false },
  { department_name: 'Health', category: 'Supplies', mode_of_procurement: 'Shopping', supplier_name: 'A', po_amount: 50, lead_time_days: 20, open_obligation: 10, late_delivery: true }
]);
assert.equal(result.spendingByDepartment[0].amount, 150);
assert.equal(result.averageLeadTimeDays, 15);
assert.equal(result.openObligations, 30);
assert.equal(result.lateDeliveries, 1);
assert.equal(result.supplierReliability[0].reliabilityRate, 50);

console.log('Reporting rule tests passed.');
