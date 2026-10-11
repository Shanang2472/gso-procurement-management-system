# GSO Procurement Management System
## User Accounts & Role Access Matrix

**Document Date:** 2026-08-29  
**System Scope:** Philippine LGU Procurement Management System (RA 9184 & COA Compliant)

---

## Executive Summary

This document provides a detailed breakdown of all registered seed users, roles, allowed navigation tabs, active UI page actions, and backend REST API endpoint permissions in the system.

---

## 1. System Users & Accounts

The system includes internal operational accounts plus supplier-linked accounts corresponding to key local government unit (LGU) procurement roles:

| ID | Username | Account Name | Assigned Role | Assigned Department / Office | Default Password Hash Status |
|:---|:---|:---|:---|:---|:---|
| **1** | `enduser` (or `Juan dela cruz`) | Dr. Elena Perez / Juan dela cruz | **End User** | Health Office (ID: 5) | Migrated to scrypt hash |
| **2** | `gso` (or `Theresa`) | Arthur N. Ramos / Ma. Theresa | **GSO Officer** | General Services Office (ID: 4) | Migrated to scrypt hash |
| **3** | `bac` (or `Cruz`) | Atty. Susan Cruz | **BAC Secretariat** | Bids and Awards Committee (Unassigned Dept) | Migrated to scrypt hash |
| **4** | `budget` (or `Urbiztondo`) | Engr. Roberto D. Santos | **Budget Officer** | Municipal Budget Office (ID: 2) | Migrated to scrypt hash |
| **5** | `mayor` (or `Nieto`) | Hon. Johnielle Keith Pasion Nieto | **Mayor** | Office of the Mayor (ID: 1) | Migrated to scrypt hash |

Supplier accounts use the **Supplier** role and must be linked to one record in the Supplier Registry through `supplier_id`.

---

## 2. Navigation Tabs & Module Access Matrix

The navigation sidebar displays tabs conditionally based on the logged-in user's role. Attempting to navigate directly to an unauthorized tab automatically redirects the user to their first allowed module.

| Navigation Tab / Module | Module Description | End User | Budget Officer | BAC Secretariat | GSO Officer | Mayor |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| `planning` | Project Procurement Planning (PPMP / APP) | ✅ *(Dept Only)* | ✅ *(Review)* | ❌ Forbidden | ✅ | ✅ |
| `pr` | Purchase Request (PR) Directory | ✅ *(Dept Only)* | ✅ *(ALOBS)* | ✅ *(Read)* | ✅ | ✅ |
| `rfq` | Request for Quotation (RFQ) Solicitation | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ | ✅ |
| `bidding` | Abstract of Canvass (AOC) Bidding Matrix | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ | ✅ |
| `bac` | BAC Committee Resolutions & NOA | ❌ Forbidden | ✅ *(Read)* | ✅ | ✅ *(Read)* | ✅ |
| `po` | Purchase Order (PO) & NTP Contracts | ❌ Forbidden | ✅ *(Read)* | ❌ Forbidden | ✅ | ✅ |
| `iar` | Inspection & Acceptance Report (IAR) | ✅ *(Dept Only)* | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ |
| `inventory` | Property Inventory (ICS / PAR Tags) | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ |
| `distribution` | Asset Distribution - Requisition & Issuance (RIS) | ✅ *(Dept Only)* | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ |
| `disposal` | Property Disposal (IIRUP Reports) | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ |
| `philgeps` | PhilGEPS e-Procurement Engine | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ | ✅ |
| `audit` | System Audit Trail & LGU Logs | ❌ Forbidden | ✅ | ✅ | ✅ | ✅ |
| `analytics` | Strategic Procurement Spending Analytics | ❌ Forbidden | ✅ | ✅ | ✅ | ✅ |
| `settings` | System Settings & Signatories | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ |
| `admin` | Admin Master Ledger & Data Cleanup | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | ✅ | ✅ |
| `supplier` | Supplier RFQ and Quotation Portal | ✅ Own invitations only | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |

---

## 3. Detailed Page Actions & Role Permissions Breakdown

### 3.1. `End User` (Department Personnel / Department Head)
- **Primary Responsibility:** Submit project procurement plans (PPMP), initiate purchase requests for departmental needs, receive delivered items, and request asset issuance.
- **Allowed Actions:**
  - View & Create PPMP items for their **own assigned department**.
  - View & Submit Purchase Requests (PR) for their **own assigned department**.
  - Cancel PRs submitted by their department if status is `Pending`.
  - View Inspection & Acceptance Reports (IAR) for items delivered to their department.
  - Submit Requisition & Issuance Slip (RIS) requests to obtain inventory items for their department.
  - Return issued property assets back to GSO central storage.
