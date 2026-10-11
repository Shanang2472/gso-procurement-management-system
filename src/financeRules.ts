export type FinanceSnapshot = {
  prAmount: number;
  poAmount: number;
  iarAmount: number;
  paidAmount: number;
  approvedPaidAmount?: number;
  paymentDate?: string | null;
  dueDate?: string | null;
  allotmentBalance?: number | null;
};

export type FinanceException = { code: string; message: string; severity: 'warning' | 'error' };

export function evaluateFinanceSnapshot(snapshot: FinanceSnapshot) {
  const exceptions: FinanceException[] = [];
  const prAmount = Number(snapshot.prAmount || 0);
  const poAmount = Number(snapshot.poAmount || 0);
  const iarAmount = Number(snapshot.iarAmount || 0);
  const paidAmount = Number(snapshot.paidAmount || 0);
  const allotmentBalance = snapshot.allotmentBalance == null ? null : Number(snapshot.allotmentBalance);

  if (poAmount > prAmount) exceptions.push({ code: 'PO_EXCEEDS_PR', message: 'Purchase Order value exceeds the approved Purchase Request amount.', severity: 'error' });
  if (iarAmount > poAmount) exceptions.push({ code: 'IAR_EXCEEDS_PO', message: 'Accepted inspection value exceeds the Purchase Order value.', severity: 'error' });
  if (paidAmount > poAmount) exceptions.push({ code: 'PAYMENT_EXCEEDS_PO', message: 'Cumulative payments exceed the Purchase Order value.', severity: 'error' });
  if (allotmentBalance != null && poAmount > allotmentBalance) exceptions.push({ code: 'PO_EXCEEDS_ALLOTMENT', message: 'Purchase Order value exceeds the available allotment balance.', severity: 'error' });
  if (paidAmount > iarAmount && iarAmount > 0) exceptions.push({ code: 'PAYMENT_EXCEEDS_IAR', message: 'Payments exceed accepted inspection value.', severity: 'warning' });

  let agingStatus = 'Not_Due';
  if (snapshot.dueDate) {
    const due = new Date(snapshot.dueDate).getTime();
    if (paidAmount >= poAmount && poAmount > 0) agingStatus = 'Paid';
    else if (Number.isFinite(due) && due < Date.now()) agingStatus = 'Overdue';
    else agingStatus = 'Open';
  }

  return {
    compliant: !exceptions.some(exception => exception.severity === 'error'),
    exceptions,
    remainingObligation: Math.max(0, prAmount - poAmount),
    remainingPayable: Math.max(0, poAmount - paidAmount),
    agingStatus
  };
}
