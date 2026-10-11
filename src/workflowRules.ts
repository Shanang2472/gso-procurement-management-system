export type WorkflowValidationInput = {
  fromStatus: string;
  toStatus: string;
  role: string;
  hasRequiredDocument?: boolean;
  fields?: Record<string, unknown>;
};

export type WorkflowValidationResult = {
  valid: boolean;
  errors: string[];
  nextAction: string;
};

type EntityWorkflowRule = {
  statuses: string[];
  transitions: Record<string, string[]>;
  responsibleRoles: Record<string, string[]>;
  requiredFields?: Record<string, string[]>;
};

export const PR_STATUSES = [
  'Draft',
  'Submitted',
  'Pending',
  'Budget_Review',
  'GSO_Review',
  'For_Approval',
  'Approved',
  'Returned',
  'For_Correction',
  'Disapproved',
  'Cancelled'
] as const;

export const PR_TRANSITIONS: Record<string, string[]> = {
  Draft: ['Submitted', 'Cancelled'],
  Submitted: ['Pending', 'Returned', 'Cancelled'],
  Pending: ['Budget_Review', 'Returned', 'Cancelled'],
  Budget_Review: ['GSO_Review', 'Disapproved', 'Returned', 'Cancelled'],
  GSO_Review: ['For_Approval', 'Disapproved', 'Returned', 'Cancelled'],
  For_Approval: ['Approved', 'Disapproved', 'Returned', 'Cancelled'],
  Returned: ['For_Correction', 'Submitted', 'Cancelled'],
  For_Correction: ['Submitted', 'Cancelled']
};

export const PR_STATUS_ROLES: Record<string, string[]> = {
  Submitted: ['End User', 'GSO Officer'],
  Pending: ['Budget Officer'],
  Budget_Review: ['Budget Officer'],
  GSO_Review: ['GSO Officer'],
  For_Approval: ['GSO Officer'],
  Approved: ['Mayor'],
  Returned: ['End User', 'GSO Officer'],
  For_Correction: ['End User'],
  Disapproved: ['Mayor'],
  Cancelled: ['End User', 'GSO Officer']
};

export const PR_REQUIRED_FIELDS: Record<string, string[]> = {
  Budget_Review: ['alobs_number', 'alobs_date'],
  For_Approval: ['mode_of_procurement'],
  Approved: ['alobs_number', 'alobs_date', 'mode_of_procurement']
};

export const ENTITY_WORKFLOW_RULES: Record<string, EntityWorkflowRule> = {
  RFQ: {
    statuses: ['Draft', 'Published', 'Closed'],
    transitions: { Draft: ['Published'], Published: ['Closed'], Closed: [] },
    responsibleRoles: {
      Published: ['GSO Officer', 'BAC Secretariat'],
      Closed: ['GSO Officer', 'BAC Secretariat']
    }
  },
  Quotation: {
    statuses: ['Draft', 'Submitted', 'Withdrawn', 'Disqualified'],
    transitions: {
      Draft: ['Submitted', 'Withdrawn'],
      Submitted: ['Submitted', 'Withdrawn', 'Disqualified'],
      Withdrawn: [],
      Disqualified: []
    },
    responsibleRoles: {
      Submitted: ['Supplier'],
      Withdrawn: ['Supplier', 'BAC Secretariat'],
      Disqualified: ['BAC Secretariat']
    }
  },
  BACResolution: {
    statuses: ['Draft', 'Approved', 'Signed'],
    transitions: { Draft: ['Approved', 'Signed'], Approved: ['Signed'], Signed: [] },
    responsibleRoles: {
      Approved: ['Mayor', 'BAC Secretariat'],
      Signed: ['BAC Secretariat', 'Mayor']
    }
  },
  NOA: {
    statuses: ['Issued', 'Accepted'],
    transitions: { Issued: ['Accepted'], Accepted: [] },
    responsibleRoles: { Accepted: ['Supplier', 'GSO Officer', 'BAC Secretariat'] }
  },
  NTP: {
    statuses: ['Issued', 'Active', 'Completed'],
    transitions: { Issued: ['Active'], Active: ['Completed'], Completed: [] },
    responsibleRoles: {
      Active: ['GSO Officer', 'Supplier'],
      Completed: ['GSO Officer', 'Supplier']
    }
  },
  RIS: {
    statuses: ['Draft', 'Issued', 'Returned', 'Cancelled'],
    transitions: {
      Draft: ['Issued', 'Cancelled'],
      Issued: ['Returned', 'Cancelled'],
      Returned: ['Issued', 'Cancelled'],
      Cancelled: []
    },
    responsibleRoles: {
      Issued: ['GSO Officer', 'Mayor'],
      Returned: ['End User', 'GSO Officer'],
      Cancelled: ['GSO Officer', 'Mayor']
    }
  },
  PO: {
    statuses: ['Draft', 'Issued', 'Signed', 'Partially_Delivered', 'Fully_Delivered', 'Completed', 'Cancelled'],
    transitions: {
      Draft: ['Issued', 'Signed', 'Cancelled'],
      Issued: ['Signed', 'Cancelled'],
      Signed: ['Partially_Delivered', 'Fully_Delivered', 'Cancelled'],
      Partially_Delivered: ['Fully_Delivered', 'Cancelled'],
      Fully_Delivered: ['Completed'],
      Completed: [],
      Cancelled: []
    },
    responsibleRoles: {
      Issued: ['GSO Officer', 'Mayor'],
      Signed: ['GSO Officer', 'Mayor'],
      Partially_Delivered: ['GSO Officer'],
      Fully_Delivered: ['GSO Officer'],
      Completed: ['Finance Officer', 'GSO Officer'],
      Cancelled: ['GSO Officer', 'Mayor']
    }
  },
  IAR: {
    statuses: ['Draft', 'Submitted', 'Partial', 'Completed'],
    transitions: {
      Draft: ['Submitted', 'Partial', 'Completed'],
      Submitted: ['Partial', 'Completed'],
      Partial: ['Partial', 'Completed'],
      Completed: []
    },
    responsibleRoles: {
      Submitted: ['GSO Officer', 'End User'],
      Partial: ['GSO Officer', 'End User'],
      Completed: ['GSO Officer', 'End User']
    }
  },
  Payment: {
    statuses: ['Pending', 'For_Verification', 'Approved', 'Disbursed', 'Completed', 'Cancelled'],
    transitions: {
      Pending: ['For_Verification', 'Cancelled'],
      For_Verification: ['Approved', 'Cancelled'],
      Approved: ['Disbursed', 'Cancelled'],
      Disbursed: ['Completed'],
      Completed: [],
      Cancelled: []
    },
    responsibleRoles: {
      For_Verification: ['Finance Officer', 'GSO Officer'],
      Approved: ['Finance Officer', 'Mayor'],
      Disbursed: ['Finance Officer'],
      Completed: ['Finance Officer'],
      Cancelled: ['Finance Officer', 'Mayor', 'GSO Officer']
    },
    requiredFields: {
      Approved: ['remarks'],
      Disbursed: ['remarks'],
      Completed: ['remarks']
    }
  },
  IIRUP: {
    statuses: ['Draft', 'Submitted', 'Approved', 'Disposed', 'Cancelled'],
    transitions: {
      Draft: ['Submitted', 'Cancelled'],
      Submitted: ['Approved', 'Cancelled'],
      Approved: ['Disposed', 'Cancelled'],
      Disposed: [],
      Cancelled: []
    },
    responsibleRoles: {
      Submitted: ['GSO Officer'],
      Approved: ['Mayor'],
      Disposed: ['GSO Officer', 'Mayor'],
      Cancelled: ['GSO Officer', 'Mayor']
    },
    requiredFields: { Disposed: ['coa_authority_no'] }
  }
};

