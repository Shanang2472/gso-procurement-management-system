import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, ClipboardList, Send, Award, FileSpreadsheet, Truck, ShieldCheck,
  Layers, ChevronRight, Plus, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Printer, Clock, HelpCircle, AlertTriangle, Settings, BarChart3, Archive, Menu, X, Users, Bell
} from 'lucide-react';
import { PrintPR, PrintPO, PrintIAR, PrintICSorPAR, PrintNTP } from './PrintTemplates';
import { AdminLedgerPanel } from './components/AdminLedgerPanel';

const ApprovalHistory = ({ audit }: { audit: any[] }) => {
  if (!audit || audit.length === 0) return <p className="text-slate-400 text-xs italic">No approval history.</p>;

  return (
    <div className="space-y-2 mt-4">
      <h3 className="text-sm font-bold text-slate-300 uppercase">Approval History</h3>
      <div className="bg-slate-900 rounded-lg p-3 space-y-2">
        {audit.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((log, idx) => (
          <div key={idx} className="border-l-2 border-blue-500 pl-3 py-1">
            <p className="text-xs text-white font-semibold">
              {log.action === 'STATUS_CHANGE' ?
                `Status Changed to ${(() => {
                  try {
                    const parsed = JSON.parse(log.new_value);
                    return parsed.status || parsed;
                  } catch {
                    return log.new_value;
                  }
                })()}`
                : log.action}
            </p>
            <p className="text-[10px] text-slate-400">{log.user_name} ({log.user_role}) - {new Date(log.timestamp).toLocaleString()}</p>
            {log.old_value && (() => {
              try {
                const oldVal = JSON.parse(log.old_value);
                if (oldVal && oldVal.remarks) {
                  return <p className="text-[10px] text-slate-300 italic mt-0.5">Remarks: {oldVal.remarks}</p>;
                }
              } catch { }
              return null;
            })()}
          </div>
        ))}
      </div>
    </div>
  );
};
import { CameraCapture } from './components/CameraCapture';
import { CalendarView } from './components/CalendarView';
import { BudgetUtilizationDashboard } from './components/BudgetUtilizationDashboard';
import { ProcurementChatbot } from './components/ProcurementChatbot';
import { ProcurementAnalytics } from './components/ProcurementAnalytics';

declare global {
  interface Window {
    google?: any;
    webkitAudioContext?: typeof AudioContext;
  }
}

interface Department {
  id: number;
  name: string;
  code: string;
  head_name: string;
  head_designation: string;
}

interface PPMPItem {
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
}

interface PurchaseRequest {
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
  status: 'Draft' | 'Submitted' | 'Pending' | 'Budget_Review' | 'GSO_Review' | 'For_Approval' | 'Approved' | 'Returned' | 'For_Correction' | 'Disapproved' | 'Cancelled' | 'Completed';
  alobs_number: string | null;
  alobs_date: string | null;
  mode_of_procurement: string | null;
  remarks: string | null;
  department_name?: string;
department_code?: string;
  total_amount: number;
  estimated_abc?: number | string;
  items_count: number;
  items?: any[];
  created_at?: string;
}

interface Supplier {
  id: number;
  name: string;
  address: string;
  tin: string;
  contact_person: string;
  contact_no: string;
  email: string;
  performance_rating: number;
  performance_notes: string | null;
}

interface RFQRecord {
  id: number;
  rfq_no: string;
  pr_id: number;
  open_date: string;
  close_date: string;
  status: 'Draft' | 'Published' | 'Closed';
  terms_and_conditions: string;
  pr_no?: string;
  department_name?: string;
  created_at?: string;
}

const PR_STATUS_FLOW = ['Draft', 'Pending', 'Budget_Review', 'GSO_Review', 'For_Approval', 'Approved'];
const PR_TRACKER_STEPS = [
  { key: 'Draft', label: 'Draft Request', tab: 'pr' },
  { key: 'Budget_Review', label: 'Budget Obligation (ALOBS)', tab: 'pr' },
  { key: 'GSO_Review', label: 'GSO Allocation', tab: 'pr' },
  { key: 'Approved', label: 'Mayor Approved', tab: 'pr' },
  { key: 'RFQ', label: 'RFQ', tab: 'rfq' },
  { key: 'BAC', label: 'BAC', tab: 'bac' },
  { key: 'PO', label: 'PO', tab: 'po' },
  { key: 'IAR', label: 'IAR', tab: 'iar' }
];
const PR_STATUS_LABELS: Record<string, string> = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  Pending: 'Pending',
  Budget_Review: 'Budget Review',
  GSO_Review: 'GSO Review',
  For_Approval: 'For Approval',
  Approved: 'Approved',
  Returned: 'Returned',
  For_Correction: 'For Correction',
  Disapproved: 'Disapproved',
  Cancelled: 'Cancelled',
  Completed: 'Completed'
};

type PRWorkflowMetadata = {
  currentStep: string;
  nextAction: string;
  responsibleRoles: string[];
  destinationTab: 'pr' | 'rfq';
  requiredDocument: string;
  actionable: boolean;
};

const PR_WORKFLOW: Record<string, PRWorkflowMetadata> = {
  Draft: { currentStep: 'Draft in progress', nextAction: 'Submit the request for routing', responsibleRoles: ['End User'], destinationTab: 'pr', requiredDocument: 'Draft requisition details', actionable: true },
  Submitted: { currentStep: 'Request submitted', nextAction: 'Verify budget availability', responsibleRoles: ['Budget Officer'], destinationTab: 'pr', requiredDocument: 'Purchase Request and supporting documents', actionable: true },
  Pending: { currentStep: 'Request submitted', nextAction: 'Verify budget availability', responsibleRoles: ['Budget Officer'], destinationTab: 'pr', requiredDocument: 'Purchase Request and supporting documents', actionable: true },
  Budget_Review: { currentStep: 'Budget review completed', nextAction: 'Review specifications and procurement route', responsibleRoles: ['GSO Officer'], destinationTab: 'pr', requiredDocument: 'Budget certification / ALOBS', actionable: true },
  GSO_Review: { currentStep: 'GSO review in progress', nextAction: 'Forward the request for approval', responsibleRoles: ['GSO Officer'], destinationTab: 'pr', requiredDocument: 'Reviewed specifications and procurement mode', actionable: true },
  For_Approval: { currentStep: 'Awaiting approval', nextAction: 'Approve or disapprove the request', responsibleRoles: ['Mayor'], destinationTab: 'pr', requiredDocument: 'Reviewed Purchase Request with remarks', actionable: true },
  Approved: { currentStep: 'Approved for procurement', nextAction: 'Create and send an RFQ', responsibleRoles: ['GSO Officer', 'BAC Secretariat'], destinationTab: 'rfq', requiredDocument: 'Approved Purchase Request', actionable: true },
  Returned: { currentStep: 'Returned for correction', nextAction: 'Update the required fields and resubmit', responsibleRoles: ['End User', 'GSO Officer'], destinationTab: 'pr', requiredDocument: 'Return remarks and corrected requisition', actionable: true },
  For_Correction: { currentStep: 'Awaiting correction', nextAction: 'Update the rejected fields and resubmit', responsibleRoles: ['End User'], destinationTab: 'pr', requiredDocument: 'Correction remarks', actionable: true },
  Disapproved: { currentStep: 'Request disapproved', nextAction: 'Review the recorded disapproval remarks', responsibleRoles: [], destinationTab: 'pr', requiredDocument: 'Disapproval remarks', actionable: false },
  Cancelled: { currentStep: 'Request cancelled', nextAction: 'No further action', responsibleRoles: [], destinationTab: 'pr', requiredDocument: 'Cancellation remarks', actionable: false }
};

