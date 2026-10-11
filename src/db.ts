import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Define the database structure
export interface Department {
  id: number;
  name: string;
  code: string;
  head_name: string;
  head_designation: string;
  created_at: string;
}

export interface PPMPItem {
  id: number;
  department_id: number;
  year: number;
  category: 'Supplies' | 'Equipment' | 'Infra';
  description: string;
  unit: string;
  unit_cost: number;
  q1_qty: number;
  q2_qty: number;
  q3_qty: number;
  q4_qty: number;
  total_qty: number;
  total_cost: number;
  mode_of_procurement: string;
  source_of_funds: string;
  created_at: string;
}

export interface PurchaseRequest {
  id: number;
  pr_no: string;
  date: string;
  department_id: number;
  section: string;
  purpose: string;
  requested_by_name: string;
  requested_by_designation: string;
  approved_by_name: string;
  approved_by_designation: string;
  status: 'Pending' | 'Budget_Review' | 'GSO_Review' | 'For_Approval' | 'Approved' | 'Disapproved' | 'Cancelled';
  alobs_number: string | null;
  alobs_date: string | null;
  mode_of_procurement: string | null;
  remarks: string | null;
  created_at: string;
}

export interface PRItem {
  id: number;
  pr_id: number;
  ppmp_item_id: number | null;
  item_no: number;
  unit: string;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface RFQRecord {
  id: number;
  rfq_no: string;
  pr_id: number;
  open_date: string;
  close_date: string;
  status: 'Draft' | 'Published' | 'Closed';
  terms_and_conditions: string;
  created_at: string;
}

export interface RFQItem {
  id: number;
  rfq_id: number;
  pr_item_id: number;
  item_no: number;
  unit: string;
  description: string;
  quantity: number;
}

export interface Supplier {
  id: number;
  name: string;
  address: string;
  tin: string;
  contact_person: string;
  contact_no: string;
  email: string;
  performance_rating: number;
  performance_notes: string | null;
  created_at: string;
}

export interface AbstractBid {
  id: number;
  rfq_id: number;
  supplier_id: number;
  pr_item_id: number;
  offered_unit_price: number;
  offered_total_price: number;
  is_compliant: boolean;
  is_lowest_bidder: boolean;
  remarks: string | null;
}

export interface BACResolution {
  id: number;
  resolution_no: string;
  rfq_id: number;
  date_passed: string;
  winning_supplier_id: number;
  type_of_bidding: string;
  justification: string;
  status: 'Draft' | 'Approved' | 'Signed';
  created_at: string;
}

export interface NoticeOfAward {
  id: number;
  noa_no: string;
  bac_resolution_id: number;
  rfq_id: number;
  supplier_id: number;
  date_issued: string;
  status: 'Issued' | 'Accepted';
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  po_no: string;
  pr_id: number;
  noa_id: number;
  supplier_id: number;
  po_date: string;
  mode_of_procurement: string;
  delivery_place: string;
  delivery_term: string;
  payment_term: string;
  penalty_clause: string;
  status: 'Draft' | 'Issued' | 'Signed' | 'Partially_Delivered' | 'Fully_Delivered' | 'Cancelled';
  created_at: string;
}

export interface POItem {
  id: number;
  po_id: number;
  pr_item_id: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface NoticeToProceed {
  id: number;
  ntp_no: string;
  po_id: number;
  date_issued: string;
  delivery_period_days: number;
  status: 'Issued' | 'Active' | 'Completed';
  created_at: string;
}

export interface IARRecord {
  id: number;
  iar_no: string;
  po_id: number;
  invoice_no: string;
  invoice_date: string;
  date_inspected: string | null;
  date_accepted: string | null;
  inspection_remarks: string | null;
  acceptance_remarks: string | null;
  photo_url?: string | null;
  status: 'Draft' | 'Submitted' | 'Partial' | 'Completed';
  inspected_by: string;
  accepted_by: string;
  created_at: string;
}

export interface IARItem {
  id: number;
  iar_id: number;
  po_item_id: number;
  quantity_delivered: number;
  is_accepted: boolean;
  item_condition?: 'Good' | 'Damaged' | 'Incomplete';
}

export interface InventoryAsset {
  id: number;
  iar_item_id: number;
  property_no: string;
  description: string;
  unit: string;
  cost: number;
  date_acquired: string;
  type: 'ICS' | 'PAR';
  assigned_to_user_id: number;
  receiver_name: string;
  receiver_designation: string;
  issuer_name: string;
  status: 'Active' | 'Condemned' | 'Transferred';
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number; // Corresponds to user who should receive notification
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
  old_value: string | null;
  new_value: string | null;
  user_role: string;
  user_name: string;
  timestamp: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  salt: string;
  name: string;
  role: 'End User' | 'GSO Officer' | 'BAC Secretariat' | 'Budget Officer' | 'Mayor';
  department_id: number | null;
  created_at: string;
}

export interface PhilGEPSPosting {
  id: number;
  ref_no: string;
  title: string;
  associated_type: 'RFQ' | 'ITB' | 'AOC' | 'NOA';
  associated_id: number;
  publish_date: string;
  closing_date: string;
  status: 'Draft' | 'Posted' | 'Awarded' | 'Failed';
  xml_payload?: string;
  api_response?: string;
  created_at: string;
}

export interface SystemSettings {
  id: number;
  system_name: string;
  municipal_name: string;
  province_name: string;
  mayor_name: string;
  gso_officer_name: string;
  budget_officer_name: string;
  accountant_name: string;
  bac_chairman_name: string;
  treasurer_name: string;
  penalty_clause_text: string;
  logo_data?: string | null;
}

interface DatabaseSchema {
  departments: Department[];
  ppmp_items: PPMPItem[];
  purchase_requests: PurchaseRequest[];
  pr_items: PRItem[];
  rfq_records: RFQRecord[];
  rfq_items: RFQItem[];
  suppliers: Supplier[];
  abstract_bids: AbstractBid[];
  bac_resolutions: BACResolution[];
  notices_of_award: NoticeOfAward[];
  purchase_orders: PurchaseOrder[];
  po_items: POItem[];
  notices_to_proceed: NoticeToProceed[];
  iar_records: IARRecord[];
  iar_items: IARItem[];
  inventory_assets: InventoryAsset[];
  audit_logs: AuditLog[];
  notifications: Notification[];
  users: User[];
  philgeps_postings: PhilGEPSPosting[];
  system_settings: SystemSettings[];
}

const DB_FILE_PATH = path.resolve(process.cwd(), 'database.json');

// Helper to seed initial data if database file doesn't exist
const getInitialData = (): DatabaseSchema => {
  const nowStr = new Date().toISOString();
  return {
    departments: [],
    ppmp_items: [
      {
        id: 1,
        department_id: 5,
        year: 2026,
        category: 'Supplies',
        description: 'Medical Grade Disposable Facemasks (50pcs/box)',
        unit: 'box',
        unit_cost: 150.00,
        q1_qty: 100,
        q2_qty: 100,
        q3_qty: 100,
        q4_qty: 100,
        total_qty: 400,
        total_cost: 60000.00,
        mode_of_procurement: 'Shopping',
        source_of_funds: 'General Fund',
        created_at: nowStr
      },
      {
        id: 2,
        department_id: 5,
        year: 2026,
        category: 'Equipment',
        description: 'Defibrillator Automated External (AED)',
        unit: 'unit',
        unit_cost: 120000.00,
        q1_qty: 1,
        q2_qty: 0,
        q3_qty: 0,
        q4_qty: 0,
        total_qty: 1,
        total_cost: 120000.00,
        mode_of_procurement: 'Small Value Procurement',
        source_of_funds: 'General Fund',
        created_at: nowStr
      },
      {
        id: 3,
        department_id: 1,
        year: 2026,
        category: 'Supplies',
        description: 'Premium A4 Copy Paper 80gsm',
        unit: 'ream',
        unit_cost: 220.00,
        q1_qty: 50,
        q2_qty: 50,
        q3_qty: 50,
        q4_qty: 50,
        total_qty: 200,
        total_cost: 44000.00,
        mode_of_procurement: 'Shopping',
        source_of_funds: 'General Fund',
        created_at: nowStr
      },
      {
        id: 4,
        department_id: 1,
        year: 2026,
        category: 'Equipment',
        description: 'Heavy Duty Office Laptop i7 16GB RAM',
        unit: 'unit',
        unit_cost: 65000.00,
        q1_qty: 2,
        q2_qty: 0,
        q3_qty: 1,
        q4_qty: 0,
        total_qty: 3,
        total_cost: 195000.00,
        mode_of_procurement: 'Small Value Procurement',
        source_of_funds: 'General Fund',
        created_at: nowStr
      },
      {
        id: 5,
        department_id: 6,
        year: 2026,
        category: 'Infra',
        description: 'Rehabilitation of Municipal Hall Lobby',
        unit: 'lot',
        unit_cost: 450000.00,
        q1_qty: 0,
        q2_qty: 1,
        q3_qty: 0,
        q4_qty: 0,
        total_qty: 1,
        total_cost: 450000.00,
        mode_of_procurement: 'Public Bidding',
        source_of_funds: 'Special Education Fund',
        created_at: nowStr
      }
    ],
    purchase_requests: [
      {
        id: 1,
        pr_no: '2026-07-0001',
        date: '2026-07-01',
        department_id: 5,
        section: 'Clinic',
        purpose: 'For emergency response units in various barangays.',
        requested_by_name: 'Dr. Elena S. Perez',
        requested_by_designation: 'Municipal Health Officer',
        approved_by_name: 'Hon. Johnielle Keith Pasion Nieto',
        approved_by_designation: 'Municipal Mayor',
        status: 'Approved',
        alobs_number: 'ALOBS-26-07-0105',
        alobs_date: '2026-07-02',
        mode_of_procurement: 'Small Value Procurement',
        remarks: 'Funding cleared by Budget Office and Approved by Mayor.',
        created_at: nowStr
      },
      {
        id: 2,
        pr_no: '2026-07-0002',
        date: '2026-07-03',
        department_id: 1,
        section: 'Administrative',
        purpose: 'To upgrade executive staff computers for efficient report writing.',
        requested_by_name: 'Hon. Johnielle Keith Pasion Nieto',
        requested_by_designation: 'Municipal Mayor',
        approved_by_name: 'Hon. Johnielle Keith Pasion Nieto',
        approved_by_designation: 'Municipal Mayor',
        status: 'Budget_Review',
        alobs_number: null,
        alobs_date: null,
        mode_of_procurement: null,
        remarks: null,
        created_at: nowStr
      }
    ],
    pr_items: [
      { id: 1, pr_id: 1, ppmp_item_id: 2, item_no: 1, unit: 'unit', description: 'Defibrillator Automated External (AED)', quantity: 1, unit_cost: 120000.00, total_cost: 120000.00 },
      { id: 2, pr_id: 2, ppmp_item_id: 4, item_no: 1, unit: 'unit', description: 'Heavy Duty Office Laptop i7 16GB RAM', quantity: 2, unit_cost: 65000.00, total_cost: 130000.00 }
    ],
    rfq_records: [
      {
        id: 1,
        rfq_no: 'RFQ-2026-07-0001',
        pr_id: 1,
        open_date: '2026-07-03',
        close_date: '2026-07-10',
        status: 'Published',
        terms_and_conditions: '1. All entries must be typewritten or legibly written.\n2. Delivery period within 15 calendar days.\n3. Warranty shall be for a period of six (6) months for supplies & materials, one (1) year for equipment.\n4. Price validity shall be for a period of 60 calendar days.',
        created_at: nowStr
      }
    ],
    rfq_items: [
      { id: 1, rfq_id: 1, pr_item_id: 1, item_no: 1, unit: 'unit', description: 'Defibrillator Automated External (AED)', quantity: 1 }
    ],
    suppliers: [
      { id: 1, name: 'Manila Medical Equipment Corp.', address: '124 Rizal Ave, Manila', tin: '111-222-333-000', contact_person: 'Juan Dela Cruz', contact_no: '0917-123-4567', email: 'juan@manilamedical.com', performance_rating: 0, performance_notes: null, created_at: nowStr },
      { id: 2, name: 'Northern Health Supplies Inc.', address: '45 Sessions Road, Baguio City', tin: '444-555-666-000', contact_person: 'Maria Santos', contact_no: '0918-987-6543', email: 'maria@northernhealth.ph', performance_rating: 0, performance_notes: null, created_at: nowStr },
      { id: 3, name: 'Apex Diagnostics Philippines', address: '789 EDSA, Quezon City', tin: '777-888-999-000', contact_person: 'David Lim', contact_no: '0922-333-4444', email: 'sales@apexdiag.ph', performance_rating: 0, performance_notes: null, created_at: nowStr }
    ],
    abstract_bids: [
      { id: 1, rfq_id: 1, supplier_id: 1, pr_item_id: 1, offered_unit_price: 118000.00, offered_total_price: 118000.00, is_compliant: true, is_lowest_bidder: true, remarks: 'Compliant with all technical specs.' },
      { id: 2, rfq_id: 1, supplier_id: 2, pr_item_id: 1, offered_unit_price: 119500.00, offered_total_price: 119500.00, is_compliant: true, is_lowest_bidder: false, remarks: 'Compliant. Slower delivery terms.' },
      { id: 3, rfq_id: 1, supplier_id: 3, pr_item_id: 1, offered_unit_price: 125000.00, offered_total_price: 125000.00, is_compliant: false, is_lowest_bidder: false, remarks: 'Disqualified. Price exceeds Approved Budget for Contract (ABC) of 120,000.00' }
    ],
    bac_resolutions: [
      {
        id: 1,
        resolution_no: 'BAC-2026-0089',
        rfq_id: 1,
        date_passed: '2026-07-12',
        winning_supplier_id: 1,
        type_of_bidding: 'Alternative Mode - Small Value Procurement',
        justification: 'Manila Medical Equipment Corp. submitted the Lowest Calculated and Responsive Bid (LCRB) complying with all required technical specifications.',
        status: 'Signed',
        created_at: nowStr
      }
    ],
    notices_of_award: [
      {
        id: 1,
        noa_no: 'NOA-2026-0045',
        bac_resolution_id: 1,
        rfq_id: 1,
        supplier_id: 1,
        date_issued: '2026-07-14',
        status: 'Accepted',
        created_at: nowStr
      }
    ],
    purchase_orders: [
      {
        id: 1,
        po_no: 'PO-2026-07-0001',
        pr_id: 1,
        noa_id: 1,
        supplier_id: 1,
        po_date: '2026-07-15',
        mode_of_procurement: 'Small Value Procurement',
        delivery_place: 'Municipal Hall, Supply Office',
        delivery_term: '15 Calendar Days upon receipt of NTP',
        payment_term: 'Charge Account (COA standard)',
        penalty_clause: 'In case of failure to make the full delivery within the time specified above, a penalty of one-tenth (1/10) of one percent for every day of delay shall be imposed on the undelivered item/s.',
        status: 'Signed',
        created_at: nowStr
      }
    ],
    po_items: [
      { id: 1, po_id: 1, pr_item_id: 1, quantity: 1, unit_cost: 118000.00, total_cost: 118000.00 }
    ],
    notices_to_proceed: [
      {
        id: 1,
        ntp_no: 'NTP-2026-0038',
        po_id: 1,
        date_issued: '2026-07-16',
        delivery_period_days: 15,
        status: 'Active',
        created_at: nowStr
      }
    ],
    iar_records: [
      {
        id: 1,
        iar_no: 'IAR-2026-07-0001',
        po_id: 1,
        invoice_no: 'INV-998822',
        invoice_date: '2026-07-20',
        date_inspected: '2026-07-21',
        date_accepted: '2026-07-21',
        inspection_remarks: 'All components verified brand new, working, and matching required medical-grade specifications.',
        acceptance_remarks: 'Inspected, accepted and turned over to GSO Inventory.',
        status: 'Completed',
        inspected_by: 'LGU Inspection Committee',
        accepted_by: 'Municipal Supply Officer',
        created_at: nowStr
      }
    ],
    iar_items: [
      { id: 1, iar_id: 1, po_item_id: 1, quantity_delivered: 1, is_accepted: true }
    ],
    inventory_assets: [
      {
        id: 1,
        iar_item_id: 1,
        property_no: 'LGU-2026-0001',
        description: 'Defibrillator Automated External (AED) - Serial SN-AED99881',
        unit: 'unit',
        cost: 118000.00,
        date_acquired: '2026-07-21',
        type: 'PAR',
        assigned_to_user_id: 5,
        receiver_name: 'Dr. Elena S. Perez',
        receiver_designation: 'Municipal Health Officer',
        issuer_name: 'Arthur N. Ramos',
        status: 'Active',
        created_at: nowStr
      }
    ],
    audit_logs: [
      { id: 1, table_name: 'purchase_requests', record_id: 1, action: 'STATUS_CHANGE', old_value: 'Pending', new_value: 'Budget_Review', user_role: 'Budget Officer', user_name: 'Engr. Roberto D. Santos', timestamp: '2026-07-01T10:30:00.000Z' },
      { id: 2, table_name: 'purchase_requests', record_id: 1, action: 'STATUS_CHANGE', old_value: 'Budget_Review', new_value: 'GSO_Review', user_role: 'GSO Procurement Officer', user_name: 'Mr. Arthur N. Ramos', timestamp: '2026-07-02T11:45:00.000Z' },
      { id: 3, table_name: 'purchase_requests', record_id: 1, action: 'STATUS_CHANGE', old_value: 'GSO_Review', new_value: 'Approved', user_role: 'Municipal Mayor', user_name: 'Hon. Johnielle Keith Pasion Nieto', timestamp: '2026-07-02T15:20:00.000Z' },
      { id: 4, table_name: 'purchase_orders', record_id: 1, action: 'STATUS_CHANGE', old_value: 'Draft', new_value: 'Signed', user_role: 'General Services Officer', user_name: 'Mr. Arthur N. Ramos', timestamp: '2026-07-15T09:00:00.000Z' },
      { id: 5, table_name: 'iar_records', record_id: 1, action: 'STATUS_CHANGE', old_value: 'Draft', new_value: 'Completed', user_role: 'GSO Supply Officer', user_name: 'Mr. Arthur N. Ramos', timestamp: '2026-07-21T16:10:00.000Z' }
    ],
    notifications: [],
    users: [],
    philgeps_postings: [],
    system_settings: [
      {
        id: 1,
        system_name: "GovProcure MS",
        municipal_name: "MUNICIPALITY OF SAN JOSE",
        province_name: "Province of Bulacan",
        mayor_name: "HON. Johnielle Keith Pasion Nieto",
        gso_officer_name: "Arthur N. Ramos",
        budget_officer_name: "Engr. Roberto D. Santos",
        accountant_name: "Mrs. Teresa V. Jose",
        bac_chairman_name: "Atty. Susan Cruz",
        treasurer_name: "Mr. Arthur N. Ramos",
        penalty_clause_text: "A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed."
      }
    ]
  };
};

export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    let loaded: DatabaseSchema;
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileContent = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        loaded = JSON.parse(fileContent);
      } else {
        loaded = getInitialData();
      }
    } catch (e) {
      console.error('Error loading database. Initializing fresh seed.', e);
      loaded = getInitialData();
    }

    let modified = false;
    if (!loaded.users) {
      loaded.users = [];
      modified = true;
    }
    if (!loaded.philgeps_postings) {
      loaded.philgeps_postings = [];
      modified = true;
    }
    if (!loaded.system_settings || loaded.system_settings.length === 0) {
      loaded.system_settings = [
        {
          id: 1,
          system_name: "GovProcure MS",
          municipal_name: "MUNICIPALITY OF SAN JOSE",
          province_name: "Province of Bulacan",
          mayor_name: "HON. Johnielle Keith Pasion Nieto",
          gso_officer_name: "Arthur N. Ramos",
          budget_officer_name: "Engr. Roberto D. Santos",
          accountant_name: "Mrs. Teresa V. Jose",
          bac_chairman_name: "Atty. Susan Cruz",
          treasurer_name: "Mr. Arthur N. Ramos",
          penalty_clause_text: "A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed."
        }
      ];
      modified = true;
    }

    // Seed default roles if users table is empty
    if (loaded.users.length === 0) {
      const defaultUsers = [
        { username: 'enduser', salt: 'salt1', name: 'Dr. Elena Perez', role: 'End User' as const, department_id: 5 },
        { username: 'gso', salt: 'salt2', name: 'Arthur N. Ramos', role: 'GSO Officer' as const, department_id: 4 },
        { username: 'bac', salt: 'salt3', name: 'Atty. Susan Cruz', role: 'BAC Secretariat' as const, department_id: null },
        { username: 'budget', salt: 'salt4', name: 'Engr. Roberto D. Santos', role: 'Budget Officer' as const, department_id: 2 },
        { username: 'mayor', salt: 'salt5', name: 'Hon. Johnielle Keith Pasion Nieto', role: 'Mayor' as const, department_id: 1 }
      ];

      defaultUsers.forEach((u, i) => {
        const pass = 'password123';
        const p_hash = hashPassword(pass, u.salt);
        loaded.users.push({
          id: i + 1,
          username: u.username,
          password_hash: p_hash,
          salt: u.salt,
          name: u.name,
          role: u.role,
          department_id: u.department_id,
          created_at: new Date().toISOString()
        });
      });
      modified = true;
    }

    if (modified) {
      this.saveData(loaded);
    }

    return loaded;
  }

  private saveData(data: DatabaseSchema) {
    try {
      // Ensure directory exists
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing database to file:', e);
    }
  }

  private persist() {
    this.saveData(this.data);
  }

  // Generic accessors
  public getTable<K extends keyof DatabaseSchema>(table: K): DatabaseSchema[K] {
    return this.data[table];
  }

  public getById<K extends keyof DatabaseSchema>(table: K, id: number): DatabaseSchema[K][number] | null {
    const list = this.data[table] as any[];
    return list.find(item => item.id === id) || null;
  }

  public insert<K extends keyof DatabaseSchema>(table: K, value: Omit<DatabaseSchema[K][number], 'id' | 'created_at'>): DatabaseSchema[K][number] {
    const list = this.data[table] as any[];
    const nextId = list.reduce((max, item) => item.id > max ? item.id : max, 0) + 1;

    const newValue = {
      id: nextId,
      ...value,
      created_at: new Date().toISOString()
    } as any;

    list.push(newValue);
    this.persist();
    return newValue;
  }

  public update<K extends keyof DatabaseSchema>(table: K, id: number, updates: Partial<DatabaseSchema[K][number]>): DatabaseSchema[K][number] | null {
    const list = this.data[table] as any[];
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return null;

    list[idx] = {
      ...list[idx],
      ...updates
    };

    this.persist();
    return list[idx];
  }

  public delete<K extends keyof DatabaseSchema>(table: K, id: number): boolean {
    const list = this.data[table] as any[];
    const idx = list.findIndex(item => item.id === id);
    if (idx === -1) return false;

    list.splice(idx, 1);
    this.persist();
    return true;
  }

  // Audit Logger
  public logAudit(tableName: string, recordId: number, action: AuditLog['action'], oldValue: string | null, newValue: string | null, userRole: string = 'Staff', userName: string = 'LGU Officer') {
    this.insert('audit_logs', {
      table_name: tableName,
      record_id: recordId,
      action: action,
      old_value: oldValue,
      new_value: newValue,
      user_role: userRole,
      user_name: userName,
      timestamp: new Date().toISOString()
    } as any);
  }
}

export const db = new Database();
