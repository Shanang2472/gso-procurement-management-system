export type ReportingRecord = {
  department_id?: number;
  department_name?: string;
  category?: string;
  mode_of_procurement?: string | null;
  supplier_id?: number;
  supplier_name?: string;
  pr_amount?: number;
  po_amount?: number;
  iar_amount?: number;
  payment_amount?: number;
  lead_time_days?: number | null;
  late_delivery?: boolean;
  open_obligation?: number;
  budget_amount?: number;
  budget_utilized?: number;
};

export function aggregateReportingRecords(records: ReportingRecord[]) {
  const spendingByDepartment = new Map<string, number>();
  const spendingByCategory = new Map<string, number>();
  const spendingByMode = new Map<string, number>();
  const supplierReliability = new Map<string, { deliveries: number; accepted: number; late: number }>();
  let leadTimeTotal = 0;
  let leadTimeCount = 0;
  let openObligations = 0;
  let lateDeliveries = 0;

  for (const record of records) {
    const amount = Number(record.po_amount || 0);
    const department = record.department_name || `Department ${record.department_id || 'Unknown'}`;
    const category = record.category || 'Uncategorized';
    const mode = record.mode_of_procurement || 'Unspecified';
    spendingByDepartment.set(department, (spendingByDepartment.get(department) || 0) + amount);
    spendingByCategory.set(category, (spendingByCategory.get(category) || 0) + amount);
    spendingByMode.set(mode, (spendingByMode.get(mode) || 0) + amount);

    if (record.lead_time_days != null && Number(record.lead_time_days) >= 0) {
      leadTimeTotal += Number(record.lead_time_days);
      leadTimeCount += 1;
    }
    openObligations += Number(record.open_obligation || 0);
    if (record.late_delivery) lateDeliveries += 1;

    if (record.supplier_name) {
      const current = supplierReliability.get(record.supplier_name) || { deliveries: 0, accepted: 0, late: 0 };
      current.deliveries += 1;
      current.accepted += record.late_delivery ? 0 : 1;
      current.late += record.late_delivery ? 1 : 0;
      supplierReliability.set(record.supplier_name, current);
    }
  }

  return {
    spendingByDepartment: [...spendingByDepartment.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    spendingByCategory: [...spendingByCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    spendingByMode: [...spendingByMode.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    supplierReliability: [...supplierReliability.entries()].map(([supplier, value]) => ({ supplier, ...value, reliabilityRate: value.deliveries ? value.accepted / value.deliveries * 100 : 0 })).sort((a, b) => b.reliabilityRate - a.reliabilityRate),
    averageLeadTimeDays: leadTimeCount ? leadTimeTotal / leadTimeCount : 0,
    openObligations,
    lateDeliveries
  };
}
