import assert from 'node:assert/strict';
import { evaluateProcurementCompliance, expectedProcurementMode, getComplianceDocumentChecklist } from './complianceRules.ts';
import { validateEntityTransition, validatePRTransition } from './workflowRules.ts';

assert.equal(expectedProcurementMode(20_000), 'Shopping');
assert.equal(expectedProcurementMode(130_000), 'Small Value Procurement');
assert.equal(expectedProcurementMode(245_000), 'Public Bidding');
assert.deepEqual(getComplianceDocumentChecklist('PO'), ['Approved Purchase Request', 'Notice of Award', 'Purchase Order']);

const compliantProcurement = evaluateProcurementCompliance({
  amount: 130_000,
  modeOfProcurement: 'Small Value Procurement',
  supplier: { name: 'Supplier Co.', tin: '123-456-789', email: 'bids@example.test' },
  requiredDocuments: ['Approved Purchase Request'],
  availableDocuments: ['Approved Purchase Request'],
  openDate: '2026-09-15',
  closeDate: '2026-09-20'
});
assert.equal(compliantProcurement.compliant, true);

const nonCompliantProcurement = evaluateProcurementCompliance({
  amount: 130_000,
  modeOfProcurement: 'Shopping',
  supplier: { name: 'Supplier Co.', tin: '', email: '' },
  requiredDocuments: ['Approved Purchase Request'],
  availableDocuments: [],
  openDate: '2026-09-20',
  closeDate: '2026-09-15'
});
assert.equal(nonCompliantProcurement.compliant, false);
assert.match(nonCompliantProcurement.checks.map(check => check.code).join(' '), /MODE_MISMATCH/);
assert.match(nonCompliantProcurement.checks.map(check => check.code).join(' '), /MISSING_DOCUMENT/);
assert.match(nonCompliantProcurement.checks.map(check => check.code).join(' '), /INVALID_TIMELINE/);

const validBudgetReview = validatePRTransition({
  fromStatus: 'Pending',
  toStatus: 'Budget_Review',
  role: 'Budget Officer',
  fields: { alobs_number: 'ALOBS-2026-0001', alobs_date: '2026-09-15' }
});
assert.equal(validBudgetReview.valid, true);

const invalidSkip = validatePRTransition({
  fromStatus: 'Pending',
  toStatus: 'Approved',
  role: 'Mayor',
  fields: { alobs_number: 'ALOBS-2026-0001', alobs_date: '2026-09-15', mode_of_procurement: 'Shopping' }
});
assert.equal(invalidSkip.valid, false);
assert.match(invalidSkip.errors.join(' '), /cannot move from Pending to Approved/);

const forbiddenRole = validatePRTransition({
  fromStatus: 'For_Approval',
  toStatus: 'Approved',
  role: 'GSO Officer',
  fields: { alobs_number: 'ALOBS-2026-0001', alobs_date: '2026-09-15', mode_of_procurement: 'Shopping' }
});
assert.equal(forbiddenRole.valid, false);
assert.match(forbiddenRole.errors.join(' '), /Forbidden/);

const missingApprovalData = validatePRTransition({
  fromStatus: 'For_Approval',
  toStatus: 'Approved',
  role: 'Mayor',
  fields: {}
});
assert.equal(missingApprovalData.valid, false);
assert.match(missingApprovalData.errors.join(' '), /alobs number/);
assert.match(missingApprovalData.errors.join(' '), /mode of procurement/);

const validPaymentApproval = validateEntityTransition('Payment', {
  fromStatus: 'For_Verification',
  toStatus: 'Approved',
  role: 'Finance Officer',
  fields: { remarks: 'Verified against receiving and payment documents.' }
});
assert.equal(validPaymentApproval.valid, true);

const invalidRfqClose = validateEntityTransition('RFQ', {
  fromStatus: 'Draft',
  toStatus: 'Closed',
  role: 'BAC Secretariat'
});
assert.equal(invalidRfqClose.valid, false);
assert.match(invalidRfqClose.errors.join(' '), /cannot move from Draft to Closed/);

const validRisIssue = validateEntityTransition('RIS', {
  fromStatus: 'Draft',
  toStatus: 'Issued',
  role: 'GSO Officer'
});
assert.equal(validRisIssue.valid, true);

const missingCoaAuthority = validateEntityTransition('IIRUP', {
  fromStatus: 'Approved',
  toStatus: 'Disposed',
  role: 'Mayor',
  fields: {}
});
assert.equal(missingCoaAuthority.valid, false);
assert.match(missingCoaAuthority.errors.join(' '), /coa authority no/);

const validIarCompletion = validateEntityTransition('IAR', {
  fromStatus: 'Draft',
  toStatus: 'Completed',
  role: 'GSO Officer'
});
assert.equal(validIarCompletion.valid, true);

const validPoSigning = validateEntityTransition('PO', {
  fromStatus: 'Draft',
  toStatus: 'Signed',
  role: 'GSO Officer'
});
assert.equal(validPoSigning.valid, true);

console.log('Workflow rule tests passed.');