- **Forbidden Actions:**
  - Cannot access system-wide Spending Analytics.
  - Cannot approve budget, allocate ALOBS, or set procurement modes.
  - Cannot create RFQs, input bids, pass BAC resolutions, or issue POs/NTPs.
  - Cannot conduct official IAR inspections or approve property disposals.
  - Cannot access Audit Trail, System Settings, PhilGEPS Portal, or Admin Cleanup.

---

### 3.2. `Budget Officer` (Municipal Budget Office)
- **Primary Responsibility:** Certify budget availability, allocate ALOBS (Appropriation, Obligation, and Allotment Balance Slip) numbers, and monitor LGU spending.
- **Allowed Actions:**
  - Review PPMP items across all municipal departments.
  - Review Purchase Requests (PR) and certify budget availability (`Pending` $\rightarrow$ `Budget_Review`).
  - Assign ALOBS Number and ALOBS Date to Purchase Requests.
  - Review Purchase Orders (PO) for budget certification.
  - Access Strategic Spending Analytics and Budget Utilization dashboards.
  - View System Audit Logs.
- **Forbidden Actions:**
  - Cannot create PRs for end-user departments.
  - Cannot create RFQs, record bids, pass BAC resolutions, or issue PO contracts.
  - Cannot perform physical delivery inspections (IAR) or issue/dispose property.
  - Cannot edit LGU System Signatories/Settings or execute Admin ledger deletions.

---

### 3.3. `BAC Secretariat` (Bids and Awards Committee)
- **Primary Responsibility:** Manage solicitation, RFQs, Abstract of Canvass bidding matrix, BAC committee resolutions, Notice of Award (NOA), and PhilGEPS exports.
- **Allowed Actions:**
  - View approved Purchase Requests ready for procurement.
  - Review and coordinate PRs that are ready for GSO and Mayor action.
  - Create and post Requests for Quotation (RFQ) based on approved PRs.
  - Record supplier bids and evaluate Abstract of Canvass (lowest calculated responsive bid).
  - Draft and pass BAC Committee Resolutions and Notice of Award (NOA).
  - Manage PhilGEPS e-Procurement XML exports and posting statuses.
  - Manage Supplier Registry (register, update, rate suppliers).
  - View Strategic Spending Analytics and System Audit Trail.
- **Forbidden Actions:**
  - Cannot create end-user PPMP or PRs.
  - Cannot certify budget or issue ALOBS numbers.
  - Cannot create or sign Purchase Order (PO) / Notice to Proceed (NTP) contracts (GSO responsibility).
  - Cannot inspect deliveries (IAR), manage physical inventory, or approve property disposals.
  - Cannot edit LGU System Settings or delete system records.

---

### 3.4. `GSO Officer` (General Services Office / Property Officer)
- **Primary Responsibility:** Oversee procurement technical review, contract issuance (PO/NTP), physical inspection/acceptance (IAR), property inventory (ICS/PAR), asset distribution (RIS), and property disposal (IIRUP).
- **Allowed Actions:**
  - Conduct GSO technical review on PRs (`Budget_Review` $\rightarrow$ `GSO_Review`) and assign procurement mode (Shopping, SVP, Bidding).
  - Submit PR for Mayor approval (`GSO_Review` $\rightarrow$ `For_Approval`).
  - Generate and issue Purchase Orders (PO) and Notice to Proceed (NTP) to winning suppliers.
  - Conduct delivery inspection and generate Inspection & Acceptance Reports (IAR).
  - Manage Property Inventory tags (ICS for items $<\mathbb{P}50,000$, PAR for items $\ge\mathbb{P}50,000$).
  - Issue Requisition and Issuance Slips (RIS) and manage asset custody transfers.
  - Process Inventory & Inspection Reports of Unserviceable Property (IIRUP) for disposal.
  - Access PhilGEPS Portal, Strategic Analytics, System Audit Trail, System Settings, and Admin Master Ledger.

### 3.5. `Supplier`
- **Primary Responsibility:** Respond to invited RFQs and confirm submitted quotations through the supplier portal.
- **Allowed Actions:**
  - View only RFQs invited to the linked supplier registry record.
  - Submit one complete quotation for every RFQ item before the closing date.
  - Update a quotation before the deadline; each submission is time-stamped and linked to the authenticated account.
- **Forbidden Actions:**
  - Cannot view other suppliers' quotations.
  - Cannot access PR, budget, BAC resolution, PO creation, inspection, payment, or administration modules.
- **Forbidden Actions:**
  - Cannot issue ALOBS budget certifications (Budget Officer role).
  - Cannot approve final PRs or approve IIRUP property disposals (Mayor role).
  - Cannot delete finalized database records (Mayor role only).

---

