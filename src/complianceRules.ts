export type ComplianceInput = {
  amount: number;
  modeOfProcurement?: string | null;
  supplier?: {
    name?: string | null;
    tin?: string | null;
    email?: string | null;
  } | null;
  requiredDocuments?: string[];
  availableDocuments?: string[];
  hasPhilGEPSPosting?: boolean;
  openDate?: string | null;
  closeDate?: string | null;
  approvalRole?: string | null;
  requiredApprovalRole?: string | null;
};

export type ComplianceCheck = {
  code: string;
  level: 'error' | 'warning' | 'pass';
  message: string;
};

export type ComplianceResult = {
  compliant: boolean;
  checks: ComplianceCheck[];
  expectedMode: string | null;
  requiredDocuments: string[];
};

export const COMPLIANCE_DOCUMENT_CHECKLISTS: Record<string, string[]> = {
  RFQ: ['Approved Purchase Request', 'ALOBS / Budget Certification', 'Technical Specifications'],
  Evaluation: ['Published RFQ', 'Supplier Quotations', 'Abstract of Canvass'],
  Award: ['BAC Resolution', 'Notice of Award'],
  PO: ['Approved Purchase Request', 'Notice of Award', 'Purchase Order'],
  IAR: ['Purchase Order', 'Delivery Receipt', 'Inspection and Acceptance Report'],
  Payment: ['Purchase Order', 'Inspection and Acceptance Report', 'Payment Voucher']
};

const numberFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const PROCUREMENT_THRESHOLDS = {
  shoppingMaximum: numberFromEnv('PROCUREMENT_SHOPPING_MAX', 50_000),
  smallValueMaximum: numberFromEnv('PROCUREMENT_SMALL_VALUE_MAX', 200_000)
};

const normalize = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

export function expectedProcurementMode(amount: number): string | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (amount <= PROCUREMENT_THRESHOLDS.shoppingMaximum) return 'Shopping';
  if (amount <= PROCUREMENT_THRESHOLDS.smallValueMaximum) return 'Small Value Procurement';
  return 'Public Bidding';
}

export function getComplianceDocumentChecklist(stage: string): string[] {
  return COMPLIANCE_DOCUMENT_CHECKLISTS[stage] || [];
}

export function evaluateProcurementCompliance(input: ComplianceInput): ComplianceResult {
  const checks: ComplianceCheck[] = [];
  const requiredDocuments = input.requiredDocuments || [];
  const availableDocuments = new Set((input.availableDocuments || []).map(normalize));
  const expectedMode = expectedProcurementMode(Number(input.amount));
  const actualMode = normalize(input.modeOfProcurement);

  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0) {
    checks.push({ code: 'INVALID_AMOUNT', level: 'error', message: 'The procurement amount must be a non-negative number.' });
  } else {
    checks.push({ code: 'AMOUNT_VALID', level: 'pass', message: 'The procurement amount is valid.' });
  }

  if (expectedMode && !actualMode) {
    checks.push({ code: 'MODE_REQUIRED', level: 'error', message: `Procurement mode is required. Based on the configured threshold, the expected mode is ${expectedMode}.` });
  } else if (expectedMode && actualMode !== normalize(expectedMode)) {
    checks.push({ code: 'MODE_MISMATCH', level: 'error', message: `The selected procurement mode (${input.modeOfProcurement}) does not match the configured threshold result (${expectedMode}).` });
  } else if (expectedMode) {
    checks.push({ code: 'MODE_VALID', level: 'pass', message: `Procurement mode ${input.modeOfProcurement} matches the configured threshold result.` });
  }

  if (input.supplier) {
    if (!String(input.supplier.name || '').trim() || !String(input.supplier.tin || '').trim() || !String(input.supplier.email || '').trim()) {
      checks.push({ code: 'SUPPLIER_QUALIFICATION_INCOMPLETE', level: 'error', message: 'Supplier name, TIN, and email are required before evaluation or award.' });
    } else {
      checks.push({ code: 'SUPPLIER_QUALIFICATION_PRESENT', level: 'pass', message: 'Required supplier identity fields are present.' });
    }
  }

  for (const document of requiredDocuments) {
    if (!availableDocuments.has(normalize(document))) {
      checks.push({ code: 'MISSING_DOCUMENT', level: 'error', message: `Required document is missing: ${document}.` });
    }
  }
  if (requiredDocuments.length > 0 && requiredDocuments.every(document => availableDocuments.has(normalize(document)))) {
    checks.push({ code: 'DOCUMENTS_COMPLETE', level: 'pass', message: 'All required documents are present.' });
  }

  if (input.hasPhilGEPSPosting === false) {
    checks.push({ code: 'MISSING_POSTING', level: 'error', message: 'The required PhilGEPS posting record is missing.' });
  } else if (input.hasPhilGEPSPosting === true) {
    checks.push({ code: 'POSTING_PRESENT', level: 'pass', message: 'The required posting record is present.' });
  }

  if (input.openDate && input.closeDate && new Date(input.closeDate).getTime() <= new Date(input.openDate).getTime()) {
    checks.push({ code: 'INVALID_TIMELINE', level: 'error', message: 'The closing date must be after the opening date.' });
  } else if (input.openDate && input.closeDate) {
    checks.push({ code: 'TIMELINE_VALID', level: 'pass', message: 'The procurement opening and closing dates are valid.' });
  }

  if (input.requiredApprovalRole && normalize(input.approvalRole) !== normalize(input.requiredApprovalRole)) {
    checks.push({ code: 'APPROVAL_AUTHORITY_MISMATCH', level: 'error', message: `This action requires approval by ${input.requiredApprovalRole}.` });
  } else if (input.requiredApprovalRole) {
    checks.push({ code: 'APPROVAL_AUTHORITY_VALID', level: 'pass', message: `Approval authority ${input.requiredApprovalRole} is satisfied.` });
  }

  return {
    compliant: !checks.some(check => check.level === 'error'),
    checks,
    expectedMode,
    requiredDocuments
  };
}