const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

export function validatePRTransition(input: WorkflowValidationInput): WorkflowValidationResult {
  const errors: string[] = [];
  const { fromStatus, toStatus, role, fields = {} } = input;

  if (!PR_STATUSES.includes(toStatus as typeof PR_STATUSES[number])) {
    errors.push(`Invalid PR status: ${toStatus}`);
  }

  const allowedTargets = PR_TRANSITIONS[fromStatus] || [];
  if (!allowedTargets.includes(toStatus)) {
    errors.push(`PR cannot move from ${fromStatus} to ${toStatus}.`);
  }

  const allowedRoles = PR_STATUS_ROLES[toStatus];
  if (allowedRoles && !allowedRoles.includes(role)) {
    errors.push(`Forbidden: Only ${allowedRoles.join(', ')} can change status to ${toStatus}.`);
  }

  for (const field of PR_REQUIRED_FIELDS[toStatus] || []) {
    if (!hasValue(fields[field])) {
      errors.push(`${toStatus} requires ${field.replace(/_/g, ' ')}.`);
    }
  }

  if (input.hasRequiredDocument === false) {
    errors.push(`${toStatus} requires its supporting document before the transition can be completed.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    nextAction: errors.length ? 'Fix the transition requirements.' : 'Proceed to the next lifecycle state.'
  };
}

export function validateEntityTransition(entity: string, input: WorkflowValidationInput): WorkflowValidationResult {
  const rule = ENTITY_WORKFLOW_RULES[entity];
  if (!rule) {
    return { valid: false, errors: [`Unknown workflow entity: ${entity}.`], nextAction: 'Use a registered workflow entity.' };
  }

  const errors: string[] = [];
  const fields = input.fields || {};
  if (!rule.statuses.includes(input.toStatus)) errors.push(`Invalid ${entity} status: ${input.toStatus}.`);
  if (!rule.transitions[input.fromStatus]?.includes(input.toStatus)) {
    errors.push(`${entity} cannot move from ${input.fromStatus} to ${input.toStatus}.`);
  }
  const roles = rule.responsibleRoles[input.toStatus];
  if (roles && !roles.includes(input.role)) {
    errors.push(`Forbidden: Only ${roles.join(', ')} can change ${entity} to ${input.toStatus}.`);
  }
  for (const field of rule.requiredFields?.[input.toStatus] || []) {
    if (!hasValue(fields[field])) errors.push(`${input.toStatus} requires ${field.replace(/_/g, ' ')}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    nextAction: errors.length ? 'Fix the transition requirements.' : 'Proceed to the next lifecycle state.'
  };
}

export function getPRWorkflowRules() {
  return {
    statuses: [...PR_STATUSES],
    transitions: PR_TRANSITIONS,
    responsibleRoles: PR_STATUS_ROLES,
    requiredFields: PR_REQUIRED_FIELDS,
    requiredDocuments: {
      Budget_Review: 'ALOBS / budget certification',
      GSO_Review: 'GSO technical review record',
      For_Approval: 'Reviewed Purchase Request with remarks',
      Approved: 'Approved Purchase Request and budget certification',
      RFQ: 'Published RFQ and invitation list',
      BAC: 'BAC resolution and NOA',
      PO: 'Purchase Order and supplier acceptance',
      IAR: 'Inspection and Acceptance Report'
    },
    entities: ENTITY_WORKFLOW_RULES
  };
}
