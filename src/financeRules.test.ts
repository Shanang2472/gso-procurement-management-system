import assert from 'node:assert/strict';
import { evaluateFinanceSnapshot } from './financeRules.ts';

const clean = evaluateFinanceSnapshot({ prAmount: 100000, poAmount: 95000, iarAmount: 95000, paidAmount: 50000, dueDate: '2099-01-01' });
assert.equal(clean.compliant, true);
assert.equal(clean.remainingPayable, 45000);
assert.equal(clean.agingStatus, 'Open');

const mismatch = evaluateFinanceSnapshot({ prAmount: 100000, poAmount: 120000, iarAmount: 130000, paidAmount: 140000, allotmentBalance: 90000 });
assert.equal(mismatch.compliant, false);
assert.deepEqual(mismatch.exceptions.map(exception => exception.code), ['PO_EXCEEDS_PR', 'IAR_EXCEEDS_PO', 'PAYMENT_EXCEEDS_PO', 'PO_EXCEEDS_ALLOTMENT', 'PAYMENT_EXCEEDS_IAR']);

const overdue = evaluateFinanceSnapshot({ prAmount: 100000, poAmount: 100000, iarAmount: 100000, paidAmount: 0, dueDate: '2020-01-01' });
assert.equal(overdue.agingStatus, 'Overdue');

console.log('Finance rule tests passed.');