### 3.5. `Mayor` (Local Chief Executive / Head of Procuring Entity - HOPE)
- **Primary Responsibility:** Executive approval, final procurement authorization, contract approval, property disposal authorization, system configuration, and audit control.
- **Allowed Actions:**
  - Final Approval of Purchase Requests (`For_Approval` $\rightarrow$ `Approved`).
  - Disapprove or Cancel PRs at any processing stage with required remarks.
  - Approve BAC Resolutions and Notice of Award (NOA).
  - Approve Purchase Orders (PO) and Notice to Proceed (NTP).
  - Approve IIRUP Property Disposal Requests (`Submitted` $\rightarrow$ `Approved` $\rightarrow$ `Disposed`).
  - View and manage all modules across the LGU procurement workflow.
  - Access and modify LGU System Settings and Signatories.
  - Access Admin Master Ledger, export full database ledgers, and execute record deletions/cleanup.
- **Forbidden Actions:**
  - None (HOPE holds full administrative oversight and approval authority under RA 9184).

---

## 4. Backend REST API Endpoint Security Authorization

Every API request is authenticated via opaque session tokens and checked against user role and department scopes:

| API Endpoint Path | HTTP Method | Minimum Required Roles | Department Scope Enforcement |
|:---|:---:|:---|:---|
| `/api/auth/login` | `POST` | Public | None |
| `/api/auth/logout` | `POST` | Authenticated | Current Session |
| `/api/auth/me` | `GET` | Authenticated | Current Session |
| `/api/ppmp` | `GET` | End User, GSO Officer, Budget Officer, Mayor | Filtered by department for End User |
| `/api/ppmp` | `POST` | End User, GSO Officer, Budget Officer, Mayor | Enforced `canAccessDepartment` |
| `/api/pr` | `GET` | End User, GSO Officer, Budget Officer, Mayor, BAC Secretariat | Filtered by department for End User |
| `/api/pr` | `POST` | End User, GSO Officer, Budget Officer | Enforced `canAccessDepartment` |
| `/api/pr/:id` | `GET` | End User, GSO Officer, Budget Officer, Mayor, BAC Secretariat | Enforced `canAccessDepartment` |
| `/api/pr/:id/status` | `PUT` | State-machine role mapping (`allowedPRStatusRoles`) | Enforced `canAccessDepartment` |
| `/api/pr/:id/audit` | `GET` | End User, GSO Officer, Budget Officer, Mayor, BAC Secretariat | Enforced `canAccessDepartment` |
| `/api/rfq` | `GET` | GSO Officer, BAC Secretariat, Mayor | Filtered by department for End User |
| `/api/rfq` | `POST` | GSO Officer, BAC Secretariat | Enforced `canAccessDepartment` |
| `/api/rfq/:id/bids` | `GET` / `POST` | GSO Officer, BAC Secretariat | Enforced `canAccessDepartment` |
| `/api/bac-resolutions` | `GET` / `POST` | BAC Secretariat, Mayor, GSO Officer, Budget Officer | System-wide |
| `/api/po` | `GET` / `POST` / `GET :id` | GSO Officer, Budget Officer, Mayor | Filtered by department for End User |
| `/api/suppliers` | `GET` / `POST` | GSO Officer, BAC Secretariat, Mayor, Budget Officer | System-wide |
| `/api/iar` | `GET` / `POST` / `GET :id` | GSO Officer, Mayor, End User | Filtered by department for End User |
| `/api/inventory` | `GET` | GSO Officer, Mayor | Filtered by department for End User |
| `/api/inventory/:id/transfer` | `POST` | GSO Officer, Mayor | System-wide |
| `/api/inventory/:id/return` | `POST` | End User, GSO Officer, Mayor | Enforced `canAccessDepartment` |
| `/api/ris` | `GET` / `POST` | GSO Officer, Mayor, End User | Filtered by department for End User |
| `/api/iirup` | `GET` / `POST` / `PUT status` | GSO Officer, Mayor | Filtered by department for End User |
| `/api/philgeps/post` / `award` | `POST` | BAC Secretariat, GSO Officer, Mayor | System-wide |
| `/api/audit-logs` | `GET` | Mayor, GSO Officer, BAC Secretariat | System-wide |
| `/api/settings` | `GET` / `PUT` | Mayor, GSO Officer | System-wide |
| `/api/ledger/export` | `GET` | Mayor, GSO Officer | System-wide |
| `/api/ppmp/:id` to `/api/audit-logs/clear` | `DELETE` | **Mayor Only** | Strict Mayor Privilege |

---

## 5. Verification & Audit Trail Compliance

All actions listed above are automatically logged in the immutable `audit_logs` table with:
- Target Table & Record ID
- Action Type (`CREATE`, `UPDATE`, `STATUS_CHANGE`, `DELETE`, `LEDGER_EXPORT`, `BULK_CLEAR`)
- Authenticated User Name & User Role
- Old Value & New Value JSON Snapshots
- Immutable Timestamp
