export const SUPPLIER_STATUSES = ['Pending_Verification', 'Pending_Approval', 'Active', 'Suspended', 'Rejected'] as const;

export const isValidSupplierEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim().toLowerCase());

export const normalizeSupplierProfile = (input: Record<string, unknown>) => ({
  name: String(input.name || '').trim(),
  address: String(input.address || '').trim(),
  tin: String(input.tin || '').trim(),
  contact_person: String(input.contact_person || '').trim(),
  contact_no: String(input.contact_no || '').trim(),
  email: String(input.email || '').trim().toLowerCase()
});

export const validateSupplierProfile = (profile: ReturnType<typeof normalizeSupplierProfile>) => {
  const errors: string[] = [];
  if (profile.name.length < 2) errors.push('Supplier name is required.');
  if (!profile.address) errors.push('Supplier address is required.');
  if (!profile.tin) errors.push('Supplier TIN is required.');
  if (!profile.contact_person) errors.push('Supplier contact person is required.');
  if (!profile.contact_no) errors.push('Supplier contact number is required.');
  if (!isValidSupplierEmail(profile.email)) errors.push('A valid supplier email address is required.');
  return { valid: errors.length === 0, errors };
};