const formatPRStatus = (status: string) => PR_STATUS_LABELS[status] || status.replace('_', ' ');
const getPRWorkflow = (status: string): PRWorkflowMetadata => PR_WORKFLOW[status] || {
  currentStep: formatPRStatus(status),
  nextAction: 'Review transaction details',
  responsibleRoles: [],
  destinationTab: 'pr',
  requiredDocument: 'Transaction record',
  actionable: false
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'planning' | 'pr' | 'rfq' | 'bidding' | 'bac' | 'po' | 'payments' | 'iar' | 'inventory' | 'distribution' | 'disposal' | 'audit' | 'analytics' | 'settings' | 'users' | 'admin' | 'supplier'>('pr');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Backend Data States
  const [departments, setDepartments] = useState<Department[]>([]);
  const [ppmpItems, setPpmpItems] = useState<PPMPItem[]>([]);
  const [prs, setPrs] = useState<PurchaseRequest[]>([]);
  const [rfqs, setRfqs] = useState<RFQRecord[]>([]);
  const [supplierRfqs, setSupplierRfqs] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [noas, setNoas] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [iars, setIars] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [supplyInventory, setSupplyInventory] = useState<any[]>([]);
  const [supplyItems, setSupplyItems] = useState<any[]>([]);
  const [risRecords, setRisRecords] = useState<any[]>([]);
  const [iirupRecords, setIirupRecords] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any | null>(null);
  const [logoData, setLogoData] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCountRef = useRef(0);
  const notificationSourceRef = useRef<EventSource | null>(null);

  // Detailed Modal/Print Selection States
  const [selectedPR, setSelectedPR] = useState<any | null>(null);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [selectedNTP, setSelectedNTP] = useState<any | null>(null);
  const [selectedIAR, setSelectedIAR] = useState<any | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [workspacePR, setWorkspacePR] = useState<any | null>(null);

  // Bulk Print & Filter States
  const [bulkPrintPRs, setBulkPrintPRs] = useState<any[] | null>(null);
  const [printSelectedPRIds, setPrintSelectedPRIds] = useState<number[]>([]);
  const [printDraft, setPrintDraft] = useState<any | null>(null);
  const [bulkPrintPOs, setBulkPrintPOs] = useState<any[] | null>(null);
  const [prSearchQuery, setPrSearchQuery] = useState('');
  const [prStatusFilter, setPrStatusFilter] = useState('');
  const [poSearchQuery, setPoSearchQuery] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('');

  // Dedicated Drawer & Modal UI Controls for spacious full-width layouts
  const [isCreatePROpen, setIsCreatePROpen] = useState(false);
  const [isCreatePPMPOpen, setIsCreatePPMPOpen] = useState(false);
  const [isCreateRISOpen, setIsCreateRISOpen] = useState(false);
  const [isCreateIIRUPOpen, setIsCreateIIRUPOpen] = useState(false);
  const [ppmpSearchQuery, setPpmpSearchQuery] = useState('');
  const [ppmpDeptFilter, setPpmpDeptFilter] = useState('');
  const [risSearchQuery, setRisSearchQuery] = useState('');
  const [iirupSearchQuery, setIirupSearchQuery] = useState('');
  const [activePRTracker, setActivePRTracker] = useState<any | null>(null);

  // Form states
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Authentication & RBAC States
  const [token, setToken] = useState<string | null>(localStorage.getItem('gso_token'));
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('gso_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'End User',
    department_id: '',
    supplier_id: ''
  });

  // SECURED API Wrapper
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const currentToken = token || localStorage.getItem('gso_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...options.headers
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      handleLogout();
      throw new Error('Session expired');
    }
    return response;
  };

  const playNotificationSound = () => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(1320, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.015);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.14);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.16);
    } catch {
      // Browsers may block audio until user interaction. Ignore gracefully.
    }
  };

  const markNotificationRead = async (notificationId: number) => {
    try {
      const res = await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
      if (!res.ok) return;
      setNotifications(prev => prev.map(item => item.id === notificationId ? { ...item, is_read: true } : item));
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch {
      showAlert('error', 'Unable to update notification status.');
    }
  };

  const refreshNotifications = async () => {
    try {
      if (!token || !currentUser) return;
      const response = await apiFetch('/api/notifications');
      if (!response.ok) return;
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.notifications) ? payload.notifications : [];
      const count = Number(payload.count || items.filter((item: any) => !item.is_read).length || 0);
      setNotifications(items);
      setNotificationCount(count);

      if (count > notificationCountRef.current) {
        playNotificationSound();
      }
      notificationCountRef.current = count;
    } catch {
      // Quietly ignore data-refresh errors for the background notification poller.
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const res = await apiFetch('/api/notifications/read-all', { method: 'POST' });
      if (!res.ok) return;
      await fetchData();
    } catch {
      showAlert('error', 'Unable to mark notifications as read.');
    }
  };

  const calculateAvgCycleTime = () => {
    let totalDays = 0;
    let count = 0;
    pos.forEach(po => {
      const matchingPr = prs.find(p => p.id === po.pr_id);
      if (matchingPr && matchingPr.created_at && po.created_at) {
        const prDate = new Date(matchingPr.created_at);
        const poDate = new Date(po.created_at);
        const diffTime = Math.abs(poDate.getTime() - prDate.getTime());
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        totalDays += diffDays;
        count++;
      }
    });
    if (count > 0 && totalDays > 0.1) {
      const avg = totalDays / count;
      return `${avg.toFixed(1)} Days`;
    }
    return '12.4 Days';
  };

  const handleLogin = async (e?: React.FormEvent, customUsername?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    const u = customUsername || usernameInput;
    const p = customPassword || passwordInput;

    if (!u || !p) {
      setAuthError('Please enter a username and password.');
      return;
    }

    try {
      setLoading(true);
      setAuthError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid credentials');
      }
      const data = await res.json();
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('gso_token', data.token);
      localStorage.setItem('gso_user', JSON.stringify(data.user));
      showAlert('success', `Welcome back, ${data.user.name}! Connected as ${data.user.role}.`);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeExternalLogin = (data: any) => {
    setToken(data.token);
    setCurrentUser(data.user);
    localStorage.setItem('gso_token', data.token);
    localStorage.setItem('gso_user', JSON.stringify(data.user));
    showAlert('success', `Welcome back, ${data.user.name}! Connected as ${data.user.role}.`);
  };

  const handleGoogleCredential = async (credential: string) => {
    try {
      setLoading(true);
      setAuthError(null);
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
      completeExternalLogin(data);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to send verification code');
      setResetSent(true);
      setAuthError(null);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const completePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: resetOtp, newPassword: resetPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to reset password');
      setResetOpen(false);
      setResetSent(false);
      setResetOtp('');
      setResetPassword('');
      setAuthError(null);
      showAlert('success', 'Password reset complete. You can now sign in.');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const currentToken = token || localStorage.getItem('gso_token');
      if (currentToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('gso_token');
    localStorage.removeItem('gso_user');
  };

  // Centralized UI role matrix for each module so access stays consistent across the app.
  const ROLE_ACCESS: Record<string, string[]> = {
    planning: ['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer'],
    pr: ['End User', 'GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer'],
    rfq: ['GSO Officer', 'BAC Secretariat', 'Mayor', 'Finance Officer'],
    bidding: ['BAC Secretariat', 'GSO Officer', 'Mayor'],
    bac: ['BAC Secretariat', 'Mayor', 'GSO Officer', 'Budget Officer', 'Finance Officer'],
    po: ['GSO Officer', 'Budget Officer', 'Mayor', 'Finance Officer'],
    payments: ['Finance Officer', 'GSO Officer', 'Mayor', 'Budget Officer'],
    iar: ['GSO Officer', 'Mayor', 'End User', 'Finance Officer'],
    inventory: ['GSO Officer', 'Mayor', 'End User'],
    distribution: ['GSO Officer', 'Mayor', 'End User', 'Finance Officer'],
    disposal: ['GSO Officer', 'Mayor', 'Finance Officer'],
    audit: ['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer'],
    analytics: ['GSO Officer', 'Budget Officer', 'Mayor', 'BAC Secretariat', 'Finance Officer'],
    settings: ['Mayor', 'GSO Officer', 'Finance Officer'],
    users: ['Mayor'],
    admin: ['Mayor', 'GSO Officer', 'Finance Officer']
    ,supplier: ['Supplier']
  };

  const canAccessTab = (tab: string) => {
    if (!currentUser) return false;
    return (ROLE_ACCESS[tab] || []).includes(currentUser.role);
  };

  // Helper to check if user can manage suppliers (registration)
  const canManageSuppliers = () => {
    if (!currentUser) return false;
    return ['GSO Officer', 'Mayor', 'BAC Secretariat'].includes(currentUser.role);
  };

  const handleCreateUser = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!newUserForm.username || !newUserForm.name || !newUserForm.role) {
      return showAlert('error', 'Please fill in the required user account fields.');
    }

    if (!editingUserId && !newUserForm.password) {
      return showAlert('error', 'Password is required for new user accounts.');
    }

    if (newUserForm.password && newUserForm.password.length < 6) {
      return showAlert('error', 'Password must be at least 6 characters long.');
    }

    try {
      setLoading(true);
      const payload = {
        ...newUserForm,
        department_id: newUserForm.department_id ? Number(newUserForm.department_id) : null,
        ...(newUserForm.password ? { password: newUserForm.password } : {})
      };

      const endpoint = editingUserId !== null ? `/api/users/${editingUserId}` : '/api/users';
      const method = editingUserId !== null ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: editingUserId !== null ? 'Failed to update user' : 'Failed to create user' }));
        throw new Error(err.error || (editingUserId !== null ? 'Failed to update user' : 'Failed to create user'));
      }

      const savedUser = await res.json();
      setUserAccounts((prev) => {
        if (editingUserId !== null) {
          return prev.map((user) => (user.id === editingUserId ? savedUser : user));
        }
        return [savedUser, ...prev];
      });

      setEditingUserId(null);
      setNewUserForm({ username: '', name: '', email: '', password: '', role: 'End User', department_id: '', supplier_id: '' });
      showAlert('success', editingUserId !== null ? `User ${savedUser.username} has been updated successfully.` : `User ${savedUser.username} has been created successfully.`);
    } catch (err: any) {
      showAlert('error', err.message || 'Unable to save user');
    } finally {
      setLoading(false);
    }
  };

  const startUserEdit = (user: any) => {
    setEditingUserId(user.id);
    setNewUserForm({
      username: user.username,
      name: user.name,
      email: user.email || '',
      password: '',
      role: user.role,
      department_id: user.department_id ? String(user.department_id) : '',
      supplier_id: user.supplier_id ? String(user.supplier_id) : ''
    });
  };

  const cancelUserEdit = () => {
    setEditingUserId(null);
    setNewUserForm({ username: '', name: '', email: '', password: '', role: 'End User', department_id: '', supplier_id: '' });
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!window.confirm(`Delete user ${username}? This cannot be undone.`)) return;

    try {
      setLoading(true);
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete user' }));
        throw new Error(err.error || 'Failed to delete user');
      }
      setUserAccounts((prev) => prev.filter((user) => user.id !== userId));
      if (editingUserId === userId) cancelUserEdit();
      showAlert('success', `User ${username} deleted successfully.`);
    } catch (err: any) {
      showAlert('error', err.message || 'Unable to delete user');
    } finally {
      setLoading(false);
    }
  };

  // Switch to allowed tab automatically if activeTab becomes inaccessible on switch role
  useEffect(() => {
    if (currentUser) {
      const tabs: ('planning' | 'pr' | 'rfq' | 'bidding' | 'bac' | 'po' | 'payments' | 'iar' | 'inventory' | 'distribution' | 'disposal' | 'audit' | 'analytics' | 'settings' | 'users' | 'admin' | 'supplier')[] = [
        'supplier', 'planning', 'pr', 'rfq', 'bidding', 'bac', 'po', 'payments', 'iar', 'inventory', 'distribution', 'disposal', 'audit', 'analytics', 'settings', 'users', 'admin'
      ];
      if (!canAccessTab(activeTab)) {
        const allowed = tabs.find(t => canAccessTab(t));
        if (allowed) setActiveTab(allowed);
      }
    }
  }, [currentUser, activeTab]);

  // New PPMP item form
  const [newPpmp, setNewPpmp] = useState({
    department_id: '',
    year: '2026',
    category: 'Supplies',
    description: '',
    unit: 'box',
    unit_cost: '',
    q1_qty: '0',
    q2_qty: '0',
    q3_qty: '0',
    q4_qty: '0',
    mode_of_procurement: 'Shopping',
    source_of_funds: 'General Fund'
  });

  // New PR wizard form
  const [newPR, setNewPR] = useState({
    department_id: '',
    section: 'Administrative',
    purpose: '',
    requested_by_name: '',
    requested_by_designation: '',
    items: [] as any[] // { ppmp_item_id, unit, description, quantity, unit_cost }
  });
  const [tempPRItem, setTempPRItem] = useState({
    ppmp_item_id: '',
    unit: '',
    description: '',
    quantity: '1',
    unit_cost: ''
  });

  // Budget Review & Mode Allocation parameters
  const [budgetReviewPR, setBudgetReviewPR] = useState<any | null>(null);
  const [alobsNumber, setAlobsNumber] = useState('');
  const [allocatedMode, setAllocatedMode] = useState('Shopping');
  const [budgetRemarks, setBudgetRemarks] = useState('');

  // RFQ Creation parameters
  const [createRfqPR, setCreateRfqPR] = useState<any | null>(null);
  const [rfqCloseDate, setRfqCloseDate] = useState('');

  // Bid Input (Abstract of Canvass) parameters
  const [activeRfqForBids, setActiveRfqForBids] = useState<any | null>(null);
  const [bidPrices, setBidPrices] = useState<{ [key: string]: string }>({}); // "supplierId-prItemId" -> offered price
  const [bidCompliance, setBidCompliance] = useState<{ [key: string]: boolean }>({}); // "supplierId-prItemId" -> isCompliant

  // BAC Resolution parameters
  const [activeRfqForBAC, setActiveRfqForBAC] = useState<any | null>(null);
  const [winningSupplierId, setWinningSupplierId] = useState('');
  const [bacJustification, setBacJustification] = useState('');

  // IAR partial vs full parameters
  const [activePoForIar, setActivePoForIar] = useState<any | null>(null);
  const [iarInvoiceNo, setIarInvoiceNo] = useState('');
  const [iarInvoiceDate, setIarInvoiceDate] = useState('');
  const [iarIsPartial, setIarIsPartial] = useState(false);
  const [iarDeliveredQtys, setIarDeliveredQtys] = useState<{ [key: number]: number }>({}); // po_item_id -> qty
  const [iarItemConditions, setIarItemConditions] = useState<{ [key: number]: 'Good' | 'Damaged' | 'Incomplete' }>({}); // po_item_id -> condition
  const [iarPhoto, setIarPhoto] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    po_id: '',
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'Transfer',
    reference_no: '',
    prepared_by: '',
    remarks: '',
    document_type: 'Disbursement Voucher',
    document_no: '',
    document_url: ''
  });

  // Asset lifecycle forms
  const [risForm, setRisForm] = useState({ asset_id: '', department_id: '', requisitioner_name: '', requisitioner_designation: '', purpose: '' });
  const [iirupForm, setIirupForm] = useState({ asset_id: '', department_id: '', reason: '', condition_notes: '', disposal_method: 'Public Auction', appraised_value: '' });
  const [supplyItemForm, setSupplyItemForm] = useState({ item_code: '', description: '', category: 'Supplies', unit: 'box', reorder_level: '0' });
  const [supplyTransactionForm, setSupplyTransactionForm] = useState({ inventory_item_id: '', transaction_type: 'RECEIVE', quantity: '', from_department_id: '', to_department_id: '', unit_cost: '', remarks: '' });

  // New Supplier form
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    address: '',
    tin: '',
    contact_person: '',
    contact_no: '',
    email: '',
    performance_rating: 0,
    performance_notes: ''
  });
  const [activeSupplierRfq, setActiveSupplierRfq] = useState<any | null>(null);
  const [supplierQuotePrices, setSupplierQuotePrices] = useState<Record<number, string>>({});
  const [supplierQuoteRemarks, setSupplierQuoteRemarks] = useState('');

  const safeFetchArray = async (url: string, condition: boolean = true) => {
    if (!condition) return [];
    try {
      const res = await apiFetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const currentToken = token || localStorage.getItem('gso_token');
      if (!currentToken) return;

      const userSaved = currentUser || (localStorage.getItem('gso_user') ? JSON.parse(localStorage.getItem('gso_user')!) : null);
      const role = userSaved?.role;

      const canViewAudit = role && ['Mayor', 'GSO Officer', 'BAC Secretariat'].includes(role);
      const canViewRfq = role && ['GSO Officer', 'BAC Secretariat', 'Mayor'].includes(role);
      const canViewPayments = role && ['Finance Officer', 'GSO Officer', 'Mayor', 'Budget Officer'].includes(role);
      const canViewSuppliers = role && ['GSO Officer', 'BAC Secretariat', 'Mayor', 'Budget Officer'].includes(role);
      const canViewInventory = role && ['GSO Officer', 'Mayor', 'End User'].includes(role);
      const canViewIirup = role && ['GSO Officer', 'Mayor'].includes(role);
      const canViewUsers = role && ['Mayor'].includes(role);

      const [resDepts, resPpmp, resPR, resRfq, resSups, resNoa, resPo, resIar, resAssets, resSupplyInventory, resSupplyItems, resRis, resIirup, resLogs, resSettings, resNotif, resPayments, resUsers, resSupplierRfqs] = await Promise.all([
        safeFetchArray('/api/departments'),
        safeFetchArray('/api/ppmp'),
        safeFetchArray('/api/pr'),
        safeFetchArray('/api/rfq', canViewRfq),
        safeFetchArray('/api/suppliers', canViewSuppliers),
        safeFetchArray('/api/noa'),
        safeFetchArray('/api/po'),
        safeFetchArray('/api/iar'),
        safeFetchArray('/api/inventory', canViewInventory),
        safeFetchArray('/api/supplies/inventory', canViewInventory),
        safeFetchArray('/api/supplies/items', canViewInventory),
        safeFetchArray('/api/ris'),
        safeFetchArray('/api/iirup', canViewIirup),
        safeFetchArray('/api/audit-logs', canViewAudit),
        apiFetch('/api/settings').then(r => r.ok ? r.json() : null).catch(() => null),
        apiFetch('/api/notifications').then(r => r.ok ? r.json() : { count: 0, items: [] }).catch(() => ({ count: 0, items: [] })),
        safeFetchArray('/api/payments', canViewPayments),
        safeFetchArray('/api/users', canViewUsers),
        safeFetchArray('/api/supplier/rfqs', role === 'Supplier')
      ]);

      setDepartments(resDepts);
      setPpmpItems(resPpmp);
      setPrs(resPR);
      setRfqs(resRfq);
      setSuppliers(resSups);
      setNoas(resNoa);
      setPos(resPo);
      setIars(resIar);
      setAssets(resAssets);
      setSupplyInventory(resSupplyInventory);
      setSupplyItems(resSupplyItems);
      setRisRecords(resRis);
      setIirupRecords(resIirup);
      setAuditLogs(resLogs);
      setPayments(resPayments);

      const nextNotificationCount = Number(resNotif?.count || 0);
      const nextNotificationItems = Array.isArray(resNotif?.items) ? resNotif.items : Array.isArray(resNotif?.notifications) ? resNotif.notifications : [];
      setNotifications(nextNotificationItems);
      setNotificationCount(nextNotificationCount);

      if (nextNotificationCount > notificationCountRef.current) {
        playNotificationSound();
      }
      notificationCountRef.current = nextNotificationCount;

      setUserAccounts(Array.isArray(resUsers) ? resUsers : []);
      setSupplierRfqs(resSupplierRfqs);
      if (resSettings) {
        setSystemSettings(resSettings);
        setLogoData(resSettings.logo_data || null);
      }
    } catch (e: any) {
      console.error(e);
      if (e.message !== 'Session expired') {
        showAlert('error', 'Failed to synchronize with server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token || !import.meta.env.VITE_GOOGLE_CLIENT_ID || !googleButtonRef.current) return;
    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => handleGoogleCredential(response.credential)
      });
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline', size: 'large', width: googleButtonRef.current.offsetWidth || 320, text: 'continue_with'
      });
    };
    const existingScript = document.querySelector('script[data-google-identity]');
    if (existingScript) {
      renderGoogleButton();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = renderGoogleButton;
    document.head.appendChild(script);
  }, [token]);

  // Pre-load settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && !data.error) {
          setSystemSettings(data);
          setLogoData(data.logo_data || null);
        }
      })
      .catch(err => console.error("Error pre-fetching settings:", err));
  }, []);

  useEffect(() => {
    if (!token || !currentUser) return undefined;

    const source = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
    notificationSourceRef.current = source;

    source.addEventListener('notification', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        const item = {
          id: payload.id || Date.now(),
          user_id: payload.user_id || null,
          user_name: payload.user_name || null,
          department_id: payload.department_id || null,
          target_role: payload.target_role || null,
          title: payload.title || 'Procurement Notification',
          message: payload.message || '',
          type: payload.type || 'info',
          is_read: false,
          created_at: payload.created_at || new Date().toISOString()
        };

        setNotifications(prev => [item, ...prev]);
        setNotificationCount(prev => prev + 1);
        notificationCountRef.current += 1;
        playNotificationSound();
      } catch {
        // Ignore malformed stream payloads silently.
      }
    });

    source.onerror = () => {
      try {
        source.close();
      } catch {
        // Stream may already be gone.
      }
    };

    return () => {
      source.close();
      notificationSourceRef.current = null;
    };
  }, [token, currentUser]);

  useEffect(() => {
    if (!token || !currentUser) return undefined;

    const interval = window.setInterval(() => {
      refreshNotifications();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [token, currentUser]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const restoreSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          handleLogout();
          return;
        }

        const user = await response.json();
        if (cancelled) return;

        setCurrentUser(user);
        localStorage.setItem('gso_user', JSON.stringify(user));
        await fetchData();
      } catch {
        if (!cancelled) handleLogout();
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 8000);
  };

  const handleCreateSupplyItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/supplies/items', { method: 'POST', body: JSON.stringify(supplyItemForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create supply item.');
      setSupplyItemForm({ item_code: '', description: '', category: 'Supplies', unit: 'box', reorder_level: '0' });
      showAlert('success', `Supply item ${data.item_code} created.`);
      await fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Unable to create supply item.');
    }
  };

  const handleSupplyTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...supplyTransactionForm,
        inventory_item_id: Number(supplyTransactionForm.inventory_item_id),
        quantity: Number(supplyTransactionForm.quantity),
        from_department_id: supplyTransactionForm.transaction_type === 'RECEIVE' || supplyTransactionForm.transaction_type === 'ADJUSTMENT' ? null : Number(supplyTransactionForm.from_department_id),
        to_department_id: supplyTransactionForm.transaction_type === 'DISPOSAL' ? null : Number(supplyTransactionForm.to_department_id),
        unit_cost: supplyTransactionForm.unit_cost ? Number(supplyTransactionForm.unit_cost) : null
      };
      const res = await apiFetch('/api/supplies/transactions', { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to record stock transaction.');
      setSupplyTransactionForm({ ...supplyTransactionForm, quantity: '', unit_cost: '', remarks: '' });
      showAlert('success', `${payload.transaction_type} transaction recorded.`);
      await fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Unable to record stock transaction.');
    }
  };

  // 1. Submit PPMP Item
  const handleCreatePPMP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPpmp.department_id || !newPpmp.description || !newPpmp.unit_cost) {
      return showAlert('error', 'Please fill in all mandatory fields.');
    }
    try {
      const res = await apiFetch('/api/ppmp', {
        method: 'POST',
        body: JSON.stringify(newPpmp)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Server error');
      }
      showAlert('success', 'PPMP Line Item successfully recorded in budget plan.');
      setNewPpmp({
        ...newPpmp,
        description: '',
        unit_cost: '',
        q1_qty: '0',
        q2_qty: '0',
        q3_qty: '0',
        q4_qty: '0'
      });
      setIsCreatePPMPOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // 2. PR Wizard Logic
  const handleAddPRItem = () => {
    if (!tempPRItem.description.trim() || !tempPRItem.unit.trim() || !tempPRItem.quantity || !tempPRItem.unit_cost) {
      return showAlert('error', 'Please fill in the item unit, description, quantity, and unit cost.');
    }

    const ppmp = tempPRItem.ppmp_item_id
      ? ppmpItems.find(p => p.id === parseInt(tempPRItem.ppmp_item_id))
      : undefined;

    // Check if item already added
    if (newPR.items.some(i => i.ppmp_item_id && ppmp && i.ppmp_item_id === ppmp.id) || newPR.items.some(i => !i.ppmp_item_id && i.description.toLowerCase() === tempPRItem.description.trim().toLowerCase())) {
      return showAlert('error', 'Item already added. Please modify quantity instead.');
    }

    const qty = parseInt(tempPRItem.quantity);
    const cost = parseFloat(tempPRItem.unit_cost) || Number(ppmp.unit_cost);

    setNewPR({
      ...newPR,
      items: [
        ...newPR.items,
        {
          ppmp_item_id: ppmp?.id || null,
          unit: tempPRItem.unit.trim(),
          description: tempPRItem.description.trim(),
          quantity: qty,
          unit_cost: cost
        }
      ]
    });
    setTempPRItem({ ppmp_item_id: '', unit: '', description: '', quantity: '1', unit_cost: '' });
  };

  const handleRemovePRItem = (idx: number) => {
    const nextItems = [...newPR.items];
    nextItems.splice(idx, 1);
    setNewPR({ ...newPR, items: nextItems });
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPR.department_id || !newPR.purpose || !newPR.items.length) {
      return showAlert('error', 'Please select a department, purpose, and add at least one validated item.');
    }

    try {
      const res = await apiFetch('/api/pr', {
        method: 'POST',
        body: JSON.stringify({ ...newPR, status: 'Submitted' })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit PR');
      }
      showAlert('success', 'Purchase Request successfully generated with custom tracking number.');
      setNewPR({
        department_id: '',
        section: 'Administrative',
        purpose: '',
        requested_by_name: '',
        requested_by_designation: '',
        items: []
      });
      setIsCreatePROpen(false);
      fetchData();
    } catch (err: any) {
      if (err.message === 'This RFQ already has a BAC resolution.' || err.message === 'This RFQ has already been awarded and closed.') {
        setActiveRfqForBAC(null);
        await fetchData();
      }
      showAlert('error', err.message);
    }
  };


  // 3. Budget Review Sign-off
  const handleSubmitBudgetReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alobsNumber) return showAlert('error', 'ALOBS Number is required by COA to certify funding availability.');
    if (currentUser?.role !== 'Budget Officer') return showAlert('error', 'Unauthorized access.');

    try {
      const res = await apiFetch(`/api/pr/${budgetReviewPR.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Budget_Review',
          alobs_number: alobsNumber,
          alobs_date: new Date().toISOString().split('T')[0],
          remarks: budgetRemarks || 'Funds certified available.',
          user_role: currentUser.role,
          user_name: currentUser.name
        })
      });

      if (!res.ok) throw new Error('Failed to update status');

      // Trigger notification
      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          user_name: budgetReviewPR.requested_by_name,
          message: `Your PR ${budgetReviewPR.pr_no} has been certified with ALOBS ${alobsNumber}.`
        })
      });

      showAlert('success', 'PR approved for funding & assigned ALOBS ID.');
      setBudgetReviewPR(null);
      setAlobsNumber('');
      setBudgetRemarks('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const updatePRStatus = async (prId: number, status: string, autoRemarks?: string) => {
    let remarks = autoRemarks || prompt(`Enter remarks for ${status} action:`);
    if (remarks === null) return; // User cancelled

    // If empty and it's GSO Review, auto-fill
    if (status === 'GSO_Review' && (!remarks || remarks.trim() === '')) {
      remarks = "Started GSO Review";
    }

    // Final check for remarks
    if (!remarks || remarks.trim() === '') {
      return showAlert('error', 'Remarks are required.');
    }

    try {
      const res = await apiFetch(`/api/pr/${prId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, remarks })
      });
      if (!res.ok) {
        let errorMessage = 'Failed to update status';
        try {
          const err = await res.json();
          errorMessage = err.error || errorMessage;
        } catch (e) {
          const text = await res.text();
          errorMessage = text || errorMessage;
        }
        throw new Error(errorMessage);
      }
      showAlert('success', `PR status updated to ${status}.`);
      // Re-fetch PRs or update state
      // For simplicity, we can reload the page or update local state
      window.location.reload();
    } catch (e: any) {
      console.error('Error updating status:', e);
      showAlert('error', e.message);
    }
  };

  // GSO Mode Allocation
  const handleGSOApproval = async (prId: number) => {
    if (currentUser?.role !== 'GSO Officer') return showAlert('error', 'Unauthorized access.');
    const remarks = prompt('Please enter remarks for approval:');
    if (!remarks) return showAlert('error', 'Remarks are required.');

    try {
      const res = await apiFetch(`/api/pr/${prId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'For_Approval',
          mode_of_procurement: allocatedMode,
          remarks: remarks,
          user_role: currentUser.role,
          user_name: currentUser.name
        })
      });

      if (!res.ok) throw new Error('Failed to approve');
      showAlert('success', `PR mode of procurement set to ${allocatedMode}. Ready for Mayor approval.`);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // 4. RFQ Solicitation
  const handleCreateRFQ = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqCloseDate) return showAlert('error', 'Closing Date is required.');
    if (createRfqPR?.status !== 'Approved') return showAlert('error', 'Only approved Purchase Requests can start an RFQ.');

    try {
      const res = await apiFetch('/api/rfq', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: createRfqPR.id,
          procurement_mode: createRfqPR.mode_of_procurement || 'Public Bidding',
          open_date: new Date().toISOString().split('T')[0],
          close_date: rfqCloseDate
        })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Failed to create RFQ');
      }
      showAlert('success', 'Public RFQ successfully published. Abstract sheet generated.');
      setCreateRfqPR(null);
      setRfqCloseDate('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // 5. Submit Supplier Bids
  const handleSubmitBids = async (e: React.FormEvent) => {
    e.preventDefault();

    // Format bids array
    // We need to map activeRfqForBids.items to suppliers
    const bids: any[] = [];
    let missingInput = false;
    let invalidInput = false;

    activeRfqForBids.items.forEach((item: any) => {
      const prItemId = Number(item.pr_item_id || item.id);
      suppliers.slice(0, 3).forEach(supplier => {
        const bidKey = `${supplier.id}-${prItemId}`;
        const price = bidPrices[bidKey];
        if (price === undefined || price === '') {
          missingInput = true;
          return;
        }
        const offeredUnitPrice = Number(price);
        if (!Number.isFinite(offeredUnitPrice) || offeredUnitPrice < 0) {
          invalidInput = true;
          return;
        }
        bids.push({
          supplier_id: supplier.id,
          pr_item_id: prItemId,
          offered_unit_price: offeredUnitPrice,
          is_compliant: offeredUnitPrice <= Number(item.unit_cost)
            && (bidCompliance[bidKey] !== undefined ? bidCompliance[bidKey] : true)
        });
      });
    });

    if (missingInput) {
      return showAlert('error', 'Please enter bid offers for all listed suppliers to complete Abstract comparison.');
    }
    if (invalidInput) {
      return showAlert('error', 'Each bid must be a valid non-negative amount.');
    }

    try {
      const res = await apiFetch(`/api/rfq/${activeRfqForBids.id}/bids`, {
        method: 'POST',
        body: JSON.stringify({ bids })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Failed to save bids');
      }
      showAlert('success', 'Abstract of Canvass matrix generated. Compliance & Lowest bidder highlighted.');
      setActiveRfqForBids(null);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // 6. BAC Resolution & Award
  const handleSubmitBACResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winningSupplierId || !bacJustification) {
      return showAlert('error', 'Select winning supplier and input official justification.');
    }

    try {
      const res = await apiFetch('/api/bac-resolutions', {
        method: 'POST',
        body: JSON.stringify({
          rfq_id: activeRfqForBAC.id,
          winning_supplier_id: winningSupplierId,
          type_of_bidding: activeRfqForBAC.pr?.mode_of_procurement || 'Small Value Procurement',
          justification: bacJustification
        })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Failed to create BAC Resolution');
      }
      showAlert('success', 'BAC Resolution signed! Notice of Award (NOA) auto-generated.');
      setActiveRfqForBAC(null);
      setWinningSupplierId('');
      setBacJustification('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // 7. Auto-convert NOA to Purchase Order
  const handleCreatePO = async (noa: any) => {
    try {
      const res = await apiFetch('/api/po', {
        method: 'POST',
        body: JSON.stringify({
          pr_id: noa.bac_resolution?.rfq?.pr_id || 1,
          noa_id: noa.id,
          supplier_id: noa.supplier_id,
          mode_of_procurement: noa.bac_resolution?.type_of_bidding || 'Shopping'
        })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error || 'Failed to generate PO');
      }
      showAlert('success', 'Purchase Order (Appendix 61) and Notice to Proceed (NTP) auto-generated with NO re-typing errors!');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // 8. Inspection & Acceptance (IAR)
  const handleSubmitIAR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePoForIar?.id || !iarInvoiceNo || !iarInvoiceDate) {
      return showAlert('error', 'Invoice number and date are required to inspect delivery.');
    }

    const items = activePoForIar.items.map((item: any) => {
      const remainingQuantity = Number(item.remaining_quantity ?? item.quantity);
      const qtyDelivered = iarDeliveredQtys[item.id] !== undefined ? iarDeliveredQtys[item.id] : remainingQuantity;
      return {
        po_item_id: item.id,
        quantity_delivered: qtyDelivered,
        remaining_quantity: remainingQuantity,
        item_condition: iarItemConditions[item.id] || 'Good',
        is_accepted: (iarItemConditions[item.id] || 'Good') === 'Good'
      };
    }).filter((item: any) => Number(item.quantity_delivered) > 0);

    const invalidItem = items.find((item: any) => {
      return !Number.isInteger(Number(item.quantity_delivered)) || Number(item.quantity_delivered) <= 0 || Number(item.quantity_delivered) > item.remaining_quantity;
    });
    if (invalidItem) {
      return showAlert('error', 'Check the delivered quantity. It must be a positive whole number and cannot exceed the ordered quantity.');
    }

    try {
      const res = await apiFetch('/api/iar', {
        method: 'POST',
        body: JSON.stringify({
          po_id: activePoForIar.id,
          invoice_no: iarInvoiceNo,
          invoice_date: iarInvoiceDate,
          is_partial: iarIsPartial,
          items,
          photo_url: iarPhoto
        })
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Failed to save inspection report.');
      showAlert('success', 'IAR (Appendix 62) recorded. Warehouse stock levels updated and property assets assigned!');
      setActivePoForIar(null);
      setIarInvoiceNo('');
      setIarInvoiceDate('');
      setIarDeliveredQtys({});
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const handleCreateRIS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!risForm.asset_id || !risForm.department_id || !risForm.requisitioner_name || !risForm.requisitioner_designation || !risForm.purpose) {
      return showAlert('error', 'Complete all RIS fields and select an active asset.');
    }
    try {
      const res = await apiFetch('/api/ris', {
        method: 'POST',
        body: JSON.stringify({ ...risForm, department_id: Number(risForm.department_id), items: [{ asset_id: Number(risForm.asset_id), quantity: 1 }] })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to issue RIS.');
      showAlert('success', `RIS ${body.ris_no} issued successfully.`);
      setRisForm({ asset_id: '', department_id: '', requisitioner_name: '', requisitioner_designation: '', purpose: '' });
      setIsCreateRISOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const handleCreateIIRUP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iirupForm.asset_id || !iirupForm.department_id || !iirupForm.reason || !iirupForm.condition_notes) {
      return showAlert('error', 'Complete all IIRUP fields and select an active asset.');
    }
    try {
      const res = await apiFetch('/api/iirup', {
        method: 'POST',
        body: JSON.stringify({
          department_id: Number(iirupForm.department_id),
          reason: iirupForm.reason,
          disposal_method: iirupForm.disposal_method,
          items: [{ asset_id: Number(iirupForm.asset_id), condition_notes: iirupForm.condition_notes, appraised_value: iirupForm.appraised_value ? Number(iirupForm.appraised_value) : null }]
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to submit IIRUP.');
      showAlert('success', `IIRUP ${body.iirup_no} submitted for review.`);
      setIirupForm({ asset_id: '', department_id: '', reason: '', condition_notes: '', disposal_method: 'Public Auction', appraised_value: '' });
      setIsCreateIIRUPOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const updateIIRUPStatus = async (record: any, status: 'Approved' | 'Disposed' | 'Cancelled') => {
    const coaAuthorityNo = status === 'Disposed' ? prompt('Enter COA authority number:') : undefined;
    if (status === 'Disposed' && !coaAuthorityNo) return;
    if (status === 'Cancelled' && !confirm(`Cancel IIRUP ${record.iirup_no}?`)) return;
    try {
      const res = await apiFetch(`/api/iirup/${record.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, coa_authority_no: coaAuthorityNo })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update IIRUP status.');
      showAlert('success', `IIRUP ${record.iirup_no} updated to ${status}.`);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Create Supplier Helper
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify(newSupplier)
      });
      if (!res.ok) throw new Error('Failed to create supplier');
      showAlert('success', 'Supplier registered in LGU registry.');
      setShowSupplierModal(false);
      setNewSupplier({ name: '', address: '', tin: '', contact_person: '', contact_no: '', email: '', performance_rating: 0, performance_notes: '' });
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const openSupplierRfq = async (rfqId: number) => {
    try {
      const res = await apiFetch(`/api/supplier/rfqs/${rfqId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to load RFQ invitation.');
      setActiveSupplierRfq(body);
      setSupplierQuotePrices(Object.fromEntries((body.items || []).map((item: any) => [Number(item.pr_item_id), item.offered_unit_price !== null && item.offered_unit_price !== undefined ? String(item.offered_unit_price) : ''])));
      setSupplierQuoteRemarks('');
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const acceptSupplierRfq = async (rfqId: number) => {
    try {
      const res = await apiFetch(`/api/supplier/rfqs/${rfqId}/accept`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to accept RFQ invitation.');
      showAlert('success', 'RFQ invitation accepted. You can now prepare a quotation.');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const submitSupplierQuotation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeSupplierRfq) return;
    const items = (activeSupplierRfq.items || []).map((item: any) => ({
      pr_item_id: Number(item.pr_item_id),
      offered_unit_price: Number(supplierQuotePrices[Number(item.pr_item_id)]),
      is_compliant: true
    }));
    if (items.some((item: any) => !Number.isFinite(item.offered_unit_price) || item.offered_unit_price < 0)) {
      return showAlert('error', 'Enter a valid non-negative price for every RFQ item.');
    }
    try {
      const res = await apiFetch(`/api/supplier/rfqs/${activeSupplierRfq.id}/quotation`, {
        method: 'POST',
        body: JSON.stringify({ items, remarks: supplierQuoteRemarks })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to submit quotation.');
      showAlert('success', 'Quotation submitted and locked into the procurement record.');
      setActiveSupplierRfq(null);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Helpers
  const formatPesos = (val: number | string) => {
    return '₱ ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const paymentStatusTone = (status: string) => {
    if (status === 'For_Verification') return 'bg-amber-100 text-amber-800 border border-amber-200';
    if (status === 'Approved') return 'bg-violet-100 text-violet-800 border border-violet-200';
    if (status === 'Disbursed') return 'bg-sky-100 text-sky-800 border border-sky-200';
    if (status === 'Completed') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (status === 'Cancelled') return 'bg-rose-100 text-rose-800 border border-rose-200';
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  const updatePaymentStatus = async (paymentId: number, nextStatus: string) => {
    const remarks = window.prompt(`Add remarks for ${nextStatus.toLowerCase()} status (optional):`, '');
    try {
      const res = await apiFetch(`/api/payments/${paymentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus, remarks: remarks || undefined })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to update payment status.');
      showAlert('success', `Payment status updated to ${nextStatus}.`);
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  const handleCreatePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentForm.po_id || !paymentForm.payment_date || !paymentForm.amount || !paymentForm.prepared_by || !paymentForm.document_no) {
      return showAlert('error', 'PO, date, amount, preparer, and document number are required.');
    }

    try {
      const res = await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify(paymentForm)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to create payment request.');
      showAlert('success', `Payment request ${body.payment_no} submitted for verification.`);
      setPaymentForm({
        po_id: '',
        payment_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_method: 'Transfer',
        reference_no: '',
        prepared_by: '',
        remarks: '',
        document_type: 'Disbursement Voucher',
        document_no: '',
        document_url: ''
      });
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message);
    }
  };

  // Filtered/Visible Lists based on search query and status filters
  const visiblePRs = prs.filter(pr => {
    const matchesSearch = !prSearchQuery ||
      pr.pr_no.toLowerCase().includes(prSearchQuery.toLowerCase()) ||
      (pr.department_code || '').toLowerCase().includes(prSearchQuery.toLowerCase()) ||
      (pr.purpose || '').toLowerCase().includes(prSearchQuery.toLowerCase());
    const matchesStatus = !prStatusFilter || pr.status === prStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const isPROwnedByCurrentUser = (pr: any) => currentUser?.role !== 'End User' || (
    Number(pr.department_id) === Number(currentUser.department_id) &&
    String(pr.requested_by_name || '').trim().toLowerCase() === String(currentUser.name || '').trim().toLowerCase()
  );

  const visiblePOs = pos.filter(po => {
    const matchesSearch = !poSearchQuery ||
      po.po_no.toLowerCase().includes(poSearchQuery.toLowerCase()) ||
      (po.supplier_name || '').toLowerCase().includes(poSearchQuery.toLowerCase());
    const matchesStatus = !poStatusFilter || po.status === poStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const transactionMatches = transactionSearch.trim()
    ? prs.filter(pr => {
      const query = transactionSearch.toLowerCase();
      const po = pos.find(item => Number(item.pr_id) === Number(pr.id));
      const rfq = rfqs.find(item => Number(item.pr_id) === Number(pr.id));
      const payment = payments.find(item => Number(item.po_id) === Number(po?.id));
      return [
        pr.pr_no,
        pr.purpose,
        pr.department_name,
        pr.department_code,
        pr.status,
        po?.po_no,
        po?.supplier_name,
        rfq?.rfq_no,
        payment?.payment_no
      ].some(value => String(value || '').toLowerCase().includes(query));
    }).slice(0, 6)
    : [];

  const handleBulkPrintPRs = async () => {
    const printablePRs = visiblePRs.filter(isPROwnedByCurrentUser);
    const selectedPRs = printablePRs.filter(pr => printSelectedPRIds.includes(Number(pr.id)));
    if (selectedPRs.length === 0) {
      return showAlert('error', 'Select at least one of your Purchase Requests to consolidate for printing.');
    }
    if (new Set(selectedPRs.map(pr => Number(pr.department_id))).size > 1) {
      return showAlert('error', 'Only requests from the same department can be consolidated into one print record.');
    }
    try {
      setLoading(true);
      const fetched = await Promise.all(
        selectedPRs.map(pr => apiFetch(`/api/pr/${pr.id}`).then(res => res.json()))
      );
      const firstPR = fetched[0];
      const department = departments.find(item => Number(item.id) === Number(firstPR.department_id));
      const sourceNumbers = fetched.map(pr => pr.pr_no).join(', ');
      setPrintDraft({
        ...firstPR,
        id: `consolidated-${Date.now()}`,
        pr_no: `CONSOLIDATED-${new Date().toISOString().slice(0, 10)}`,
        section: 'Consolidated Requests',
        purpose: `Consolidated request from PRs: ${sourceNumbers}`,
        requested_by_name: currentUser?.name || firstPR.requested_by_name,
        requested_by_designation: currentUser?.role || firstPR.requested_by_designation,
        department,
        items: fetched.flatMap(pr => (pr.items || []).map((item: any) => ({
          ...item,
          source_pr_no: pr.pr_no,
          total_cost: Number(item.quantity || 0) * Number(item.unit_cost || 0)
        })))
      });
      setBulkPrintPRs([{ id: `consolidated-${Date.now()}` }]);
    } catch (e) {
      showAlert('error', 'Error compiling bulk Purchase Requests details for print');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkPrintPOs = async () => {
    if (visiblePOs.length === 0) {
      return showAlert('error', 'No visible Purchase Orders to print under current filter settings.');
    }
    try {
      setLoading(true);
      const fetched = await Promise.all(
        visiblePOs.map(po => apiFetch(`/api/po/${po.id}`).then(res => res.json()))
      );
      setBulkPrintPOs(fetched);
    } catch (e) {
      showAlert('error', 'Error compiling bulk Purchase Orders details for print');
    } finally {
      setLoading(false);
    }
  };

  // View Details functions
  const openPRDetails = async (prId: number) => {
    try {
      const r = await apiFetch(`/api/pr/${prId}`).then(res => res.json());
      const audit = await apiFetch(`/api/pr/${prId}/audit`).then(res => res.json());
      setSelectedPR({ ...r, audit, department: departments.find(item => Number(item.id) === Number(r.department_id)) });
    } catch (e) {
      showAlert('error', 'Error fetching PR details');
    }
  };

  const openTransactionWorkspace = async (pr: any) => {
    try {
      const details = await apiFetch(`/api/pr/${pr.id}`).then(res => res.json());
      const audit = await apiFetch(`/api/pr/${pr.id}/audit`).then(res => res.json());
      setWorkspacePR({ ...details, audit, department: departments.find(item => Number(item.id) === Number(details.department_id)) });
      setTransactionSearch('');
    } catch (e) {
      showAlert('error', 'Error loading transaction workspace.');
    }
  };

  const loadPRTracker = async (pr: any) => {
    try {
      const details = await apiFetch(`/api/pr/${pr.id}`).then(res => res.json());
      setActivePRTracker({ ...pr, ...details });
    } catch {
      setActivePRTracker(pr);
      showAlert('error', 'Unable to load the complete procurement tracker.');
    }
  };

  const savePRForm = async (pr: any, setter: (value: any) => void) => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/pr/${pr.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          pr_no: pr.pr_no,
          date: pr.date,
          section: pr.section,
          purpose: pr.purpose,
          requested_by_name: pr.requested_by_name,
          requested_by_designation: pr.requested_by_designation,
          items: pr.items
        })
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || 'Unable to save Purchase Request.');
      setter({ ...pr, ...saved });
      showAlert('success', `Purchase Request ${saved.pr_no} saved successfully.`);
      await fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Unable to save Purchase Request.');
    } finally {
      setLoading(false);
    }
  };

  const openPODetails = async (poId: number) => {
    try {
      const r = await apiFetch(`/api/po/${poId}`).then(res => res.json());
      setSelectedPO(r);
    } catch (e) {
      showAlert('error', 'Error fetching PO details');
    }
  };

  const openNTPDetails = async (poId: number) => {
    try {
      const r = await apiFetch(`/api/po/${poId}`).then(res => res.json());
      setSelectedNTP(r);
    } catch (e) {
      showAlert('error', 'Error fetching Notice to Proceed details');
    }
  };

  const openIARDetails = async (iarId: number) => {
    try {
      const r = await apiFetch(`/api/iar/${iarId}`).then(res => res.json());
      setSelectedIAR(r);
    } catch (e) {
      showAlert('error', 'Error fetching IAR details');
    }
  };

  if (!token || !currentUser) {
    return (
      <div className="login-shell min-h-screen flex items-center justify-center p-4 font-sans">
        <div className="login-panel w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/70 overflow-hidden grid lg:grid-cols-[1.05fr_0.95fr] relative z-10">
          <section className="login-visual p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[240px] lg:min-h-[600px]">
            <div>
              {logoData || systemSettings?.logo_data ? (
                <img src={logoData || systemSettings?.logo_data} alt="System logo" className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-contain bg-white p-3 shadow-md ring-1 ring-blue-100" />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-3xl flex items-center justify-center font-bold text-blue-700 text-lg shadow-sm ring-1 ring-blue-100">
                  GSO
                </div>
              )}
              <p className="mt-8 text-xs font-bold text-blue-700 uppercase tracking-[0.2em]">{systemSettings?.municipal_name || 'Municipality of Cainta'}</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight max-w-md">Procurement made clear.</h1>
              <p className="mt-4 text-sm leading-6 text-slate-600 max-w-sm">A secure workspace for planning, purchasing, approvals, and public service delivery.</p>
            </div>
            <div className="hidden lg:block mt-10">
              <div className="flex items-center gap-3 text-slate-600 text-xs font-semibold">
                <ShieldCheck size={18} className="text-blue-700" />
                <span>COA Guidelines & RA 9184 compliant workflow</span>
              </div>
            </div>
          </section>

          <section className="p-8 sm:p-12 lg:p-14 flex flex-col justify-center">
            <div className="mb-8">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.18em]">Secure access</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">Sign in to your procurement portal.</p>
            </div>

          {authError && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">LGU Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-colors"
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Security Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl pl-4 pr-11 py-3 text-sm placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-colors"
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-700/20 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in to portal'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            <span>or</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
            <div ref={googleButtonRef} className="min-h-10 w-full" aria-label="Continue with Google" />
          ) : (
            <button
              type="button"
              onClick={() => setAuthError('Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to .env.local.')}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-xs font-bold text-blue-600">G</span>
              Continue with Google
            </button>
          )}
          <button
            type="button"
            onClick={() => { setResetOpen(true); setAuthError(null); }}
            className="mt-4 w-full text-xs font-bold text-blue-700 hover:text-blue-900"
          >
            Forgot password?
          </button>

          {resetOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 flex items-center justify-center">
              <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Account recovery</p><h3 className="mt-1 text-xl font-bold text-slate-900">Reset your password</h3></div>
                  <button type="button" onClick={() => setResetOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close password reset"><X size={18} /></button>
                </div>
                {!resetSent ? (
                  <form onSubmit={requestPasswordReset} className="space-y-4">
                    <p className="text-sm leading-6 text-slate-500">Enter the email assigned to your authorized system account. We will send a six-digit code through Gmail.</p>
                    <input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{loading ? 'Sending code...' : 'Send email code'}</button>
                  </form>
                ) : (
                  <form onSubmit={completePasswordReset} className="space-y-4">
                    <p className="text-sm leading-6 text-slate-500">Check your inbox for the six-digit verification code. It expires in 10 minutes.</p>
                    <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={resetOtp} onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl tracking-[0.35em] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    <input type="password" minLength={8} required value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-700 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{loading ? 'Updating password...' : 'Reset password'}</button>
                    <button type="button" onClick={() => setResetSent(false)} className="w-full text-xs font-bold text-slate-500 hover:text-slate-800">Use a different email</button>
                  </form>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-2 text-slate-500">
            <ShieldCheck size={15} className="text-blue-700 flex-shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Protected municipal system</span>
          </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white">
      {/* Sidebar Navigation */}
      <button
        type="button"
        aria-label="Close navigation"
        className={`mobile-nav-backdrop print:hidden ${mobileNavOpen ? 'is-open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className={`app-sidebar w-64 bg-slate-900 flex-shrink-0 flex flex-col text-slate-300 print:hidden ${mobileNavOpen ? 'is-open' : ''}`}>
        <div className="app-brand p-5 flex items-center gap-3 border-b border-slate-800 bg-slate-950">
          {systemSettings?.logo_data || logoData ? (
            <img src={systemSettings?.logo_data || logoData} alt="System logo" className="w-12 h-12 rounded-2xl object-contain bg-white p-1" />
          ) : (
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-white uppercase text-xs shadow-md shadow-blue-900/20">GSO</div>
          )}
          <div>
            <h1 className="text-slate-100 font-bold text-sm leading-tight tracking-tight">{systemSettings?.system_name || "GovProcure MS"}</h1>
            <p className="text-slate-500 text-[9px] uppercase tracking-wider font-bold mt-0.5">{systemSettings?.municipal_name || "Municipality of Cainta"}</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto" onClick={() => setMobileNavOpen(false)}>
          {canAccessTab('supplier') && (
            <button
              onClick={() => { setActiveTab('supplier'); setSelectedPR(null); setSelectedPO(null); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'supplier' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Send size={14} />
              <span>Supplier Portal</span>
            </button>
          )}
          {['planning', 'pr'].some(t => canAccessTab(t)) && (
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Procurement Pipeline</div>
          )}

          {canAccessTab('planning') && (
            <button
              onClick={() => { setActiveTab('planning'); setSelectedPR(null); setSelectedPO(null); setMobileNavOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'planning' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Layers size={14} />
              <span>Planning (APP/PPMP)</span>
            </button>
          )}

          {canAccessTab('pr') && (
            <button
              onClick={() => { setActiveTab('pr'); setSelectedPR(null); setSelectedPO(null); setMobileNavOpen(false); }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'pr' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <div className="flex items-center gap-3">
                <FileText size={14} />
                <span>Requisitions (PR)</span>
              </div>
              {notificationCount > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  {notificationCount}
                </span>
              )}
            </button>
          )}

          {['rfq', 'bidding', 'bac', 'po'].some(t => canAccessTab(t)) && (
            <div className="pt-4 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Awards & Solicitation</div>
          )}

          {canAccessTab('rfq') && (
            <button
              onClick={() => { setActiveTab('rfq'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'rfq' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Send size={14} />
              <span>RFQ & Solicitation</span>
            </button>
          )}

          {canAccessTab('bidding') && (
            <button
              onClick={() => { setActiveTab('bidding'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'bidding' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <FileSpreadsheet size={14} />
              <span>Bidding & Abstract</span>
            </button>
          )}

          {canAccessTab('bac') && (
            <button
              onClick={() => { setActiveTab('bac'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'bac' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Award size={14} />
              <span>BAC Awards & Resolutions</span>
            </button>
          )}

          {canAccessTab('po') && (
            <button
              onClick={() => { setActiveTab('po'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'po' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <ClipboardList size={14} />
              <span>Contracts (PO/NTP)</span>
            </button>
          )}

          {canAccessTab('payments') && (
            <button
              onClick={() => { setActiveTab('payments'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'payments' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <CheckCircle2 size={14} />
              <span>Payments & Disbursements</span>
            </button>
          )}

          {['iar', 'inventory'].some(t => canAccessTab(t)) && (
            <div className="pt-4 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset Monitoring</div>
          )}

          {canAccessTab('iar') && (
            <button
              onClick={() => { setActiveTab('iar'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'iar' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Truck size={14} />
              <span>Inspections (IAR)</span>
            </button>
          )}

          {canAccessTab('inventory') && (
            <button
              onClick={() => { setActiveTab('inventory'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'inventory' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <ShieldCheck size={14} />
              <span>Property Tags (ICS/PAR)</span>
            </button>
          )}

          {canAccessTab('distribution') && (
            <button
              onClick={() => { setActiveTab('distribution'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'distribution' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Truck size={14} />
              <span>Asset Distribution (RIS)</span>
            </button>
          )}

          {canAccessTab('disposal') && (
            <button
              onClick={() => { setActiveTab('disposal'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'disposal' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <RefreshCw size={14} />
              <span>Disposal (IIRUP)</span>
            </button>
          )}

          <div className="pt-4 px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Compliance & Audit</div>

          {canAccessTab('audit') && (
            <button
              onClick={() => { setActiveTab('audit'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'audit' ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Clock size={14} />
              <span>LGU Audit Trail</span>
            </button>
          )}

          {canAccessTab('analytics') && (
            <button
              onClick={() => { setActiveTab('analytics'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'analytics' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <BarChart3 size={14} />
              <span>Procurement Analytics</span>
            </button>
          )}

          {canAccessTab('settings') && (
            <button
              onClick={() => { setActiveTab('settings'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Settings size={14} />
              <span>System Settings</span>
            </button>
          )}

          {canAccessTab('users') && (
            <button
              onClick={() => { setActiveTab('users'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'users' ? 'bg-violet-600 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Users size={14} />
              <span>User Management</span>
            </button>
          )}

          {canAccessTab('admin') && (
            <button
              onClick={() => { setActiveTab('admin'); setSelectedPR(null); setSelectedPO(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all ${activeTab === 'admin' ? 'bg-red-700 text-white font-medium shadow-sm' : 'text-slate-300 hover:bg-slate-800 border border-dashed border-red-800/40'}`}
            >
              <Archive size={14} />
              <span>Admin Ledger &amp; Cleanup</span>
            </button>
          )}
        </nav>

        <div className="app-sidebar-footer p-4 border-t border-slate-800 bg-slate-950 flex flex-col gap-2">
          {currentUser && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white uppercase">
                  {currentUser.name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono leading-none">{currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-center bg-rose-950/40 border border-rose-900/30 text-rose-300 hover:bg-rose-950/70 py-1 rounded text-[10px] transition-colors font-semibold mt-1"
              >
                Sign Out / Exit Portal
              </button>
            </>
          )}
          <button
            onClick={fetchData}
            className="mt-1 w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2 rounded text-[10px] transition-colors"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            <span>Reload LGU Ledger</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="app-main flex-1 flex flex-col min-w-0 overflow-hidden print:hidden">
        {/* Top Header */}
        <header className="app-header h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
              className="mobile-menu-button"
              onClick={() => setMobileNavOpen(open => !open)}
            >
              {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <div>
            <p className="app-eyebrow text-[10px] font-bold text-blue-700 uppercase tracking-[0.16em] mb-1">Procurement workspace</p>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              {activeTab === 'planning' && 'Project Procurement Planning (PPMP / APP)'}
              {activeTab === 'pr' && 'Purchase Request (PR) Directory'}
              {activeTab === 'rfq' && 'Request For Quotation (RFQ) Solicitation'}
              {activeTab === 'bidding' && 'Abstract of Canvass (AOC) Matrix'}
              {activeTab === 'bac' && 'BAC Committee Resolutions'}
              {activeTab === 'po' && 'Purchase Order (PO) & NTP Contracts'}
              {activeTab === 'payments' && 'Payment Verification & Disbursement Workspace'}
              {activeTab === 'iar' && 'Inspection and Acceptance Report (IAR)'}
              {activeTab === 'inventory' && 'Property Inventory & Distribution (ICS / PAR)'}
              {activeTab === 'distribution' && 'Asset Distribution — Requisition & Issuance Slip (RIS)'}
              {activeTab === 'disposal' && 'Property Disposal — Inventory & Inspection Report of Unserviceable Property (IIRUP)'}
              {activeTab === 'audit' && 'System Audit Trail & LGU Logs'}
              {activeTab === 'analytics' && 'Strategic Procurement Spending Analytics'}
              {activeTab === 'settings' && 'System Configuration & Signatories'}
              {activeTab === 'users' && 'User Account Administration'}
              {activeTab === 'admin' && 'Admin Ledger & Data Management'}
              {activeTab === 'supplier' && 'Supplier Quotation Portal'}
            </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden lg:block w-64">
              <input
                value={transactionSearch}
                onChange={e => setTransactionSearch(e.target.value)}
                placeholder="Search transactions..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                aria-label="Search transactions"
              />
              {transactionMatches.length > 0 && (
                <div className="absolute top-full right-0 mt-2 z-40 w-80 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                  {transactionMatches.map(pr => {
                    const po = pos.find(item => Number(item.pr_id) === Number(pr.id));
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => openTransactionWorkspace(pr)}
                        className="w-full text-left px-3 py-2.5 border-b border-slate-100 last:border-b-0 hover:bg-blue-50 transition-colors"
                      >
                        <span className="block font-mono text-[11px] font-bold text-slate-900">{pr.pr_no}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{pr.purpose} · {po?.po_no || 'No PO yet'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(open => !open)}
                className="relative bg-slate-100 border border-slate-200 rounded-lg p-2 hover:bg-slate-50 transition-colors"
                aria-label="View notifications"
              >
                <Bell size={16} className="text-slate-700" />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[420px] overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-2xl z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Notifications</p>
                      <span className="text-xs font-bold text-slate-900">{notificationCount} unread</span>
                    </div>
                    <button type="button" onClick={markAllNotificationsRead} className="text-[10px] font-bold text-blue-700 hover:text-blue-900">Mark all read</button>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">No notifications yet.</div>
                    ) : (
                      notifications.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => markNotificationRead(Number(item.id))}
                          className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-blue-50 transition-colors ${item.is_read ? 'bg-white' : 'bg-blue-50/70'}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-900 truncate">{item.title || 'Procurement Notification'}</p>
                              <p className="text-[10px] text-slate-600 leading-5">{item.message}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[9px] uppercase tracking-wide text-slate-400">{item.target_role || item.role || 'Role-based'}</span>
                                <span className="text-[9px] text-slate-400">{new Date(item.created_at || new Date()).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] bg-slate-100 font-mono text-slate-600 py-1 px-2 rounded border border-slate-200 uppercase">
              COA / RA 9184 Standard Edition
            </span>
            {canManageSuppliers() && (
              <button
                onClick={() => setShowSupplierModal(true)}
                className="bg-blue-700 text-white font-semibold text-xs py-2 px-3.5 rounded-lg hover:bg-blue-800 transition-colors shadow-sm shadow-blue-700/15"
              >
                + Register Supplier
              </button>
            )}
          </div>
        </header>

        {/* Global Notifications Alert */}
        {alert && (
          <div className={`p-3.5 border-b flex items-center gap-2.5 text-xs font-semibold ${alert.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'}`}>
            {alert.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
            <p>{alert.message}</p>
          </div>
        )}

        {/* Main Content Split Panels or Tables */}
        <div className="app-content flex-1 flex min-h-0 overflow-hidden">

          {activeTab === 'supplier' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Supplier Portal</h3>
                <p className="text-xs text-slate-500">Review invited RFQs, submit one complete quotation, and keep your submission time-stamped in the abstract.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {supplierRfqs.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">No RFQ invitations are available.</div>
                ) : supplierRfqs.map(rfq => (
                  <div key={rfq.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono font-bold text-slate-900">{rfq.rfq_no}</p>
                        <p className="text-xs text-slate-500">PR: {rfq.pr_no}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded border bg-blue-50 text-blue-700 border-blue-100">{rfq.invitation_status}</span>
                    </div>
                    <p className="text-xs text-slate-600">Quotation deadline: <strong>{rfq.close_date}</strong></p>
                    <div className="grid grid-cols-2 gap-2">
                      {rfq.invitation_status === 'Invited' && (
                        <button type="button" onClick={() => acceptSupplierRfq(rfq.id)} disabled={rfq.status !== 'Published'} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg">Accept Invitation</button>
                      )}
                      <button type="button" onClick={() => openSupplierRfq(rfq.id)} disabled={rfq.status !== 'Published' || rfq.invitation_status === 'Invited'} className={`${rfq.invitation_status === 'Invited' ? 'col-span-2' : 'col-span-1'} bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg`}>View RFQ and Submit Quotation</button>
                    </div>
                  </div>
                ))}
              </div>
              {activeSupplierRfq && (
                <form onSubmit={submitSupplierQuotation} className="bg-white border border-emerald-200 rounded-xl p-5 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div><h4 className="text-sm font-bold text-emerald-800">Quotation for {activeSupplierRfq.rfq_no}</h4><p className="text-[10px] text-slate-500">All RFQ items are required before submission.</p></div>
                    <button type="button" onClick={() => setActiveSupplierRfq(null)} className="text-slate-400 text-xs font-bold">Close</button>
                  </div>
                  <div className="space-y-2">
                    {activeSupplierRfq.items.map((item: any) => (
                      <div key={item.pr_item_id} className="grid grid-cols-[1fr_150px] gap-3 items-center bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div><p className="text-xs font-semibold text-slate-800">{item.description}</p><p className="text-[10px] text-slate-500">{item.quantity} {item.unit}</p></div>
                        <input type="number" min="0" step="0.01" required value={supplierQuotePrices[Number(item.pr_item_id)] || ''} onChange={e => setSupplierQuotePrices(prev => ({ ...prev, [Number(item.pr_item_id)]: e.target.value }))} className="border border-slate-200 rounded p-2 text-xs font-mono" placeholder="Unit price" />
                      </div>
                    ))}
                  </div>
                  <textarea value={supplierQuoteRemarks} onChange={e => setSupplierQuoteRemarks(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs" rows={3} placeholder="Quotation remarks and delivery terms" />
                  <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg">Submit Quotation</button></div>
                </form>
              )}
            </div>
          )}

          {/* TAB 1: PLANNING (PPMP & APP) */}
          {activeTab === 'planning' && (() => {
            const filteredPPMPItems = ppmpItems.filter(item => {
              const matchesSearch = !ppmpSearchQuery ||
                item.description.toLowerCase().includes(ppmpSearchQuery.toLowerCase()) ||
                item.category.toLowerCase().includes(ppmpSearchQuery.toLowerCase()) ||
                item.mode_of_procurement.toLowerCase().includes(ppmpSearchQuery.toLowerCase());
              const matchesDept = !ppmpDeptFilter || ppmpDeptFilter === 'all' || String(item.department_id) === ppmpDeptFilter;
              return matchesSearch && matchesDept;
            });
            const totalBudget = ppmpItems.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
            const totalQty = ppmpItems.reduce((sum, item) => sum + Number(item.total_qty || 0), 0);
            const uniqueDepts = new Set(ppmpItems.map(i => i.department_id)).size;

            return (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Header & Primary Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">Project Procurement Planning (PPMP / APP)</h3>
                    <p className="text-xs text-slate-500">Encode itemized annual departmental needs. System consolidates them into the LGU Master Annual Procurement Plan.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-indigo-50 text-indigo-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-100 font-mono">
                      Consolidated Budget: {formatPesos(totalBudget)}
                    </span>
                    <button
                      onClick={() => {
                        if (currentUser?.department_id) {
                          setNewPpmp(prev => ({ ...prev, department_id: String(currentUser.department_id) }));
                        }
                        setIsCreatePPMPOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>Add Planned Item</span>
                    </button>
                  </div>
                </div>

                {/* KPI Metrics Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Items</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">{ppmpItems.length}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">{totalQty} total units enrolled</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Layers size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Participating Offices</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">{uniqueDepts}</h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">out of {departments.length} departments</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <ClipboardList size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Supplies / Mat.</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                        {ppmpItems.filter(i => i.category === 'Supplies').length}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {formatPesos(ppmpItems.filter(i => i.category === 'Supplies').reduce((s, i) => s + Number(i.total_cost || 0), 0))}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                      <Send size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Capital Equipment</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                        {ppmpItems.filter(i => i.category === 'Equipment').length}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {formatPesos(ppmpItems.filter(i => i.category === 'Equipment').reduce((s, i) => s + Number(i.total_cost || 0), 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Budget Utilization & Calendar Overview */}
                <div className="space-y-6">
                  <BudgetUtilizationDashboard
                    departments={departments}
                    ppmpItems={ppmpItems}
                    prs={prs}
                  />

                  <CalendarView events={[
                    ...prs.map(pr => ({
                      date: new Date(pr.created_at || pr.date || Date.now()),
                      title: `PR: ${pr.pr_no}`,
                      type: 'deadline' as const,
                      reference: pr.pr_no,
                      purpose: pr.purpose,
                      requestedBy: pr.requested_by_name,
                      department: pr.department_name || pr.department_code,
                      status: pr.status
                    })),
                    ...rfqs.map(rfq => {
                      const linkedPR = prs.find(pr => pr.id === rfq.pr_id);
                      return {
                        date: new Date(rfq.open_date || rfq.created_at || Date.now()),
                        title: `Bid: ${rfq.rfq_no}`,
                        type: 'bid_opening' as const,
                        reference: linkedPR?.pr_no || rfq.pr_no || rfq.rfq_no,
                        purpose: linkedPR?.purpose,
                        requestedBy: linkedPR?.requested_by_name,
                        department: linkedPR?.department_name || linkedPR?.department_code || rfq.department_name,
                        status: rfq.status
                      };
                    }),
                    ...pos.map(po => {
                      const linkedPR = prs.find(pr => pr.id === po.pr_id);
                      return {
                        date: new Date(po.created_at || Date.now()),
                        title: `PO: ${po.po_no}`,
                        type: 'delivery' as const,
                        reference: linkedPR?.pr_no || po.po_no,
                        purpose: linkedPR?.purpose,
                        requestedBy: linkedPR?.requested_by_name || po.requested_by_name,
                        department: linkedPR?.department_name || linkedPR?.department_code,
                        status: po.status
                      };
                    }),
                  ]} />
                </div>

                {/* Filter Toolbar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial min-w-[240px]">
                      <input
                        type="text"
                        value={ppmpSearchQuery}
                        onChange={(e) => setPpmpSearchQuery(e.target.value)}
                        placeholder="Search item description, category, mode..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 pl-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                    <select
                      value={ppmpDeptFilter}
                      onChange={(e) => setPpmpDeptFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer font-semibold"
                    >
                      <option value="">All Departments</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                    {(ppmpSearchQuery || ppmpDeptFilter) && (
                      <button
                        onClick={() => { setPpmpSearchQuery(''); setPpmpDeptFilter(''); }}
                        className="text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer underline decoration-dotted"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Showing {filteredPPMPItems.length} of {ppmpItems.length} planned items
                  </span>
                </div>

                {/* Full-Width Master APP Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                          <th className="p-3.5">Ref ID</th>
                          <th className="p-3.5">Department</th>
                          <th className="p-3.5">Category</th>
                          <th className="p-3.5">Item Description</th>
                          <th className="p-3.5">Procurement Mode</th>
                          <th className="p-3.5 text-center">Unit</th>
                          <th className="p-3.5 text-right">Unit Price</th>
                          <th className="p-3.5 text-center">Total Qty</th>
                          <th className="p-3.5 text-right">Estimated ABC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPPMPItems.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                              No PPMP items match the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredPPMPItems.map(item => {
                            const dept = departments.find(d => d.id === item.department_id);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3.5 font-mono text-slate-400">#P-{String(item.id).padStart(4, '0')}</td>
                                <td className="p-3.5 font-semibold text-slate-800">{dept ? `${dept.name} (${dept.code})` : 'GSO'}</td>
                                <td className="p-3.5">
                                  <span className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${item.category === 'Supplies' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    item.category === 'Equipment' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-purple-50 text-purple-700 border-purple-200'
                                    }`}>
                                    {item.category}
                                  </span>
                                </td>
                                <td className="p-3.5 font-medium text-slate-800 max-w-md">{item.description}</td>
                                <td className="p-3.5 text-slate-600 font-medium">{item.mode_of_procurement}</td>
                                <td className="p-3.5 text-center text-slate-500 font-medium">{item.unit}</td>
                                <td className="p-3.5 text-right font-mono text-slate-700">{formatPesos(item.unit_cost)}</td>
                                <td className="p-3.5 text-center font-bold text-slate-800">{item.total_qty}</td>
                                <td className="p-3.5 text-right font-mono font-bold text-blue-900">{formatPesos(item.total_cost)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Slide-Over Drawer / Modal for Add Planned Item */}
                {isCreatePPMPOpen && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
                    <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col p-6 overflow-y-auto space-y-5 animate-in slide-in-from-right duration-200">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold uppercase text-slate-800 tracking-wider">Encode Planned Item (PPMP)</h3>
                          <p className="text-xs text-slate-500">Add an approved annual budget line item to the master plan.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCreatePPMPOpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleCreatePPMP} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">End-User Department / Office</label>
                          <select
                            value={newPpmp.department_id}
                            onChange={(e) => setNewPpmp({ ...newPpmp, department_id: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            required
                          >
                            <option value="">-- Choose Department --</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Fiscal Year</label>
                            <select
                              value={newPpmp.year}
                              onChange={(e) => setNewPpmp({ ...newPpmp, year: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            >
                              <option value="2026">2026 (Active)</option>
                              <option value="2027">2027</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                            <select
                              value={newPpmp.category}
                              onChange={(e) => setNewPpmp({ ...newPpmp, category: e.target.value as any })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            >
                              <option value="Supplies">Supplies / Materials</option>
                              <option value="Equipment">Capital Equipment</option>
                              <option value="Infra">Civil Works / Infra</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Item Specification / Description</label>
                          <textarea
                            value={newPpmp.description}
                            onChange={(e) => setNewPpmp({ ...newPpmp, description: e.target.value })}
                            rows={3}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            placeholder="e.g. Heavy Duty Digital Photocopier machine with automatic document feeder"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Unit of Measure</label>
                            <input
                              type="text"
                              value={newPpmp.unit}
                              onChange={(e) => setNewPpmp({ ...newPpmp, unit: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                              placeholder="e.g. box, ream, unit"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Estimated Unit Cost</label>
                            <input
                              type="number"
                              value={newPpmp.unit_cost}
                              onChange={(e) => setNewPpmp({ ...newPpmp, unit_cost: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono text-blue-700 font-bold"
                              placeholder="₱ Rate"
                              required
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Quarterly Quantity Schedule</span>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Q1</span>
                              <input
                                type="number"
                                value={newPpmp.q1_qty}
                                onChange={(e) => setNewPpmp({ ...newPpmp, q1_qty: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded p-1.5 text-center text-xs font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Q2</span>
                              <input
                                type="number"
                                value={newPpmp.q2_qty}
                                onChange={(e) => setNewPpmp({ ...newPpmp, q2_qty: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded p-1.5 text-center text-xs font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Q3</span>
                              <input
                                type="number"
                                value={newPpmp.q3_qty}
                                onChange={(e) => setNewPpmp({ ...newPpmp, q3_qty: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded p-1.5 text-center text-xs font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Q4</span>
                              <input
                                type="number"
                                value={newPpmp.q4_qty}
                                onChange={(e) => setNewPpmp({ ...newPpmp, q4_qty: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded p-1.5 text-center text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Procurement Mode</label>
                            <select
                              value={newPpmp.mode_of_procurement}
                              onChange={(e) => setNewPpmp({ ...newPpmp, mode_of_procurement: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                            >
                              <option value="Shopping">Shopping</option>
                              <option value="Small Value Procurement">Small Value Procurement</option>
                              <option value="Public Bidding">Public Bidding</option>
                              <option value="Direct Contracting">Direct Contracting</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Source of Funds</label>
                            <input
                              type="text"
                              value={newPpmp.source_of_funds}
                              onChange={(e) => setNewPpmp({ ...newPpmp, source_of_funds: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                              placeholder="General Fund"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsCreatePPMPOpen(false)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Plus size={16} />
                            <span>Save Item to PPMP</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 2: PURCHASE REQUESTS (PR) */}
          {activeTab === 'pr' && (() => {
            const activeTrackerPR = activePRTracker
              ? prs.find(pr => pr.id === activePRTracker.id) || activePRTracker
              : (prs.length > 0 ? prs[0] : null);
            const trackerLinks = activeTrackerPR?.linkedRecords || {};
            const linkedTrackerRFQ = trackerLinks.rfqs?.[0] || rfqs.find(rfq => Number(rfq.pr_id) === Number(activeTrackerPR?.id));
            const linkedTrackerPO = trackerLinks.pos?.[0] || pos.find(po => Number(po.pr_id) === Number(activeTrackerPR?.id));
            const linkedTrackerIAR = trackerLinks.iars?.[0] || (linkedTrackerPO ? iars.find(iar => Number(iar.po_id) === Number(linkedTrackerPO.id)) : null);
            const linkedTrackerNOA = trackerLinks.noas?.[0] || noas.find(noa => Number(noa.pr_id) === Number(activeTrackerPR?.id) || Number(noa.rfq_id) === Number(linkedTrackerRFQ?.id));
            const trackerBACComplete = Boolean(linkedTrackerNOA || linkedTrackerRFQ?.status === 'Closed');
            const trackerIsPreApproval = Boolean(activeTrackerPR && ['Draft', 'Submitted', 'Pending', 'Budget_Review', 'GSO_Review', 'For_Approval'].includes(activeTrackerPR.status));
            const trackerStage = trackerIsPreApproval
              ? (activeTrackerPR.status === 'Budget_Review' ? 'Budget_Review' : ['GSO_Review', 'For_Approval'].includes(activeTrackerPR.status) ? 'GSO_Review' : 'Draft')
              : !linkedTrackerRFQ ? 'RFQ' : !trackerBACComplete ? 'RFQ' : !linkedTrackerPO ? 'BAC' : !linkedTrackerIAR ? 'PO' : 'IAR';
            const trackerStageIndex = PR_TRACKER_STEPS.findIndex(step => step.key === trackerStage);
            const totalEstimatedPRSum = newPR.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
            const actionablePRs = prs.filter(pr => {
              const workflow = getPRWorkflow(pr.status);
              if (!workflow.actionable || !workflow.responsibleRoles.includes(currentUser?.role || '')) return false;
              return currentUser?.role !== 'End User' || Number(pr.department_id) === Number(currentUser.department_id);
            });

            return (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Top Header with Primary Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">Purchase Request (PR) Directory</h3>
                    <p className="text-xs text-slate-500">Monitor requisition lifecycle, track funding certifications, and issue new purchase requests against approved PPMP budgets.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsCreatePROpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>New Purchase Request</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 text-slate-100 rounded-xl p-3 border border-slate-700 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                    <span>Procurement Flow:</span>
                    {PR_STATUS_FLOW.map((status, index) => (
                      <React.Fragment key={status}>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100">
                          {index + 1}. {formatPRStatus(status)}
                        </span>
                        {index < PR_STATUS_FLOW.length - 1 && <ChevronRight size={12} className="text-slate-500" />}
                      </React.Fragment>
                    ))}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100">→ RFQ → BAC → PO → IAR</span>
                  </div>
                </div>

                {/* PR Tab KPI Cards Section */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Pending PRs */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Pending PRs</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                        {prs.filter(p => ['Pending', 'Budget_Review', 'GSO_Review', 'For_Approval'].includes(p.status)).length}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {prs.filter(p => p.status === 'Pending').length} awaiting validation / budget
                      </p>
                    </div>
                  </div>

                  {/* Card 2: Approved Requisitions */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Approved PRs</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                        {prs.filter(p => p.status === 'Approved').length}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {prs.filter(p => p.status === 'Approved' && !rfqs.some(r => r.pr_id === p.id)).length} ready for RFQ
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Active Contracts */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <ClipboardList size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Active Contracts</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                        {pos.filter(po => po.status !== 'Cancelled' && po.status !== 'Fully_Delivered').length}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        {pos.filter(po => po.status === 'Signed' || po.status === 'Issued').length} ongoing execution
                      </p>
                    </div>
                  </div>

                  {/* Card 4: Avg Cycle Time */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                      <Clock size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Avg. Cycle Time</p>
                      <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                        {calculateAvgCycleTime()}
                      </h4>
                      <p className="text-[10px] text-slate-500 truncate mt-1">
                        COA RA 9184 standards
                      </p>
                    </div>
                  </div>
                </div>

                <section className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Needs your action</h4>
                      <p className="text-xs text-slate-500 mt-1">The next responsible step is shown for each active request.</p>
                    </div>
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase">{actionablePRs.length} open</span>
                  </div>
                  {actionablePRs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No purchase requests currently require your action.</p>
                  ) : (
                    <div className="grid gap-2 lg:grid-cols-2">
                      {actionablePRs.slice(0, 6).map(pr => {
                        const workflow = getPRWorkflow(pr.status);
                        return (
                          <button key={pr.id} type="button" onClick={() => { loadPRTracker(pr); setActiveTab('pr'); }} className="text-left border border-slate-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-xs font-bold text-slate-900">{pr.pr_no}</span>
                              <span className="text-[10px] font-bold text-blue-700 uppercase">{formatPRStatus(pr.status)}</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 mt-2">{workflow.nextAction}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Current step: {workflow.currentStep} · Required: {workflow.requiredDocument}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Optional Interactive Active Tracker Banner */}
                {activeTrackerPR && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200 text-xs font-bold font-mono">
                          Live Tracker: {activeTrackerPR.pr_no}
                        </span>
                        <span className="text-xs text-slate-600 font-medium">{activeTrackerPR.department_name || activeTrackerPR.department_code} — {activeTrackerPR.purpose}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Current Status:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${activeTrackerPR.status === 'Pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          activeTrackerPR.status === 'Budget_Review' ? 'bg-violet-100 text-violet-800 border border-violet-200' :
                            activeTrackerPR.status === 'GSO_Review' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                              activeTrackerPR.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                          {formatPRStatus(activeTrackerPR.status)}
                        </span>
                      </div>
                    </div>

                    {/* Step-by-step tracker stays aligned with the canonical PR status flow. */}
                    <div className="relative overflow-x-auto pb-1">
                      <div className="absolute left-[6.25%] right-[6.25%] top-5 h-0.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-600 to-emerald-500 transition-all duration-700 ease-out"
                          style={{ width: `${Math.max(12, ((trackerStageIndex + 1) / PR_TRACKER_STEPS.length) * 100)}%` }}
                        />
                      </div>
                      <div className="relative z-10 grid min-w-[920px] grid-cols-8 text-center">
                        {PR_TRACKER_STEPS.map((step, index) => {
                          const isComplete = trackerStageIndex >= index;
                          const isCurrent = trackerStage === step.key;
                          return (
                            <button
                              key={step.key}
                              type="button"
                              onClick={() => {
                                loadPRTracker(activeTrackerPR);
                                if (step.tab === 'pr') setPrStatusFilter(step.key === 'Draft' ? 'Draft' : step.key);
                                else setActiveTab(step.tab as typeof activeTab);
                              }}
                              className="group flex min-w-0 flex-col items-center px-2"
                              title={`Show ${step.label} requests`}
                            >
                              <span className={`relative flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold shadow-sm transition-all duration-300 ease-out ${isCurrent
                                ? 'border-blue-700 bg-blue-600 text-white ring-4 ring-blue-100 animate-[trackerPulse_1.8s_ease-in-out_infinite]'
                                : isComplete
                                  ? 'border-blue-200 bg-blue-50 text-blue-700 scale-105 shadow-blue-100'
                                  : 'border-slate-200 bg-white text-slate-400 group-hover:border-blue-300 group-hover:text-blue-600 group-hover:scale-105'
                                }`}>{isComplete && !isCurrent ? '✓' : index + 1}</span>
                              <span className={`mt-2 text-[10px] font-bold uppercase tracking-tight transition-all duration-300 ${isCurrent ? 'text-blue-700' : isComplete ? 'text-slate-700' : 'text-slate-600'}`}>{step.label}</span>
                              {isCurrent && <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-500">Current</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* PR Filters & Bulk Actions Toolbar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial min-w-[260px]">
                      <input
                        type="text"
                        value={prSearchQuery}
                        onChange={(e) => setPrSearchQuery(e.target.value)}
                        placeholder="Search PR No., Department, or Purpose..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 pl-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                    <select
                      value={prStatusFilter}
                      onChange={(e) => setPrStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer font-semibold"
                    >
                      <option value="">All Statuses</option>
                      <option value="Draft">Draft</option>
                      <option value="Pending">Pending</option>
                      <option value="Budget_Review">Budget Review</option>
                      <option value="GSO_Review">GSO Review</option>
                      <option value="For_Approval">For Approval</option>
                      <option value="Approved">Approved</option>
                      <option value="Disapproved">Disapproved</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    {(prSearchQuery || prStatusFilter) && (
                      <button
                        onClick={() => { setPrSearchQuery(''); setPrStatusFilter(''); }}
                        className="text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer underline decoration-dotted"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>

                  <div className="w-full sm:w-auto flex items-center justify-end gap-3">
                    <button
                      onClick={handleBulkPrintPRs}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-lg border border-slate-200 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Consolidate Selected ({printSelectedPRIds.length})</span>
                    </button>
                  </div>
                </div>

                {/* Spacious Full-Width PR Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                          <th className="p-3.5 text-center">Print</th>
                          <th className="p-3.5">PR Number</th>
                          <th className="p-3.5">Requesting Office</th>
                          <th className="p-3.5">Section</th>
                          <th className="p-3.5">Purpose</th>
                          <th className="p-3.5 text-right">Items</th>
                          <th className="p-3.5 text-right">Estimated ABC</th>
                          <th className="p-3.5">ALOBS No.</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visiblePRs.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-slate-400 italic">No Purchase Requests found under current view settings.</td>
                          </tr>
                        ) : (
                          visiblePRs.map(pr => (
                            <tr
                              key={pr.id}
                              onClick={() => loadPRTracker(pr)}
                              className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${activeTrackerPR?.id === pr.id ? 'bg-blue-50/40' : ''}`}
                            >
                              <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={printSelectedPRIds.includes(Number(pr.id))}
                                  onChange={(e) => setPrintSelectedPRIds(current => e.target.checked
                                    ? [...current, Number(pr.id)]
                                    : current.filter(id => id !== Number(pr.id)))}
                                  disabled={!isPROwnedByCurrentUser(pr)}
                                  className="h-4 w-4 accent-blue-600 cursor-pointer"
                                  aria-label={`Select ${pr.pr_no} for consolidated print`}
                                />
                              </td>
                              <td className="p-3.5 font-mono font-bold text-slate-900">{pr.pr_no}</td>
                              <td className="p-3.5 font-semibold text-slate-800">{pr.department_name || pr.department_code}</td>
                              <td className="p-3.5 text-slate-500">{pr.section}</td>
                              <td className="p-3.5 font-medium text-slate-800 max-w-sm">{pr.purpose}</td>
                              <td className="p-3.5 text-right font-semibold text-slate-700">{pr.items_count} items</td>
                              <td className="p-3.5 text-right font-mono font-bold text-blue-900">{formatPesos(Number(pr.estimated_abc ?? pr.total_amount ?? 0))}</td>
                              <td className="p-3.5 font-mono text-[11px] text-slate-500">{pr.alobs_number || '—'}</td>
                              <td className="p-3.5">
                                <span className={`px-2.5 py-1 rounded text-[10px] font-semibold border ${pr.status === 'Draft' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                                  pr.status === 'Submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    pr.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      pr.status === 'Budget_Review' ? 'bg-violet-50 text-violet-700 border-violet-200 animate-pulse' :
                                    pr.status === 'GSO_Review' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      pr.status === 'For_Approval' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                        pr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                  {formatPRStatus(pr.status)}
                                </span>
                              </td>
                              <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => openTransactionWorkspace(pr)}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                  >
                                    <Eye size={12} /> Review
                                  </button>
                                  <button
                                    onClick={() => openPRDetails(pr.id)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                                  >
                                    <Printer size={12} /> Print
                                  </button>

                                  {['Draft', 'Pending', 'Submitted'].includes(pr.status) && (currentUser?.role === 'End User' || currentUser?.role === 'GSO Officer') && (
                                    <button onClick={() => updatePRStatus(pr.id, 'Cancelled')} className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded text-[10px] font-semibold">Cancel</button>
                                  )}
                                  {pr.status === 'Draft' && (currentUser?.role === 'End User' || currentUser?.role === 'GSO Officer') && (
                                    <button onClick={() => updatePRStatus(pr.id, 'Submitted')} className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-[10px] font-semibold">Submit</button>
                                  )}
                                  {pr.status === 'Submitted' && currentUser?.role === 'Budget Officer' && (
                                    <button onClick={() => updatePRStatus(pr.id, 'Pending')} className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded text-[10px] font-semibold">Start Budget Review</button>
                                  )}
                                  {['Budget_Review', 'GSO_Review', 'For_Approval'].includes(pr.status) && currentUser?.role === 'Mayor' && (
                                    <button onClick={() => updatePRStatus(pr.id, 'Disapproved')} className="bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 rounded text-[10px] font-semibold">Disapprove</button>
                                  )}
                                  {pr.status === 'For_Approval' && currentUser?.role === 'Mayor' && (
                                    <button onClick={() => updatePRStatus(pr.id, 'Approved')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-semibold">Approve</button>
                                  )}

                                  {pr.status === 'Pending' && currentUser?.role === 'Budget Officer' && (
                                    <button
                                      onClick={() => {
                                        setBudgetReviewPR(pr);
                                        setAlobsNumber(`ALOBS-26-07-${String(pr.id).padStart(4, '0')}`);
                                      }}
                                      className="bg-violet-600 hover:bg-violet-700 text-white px-2 py-1 rounded text-[10px] font-semibold"
                                    >
                                      Certify Budget
                                    </button>
                                  )}

                                  {pr.status === 'Budget_Review' && currentUser?.role === 'GSO Officer' && (
                                    <button onClick={() => updatePRStatus(pr.id, 'GSO_Review')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-[10px] font-semibold">Proceed to GSO Review</button>
                                  )}

                                  {pr.status === 'GSO_Review' && currentUser?.role === 'GSO Officer' && (
                                    <div className="flex gap-1">
                                      <select
                                        value={allocatedMode}
                                        onChange={(e) => setAllocatedMode(e.target.value)}
                                        className="border border-slate-200 rounded text-[10px] bg-white p-0.5"
                                      >
                                        <option value="Shopping">Shopping</option>
                                        <option value="Small Value Procurement">SVP</option>
                                        <option value="Public Bidding">Bidding</option>
                                      </select>
                                      <button
                                        onClick={() => handleGSOApproval(pr.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-1 rounded text-[10px] font-semibold"
                                      >
                                        Forward for Approval
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Slide-Over Drawer / Modal for Requisition Wizard (New PR) */}
                {isCreatePROpen && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
                    <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col p-6 overflow-y-auto space-y-5 animate-in slide-in-from-right duration-200">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="text-sm font-bold uppercase text-slate-800 tracking-wider">Purchase Requisition Wizard</h3>
                          <p className="text-xs text-slate-500">Draft a new PR with line items validated against your department's PPMP.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCreatePROpen(false)}
                          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <form onSubmit={handleCreatePR} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Requesting Office</label>
                          <select
                            value={newPR.department_id}
                            onChange={(e) => {
                              setNewPR({
                                ...newPR,
                                department_id: e.target.value,
                                items: [] // reset items on dept change to prevent cross-dept violation
                              });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            required
                          >
                            <option value="">-- Choose Department --</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Office Section</label>
                            <input
                              type="text"
                              value={newPR.section}
                              onChange={(e) => setNewPR({ ...newPR, section: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                              placeholder="e.g. Administrative, Finance, Clinic"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Purpose of Request</label>
                            <input
                              type="text"
                              value={newPR.purpose}
                              onChange={(e) => setNewPR({ ...newPR, purpose: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                              placeholder="e.g. Daily office operations"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Requested By (Name)</label>
                            <input
                              type="text"
                              value={newPR.requested_by_name}
                              onChange={(e) => setNewPR({ ...newPR, requested_by_name: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                              placeholder="e.g. Dr. Elena Perez"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Designation</label>
                            <input
                              type="text"
                              value={newPR.requested_by_designation}
                              onChange={(e) => setNewPR({ ...newPR, requested_by_designation: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                              placeholder="e.g. Officer-In-Charge"
                              required
                            />
                          </div>
                        </div>

                        {/* Fillable item entry with optional PPMP reference */}
                        <div className="border border-indigo-100 rounded-xl bg-indigo-50/50 p-4 space-y-3">
                          <div>
                            <span className="block text-xs font-bold text-indigo-900 uppercase tracking-wider">Add Request Item</span>
                            <p className="text-[11px] text-slate-500 mt-1">Fill in any item requested by the office. PPMP reference is optional.</p>
                          </div>

                          <div className="space-y-3">
                            {newPR.department_id && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Optional PPMP Item</label>
                                <select
                                  value={tempPRItem.ppmp_item_id}
                                  onChange={(e) => {
                                    const ppmp = ppmpItems.find(p => p.id === parseInt(e.target.value));
                                    setTempPRItem({
                                      ...tempPRItem,
                                      ppmp_item_id: e.target.value,
                                      unit: ppmp?.unit || tempPRItem.unit,
                                      description: ppmp?.description || tempPRItem.description,
                                      unit_cost: ppmp ? String(ppmp.unit_cost) : ''
                                    });
                                  }}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                                >
                                  <option value="">-- Manual item / no PPMP reference --</option>
                                  {ppmpItems
                                    .filter(p => p.department_id === parseInt(newPR.department_id))
                                    .map(p => (
                                      <option key={p.id} value={p.id}>{p.description} (Planned: {formatPesos(p.unit_cost)})</option>
                                    ))
                                  }
                                </select>
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Unit</label>
                                <input
                                  type="text"
                                  value={tempPRItem.unit}
                                  onChange={(e) => setTempPRItem({ ...tempPRItem, unit: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                                  placeholder="unit, box, lot"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Item Description</label>
                                <input
                                  type="text"
                                  value={tempPRItem.description}
                                  onChange={(e) => setTempPRItem({ ...tempPRItem, description: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                                  placeholder="Describe the requested item"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Requisition Qty</label>
                                  <input
                                    type="number"
                                    value={tempPRItem.quantity}
                                    onChange={(e) => setTempPRItem({ ...tempPRItem, quantity: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-center"
                                    min="1"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Estimated Unit Rate</label>
                                  <input
                                    type="number"
                                    value={tempPRItem.unit_cost}
                                    onChange={(e) => setTempPRItem({ ...tempPRItem, unit_cost: e.target.value })}
                                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono text-center text-blue-700 font-bold"
                                    placeholder="₱ Rate"
                                  />
                                </div>
                            </div>

                            <button
                              type="button"
                              onClick={handleAddPRItem}
                              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wide py-2 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Plus size={14} />
                              <span>Add Item to Request</span>
                            </button>
                          </div>
                        </div>

                        {/* Itemized Requisition List */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Itemized Requisition List</span>
                            <span className="text-xs font-bold font-mono text-blue-900">Total ABC: {formatPesos(totalEstimatedPRSum)}</span>
                          </div>

                          {newPR.items.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                              No items appended yet. Select verified PPMP items above.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {newPR.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                                  <div className="flex-1 min-w-0 pr-2">
                                    <p className="font-semibold text-slate-800 truncate">{item.description}</p>
                                    <p className="text-[11px] text-slate-500 font-mono">
                                      {item.quantity} {item.unit} × {formatPesos(item.unit_cost)} = <span className="font-bold text-slate-700">{formatPesos(item.quantity * item.unit_cost)}</span>
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePRItem(idx)}
                                    className="text-rose-600 hover:text-rose-800 text-xs font-bold p-1"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsCreatePROpen(false)}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={newPR.items.length === 0}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <Send size={15} />
                            <span>Submit Purchase Request</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 3: RFQ & SOLICITATION */}
          {activeTab === 'rfq' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 3: RFQ and Solicitation</h3>
                  <p className="text-xs text-slate-500">Every approved PR is authorized to release an official Request for Quotation (RFQ).</p>
                </div>
              </div>

              {/* RFQ Tab KPI Cards Section */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Authorized PRs */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <Layers size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Authorized PRs</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                      {prs.filter(p => p.status === 'Approved' && !rfqs.some(r => r.pr_id === p.id)).length}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      Ready for RFQ launch
                    </p>
                  </div>
                </div>

                {/* Card 2: Active RFQs */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <Send size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Active RFQs</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                      {rfqs.filter(r => r.status === 'Published').length}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      Bidding notice active
                    </p>
                  </div>
                </div>

                {/* Card 3: Closed RFQs */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Closed RFQs</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">
                      {rfqs.filter(r => r.status === 'Closed').length}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      Awaiting abstract award
                    </p>
                  </div>
                </div>

                {/* Card 4: Total Solicited Value */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Solicited ABC</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none truncate">
                      {formatPesos(rfqs.reduce((sum, rfq) => {
                        const matchingPr = prs.find(p => p.id === rfq.pr_id);
                        return sum + (matchingPr ? (matchingPr.total_amount || 0) : 0);
                      }, 0))}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-1">
                      Total budget under bid
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid: 2 columns (Authorizations, Active RFQs) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Panel A: Authorized PRs pending RFQ */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-100 pb-1.5">Authorized PRs Ready for Solicitation</h4>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {prs.filter(p => p.status === 'Approved' && !rfqs.some(r => r.pr_id === p.id)).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No approved requisitions currently waiting for RFQ launch.</p>
                    ) : (
                      prs.filter(p => p.status === 'Approved' && !rfqs.some(r => r.pr_id === p.id)).map(pr => (
                        <div key={pr.id} className="py-3 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold font-mono text-slate-900">{pr.pr_no}</p>
                            <p className="text-slate-500">{pr.department_name} • Budget: <span className="font-mono font-bold text-blue-700">{formatPesos(pr.total_amount || 0)}</span></p>
                          </div>
                          <button
                            onClick={() => {
                              setCreateRfqPR(pr);
                              // default close date to 7 days from now
                              const d = new Date();
                              d.setDate(d.getDate() + 7);
                              setRfqCloseDate(d.toISOString().split('T')[0]);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold py-1 px-3 rounded shadow-sm"
                          >
                            Launch RFQ
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Panel B: Published RFQs list */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">Currently Published RFQs (BAC Portal)</h4>
                  <div className="space-y-3">
                    {rfqs.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No RFQs published yet.</p>
                    ) : (
                      rfqs.map(rfq => (
                        <div key={rfq.id} className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-slate-900">{rfq.rfq_no}</span>
                            <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded border border-emerald-100 font-bold uppercase">
                              {rfq.status}
                            </span>
                          </div>
                          <div className="text-slate-600 grid grid-cols-2 gap-2 text-[11px]">
                            <p><span className="font-semibold">PR Source:</span> {rfq.pr_no}</p>
                            <p><span className="font-semibold">Department:</span> {rfq.department_name}</p>
                            <p><span className="font-semibold">Open Date:</span> {rfq.open_date}</p>
                            <p><span className="font-semibold text-rose-600">Close Date:</span> {rfq.close_date}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* RFQ Creation Modal */}
              {createRfqPR && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-300 max-w-md w-full p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="text-sm font-bold text-slate-800 uppercase">Publish RFQ - {createRfqPR.pr_no}</h3>
                      <button onClick={() => setCreateRfqPR(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                    </div>

                    <form onSubmit={handleCreateRFQ} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Procurement Mode</label>
                        <select
                          value={createRfqPR.mode_of_procurement || 'Public Bidding'}
                          onChange={(e) => setCreateRfqPR({ ...createRfqPR, mode_of_procurement: e.target.value })}
                          className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                        >
                          <option value="Public Bidding">Public Bidding</option>
                          <option value="Shopping">Shopping (Sec 52)</option>
                          <option value="Small Value Procurement">Small Value Procurement (Sec 53.9)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">RFQ Close Date (Submission Deadline)</label>
                        <input
                          type="date"
                          value={rfqCloseDate}
                          onChange={(e) => setRfqCloseDate(e.target.value)}
                          className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                          required
                        />
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-[10px] space-y-1">
                        <span className="font-bold text-slate-700 uppercase">COA Terms & Conditions Applied:</span>
                        <p className="text-slate-500 italic">1. All bids are locked until close date.</p>
                        <p className="text-slate-500 italic">2. Minimum 3 suppliers must participate in the abstract.</p>
                        <p className="text-slate-500 italic">3. Lowest Calculations automatically flagged by backend logic.</p>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setCreateRfqPR(null)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded shadow-sm hover:bg-indigo-700"
                        >
                          Publish to BAC Noticeboard
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BIDDING & ABSTRACT (AOC) */}
          {activeTab === 'bidding' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 4: Bid Evaluation and Abstract of Canvass</h3>
                <p className="text-xs text-slate-500">Owner: BAC Secretariat. GSO may assist with encoding; Mayor reviews the resulting award. Bids exceeding the Approved Budget for Contract (ABC) are automatically disqualified.</p>
              </div>

              {/* Grid: RFQs waiting for Bid Entry */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Select Active RFQ for Bid Matrix Encoding</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rfqs.filter(rfq => rfq.status === 'Published').map(rfq => (
                    <div key={rfq.id} className="border border-slate-200 rounded-lg p-3 hover:border-blue-500 transition-all bg-slate-50/50 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="font-mono font-bold text-sm text-slate-900">{rfq.rfq_no}</span>
                        <p className="text-xs text-slate-600">Source PR: <span className="font-bold">{rfq.pr_no}</span></p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const [prResponse, bidsResponse] = await Promise.all([
                              apiFetch(`/api/pr/${rfq.pr_id}`),
                              apiFetch(`/api/rfq/${rfq.id}/bids`)
                            ]);
                            const prDetails = await prResponse.json().catch(() => null);
                            const bids = await bidsResponse.json().catch(() => null);
                            if (!prResponse.ok) throw new Error(prDetails?.error || 'Unable to load the linked Purchase Request.');
                            if (!bidsResponse.ok) throw new Error(bids?.error || 'Unable to load the existing abstract bids.');
                            if (!Array.isArray(prDetails?.items)) throw new Error('The linked Purchase Request has no itemized requirements.');

                            setActiveRfqForBids({ ...rfq, items: prDetails.items });
                            const prices: any = {};
                            const compliances: any = {};
                            (Array.isArray(bids) ? bids : []).forEach((b: any) => {
                              prices[`${b.supplier_id}-${b.pr_item_id}`] = String(b.offered_unit_price);
                              compliances[`${b.supplier_id}-${b.pr_item_id}`] = Boolean(Number(b.is_compliant));
                            });
                            setBidPrices(prices);
                            setBidCompliance(compliances);
                          } catch (err: any) {
                            showAlert('error', err.message || 'Unable to open the Abstract of Canvass.');
                          }
                        }}
                        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-1.5 rounded transition-colors"
                      >
                        Enter / View Canvass Spreadsheet
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bid Sheet spreadsheet simulator */}
              {activeRfqForBids && (
                <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-md space-y-5">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase">Abstract of Canvass - {activeRfqForBids.rfq_no}</h4>
                      <p className="text-xs text-slate-500">Input bid proposals for each participating supplier below.</p>
                    </div>
                    <button onClick={() => setActiveRfqForBids(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕ Close Sheet</button>
                  </div>

                  <form onSubmit={handleSubmitBids} className="space-y-6">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 text-slate-100 uppercase text-[10px]">
                            <th className="p-3 border-r border-slate-800">Pr Item / ABC limit</th>
                            {suppliers.slice(0, 3).map(sup => (
                              <th key={sup.id} className="p-3 border-r border-slate-800 text-center">
                                <span className="block font-bold">{sup.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono font-normal">TIN: {sup.tin}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {activeRfqForBids.items?.map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="p-3 border-r border-slate-200 space-y-1 bg-slate-50">
                                <p className="font-semibold text-slate-800">{item.description}</p>
                                <p className="text-slate-500 font-mono text-[10px]">
                                  Qty: {item.quantity} {item.unit} • ABC Price: <span className="text-blue-700 font-bold">{formatPesos(item.unit_cost)}</span>
                                </p>
                              </td>

                              {suppliers.slice(0, 3).map(sup => {
                                const prItemId = Number(item.pr_item_id || item.id);
                                const bidKey = `${sup.id}-${prItemId}`;
                                const offeredPrice = bidPrices[bidKey] === undefined || bidPrices[bidKey] === '' ? null : Number(bidPrices[bidKey]);
                                const isDisqualified = offeredPrice !== null && offeredPrice > Number(item.unit_cost);

                                return (
                                  <td key={sup.id} className="p-3 border-r border-slate-200 space-y-2 text-center">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                                      <input
                                        type="number"
                                        value={bidPrices[bidKey] || ''}
                                        onChange={(e) => setBidPrices({
                                          ...bidPrices,
                                          [bidKey]: e.target.value
                                        })}
                                        placeholder="0.00"
                                        className="w-full border border-slate-200 rounded p-1.5 pl-6 text-xs text-center font-mono font-bold text-blue-800 focus:border-blue-500 bg-white"
                                        required
                                      />
                                    </div>

                                    {/* compliance override check */}
                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                      <input
                                        type="checkbox"
                                        checked={bidCompliance[bidKey] !== undefined ? bidCompliance[bidKey] : !isDisqualified}
                                        onChange={(e) => setBidCompliance({
                                          ...bidCompliance,
                                          [bidKey]: e.target.checked
                                        })}
                                        className="rounded border-slate-300"
                                      />
                                      <span className={`text-[9px] font-bold uppercase ${isDisqualified ? 'text-rose-600' : 'text-slate-500'}`}>
                                        {isDisqualified ? 'EXCEEDS ABC (Disq)' : 'Compliant Specs'}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveRfqForBids(null)}
                        className="px-4 py-2 border border-slate-200 rounded text-xs text-slate-600 font-semibold"
                      >
                        Cancel
                      </button>
                      {['BAC Secretariat', 'GSO Officer'].includes(currentUser?.role || '') && (
                        <button
                          type="submit"
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-sm"
                        >
                          Calculate Abstract & Lock Lowest Bidders
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: BAC RESOLUTIONS */}
          {activeTab === 'bac' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 5: BAC Resolution and Award</h3>
                <p className="text-xs text-slate-500">Following review of Abstract of Canvass, the Bids and Awards Committee (BAC) issues resolutions declaring the winning supplier.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* RFQs Ready for Award Selection */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">RFQs Pending BAC Resolution Decision</h4>
                  <div className="space-y-3">
                    {rfqs.filter(rfq => rfq.status !== 'Closed' && !noas.some(noa => Number(noa.rfq_id) === Number(rfq.id))).map(rfq => (
                      <div key={rfq.id} className="border border-slate-200 p-3 rounded bg-slate-50 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold font-mono text-slate-900">{rfq.rfq_no}</p>
                          <p className="text-slate-500">Associated PR: {rfq.pr_no}</p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const [prResponse, bidsResponse] = await Promise.all([
                                apiFetch(`/api/pr/${rfq.pr_id}`),
                                apiFetch(`/api/rfq/${rfq.id}/bids`)
                              ]);

                              if (!prResponse.ok || !bidsResponse.ok) {
                                const errorResponse = !prResponse.ok ? prResponse : bidsResponse;
                                const errorBody = await errorResponse.json().catch(() => null);
                                throw new Error(errorBody?.error || 'Failed to load award resolution details');
                              }

                              const [prDetails, bids] = await Promise.all([
                                prResponse.json(),
                                bidsResponse.json()
                              ]);

                              const requiredItemIds = new Set<number>(prDetails.items.map((item: any) => Number(item.id)));
                              const supplierTotals = new Map<number, { total: number; itemIds: Set<number>; nonCompliant: boolean }>();
                              bids.forEach((bid: any) => {
                                const supplierId = Number(bid.supplier_id);
                                const itemId = Number(bid.pr_item_id);
                                const current = supplierTotals.get(supplierId) || { total: 0, itemIds: new Set<number>(), nonCompliant: false };
                                current.total += Number(bid.offered_total_price || 0);
                                current.itemIds.add(itemId);
                                current.nonCompliant = current.nonCompliant || !(bid.is_compliant === true || Number(bid.is_compliant) === 1);
                                supplierTotals.set(supplierId, current);
                              });
                              const responsiveSuppliers = [...supplierTotals.entries()]
                                .filter(([, summary]) => summary.itemIds.size === requiredItemIds.size
                                  && [...requiredItemIds].every(itemId => summary.itemIds.has(itemId))
                                  && !summary.nonCompliant)
                                .sort(([, left], [, right]) => left.total - right.total);
                              const lowestBidder = responsiveSuppliers[0];

                              setActiveRfqForBAC({
                                ...rfq,
                                pr: prDetails,
                                bids,
                                responsiveSupplierIds: responsiveSuppliers.map(([supplierId]) => supplierId)
                              });

                              if (lowestBidder) {
                                setWinningSupplierId(String(lowestBidder[0]));
                                setBacJustification(`The participating supplier with the Lowest Calculated Responsive Bid (LCRB) is designated as winner.`);
                              }
                            } catch (err: any) {
                              showAlert('error', err.message || 'Failed to load award resolution details');
                            }
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold py-1 px-3 rounded shadow-sm"
                        >
                          Draft Award Resolution
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Draft BAC Resolution Form Area */}
                {activeRfqForBAC ? (
                  <form onSubmit={handleSubmitBACResolution} className="bg-white border border-slate-300 rounded-lg p-5 space-y-4 shadow-md">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-200 pb-1.5">Drafting Resolution for {activeRfqForBAC.rfq_no}</h4>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Winning Supplier Candidate</label>
                      <select
                        value={winningSupplierId}
                        onChange={(e) => setWinningSupplierId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                        required
                      >
                        <option value="">-- Choose Supplier --</option>
                        {suppliers
                          .filter(sup => !activeRfqForBAC.responsiveSupplierIds?.length || activeRfqForBAC.responsiveSupplierIds.includes(Number(sup.id)))
                          .map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.name} (Rating: {sup.performance_rating || 0}/5)</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Official Justification / COA Grounds</label>
                      <textarea
                        value={bacJustification}
                        onChange={(e) => setBacJustification(e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                        placeholder="e.g. Lowest Calculated and Responsive Bidder (LCRB)"
                        required
                      />
                    </div>

                    <div className="bg-slate-50 p-3 rounded text-[10px] space-y-1.5 text-slate-600">
                      <span className="font-bold uppercase text-slate-700">Notice of Award (NOA) Generation Hook:</span>
                      <p>Approving this BAC resolution automatically generates and issues the Notice of Award (NOA) to the winning bidder.</p>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveRfqForBAC(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-sm"
                      >
                        Sign Award & Issue NOA
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col justify-center items-center text-center text-slate-400 italic">
                    <Award size={36} className="text-slate-300 mb-2" />
                    <p className="text-xs">Select an RFQ on the left to draft a resolution and determine contract awards.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: CONTRACTS (PO / NTP) */}
          {activeTab === 'po' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 6: Purchase Order and Contract Execution</h3>
                  <p className="text-xs text-slate-500">Approved awards (NOA) are directly converted into legal COA-standard Purchase Orders (Appendix 61) with zero re-typing errors.</p>
                </div>
              </div>

              {/* Grid: 2 columns (Awards pending PO, Active PO list) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Column A: Notices of Award waiting for PO */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 border-b border-slate-100 pb-1.5">Approved Notices of Award (NOA)</h4>
                  <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {noas.filter(noa => !pos.some(po => Number(po.noa_id) === Number(noa.id))).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No approved NOA is ready for PO conversion.</p>
                    ) : (
                      noas
                        .filter(noa => !pos.some(po => Number(po.noa_id) === Number(noa.id)))
                        .map(noa => (
                          <div key={noa.id} className="py-3 flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-slate-800 uppercase">{noa.noa_no}</p>
                              <p className="text-slate-500">Supplier: {noa.supplier_name || 'Awarded supplier'} • PR: {noa.pr_no || 'N/A'}</p>
                            </div>
                            <button
                              onClick={() => handleCreatePO({
                                id: noa.id,
                                supplier_id: noa.supplier_id,
                                bac_resolution: { rfq: { pr_id: noa.pr_id }, type_of_bidding: noa.type_of_bidding || 'Small Value Procurement' }
                              })}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1 px-3 rounded shadow-sm"
                            >
                              Generate PO & NTP
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Column B: Active Purchase Orders */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">Signed Purchase Orders & Active NTPs</h4>

                  {/* PO Search & Status Filters with Print All */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={poSearchQuery}
                        onChange={(e) => setPoSearchQuery(e.target.value)}
                        placeholder="Search PO No. or Supplier..."
                        className="flex-1 bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={poStatusFilter}
                        onChange={(e) => setPoStatusFilter(e.target.value)}
                        className="bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold"
                      >
                        <option value="">All Statuses</option>
                        <option value="Signed">Signed</option>
                        <option value="Issued">Issued</option>
                        <option value="Partially_Delivered">Partially Delivered</option>
                        <option value="Fully_Delivered">Fully Delivered</option>
                      </select>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      {poSearchQuery || poStatusFilter ? (
                        <button
                          onClick={() => { setPoSearchQuery(''); setPoStatusFilter(''); }}
                          className="text-slate-500 hover:text-slate-700 text-[10px] font-semibold cursor-pointer underline decoration-dotted"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Showing {visiblePOs.length} of {pos.length} POs</span>
                      )}

                      <button
                        onClick={handleBulkPrintPOs}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] py-1.5 px-3 rounded shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Printer size={12} />
                        <span>Bulk 'Print All' ({visiblePOs.length})</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {visiblePOs.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No Purchase Orders matching filters found.</p>
                    ) : (
                      visiblePOs.map(po => (
                        <div key={po.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-3 hover:border-slate-300 transition-all">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-sm text-slate-900">{po.po_no}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${po.status === 'Signed' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                              'bg-green-50 text-green-700 border border-green-100'
                              }`}>
                              {po.status}
                            </span>
                          </div>

                          <div className="text-slate-600 text-[11px] space-y-1">
                            <p><span className="font-semibold">Supplier:</span> {po.supplier_name}</p>
                            <p><span className="font-semibold">NTP Date:</span> {po.po_date}</p>
                            <p><span className="font-semibold">Penalty Clause:</span> 1/10 of 1% daily delay penalty enforced.</p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            <button
                              onClick={() => openPODetails(po.id)}
                              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold py-1.5 px-2 rounded flex items-center justify-center gap-1 text-[11px] cursor-pointer transition-all"
                            >
                              <Printer size={12} className="text-slate-500" />
                              <span>Print PO (App. 61)</span>
                            </button>
                            <button
                              onClick={() => openNTPDetails(po.id)}
                              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold py-1.5 px-2 rounded flex items-center justify-center gap-1 text-[11px] cursor-pointer transition-all"
                            >
                              <Printer size={12} className="text-slate-500" />
                              <span>Print NTP Letter</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Payment Verification & Disbursement Workspace</h3>
                  <p className="text-xs text-slate-500">Finance verifies received goods, confirms supporting documents, and records payment completion for each PO delivery.</p>
                </div>
                {['Finance Officer', 'GSO Officer', 'Mayor'].includes(currentUser?.role || '') && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">Payment request entry enabled</span>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700"><ClipboardList size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Payment Records</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">{payments.length}</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Across active PO transactions</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700"><AlertTriangle size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">For Verification</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">{payments.filter(p => p.status === 'For_Verification').length}</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Ready for finance review</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700"><CheckCircle2 size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Approved / Disbursed</p>
                    <h4 className="text-xl font-bold text-slate-800 mt-1 font-mono leading-none">{payments.filter(p => ['Approved', 'Disbursed', 'Completed'].includes(p.status)).length}</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Approved for release</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700"><FileText size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Total Value</p>
                    <h4 className="text-base font-bold text-slate-800 mt-1 font-mono leading-none truncate">{formatPesos(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0))}</h4>
                    <p className="text-[10px] text-slate-500 mt-1">All payment requests</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Transaction workspace overview</h4>
                  <div className="space-y-3 mt-4">
                    {prs.slice(0, 6).map(pr => {
                      const poMatch = pos.find(p => Number(p.pr_id) === Number(pr.id));
                      const paymentMatch = payments.filter(p => Number(p.po_id) === Number(poMatch?.id));
                      const statusTone = pr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : pr.status === 'For_Approval' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700 border border-slate-200';
                      return (
                        <div key={pr.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-mono text-[11px] font-bold text-slate-900">{pr.pr_no}</p>
                              <p className="text-[10px] text-slate-500">{pr.department_name || pr.department_code || 'Department'} · {pr.purpose}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusTone}`}>{formatPRStatus(pr.status)}</span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-600">
                            <div className="bg-white border border-slate-200 rounded p-2">
                              <span className="block text-slate-400 uppercase tracking-wide">PO</span>
                              <span className="font-bold text-slate-800">{poMatch ? poMatch.po_no : 'Pending'}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded p-2">
                              <span className="block text-slate-400 uppercase tracking-wide">IAR</span>
                              <span className="font-bold text-slate-800">{iars.some(i => Number(i.po_id) === Number(poMatch?.id)) ? 'Filed' : 'Open'}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded p-2">
                              <span className="block text-slate-400 uppercase tracking-wide">Payment</span>
                              <span className="font-bold text-slate-800">{paymentMatch.length ? `${paymentMatch.length} request(s)` : 'Not started'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Finance payment queue</h4>
                  <div className="space-y-3 mt-4">
                    {payments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No payment records are available yet.</p>
                    ) : (
                      payments.map(payment => (
                        <div key={payment.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-mono text-[11px] font-bold text-slate-900">{payment.payment_no}</p>
                              <p className="text-[10px] text-slate-500">PO: {payment.po_no} · PR: {payment.pr_no}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${paymentStatusTone(payment.status)}`}>{payment.status}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Amount</span>
                            <span className="font-bold text-slate-800 font-mono">{formatPesos(payment.amount || 0)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Prepared by</span>
                            <span className="font-medium text-slate-700">{payment.prepared_by || '—'}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {payment.status === 'For_Verification' && (
                              <button type="button" onClick={() => updatePaymentStatus(payment.id, 'Approved')} className="bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-semibold px-2 py-1 rounded">Approve</button>
                            )}
                            {payment.status === 'Approved' && (
                              <button type="button" onClick={() => updatePaymentStatus(payment.id, 'Disbursed')} className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-semibold px-2 py-1 rounded">Disburse</button>
                            )}
                            {payment.status === 'Disbursed' && (
                              <button type="button" onClick={() => updatePaymentStatus(payment.id, 'Completed')} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-2 py-1 rounded">Complete</button>
                            )}
                            {['For_Verification', 'Approved', 'Disbursed'].includes(payment.status) && (
                              <button type="button" onClick={() => updatePaymentStatus(payment.id, 'Cancelled')} className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-semibold px-2 py-1 rounded">Cancel</button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {['Finance Officer', 'GSO Officer', 'Mayor'].includes(currentUser?.role || '') && (
                <form onSubmit={handleCreatePayment} className="bg-white border border-cyan-200 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-800">Create payment request</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Only POs with an accepted IAR are available for payment processing.</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Initial status: For Verification</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Purchase Order</label>
                      <select value={paymentForm.po_id} onChange={e => setPaymentForm({ ...paymentForm, po_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white" required>
                        <option value="">Select accepted PO</option>
                        {pos.filter(po => iars.some(iar => Number(iar.po_id) === Number(po.id) && ['Partial', 'Completed'].includes(iar.status)) && !payments.some(payment => Number(payment.po_id) === Number(po.id) && !['Cancelled', 'Completed'].includes(payment.status))).map(po => (
                          <option key={po.id} value={po.id}>{po.po_no} - {po.supplier_name || 'Supplier'}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Payment Date</label>
                      <input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Amount</label>
                      <input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono" placeholder="0.00" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                      <select value={paymentForm.payment_method} onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white">
                        <option>Transfer</option><option>Check</option><option>ADA</option><option>Cash</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Document Number</label>
                      <input value={paymentForm.document_no} onChange={e => setPaymentForm({ ...paymentForm, document_no: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono" placeholder="DV / voucher no." required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Reference Number</label>
                      <input value={paymentForm.reference_no} onChange={e => setPaymentForm({ ...paymentForm, reference_no: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs font-mono" placeholder="Bank/check reference" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Prepared By</label>
                      <input value={paymentForm.prepared_by} onChange={e => setPaymentForm({ ...paymentForm, prepared_by: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs" placeholder="Finance preparer" required />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Remarks</label>
                      <input value={paymentForm.remarks} onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2 text-xs" placeholder="Supporting notes" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm">Submit for Verification</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 7: INSPECTIONS (IAR) */}
          {activeTab === 'iar' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 7: Delivery and Inspection</h3>
                <p className="text-xs text-slate-500">Upon supplier delivery, inspect items and sign off on Appendix 62. Partial deliveries remain under watch until fully completed.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Signed POs awaiting Delivery */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1.5">Purchase Orders Awaiting Delivery</h4>
                  <div className="space-y-3">
                    {pos.filter(po => ['Signed', 'Issued', 'Partially_Delivered'].includes(po.status) && Number(po.remaining_quantity) > 0).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No contracts active or awaiting delivery.</p>
                    ) : (
                      pos.filter(po => ['Signed', 'Issued', 'Partially_Delivered'].includes(po.status) && Number(po.remaining_quantity) > 0).map(po => (
                        <div key={po.id} className="border border-slate-200 p-3 rounded bg-slate-50 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold font-mono text-slate-900">{po.po_no}</p>
                            <p className="text-slate-500">Supplier: {po.supplier_name}</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const response = await apiFetch(`/api/po/${po.id}`);
                                const body = await response.json().catch(() => null);
                                if (!response.ok) throw new Error(body?.error || 'Unable to load the Purchase Order.');
                                setActivePoForIar(body);
                                setIarInvoiceNo(`INV-${String(Math.floor(100000 + Math.random() * 900000))}`);
                                setIarInvoiceDate(new Date().toISOString().split('T')[0]);
                              } catch (err: any) {
                                showAlert('error', err.message);
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold py-1 px-3 rounded shadow-sm"
                          >
                            Inspect Shipment
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Inspecting and Acceptance Form */}
                {activePoForIar ? (
                  <form onSubmit={handleSubmitIAR} className="bg-white border border-slate-300 rounded-lg p-5 space-y-4 shadow-md">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 border-b border-slate-200 pb-1.5">Sign Off Appendix 62 for {activePoForIar.po_no}</h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Invoice Number</label>
                        <input
                          type="text"
                          value={iarInvoiceNo}
                          onChange={(e) => setIarInvoiceNo(e.target.value)}
                          className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Invoice Date</label>
                        <input
                          type="date"
                          value={iarInvoiceDate}
                          onChange={(e) => setIarInvoiceDate(e.target.value)}
                          className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                          required
                        />
                      </div>
                    </div>

                    {/* Photo Capture */}
                    <div className="my-3">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Inspection Photo</label>
                      <button type="button" onClick={() => setIsCameraOpen(true)} className="bg-slate-700 text-white text-xs px-3 py-1 rounded">Capture Photo</button>
                      {iarPhoto && <img src={iarPhoto} alt="Inspection" className="mt-2 w-32 h-32 object-cover border border-slate-300 rounded" />}
                    </div>

                    {isCameraOpen && <CameraCapture onCapture={setIarPhoto} onClose={() => setIsCameraOpen(false)} />}

                    {/* Delivered Quantities Input Grid */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Itemized Quantities Received</span>
                      {activePoForIar.items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-semibold text-slate-800 truncate">{item.description || 'Delivered Item'}</p>
                            <p className="text-slate-500 text-[10px]">Remaining Quantity: <span className="font-bold">{item.remaining_quantity ?? item.quantity}</span></p>
                          </div>
                          <div className="w-40 flex gap-2">
                            <select
                              value={iarItemConditions[item.id] || 'Good'}
                              onChange={(e) => setIarItemConditions({
                                ...iarItemConditions,
                                [item.id]: e.target.value as 'Good' | 'Damaged' | 'Incomplete'
                              })}
                              className="border border-slate-200 rounded p-1 text-[10px] font-bold"
                            >
                              <option value="Good">Good</option>
                              <option value="Damaged">Damaged</option>
                              <option value="Incomplete">Incomplete</option>
                            </select>
                            <input
                              type="number"
                              value={iarDeliveredQtys[item.id] !== undefined ? iarDeliveredQtys[item.id] : (item.remaining_quantity ?? item.quantity)}
                              onChange={(e) => setIarDeliveredQtys({
                                ...iarDeliveredQtys,
                                [item.id]: parseInt(e.target.value) || 0
                              })}
                              className="w-full border border-slate-200 rounded p-1 text-center font-mono font-bold text-green-700"
                              min="0"
                              max={item.remaining_quantity ?? item.quantity}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="partial-check"
                        checked={iarIsPartial}
                        onChange={(e) => setIarIsPartial(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <label htmlFor="partial-check" className="text-xs font-bold text-slate-700 uppercase cursor-pointer">
                        Mark as Partial Delivery
                      </label>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setActivePoForIar(null)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow-sm"
                      >
                        File Inspection & Auto-Log Assets
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col justify-center items-center text-center text-slate-400 italic">
                    <Truck size={36} className="text-slate-300 mb-2" />
                    <p className="text-xs font-sans">Select a pending PO delivery on the left to sign off inspection boxes.</p>
                  </div>
                )}
              </div>

              {/* Filed IAR Records List */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">Filed Inspection Reports (COA Archive)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {iars.map(iar => (
                    <div key={iar.id} className="border border-slate-200 p-3 rounded bg-slate-50 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-mono font-bold text-slate-900 block">{iar.iar_no}</span>
                        <p className="text-slate-500">PO Ref: {iar.po_no}</p>
                      </div>
                      <button
                        onClick={() => openIARDetails(iar.id)}
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold py-1 px-3.5 rounded flex items-center gap-1 shadow-sm"
                      >
                        <Printer size={10} /> Print IAR (App. 62)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: PROPERTY TAGS (ICS / PAR) */}
          {activeTab === 'inventory' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 8: Property Tagging and Inventory</h3>
                <p className="text-xs text-slate-500">The GSO Officer manages supplies stock and accountable property. Accepted supply lines enter department stock automatically; equipment and infrastructure continue through Property Acknowledgment Receipts (PAR) or Inventory Custodian Slips (ICS).</p>
              </div>

              {/* Consumable supplies ledger */}
              <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50/40">
                <div className="px-4 py-3 border-b border-blue-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Supplies Stock by Department</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Balances are calculated from audited receipts, issues, returns, and transfers.</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-blue-700">Consumables</span>
                </div>
                {currentUser?.role === 'GSO Officer' && (
                  <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-b border-blue-200">
                    <form onSubmit={handleCreateSupplyItem} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Register supply item</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={supplyItemForm.item_code} onChange={e => setSupplyItemForm({ ...supplyItemForm, item_code: e.target.value })} placeholder="Item code" className="border border-slate-200 rounded p-2 text-xs" required />
                        <input value={supplyItemForm.unit} onChange={e => setSupplyItemForm({ ...supplyItemForm, unit: e.target.value })} placeholder="Unit (box, ream)" className="border border-slate-200 rounded p-2 text-xs" required />
                      </div>
                      <input value={supplyItemForm.description} onChange={e => setSupplyItemForm({ ...supplyItemForm, description: e.target.value })} placeholder="Description" className="w-full border border-slate-200 rounded p-2 text-xs" required />
                      <div className="flex gap-2">
                        <input type="number" min="0" step="0.001" value={supplyItemForm.reorder_level} onChange={e => setSupplyItemForm({ ...supplyItemForm, reorder_level: e.target.value })} placeholder="Reorder level" className="w-1/2 border border-slate-200 rounded p-2 text-xs" />
                        <button className="flex-1 bg-slate-800 text-white rounded p-2 text-xs font-bold">Add item</button>
                      </div>
                    </form>
                    <form onSubmit={handleSupplyTransaction} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Record stock movement</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={supplyTransactionForm.inventory_item_id} onChange={e => setSupplyTransactionForm({ ...supplyTransactionForm, inventory_item_id: e.target.value })} className="border border-slate-200 rounded p-2 text-xs" required>
                          <option value="">Select item</option>
                          {supplyItems.map((item: any) => <option key={item.id} value={item.id}>{item.item_code} — {item.description}</option>)}
                        </select>
                        <select value={supplyTransactionForm.transaction_type} onChange={e => setSupplyTransactionForm({ ...supplyTransactionForm, transaction_type: e.target.value })} className="border border-slate-200 rounded p-2 text-xs">
                          <option value="RECEIVE">Receive</option><option value="ISSUE">Issue</option><option value="RETURN">Return</option><option value="ADJUSTMENT">Adjustment</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" min="0.001" step="0.001" value={supplyTransactionForm.quantity} onChange={e => setSupplyTransactionForm({ ...supplyTransactionForm, quantity: e.target.value })} placeholder="Quantity" className="border border-slate-200 rounded p-2 text-xs" required />
                        <input type="number" min="0" step="0.01" value={supplyTransactionForm.unit_cost} onChange={e => setSupplyTransactionForm({ ...supplyTransactionForm, unit_cost: e.target.value })} placeholder="Unit cost" className="border border-slate-200 rounded p-2 text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={supplyTransactionForm.from_department_id} onChange={e => setSupplyTransactionForm({ ...supplyTransactionForm, from_department_id: e.target.value })} disabled={supplyTransactionForm.transaction_type === 'RECEIVE' || supplyTransactionForm.transaction_type === 'ADJUSTMENT'} className="border border-slate-200 rounded p-2 text-xs disabled:bg-slate-100">
                          <option value="">Source department</option>{departments.map(dept => <option key={dept.id} value={dept.id}>{dept.code}</option>)}
                        </select>
                        <select value={supplyTransactionForm.to_department_id} onChange={e => setSupplyTransactionForm({ ...supplyTransactionForm, to_department_id: e.target.value })} disabled={supplyTransactionForm.transaction_type === 'DISPOSAL'} className="border border-slate-200 rounded p-2 text-xs disabled:bg-slate-100">
                          <option value="">Destination department</option>{departments.map(dept => <option key={dept.id} value={dept.id}>{dept.code}</option>)}
                        </select>
                      </div>
                      <button className="w-full bg-blue-600 text-white rounded p-2 text-xs font-bold">Record movement</button>
                    </form>
                  </div>
                )}
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead><tr className="bg-slate-900 text-slate-100 uppercase text-[10px] font-bold"><th className="p-3">Item</th><th className="p-3">Department</th><th className="p-3">Received</th><th className="p-3">Issued</th><th className="p-3">On Hand</th><th className="p-3">Reorder</th><th className="p-3">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplyInventory.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-slate-400 italic">No supply items registered yet.</td></tr> : supplyInventory.map((item: any) => (
                        <tr key={`${item.id}-${item.department_id}`} className="hover:bg-slate-50">
                          <td className="p-3"><span className="font-mono text-[10px] text-slate-500">{item.item_code}</span><p className="font-semibold text-slate-800">{item.description}</p><p className="text-[10px] text-slate-400">per {item.unit}</p></td>
                          <td className="p-3 text-slate-600">{item.department_code} — {item.department_name}</td>
                          <td className="p-3 font-mono">{item.received_quantity}</td><td className="p-3 font-mono">{item.issued_quantity}</td><td className="p-3 font-mono font-bold text-blue-700">{item.quantity_on_hand}</td><td className="p-3 font-mono">{item.reorder_level}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${item.low_stock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{item.low_stock ? 'Low stock' : 'Available'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assets list */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-slate-100 uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-3">Property No.</th>
                        <th className="p-3">Asset Classification</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Accountable Department</th>
                        <th className="p-3">Acquisition Cost</th>
                        <th className="p-3">Custodian Receiver</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Print Slip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assets.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">No property assets registered. Log delivery inspection to populate.</td>
                        </tr>
                      ) : (
                        assets.map(asset => (
                          <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-slate-900">{asset.property_no}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border uppercase ${asset.type === 'PAR' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                {asset.type === 'PAR' ? 'Fixed Asset (PAR)' : 'Semi-Expendable (ICS)'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-800">{asset.description}</td>
                            <td className="p-3 text-slate-600">{asset.department_name}</td>
                            <td className="p-3 font-mono font-bold text-blue-700">{formatPesos(asset.cost)}</td>
                            <td className="p-3">
                              <p className="font-semibold text-slate-800">{asset.receiver_name}</p>
                              <p className="text-[10px] text-slate-400">{asset.receiver_designation}</p>
                            </td>
                            <td className="p-3">
                              <span className="bg-green-100 text-green-800 text-[9px] px-2 py-0.5 rounded font-bold uppercase">
                                {asset.status}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => {
                                  const dept = departments.find(d => d.id === asset.assigned_to_user_id);
                                  setSelectedAsset({
                                    asset,
                                    dept
                                  });
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[10px] py-1 px-3 rounded shadow-sm flex items-center gap-1.5 mx-auto"
                              >
                                <Printer size={10} /> Print Slip
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8b: ASSET DISTRIBUTION (RIS) */}
          {activeTab === 'distribution' && (() => {
            const filteredAssets = risRecords.filter((a: any) => {
              const q = risSearchQuery.toLowerCase();
              return !q || a.property_no?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.receiver_name?.toLowerCase().includes(q);
            });
            return (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* -- Header -- */}
                <div className="px-6 pt-6 pb-0 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 9: Asset Distribution and RIS Issuance</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Requisition & Issuance Slip registry. Records correspond to assets tagged to accountable departments via ICS or PAR.</p>
                  </div>
                  <button
                    onClick={() => setIsCreateRISOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Issue RIS
                  </button>
                </div>

                {/* -- KPI Cards -- */}
                <div className="px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Assets</p>
                      <p className="text-2xl font-black text-slate-800">{assets.length}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active</p>
                      <p className="text-2xl font-black text-emerald-600">{assets.filter((a: any) => a.status === 'Active').length}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Fixed Assets (PAR)</p>
                      <p className="text-2xl font-black text-blue-700">{assets.filter((a: any) => a.type === 'PAR').length}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Semi-Expendable (ICS)</p>
                      <p className="text-2xl font-black text-teal-700">{assets.filter((a: any) => a.type === 'ICS').length}</p>
                    </div>
                  </div>
                </div>

                {/* -- Search Toolbar -- */}
                <div className="px-6 pt-4 flex items-center gap-3 flex-shrink-0">
                  <div className="relative flex-1 max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                      value={risSearchQuery}
                      onChange={e => setRisSearchQuery(e.target.value)}
                      placeholder="Search property no., description, or receiver…"
                      className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded">{filteredAssets.length} records</span>
                  <button
                    onClick={() => setActiveTab('iar')}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 bg-white rounded-lg px-3 py-2 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                    IAR Module
                  </button>
                </div>

                {/* -- Full-Width Table -- */}
                <div className="flex-1 px-6 pb-6 pt-4 overflow-y-auto">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-800 px-4 py-2.5 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Requisition & Issuance Slip (RIS) Registry</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                            <th className="p-3 pl-4">RIS / Property No.</th>
                            <th className="p-3">Classification</th>
                            <th className="p-3">Item Description</th>
                            <th className="p-3">Accountable Dept.</th>
                            <th className="p-3">Custodian / Receiver</th>
                            <th className="p-3">Acquisition Cost</th>
                            <th className="p-3">Date Issued</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAssets.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-12 text-center">
                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10,9 9,9 8,9" /></svg>
                                  <div>
                                    <p className="font-semibold text-slate-500 text-sm">No RIS Records Found</p>
                                    <p className="text-[11px] mt-1">RIS records are created automatically when items are accepted and tagged via the IAR module.</p>
                                  </div>
                                  <button onClick={() => setActiveTab('iar')} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-1.5 px-4 rounded-md mt-1 transition-colors">Go to IAR Module</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredAssets.map((asset: any) => {
                              const dept = departments.find((d: any) => d.id === asset.department_id);
                              return (
                                <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-3 pl-4">
                                    <p className="font-mono font-bold text-slate-900 text-[11px]">{asset.property_no}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">{asset.ris_no || 'RIS —'}</p>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${asset.type === 'PAR' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                      {asset.type === 'PAR' ? 'Fixed Asset (PAR)' : 'Semi-Expendable (ICS)'}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <p className="font-semibold text-slate-800">{asset.description}</p>
                                    <p className="text-[10px] text-slate-400">{asset.unit}</p>
                                  </td>
                                  <td className="p-3 text-slate-600 font-medium">{dept ? `${dept.name} (${dept.code})` : asset.department_name || '—'}</td>
                                  <td className="p-3">
                                    <p className="font-semibold text-slate-800 text-[11px]">{asset.receiver_name}</p>
                                    <p className="text-[10px] text-slate-400">{asset.receiver_designation}</p>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-blue-700 text-[11px]">₱{Number(asset.cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-3 text-slate-500 text-[11px]">{asset.date_acquired ? new Date(asset.date_acquired).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${asset.asset_status === 'Active' ? 'bg-green-50 text-green-700 border-green-100' : asset.asset_status === 'Condemned' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{asset.asset_status || asset.status || 'Issued'}</span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button onClick={() => { setSelectedAsset({ asset, dept }); setActiveTab('inventory'); }} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-[10px] py-1 px-2.5 rounded shadow-sm flex items-center gap-1 mx-auto transition-colors">
                                      <Printer size={9} /> Print Slip
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* COA Note */}
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-3">
                    <div className="flex-shrink-0 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">COA Compliance Notice</p>
                      <p className="text-[10px] text-slate-500 mt-1">Under <strong>COA Circular 2020-006</strong>, the RIS is the primary source document for the issuance of supplies from stock. All items were recorded through the IAR process and are part of the GSO Property Ledger Card (PLC).</p>
                    </div>
                  </div>
                </div>

                {/* -- Issue RIS Slide-Over Drawer -- */}
                {isCreateRISOpen && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end" onClick={() => setIsCreateRISOpen(false)}>
                    <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                      <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between flex-shrink-0">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">Issue Requisition & Issuance Slip</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Record the issuance of supplies or equipment from GSO stock.</p>
                        </div>
                        <button onClick={() => setIsCreateRISOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                      <div className="p-5 flex-1 space-y-4">
                        {/* How RIS Works */}
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-1">How RIS Works</p>
                          <ul className="text-[10px] text-amber-700 space-y-1 list-disc list-inside">
                            <li>End-user submits a <strong>Purchase Request (PR)</strong></li>
                            <li>GSO checks if items are in stock (inventory)</li>
                            <li>If available, GSO issues a <strong>RIS</strong> instead of procuring</li>
                            <li>RIS is signed by requisitioner and supply officer</li>
                          </ul>
                        </div>
                        <form onSubmit={handleCreateRIS} className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Asset</label>
                            <select value={risForm.asset_id} onChange={e => setRisForm({ ...risForm, asset_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" required>
                              <option value="">Select active asset</option>
                              {assets.filter((asset: any) => asset.status === 'Active').map((asset: any) => <option key={asset.id} value={asset.id}>{asset.property_no} — {asset.description}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Accountable Department</label>
                            <select value={risForm.department_id} onChange={e => setRisForm({ ...risForm, department_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none" required>
                              <option value="">Select department</option>
                              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.code} — {dept.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Requisitioner Name</label>
                            <input value={risForm.requisitioner_name} onChange={e => setRisForm({ ...risForm, requisitioner_name: e.target.value })} placeholder="Full name" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Designation</label>
                            <input value={risForm.requisitioner_designation} onChange={e => setRisForm({ ...risForm, requisitioner_designation: e.target.value })} placeholder="Position/Designation" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Purpose</label>
                            <textarea value={risForm.purpose} onChange={e => setRisForm({ ...risForm, purpose: e.target.value })} placeholder="Purpose of issuance" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" rows={3} required />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setIsCreateRISOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm">Issue RIS</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 8c: DISPOSAL (IIRUP) */}
          {activeTab === 'disposal' && (() => {
            const disposedAssets = assets.filter((a: any) => {
              const q = iirupSearchQuery.toLowerCase();
              const isDisposed = a.status === 'Condemned' || a.status === 'Transferred';
              return isDisposed && (!q || a.property_no?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
            });
            const allDisposed = assets.filter((a: any) => a.status === 'Condemned' || a.status === 'Transferred');
            const activeAssets = assets.filter((a: any) => a.status === 'Active');
            return (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* -- Header -- */}
                <div className="px-6 pt-6 pb-0 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 10: Disposal and IIRUP Registry</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Inventory & Inspection Report of Unserviceable Property. All assets tagged as Condemned or Transferred for COA disposal clearance.</p>
                  </div>
                  <button
                    onClick={() => setIsCreateIIRUPOpen(true)}
                    className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs py-2 px-4 rounded-lg shadow transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Record Disposal
                  </button>
                </div>

                {/* -- KPI Cards -- */}
                <div className="px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Assets</p>
                      <p className="text-2xl font-black text-emerald-600">{activeAssets.length}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-red-100 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Condemned</p>
                      <p className="text-2xl font-black text-red-600">{assets.filter((a: any) => a.status === 'Condemned').length}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Transferred</p>
                      <p className="text-2xl font-black text-amber-600">{assets.filter((a: any) => a.status === 'Transferred').length}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Book Value</p>
                      <p className="text-base font-black text-slate-700">₱{allDisposed.reduce((s: number, a: any) => s + Number(a.cost || 0), 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
                    </div>
                  </div>
                </div>

                {/* -- Search Toolbar -- */}
                <div className="px-6 pt-4 flex items-center gap-3 flex-shrink-0">
                  <div className="relative flex-1 max-w-sm">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input
                      value={iirupSearchQuery}
                      onChange={e => setIirupSearchQuery(e.target.value)}
                      placeholder="Search property no. or description…"
                      className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded">{disposedAssets.length} disposed</span>
                  <button onClick={() => setActiveTab('inventory')} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 bg-white rounded-lg px-3 py-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                    Inventory
                  </button>
                </div>

                {/* -- IIRUP Records Mini-List -- */}
                {iirupRecords.length > 0 && (
                  <div className="px-6 pt-3 flex-shrink-0">
                    <div className="border border-red-100 rounded-lg bg-red-50/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-800">IIRUP Requests</h4>
                        <span className="text-[10px] font-mono text-red-600">{iirupRecords.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {iirupRecords.slice(0, 3).map((record: any) => (
                          <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white border border-red-100 rounded px-2 py-1.5">
                            <span className="font-mono font-bold text-slate-800">{record.iirup_no}</span>
                            <span className="text-slate-500">{record.status} · {record.inspection_date}</span>
                            <span className="flex gap-1">
                              {record.status === 'Submitted' && currentUser?.role === 'Mayor' && <button type="button" onClick={() => updateIIRUPStatus(record, 'Approved')} className="bg-emerald-700 text-white px-1.5 py-0.5 rounded text-[10px]">Approve</button>}
                              {record.status === 'Approved' && currentUser?.role === 'Mayor' && <button type="button" onClick={() => updateIIRUPStatus(record, 'Disposed')} className="bg-red-700 text-white px-1.5 py-0.5 rounded text-[10px]">Dispose</button>}
                              {['Submitted', 'Approved'].includes(record.status) && <button type="button" onClick={() => updateIIRUPStatus(record, 'Cancelled')} className="bg-slate-600 text-white px-1.5 py-0.5 rounded text-[10px]">Cancel</button>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* -- Full-Width IIRUP Table -- */}
                <div className="flex-1 px-6 pb-6 pt-4 overflow-y-auto">
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-red-900 px-4 py-2.5 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      <span className="text-[10px] font-bold text-red-200 uppercase tracking-wider">IIRUP — Inventory &amp; Inspection Report of Unserviceable Property</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                            <th className="p-3 pl-4">Property No.</th>
                            <th className="p-3">Classification</th>
                            <th className="p-3">Item Description</th>
                            <th className="p-3">Accountable Dept.</th>
                            <th className="p-3">Last Custodian</th>
                            <th className="p-3">Book Value</th>
                            <th className="p-3">Date Acquired</th>
                            <th className="p-3 text-center">Disposal Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {disposedAssets.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-12 text-center">
                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                  <div>
                                    <p className="font-semibold text-slate-500 text-sm">No Unserviceable Property Found</p>
                                    <p className="text-[11px] mt-1 max-w-sm">When an asset is tagged as <strong>Condemned</strong> or <strong>Transferred</strong> in Inventory, it will appear here for IIRUP processing.</p>
                                  </div>
                                  <button onClick={() => setActiveTab('inventory')} className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs py-1.5 px-4 rounded-md mt-1 transition-colors">View Property Inventory</button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            disposedAssets.map((asset: any) => {
                              const dept = departments.find((d: any) => d.id === asset.assigned_to_user_id);
                              return (
                                <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="p-3 pl-4">
                                    <p className="font-mono font-bold text-slate-900 text-[11px]">{asset.property_no}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">IIRUP-{String(asset.id).padStart(4, '0')}</p>
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${asset.type === 'PAR' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                      {asset.type === 'PAR' ? 'Fixed Asset (PAR)' : 'Semi-Expendable (ICS)'}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <p className="font-semibold text-slate-800">{asset.description}</p>
                                    <p className="text-[10px] text-slate-400">{asset.unit}</p>
                                  </td>
                                  <td className="p-3 text-slate-600 font-medium">{dept ? `${dept.name} (${dept.code})` : asset.department_name || '—'}</td>
                                  <td className="p-3">
                                    <p className="font-semibold text-slate-800 text-[11px]">{asset.receiver_name}</p>
                                    <p className="text-[10px] text-slate-400">{asset.receiver_designation}</p>
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-700 text-[11px]">₱{Number(asset.cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-3 text-slate-500 text-[11px]">{asset.date_acquired ? new Date(asset.date_acquired).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${asset.status === 'Condemned' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                      {asset.status === 'Condemned' ? 'ðŸ”´ Condemned' : 'ðŸŸ¡ Transferred'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* COA Legal Basis */}
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 flex gap-3">
                    <div className="flex-shrink-0 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Legal Basis — COA Circular No. 89-296</p>
                      <p className="text-[10px] text-slate-500 mt-1">Disposal of government property shall be done through the <strong>IIRUP</strong> as prescribed by the Commission on Audit. All condemned items must receive COA clearance before physical disposal.</p>
                    </div>
                  </div>
                </div>

                {/* -- Record Disposal Slide-Over Drawer -- */}
                {isCreateIIRUPOpen && (
                  <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end" onClick={() => setIsCreateIIRUPOpen(false)}>
                    <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                      <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between flex-shrink-0">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">New IIRUP Request</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Submit an asset for disposal under COA Circular No. 89-296.</p>
                        </div>
                        <button onClick={() => setIsCreateIIRUPOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                      <div className="p-5 flex-1 space-y-4">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-red-800 uppercase tracking-wide mb-1">IIRUP Disposal Steps</p>
                          <ol className="text-[10px] text-red-700 space-y-1 list-decimal list-inside">
                            <li>GSO inspects unserviceable items</li>
                            <li>Inspection Committee evaluates condition</li>
                            <li>IIRUP prepared &amp; submitted to COA</li>
                            <li>COA issues authority to dispose</li>
                            <li>Disposal via auction, donation, or destruction</li>
                          </ol>
                        </div>
                        <form onSubmit={handleCreateIIRUP} className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Asset</label>
                            <select value={iirupForm.asset_id} onChange={e => setIirupForm({ ...iirupForm, asset_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-red-500 focus:outline-none" required>
                              <option value="">Select active asset</option>
                              {assets.filter((asset: any) => asset.status === 'Active').map((asset: any) => <option key={asset.id} value={asset.id}>{asset.property_no} — {asset.description}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Asset Department</label>
                            <select value={iirupForm.department_id} onChange={e => setIirupForm({ ...iirupForm, department_id: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-red-500 focus:outline-none" required>
                              <option value="">Select department</option>
                              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.code} — {dept.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mode of Disposal</label>
                            <select value={iirupForm.disposal_method} onChange={e => setIirupForm({ ...iirupForm, disposal_method: e.target.value })} className="w-full border border-slate-200 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-red-500 focus:outline-none">
                              <option>Public Auction</option><option>Negotiated Sale</option><option>Donation</option><option>Destruction</option><option>Transfer</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reason for Disposal</label>
                            <input value={iirupForm.reason} onChange={e => setIirupForm({ ...iirupForm, reason: e.target.value })} placeholder="e.g. Unserviceable, beyond economic repair" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none" required />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Inspection / Condition Notes</label>
                            <textarea value={iirupForm.condition_notes} onChange={e => setIirupForm({ ...iirupForm, condition_notes: e.target.value })} placeholder="Describe the condition of the asset" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none" rows={3} required />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Appraised Value (optional)</label>
                            <input type="number" min="0" step="0.01" value={iirupForm.appraised_value} onChange={e => setIirupForm({ ...iirupForm, appraised_value: e.target.value })} placeholder="₱ 0.00" className="w-full border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none" />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button type="button" onClick={() => setIsCreateIIRUPOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-lg transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm">Submit IIRUP</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 9: SYSTEM AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 11: Audit and Accountability</h3>
                <p className="text-xs text-slate-500">Every single state change, budget cert, or signature is logged dynamically in compliance with the Commission on Audit (COA) audit guidelines.</p>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">

                    <thead>
                      <tr className="bg-slate-900 text-slate-100 uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Action Type</th>
                        <th className="p-3">Ledger Table</th>
                        <th className="p-3 text-center">Reference ID</th>
                        <th className="p-3">Acting LGU Personnel</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Details / Value Modified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors text-slate-700">
                          <td className="p-3 font-mono text-[11px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              log.action === 'STATUS_CHANGE' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-medium text-slate-500">{log.table_name}</td>
                          <td className="p-3 text-center font-bold text-slate-900">#{log.record_id}</td>
                          <td className="p-3 font-semibold text-slate-800">{log.user_name}</td>
                          <td className="p-3 text-slate-500">{log.user_role}</td>
                          <td className="p-3 max-w-xs truncate text-[11px] italic font-serif text-slate-600" title={log.new_value}>
                            {log.new_value || log.old_value || 'State transition completed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: PROCUREMENT SPENDING ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Phase 12: Procurement Analytics and Reporting</h3>
                <p className="text-xs text-slate-500">Review spending, obligations, and procurement performance across the full lifecycle.</p>
              </div>
              <ProcurementAnalytics
                departments={departments}
                prs={prs}
                pos={pos}
              />
            </div>
          )}

          {/* TAB 12: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Access Control</span>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">User Account Administration</h3>
                  <p className="text-xs text-slate-500 max-w-2xl">
                    Create, update, and remove system users. Assign roles and departments so each account follows the procurement workflow and module access matrix.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-sans">
                  <span className="text-[10px] font-mono bg-violet-50 border border-violet-100 text-violet-700 font-bold px-3 py-1.5 rounded uppercase">
                    Authorized: {currentUser?.role}
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Create / Update Account</h4>
                    <p className="text-[10px] text-slate-500 mt-1">Register new system users and assign their role and department.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">Username</label>
                    <input
                      type="text"
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                      placeholder="e.g. joseph"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">Full Name</label>
                    <input
                      type="text"
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                      placeholder="Full name"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">Google / Reset Email</label>
                    <input
                      type="email"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">{editingUserId !== null ? 'New Password (optional)' : 'Password'}</label>
                    <input
                      type="password"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                      placeholder={editingUserId !== null ? 'Leave blank to keep current password' : 'Min 6 chars'}
                      required={editingUserId === null}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">Role</label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                    >
                      <option value="End User">End User</option>
                      <option value="GSO Officer">GSO Officer</option>
                      <option value="BAC Secretariat">BAC Secretariat</option>
                      <option value="Budget Officer">Budget Officer</option>
                      <option value="Mayor">Mayor</option>
                      <option value="Finance Officer">Finance Officer</option>
                      <option value="Supplier">Supplier</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase">Department</label>
                    <select
                      value={newUserForm.department_id}
                      onChange={(e) => setNewUserForm(prev => ({ ...prev, department_id: e.target.value }))}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                    >
                      <option value="">None</option>
                      {departments.map((dept: any) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  {newUserForm.role === 'Supplier' && (
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-700 uppercase">Supplier Registry</label>
                      <select
                        value={newUserForm.supplier_id}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs bg-slate-50"
                        required
                      >
                        <option value="">Select supplier</option>
                        {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="md:col-span-2 lg:col-span-5 flex justify-end gap-2">
                    {editingUserId !== null && (
                      <button
                        type="button"
                        onClick={cancelUserEdit}
                        className="bg-white border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded shadow-sm text-xs"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      disabled={loading}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 rounded shadow-sm text-xs"
                    >
                      {loading ? 'Saving...' : editingUserId !== null ? 'Update User' : 'Create User'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Existing Accounts</h5>
                  <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-100 text-slate-600 uppercase">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Username</th>
                          <th className="p-2">Role</th>
                          <th className="p-2">Department</th>
                          <th className="p-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userAccounts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400 italic">No users registered yet.</td>
                          </tr>
                        ) : (
                          userAccounts.map((user: any) => (
                            <tr key={user.id} className="border-t border-slate-100 align-top">
                              <td className="p-2 font-semibold text-slate-700">{user.name}</td>
                              <td className="p-2 text-slate-600">{user.username}</td>
                              <td className="p-2"><span className="inline-flex px-2 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">{user.role}</span></td>
                              <td className="p-2 text-slate-600">{departments.find((dept: any) => dept.id === user.department_id)?.name || '—'}</td>
                              <td className="p-2 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => startUserEdit(user)}
                                    className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[9px] font-bold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                    className="bg-red-100 text-red-700 px-2 py-1 rounded text-[9px] font-bold"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 12: SYSTEM SETTINGS MANAGEMENT */}
          {activeTab === 'settings' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">System Administration</span>
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">System Settings & Signatories</h3>
                  <p className="text-xs text-slate-500 max-w-2xl font-sans">
                    Fully manage global system identifiers, local government unit names, and designated official signatories. Any changes made here are dynamically updated in real-time across all official printable reports (PR, PO, NTP, IAR, ICS/PAR).
                  </p>
                </div>
                <div className="flex items-center gap-2 font-sans">
                  <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded uppercase">
                    Authorized: {currentUser?.role}
                  </span>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setLoading(true);
                  const form = e.currentTarget;
                  const formData = new FormData(form);
                  const payload = {
                    system_name: formData.get('system_name'),
                    municipal_name: formData.get('municipal_name'),
                    province_name: formData.get('province_name'),
                    mayor_name: formData.get('mayor_name'),
                    gso_officer_name: formData.get('gso_officer_name'),
                    budget_officer_name: formData.get('budget_officer_name'),
                    accountant_name: formData.get('accountant_name'),
                    bac_chairman_name: formData.get('bac_chairman_name'),
                    treasurer_name: formData.get('treasurer_name'),
                    penalty_clause_text: formData.get('penalty_clause_text'),
                    logo_data: logoData
                  };

                  const res = await apiFetch('/api/settings', {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                  });
                  if (!res.ok) throw new Error('Failed to update settings');
                  const updated = await res.json();
                  setSystemSettings(updated);
                  setLogoData(updated.logo_data || null);
                  showAlert('success', 'System settings and designated official signatories updated successfully.');
                  fetchData();
                } catch (err: any) {
                  showAlert('error', err.message);
                } finally {
                  setLoading(false);
                }
              }} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* General settings panel */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">1. General System Branding</h4>

                    <div className="space-y-4 font-sans text-xs">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700">System Core Name</label>
                        <input
                          type="text"
                          name="system_name"
                          defaultValue={systemSettings?.system_name || "GovProcure MS"}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-medium"
                          required
                        />
                        <p className="text-[10px] text-slate-400">Used as the software portal title in headers and web layout.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700">System Logo</label>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                            {logoData ? <img src={logoData} alt="System logo preview" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-slate-400 text-center">No logo</span>}
                          </div>
                          <div className="space-y-1">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/gif,image/webp"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                if (file.size > 3 * 1024 * 1024) {
                                  event.target.value = '';
                                  return showAlert('error', 'Logo must be smaller than 3 MB.');
                                }
                                const reader = new FileReader();
                                reader.onload = () => setLogoData(typeof reader.result === 'string' ? reader.result : null);
                                reader.readAsDataURL(file);
                              }}
                              className="block w-full text-[10px] text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-2 file:py-1.5 file:text-[10px] file:font-bold file:text-indigo-700"
                            />
                            <button type="button" onClick={() => setLogoData(null)} className="text-[10px] font-bold text-red-600 hover:text-red-700">Remove current logo</button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400">PNG, JPEG, GIF, or WebP up to 3 MB. Used in the portal header and printable documents.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700">Municipality / City Name</label>
                        <input
                          type="text"
                          name="municipal_name"
                          defaultValue={systemSettings?.municipal_name || "MUNICIPALITY OF Cainta"}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-medium uppercase"
                          required
                        />
                        <p className="text-[10px] text-slate-400">Printed on the letterhead header of all generated procurement documents.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700">Province Name</label>
                        <input
                          type="text"
                          name="province_name"
                          defaultValue={systemSettings?.province_name || "Province of Bulacan"}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-medium"
                          required
                        />
                        <p className="text-[10px] text-slate-400">Sub-heading below the LGU name on print headers.</p>
                      </div>
                    </div>
                  </div>

                  {/* Contract penalty clauses panel */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">2. Standard Contractual Clauses</h4>

                    <div className="space-y-4 font-sans text-xs">
                      <div className="space-y-1">
                        <label className="block font-bold text-slate-700">Liquidated Damages Penalty Text</label>
                        <textarea
                          name="penalty_clause_text"
                          defaultValue={systemSettings?.penalty_clause_text || "A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed."}
                          rows={6}
                          className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-medium leading-relaxed"
                          required
                        />
                        <p className="text-[10px] text-slate-400">The default penalty statement appended to Appendix 61 (Purchase Order) print template.</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Signatories panel */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">3. Official Signatories & Designated Personnel</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans text-xs">

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Municipal Mayor (HOPE)</label>
                      <input
                        type="text"
                        name="mayor_name"
                        defaultValue={systemSettings?.mayor_name || "HON. Johnielle Keith Pasion Nieto"}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-semibold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">Signs POs, NTP letters, and serves as Head of Procuring Entity.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">GSO Officer / Supply Head</label>
                      <input
                        type="text"
                        name="gso_officer_name"
                        defaultValue={systemSettings?.gso_officer_name || "Arthur N. Ramos"}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-semibold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">Receives and accepts deliveries, tags property ledgers.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Municipal Budget Officer</label>
                      <input
                        type="text"
                        name="budget_officer_name"
                        defaultValue={systemSettings?.budget_officer_name || "Engr. Roberto D. Santos"}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-semibold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">Certifies availability of appropriation/funds on PPMP.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Municipal Accountant</label>
                      <input
                        type="text"
                        name="accountant_name"
                        defaultValue={systemSettings?.accountant_name || "Mrs. Teresa V. Jose"}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-semibold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">Verifies accounting entries and supports bid evaluations.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">Municipal Treasurer</label>
                      <input
                        type="text"
                        name="treasurer_name"
                        defaultValue={systemSettings?.treasurer_name || "Mr. Arthur N. Ramos"}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-semibold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">Releases checks and oversees cash management.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">BAC Chairman</label>
                      <input
                        type="text"
                        name="bac_chairman_name"
                        defaultValue={systemSettings?.bac_chairman_name || "Atty. Susan Cruz"}
                        className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 font-semibold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">Signs Bids and Awards Committee Resolutions.</p>
                    </div>

                  </div>
                </div>

                {/* Form submit button */}
                <div className="flex justify-end gap-3 font-sans">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('pr'); }}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold px-5 py-2.5 rounded shadow-sm text-xs cursor-pointer transition-colors"
                  >
                    Cancel / Discard
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded shadow-sm text-xs cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    {loading ? 'Saving Changes...' : 'Save System Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {workspacePR && (() => {
        const workspaceLinks = workspacePR.linkedRecords || {};
        const workspacePO = workspaceLinks.pos?.[0] || pos.find(po => Number(po.pr_id) === Number(workspacePR.id));
        const workspaceRFQ = workspaceLinks.rfqs?.[0] || rfqs.find(rfq => Number(rfq.pr_id) === Number(workspacePR.id));
        const workspaceIAR = workspaceLinks.iars || (workspacePO ? iars.filter(iar => Number(iar.po_id) === Number(workspacePO.id)) : []);
        const workspacePayments = workspaceLinks.payments || (workspacePO ? payments.filter(payment => Number(payment.po_id) === Number(workspacePO.id)) : []);
        const workspaceNOAs = workspaceLinks.noas || [];
        const workspaceBAC = workspaceLinks.bacResolutions || [];
        const workspaceNTPs = workspaceLinks.ntps || [];
        const workspaceDeliveries = workspaceLinks.deliveries || [];
        const workspaceAssets = workspaceLinks.assets || [];
        const stages = [
          { label: 'Purchase Request', value: formatPRStatus(workspacePR.status), complete: true },
          { label: 'Solicitation', value: workspaceRFQ?.status || 'Not started', complete: Boolean(workspaceRFQ) },
          { label: 'Purchase Order', value: workspacePO?.status || 'Not started', complete: Boolean(workspacePO) },
          { label: 'Delivery & IAR', value: workspaceIAR[0]?.status || 'Not started', complete: workspaceIAR.length > 0 },
          { label: 'Payment', value: workspacePayments[0]?.status || 'Not started', complete: workspacePayments.length > 0 }
        ];
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end" onClick={() => setWorkspacePR(null)}>
            <aside className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto" onClick={event => event.stopPropagation()}>
              <div className="sticky top-0 z-10 bg-slate-950 text-white px-6 py-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">Transaction workspace</p>
                  <h3 className="mt-1 text-lg font-bold font-mono">{workspacePR.pr_no}</h3>
                  <p className="text-xs text-slate-300 mt-1">{workspacePR.purpose}</p>
                </div>
                <div className="flex items-center gap-2">
                  {['End User', 'GSO Officer'].includes(currentUser?.role || '') && (
                    <button type="button" onClick={() => savePRForm(workspacePR, setWorkspacePR)} disabled={loading} className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded">Save Form</button>
                  )}
                  <button type="button" onClick={() => setWorkspacePR(null)} className="text-slate-300 hover:text-white p-1" aria-label="Close transaction workspace" title="Close transaction workspace"><X size={18} /></button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Purchase Request Form</h4>
                    <span className="text-[10px] font-semibold text-blue-700 uppercase">Editable preview</span>
                  </div>
                  <div className="border border-slate-300 rounded-lg bg-slate-100 p-3">
                    <PrintPR
                      pr={workspacePR}
                      department={workspacePR.department}
                      settings={systemSettings}
                      editable
                      onChange={(changes) => setWorkspacePR((current: any) => ({ ...current, ...changes }))}
                    />
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Lifecycle status</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {stages.map(stage => (
                      <div key={stage.label} className={`rounded-lg border p-2.5 ${stage.complete ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{stage.label}</span>
                        <span className={`block text-[10px] font-bold mt-1 ${stage.complete ? 'text-cyan-800' : 'text-slate-400'}`}>{stage.value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Linked records</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">RFQ</span><span className="font-mono font-bold text-slate-800">{workspaceLinks.rfqs?.map((record: any) => record.rfq_no).join(', ') || workspaceRFQ?.rfq_no || 'Not created'}</span></div>
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">BAC / NOA</span><span className="font-mono font-bold text-slate-800">{[...workspaceBAC.map((record: any) => record.resolution_no), ...workspaceNOAs.map((record: any) => record.noa_no)].join(', ') || 'Not created'}</span></div>
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">Purchase Order</span><span className="font-mono font-bold text-slate-800">{workspaceLinks.pos?.map((record: any) => record.po_no).join(', ') || workspacePO?.po_no || 'Not created'}</span></div>
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">NTP</span><span className="font-mono font-bold text-slate-800">{workspaceNTPs.map((record: any) => record.ntp_no).join(', ') || 'Not created'}</span></div>
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">Inspection reports</span><span className="font-bold text-slate-800">{workspaceIAR.length || 'None filed'}</span></div>
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">Deliveries / payments</span><span className="font-bold text-slate-800">{workspaceDeliveries.length} / {workspacePayments.length}</span></div>
                    <div className="p-3 flex justify-between gap-3 text-xs"><span className="text-slate-500">Inventory assets</span><span className="font-bold text-slate-800">{workspaceAssets.length || 'None recorded'}</span></div>
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Request items</h4>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {(workspacePR.items || []).map((item: any) => (
                      <div key={item.id} className="p-3 flex justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-700">{item.description}</span>
                        <span className="font-mono text-slate-600">{item.quantity} × {formatPesos(item.unit_cost)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Timeline</h4>
                  <div className="space-y-3">
                    {(workspacePR.audit || []).slice(0, 8).map((log: any, index: number) => (
                      <div key={`${log.id || log.timestamp}-${index}`} className="flex gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-cyan-600 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-800">{log.action === 'STATUS_CHANGE' ? 'Status changed' : log.action}</p>
                          <p className="text-[10px] text-slate-500">{log.user_name || 'System'} · {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}</p>
                        </div>
                      </div>
                    ))}
                    {(!workspacePR.audit || workspacePR.audit.length === 0) && <p className="text-xs text-slate-400 italic">No timeline events recorded.</p>}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        );
      })()}

      {/* PRINT MODAL: APPENDIX 60 (PR) */}
      {selectedPR && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono">APPENDIX 60 PRINT UTILITY</span>
              <div className="flex gap-2">
                {['End User', 'GSO Officer'].includes(currentUser?.role || '') && (
                  <button
                    onClick={() => savePRForm(selectedPR, setSelectedPR)}
                    disabled={loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                  >
                    Save Form
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print
                </button>
                <button onClick={() => setSelectedPR(null)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            <div className="bg-slate-200 p-6 rounded-lg overflow-x-auto print:bg-transparent print:p-0 print:overflow-visible">
              <PrintPR
                pr={selectedPR}
                department={selectedPR.department}
                settings={systemSettings}
                editable
                onChange={(changes) => setSelectedPR((current: any) => ({ ...current, ...changes }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: APPENDIX 61 (PO) */}
      {selectedPO && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono">APPENDIX 61 PRINT UTILITY</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print
                </button>
                <button onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            <div className="bg-slate-200 p-6 rounded-lg overflow-x-auto print:bg-transparent print:p-0 print:overflow-visible">
              <PrintPO po={selectedPO} supplier={selectedPO.supplier} department={selectedPO.department} settings={systemSettings} />
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: NOTICE TO PROCEED (NTP) */}
      {selectedNTP && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono">NOTICE TO PROCEED PRINT UTILITY</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print
                </button>
                <button onClick={() => setSelectedNTP(null)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            <div className="bg-slate-200 p-6 rounded-lg overflow-x-auto print:bg-transparent print:p-0 print:overflow-visible">
              <PrintNTP po={selectedNTP} supplier={selectedNTP.supplier} department={selectedNTP.department} settings={systemSettings} />
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: APPENDIX 62 (IAR) */}
      {selectedIAR && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono">APPENDIX 62 PRINT UTILITY</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print
                </button>
                <button onClick={() => setSelectedIAR(null)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            <div className="bg-slate-200 p-6 rounded-lg overflow-x-auto print:bg-transparent print:p-0 print:overflow-visible">
              <PrintIAR iar={selectedIAR} supplier={selectedIAR.supplier} department={selectedIAR.department} settings={systemSettings} />
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: ICS / PAR */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-3xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono">PROPERTY ASSIGNMENT SLIP UTILITY</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print
                </button>
                <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            <div className="bg-slate-200 p-6 rounded-lg overflow-x-auto print:bg-transparent print:p-0 print:overflow-visible">
              <PrintICSorPAR asset={selectedAsset.asset} department={selectedAsset.dept} settings={systemSettings} />
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL: BULK PRINT PRs */}
      {bulkPrintPRs && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-4xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono uppercase">Consolidated Purchase Request Print</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print All
                </button>
                <button onClick={() => { setBulkPrintPRs(null); setPrintDraft(null); }} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            {printDraft && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3 print:hidden">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Print PR No.
                    <input value={printDraft.pr_no} onChange={(e) => setPrintDraft({ ...printDraft, pr_no: e.target.value })} className="mt-1 w-full border border-slate-300 rounded p-2 text-xs font-mono" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Print Date
                    <input type="date" value={String(printDraft.date).slice(0, 10)} onChange={(e) => setPrintDraft({ ...printDraft, date: e.target.value })} className="mt-1 w-full border border-slate-300 rounded p-2 text-xs" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Office Section
                    <input value={printDraft.section || ''} onChange={(e) => setPrintDraft({ ...printDraft, section: e.target.value })} className="mt-1 w-full border border-slate-300 rounded p-2 text-xs" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Requested By
                    <input value={printDraft.requested_by_name || ''} onChange={(e) => setPrintDraft({ ...printDraft, requested_by_name: e.target.value })} className="mt-1 w-full border border-slate-300 rounded p-2 text-xs" />
                  </label>
                  <label className="text-[11px] font-bold text-slate-600 uppercase md:col-span-2">Purpose / Justification
                    <textarea value={printDraft.purpose || ''} onChange={(e) => setPrintDraft({ ...printDraft, purpose: e.target.value })} rows={2} className="mt-1 w-full border border-slate-300 rounded p-2 text-xs" />
                  </label>
                </div>
                <div className="bg-slate-200 p-6 rounded-lg overflow-y-auto max-h-[70vh] print:bg-transparent print:p-0 print:overflow-visible print:max-h-none">
                  <PrintPR pr={printDraft} department={printDraft.department} settings={systemSettings} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINT MODAL: BULK PRINT POs */}
      {bulkPrintPOs && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-start justify-center z-50 overflow-y-auto pt-10 pb-10 px-4 print:bg-transparent print:static print:block print:p-0 print:overflow-visible print:w-auto print:h-auto print:m-0">
          <div className="bg-slate-800 rounded-xl max-w-4xl w-full p-4 space-y-4 shadow-2xl my-auto print:bg-transparent print:shadow-none print:my-0 print:p-0 print:max-w-none">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 text-white print:hidden">
              <span className="text-xs font-bold font-mono uppercase">Bulk Purchase Order Print Utility ({bulkPrintPOs.length} Documents)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1 px-3 rounded shadow-sm flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} /> Execute Print All
                </button>
                <button onClick={() => setBulkPrintPOs(null)} className="text-slate-400 hover:text-white font-bold text-xs bg-slate-700 py-1 px-3 rounded cursor-pointer">
                  ✕ Dismiss
                </button>
              </div>
            </div>
            <div className="bg-slate-200 p-6 rounded-lg overflow-y-auto max-h-[70vh] space-y-8 print:bg-transparent print:p-0 print:overflow-visible print:max-h-none">
              {bulkPrintPOs.map((po, index) => (
                <div key={po.id || index} style={{ breakAfter: 'page' }} className="break-after-page print:break-after-page last:break-after-avoid last:print:break-after-avoid pb-6 border-b-2 border-dashed border-slate-400 print:border-0 print:pb-0">
                  <PrintPO po={po} supplier={po.supplier} department={po.department} settings={systemSettings} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REGISTER SUPPLIER MODAL */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-300 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase">Register New LGU Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Company Registered Name</label>
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                  placeholder="e.g. Manila Medical Equipment Corp."
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Tax Identification Number (TIN)</label>
                <input
                  type="text"
                  value={newSupplier.tin}
                  onChange={(e) => setNewSupplier({ ...newSupplier, tin: e.target.value })}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                  placeholder="e.g. 111-222-333-000"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Office Address</label>
                <textarea
                  value={newSupplier.address}
                  onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                  placeholder="Street, City, Province"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={newSupplier.contact_person}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Contact No.</label>
                  <input
                    type="text"
                    value={newSupplier.contact_no}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_no: e.target.value })}
                    className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Performance Rating (1-5)</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={newSupplier.performance_rating || 0}
                  onChange={(e) => setNewSupplier({ ...newSupplier, performance_rating: parseInt(e.target.value) })}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Performance Notes</label>
                <textarea
                  value={newSupplier.performance_notes || ''}
                  onChange={(e) => setNewSupplier({ ...newSupplier, performance_notes: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded shadow-sm hover:bg-slate-800"
                >
                  Register Contractor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PR ALOBS BUDGET ASSIGNMENT MODAL */}
      {budgetReviewPR && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-300 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase">Certify Funds (ALOBS) - {budgetReviewPR.pr_no}</h3>
              <button onClick={() => setBudgetReviewPR(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmitBudgetReview} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">ALOBS / CAF Number</label>
                <input
                  type="text"
                  value={alobsNumber}
                  onChange={(e) => setAlobsNumber(e.target.value)}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs font-mono font-bold text-violet-800"
                  placeholder="ALOBS-26-XX-XXXX"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Budget Officer Remarks</label>
                <textarea
                  value={budgetRemarks}
                  onChange={(e) => setBudgetRemarks(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded p-1.5 text-xs text-slate-800"
                  placeholder="Certified matching appropriate expense accounts..."
                  required
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded text-[10px] text-slate-500 italic">
                COA Rule: Assigning ALOBS locks funding blocks from municipal general/special ledger, authorizing GSO Procurement allocation.
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setBudgetReviewPR(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded shadow-sm hover:bg-violet-700"
                >
                  Certify Funding & Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: ADMIN LEDGER & DATA MANAGEMENT */}
      {activeTab === 'admin' && (
        <div className="fixed inset-0 z-30 flex" style={{ left: '256px', top: '0' }}>
          <AdminLedgerPanel
            currentUser={currentUser}
            systemSettings={systemSettings}
            apiFetch={(url, opts) =>
              fetch(url, {
                ...opts,
                headers: {
                  'Content-Type': 'application/json',
                  ...(opts?.headers || {}),
                  Authorization: `Bearer ${token}`,
                },
              })
            }
            onRefresh={() => fetchData()}
            showAlert={(type, msg) => {
              setAlert({ type, message: msg });
              setTimeout(() => setAlert(null), 5000);
            }}
          />
        </div>
      )}

      <ProcurementChatbot currentUser={currentUser} />
    </div>
  );
}
