# GSO Procurement Management System Review

**Review date:** 2026-09-16  
**Scope:** Backend routes and action functions, frontend API callers and displays, database schema/migrations, workflow/compliance helpers, reports, documentation, tests, and available build checks.  
**Review method:** Static end-to-end tracing of the Express handlers, MySQL queries, React state/display paths, schema/migration definitions, and all repository test commands. No production database mutation was performed.

## Executive Summary

The project compiles and all seven focused utility/rule test commands pass, but those tests do not exercise the Express handlers, MySQL transactions, role boundaries, report queries, or React data mapping. The highest-risk defects are:

1. Authorization is incomplete on several read/write endpoints.
2. Related procurement records are often written in separate operations without one transaction.
3. Workflow/compliance rules are bypassed or satisfied with hardcoded placeholder documents.
4. Finance/reporting calculations use inconsistent or incorrect source values.
5. Several frontend dashboards intentionally display estimates or zeros instead of source-backed values.
6. The schema/migration process is not safely repeatable and runtime DDL hides deployment failures.

Severity is based on likely impact: **Critical** can expose data or corrupt a legal/financial record; **High** can create materially incorrect workflow or money data; **Medium** causes incorrect/incomplete user behavior or operational risk; **Low** is documentation/test/debt that still blocks confidence.

## Critical Findings

### C-01: Supplier accounts can read the global supplier portal summary

- **Evidence:** `server_mysql.routes_patch.ts` `/api/supplier/portal/summary` permits the `Supplier` role, but its queries return total supplier counts and `supplierPerformance` for every supplier.
- **Impact:** Any supplier account can see other suppliers' names, email addresses, TINs, performance ratings, and notes. This violates supplier isolation and leaks sensitive registry data.
- **Verification:** Log in as a Supplier and call `GET /api/supplier/portal/summary`; confirm the response contains all suppliers.
- **Required correction:** Return a supplier-scoped summary for Supplier sessions; reserve global summary data for authorized staff.

### C-02: Notification read endpoint has an IDOR and read-all does not protect per-user state

- **Evidence:** `server_mysql.routes_patch.ts` `/api/notifications/:id/read` updates `is_read` using only the notification ID. It does not include the authenticated user's scope in the `UPDATE` condition.
- **Impact:** Any authenticated user can mark another user's notification as read. This destroys the recipient's unread state and auditability.
- **Verification:** Create or identify a notification for user A, authenticate as user B, call `PUT /api/notifications/{id}/read`, and verify it changes.
- **Required correction:** Update only notifications visible to the current user using the same user/department/role predicate used by the list endpoint.

### C-03: Any authenticated user can create arbitrary notifications

- **Evidence:** `server_mysql.routes_patch.ts` `/api/notifications` uses only `authenticate`, accepts arbitrary `user_id`, `department_id`, `target_role`, title, and message, and does not restrict the caller role or validate target scope.
- **Impact:** A normal user can impersonate system notifications, send messages to all users or privileged roles, or create misleading workflow notices.
- **Verification:** Authenticate as an End User and POST a notification targeting `Mayor` or a different user.
- **Required correction:** Remove the public mutation endpoint or restrict it to a notification service/internal roles with validated templates and targets.

### C-04: Document archive and signing endpoints omit record-level access checks

- **Evidence:** `server_mysql.routes_patch.ts` `/api/documents/:id/archive` and `/api/documents/:id/sign` check the role but never call `canAccessDocumentRecord`. They load any document by ID and mutate/sign it.
- **Impact:** An authorized staff member can archive or sign a document belonging to an unrelated record. The signature is not proof that the signer was authorized for that procurement record.
- **Verification:** Authenticate as an allowed staff role and use a document ID from another department/transaction; call archive/sign and inspect the result.
- **Required correction:** Resolve the document's `table_name`/`record_id`, enforce record ownership/module permissions, reject archived documents, and validate the required signatory role for the stage.

### C-05: Document access is fail-open for unfiltered global listings for lower-privilege users

- **Evidence:** `GET /api/documents` allows End User and Supplier. If `table_name` and `record_id` are omitted, it selects all document metadata without applying `canAccessDocumentRecord` row-by-row.
- **Impact:** A Supplier or End User can list filenames, metadata, checksums, extracted text, and record IDs for unrelated transactions.
- **Verification:** Call `GET /api/documents` as Supplier or End User with no query parameters.
- **Required correction:** Require a scoped record query for limited roles or filter every returned row through a server-side ownership query.

### C-06: Asset movement history is readable by any authenticated user

- **Evidence:** `GET /api/asset-movements/:assetId` uses `authenticate` only and returns movement history for any asset ID without checking the asset's department or role.
- **Impact:** End Users can enumerate custody and disposal history for assets outside their department; suppliers with sessions can also reach the route unless blocked elsewhere by frontend navigation.
- **Verification:** Call the endpoint as a lower-privilege user with an asset ID from another department.
- **Required correction:** Require the inventory roles and enforce asset department scope for End Users.

### C-07: Supplier status updates and delivery-confirmation status updates lack ownership and transition enforcement

- **Evidence:** Supplier lifecycle updates allow statuses to jump arbitrarily among the enum values. Delivery confirmation status accepts `Accepted`, `Rejected`, or `Correction_Required` without checking current status, PO state, department ownership, or whether the actor is the assigned reviewer.
- **Impact:** Supplier records and delivery decisions can move backward or be finalized without a controlled state machine. Performance scores and reporting can be falsified by status changes.
- **Verification:** Move an Active supplier directly to Rejected, or repeatedly change one delivery confirmation between all three statuses.
- **Required correction:** Define transitions, enforce them server-side, and record the reason/authority for each transition.

## High Findings

### H-01: PR creation is not transactional and can leave orphaned/incomplete PRs

- **Evidence:** `POST /api/pr` inserts `purchase_requests`, then inserts each `pr_items` row in a loop, then logs and notifies. There is no `withTransaction` around the parent and children.
- **Impact:** A bad item, foreign-key failure, duplicate number, or process interruption can leave a PR without all items. The user receives a 500 even though the parent may already exist.
- **Verification:** Submit a PR with one valid item followed by an invalid `ppmp_item_id`; inspect the database after the 500 response.
- **Required correction:** Validate all items before writing and create the PR, items, audit event, and relevant notification in one transaction or use compensating cleanup.

### H-02: PR creation accepts invalid item payloads and does not recalculate item totals

- **Evidence:** The handler validates only that `items` is a non-empty array. It forwards item fields to `db.insert('pr_items', ...)`, including client-supplied `total_cost`, without checking positive integer quantity, finite non-negative unit cost, description, unit, or PPMP relationship.
- **Impact:** PR totals and all downstream finance/reporting values can be incorrect or can fail later on database constraints.
- **Verification:** Submit negative quantities, a mismatched `total_cost`, or an arbitrary `ppmp_item_id`; compare stored rows and list totals.
- **Required correction:** Use a strict DTO, calculate `total_cost = quantity * unit_cost` server-side, and verify each referenced PPMP item belongs to the department/year where required.

### H-03: PR edit can modify finalized records and rewrites child items outside a transaction

- **Evidence:** `PUT /api/pr/:id` permits End User and GSO Officer but checks neither PR status nor workflow role. It updates the parent, deletes all `pr_items`, then reinserts them in separate calls.
- **Impact:** Approved or in-process procurement can be changed after approval, invalidating RFQ/PO relationships and audit history. A failure between delete and insert can erase all items.
- **Verification:** Edit an Approved PR or force an invalid child insert after the delete; inspect workflow links and stored items.
- **Required correction:** Permit edits only in Draft/Returned/For_Correction states, enforce role-specific fields, and update parent/items transactionally with revision/audit details.

### H-04: GSO and other non-End-User roles bypass department scope by design

- **Evidence:** `canAccessDepartment` returns true for every role except End User. This is used by PR edits, status changes, PO/IAR/payment actions, documents, and inventory-related paths.
- **Impact:** The code does not match the documented department-scoped access model for operational roles. Any GSO officer, for example, can modify any department's PR or process any transaction.
- **Verification:** Authenticate as a GSO user and mutate/read a transaction belonging to a different department; observe the request is accepted.
- **Required correction:** Define explicit system-wide versus department-scoped roles and use route-specific authorization policies instead of one broad helper.

### H-05: PR status transition rules are not consistently aligned with the UI and documented flow

- **Evidence:** `src/App.tsx` has `PR_STATUS_FLOW` without Submitted, Returned, For_Correction, Disapproved, or Cancelled. The UI metadata says Approved proceeds to RFQ, while the backend status engine still treats downstream workflow separately. `GSO_SYSTEM_FLOW_USER_GUIDE.md` says Returned is not yet implemented, while the backend exposes it.
- **Impact:** Users can see incomplete queues/actions or be directed to the wrong next module. Documentation and actual status behavior disagree.
- **Verification:** Test a PR in Submitted, Returned, For_Correction, Disapproved, and Cancelled states in the UI and compare available actions with `/api/workflow/rules`.
- **Required correction:** Generate UI action visibility and labels from one backend-provided workflow registry and update the guide to match.

### H-06: RFQ creation publishes immediately, does not audit the creation, and can partially write

- **Evidence:** `POST /api/rfq` inserts an RFQ with status `Published`, inserts items in a loop, creates invitations for every supplier, and sends notifications. No transaction or RFQ CREATE/STATUS audit is used.
- **Impact:** A partially created published solicitation can invite suppliers without complete requirements. There is no reliable audit record of who created/published it.
- **Verification:** Cause a child insert or invitation insert to fail and inspect the RFQ, items, invitations, and audit log.
- **Required correction:** Create Draft first or intentionally publish only after validation, use one transaction, restrict invitations to eligible active suppliers, and audit the publication.

### H-07: RFQ invitations are sent to every supplier regardless of lifecycle status

- **Evidence:** The RFQ handler runs `SELECT id FROM suppliers` without filtering `supplier_status`, `email_verified`, or eligibility.
- **Impact:** Pending, Suspended, Rejected, or unverified suppliers receive invitations and are counted in solicitation activity.
- **Verification:** Create suppliers in each status, create an RFQ, and inspect `rfq_supplier_invitations` and notifications.
- **Required correction:** Invite only eligible active/verified suppliers and record why a supplier was excluded.

### H-08: Manual bid entry lacks RFQ department authorization and supplier/invitation validation

- **Evidence:** `POST /api/rfq/:id/bids` requires a GSO/BAC role but loads only RFQ status. It does not check the linked PR department, supplier existence/status, invitation status, or that a supplier has been invited.
- **Impact:** A staff user can enter bids for an unrelated department and create bids for arbitrary suppliers, including suppliers not invited to the RFQ.
- **Verification:** Post bids for an RFQ outside the user's intended scope or with a supplier not in `rfq_supplier_invitations`.
- **Required correction:** Enforce RFQ scope and supplier invitation/eligibility, then write bid replacement in a transaction with audit logging.

### H-09: Bid replacement is destructive and non-transactional

- **Evidence:** The same bid endpoint deletes all `abstract_bids` for the RFQ before inserting normalized bids one by one.
- **Impact:** Any insert failure or concurrent request can erase the existing abstract and leave incomplete bidder data.
- **Verification:** Submit one invalid later bid or interrupt the request after deletion; inspect the abstract.
- **Required correction:** Validate the complete replacement first and replace rows in a transaction with locking/version checks.

### H-10: BAC award and NOA creation are not atomic and have inconsistent validation

- **Evidence:** BAC award creates a signed resolution, updates RFQ to Closed, creates NOA, then audits only the resolution and NOA. These are separate writes. The separate `POST /api/noa` route can create an NOA without checking BAC status, RFQ state, department scope, or audit logging.
- **Impact:** A failure can leave a signed resolution with an open RFQ or a closed RFQ without an NOA. The separate route can create an award from an unsigned/draft resolution.
- **Verification:** Force a failure between the three writes; call `POST /api/noa` with a Draft BAC resolution.
- **Required correction:** Use one award transaction and one canonical award path; enforce BAC signed status, RFQ closed state, winner eligibility, and audit all status changes.

### H-11: PO compliance validates placeholder documents instead of stored documents

- **Evidence:** `POST /api/po` calls compliance with `requiredDocuments: ['Approved Purchase Request']` and `availableDocuments: ['Approved Purchase Request']` regardless of actual document records.
- **Impact:** A PO passes the document-completeness check even when no approved PR, NOA, or supporting document exists in document storage.
- **Verification:** Create an otherwise eligible PO for a PR with no document records and observe it passes this check.
- **Required correction:** Load actual non-archived document records and validate the complete PO checklist against them.

### H-12: PO accepts caller-supplied line items and totals without proving they belong to the PR

- **Evidence:** When `items` is supplied, the handler uses it instead of loading all PR items. It validates quantity and unit cost but does not verify `pr_item_id` belongs to the PR or recompute/compare `total_cost`.
- **Impact:** A PO can contain another PR's line item or a manipulated total, causing contract, inventory, and finance totals to diverge.
- **Verification:** Submit a valid PR/NOA with an item ID from another PR and a mismatched total.
- **Required correction:** Derive allowed lines from the PR, reject unknown IDs, and calculate totals server-side.

### H-13: PO amount is not checked against the approved PR amount

- **Evidence:** Finance rules include `PO_EXCEEDS_PR`, but PO creation only evaluates the PR amount and hardcodes available documents. It never compares the requested PO line total with the PR total.
- **Impact:** The live PO creation path can create a contract exceeding the approved request even though the finance helper claims to detect that condition elsewhere.
- **Verification:** Create a PO with a line total greater than the PR total and inspect the response.
- **Required correction:** Calculate the proposed PO total and reject or explicitly authorize an excess before insertion.

### H-14: IAR completion can mark a PO fully delivered using rejected/unaccepted quantities

- **Evidence:** `/api/iar` stores `is_accepted`, but the `fullyDelivered` query sums `quantity_delivered` without filtering `is_accepted = TRUE`. The validation also limits cumulative delivery using all IAR quantities, not accepted quantities.
- **Impact:** Rejected or partially accepted goods can make the PO Fully_Delivered and later satisfy payment completion conditions.
- **Verification:** Submit an IAR with `is_accepted: false` for the full quantity and inspect the PO status and payment eligibility.
- **Required correction:** Separate delivered, inspected, accepted, rejected, and corrected quantities; only accepted quantity may complete a PO/payment.

### H-15: IAR does not require all PO lines for a full IAR

- **Evidence:** A non-partial request is accepted when it contains at least one item; no check requires every PO item to be included and accepted before status `Completed`.
- **Impact:** A multi-line PO can receive a Completed IAR with missing lines, while the PO status calculation may still be inconsistent.
- **Verification:** Create a PO with two items and submit a non-partial IAR containing one.
- **Required correction:** Require complete line coverage for Completed; use Partial only for incomplete deliveries.

### H-16: Finance reconciliation treats missing budget allotment as zero available balance

- **Evidence:** Reconciliation passes `Number(row.allotment_amount || 0) - Number(row.allotment_utilized || 0)` to `allotmentBalance`. A missing allotment therefore becomes `0`, and any positive PO triggers `PO_EXCEEDS_ALLOTMENT`.
- **Impact:** Records without an allotment row are reported as finance exceptions even when the system has no configured budget source. This makes the dashboard misleading and can block/overstate problems.
- **Verification:** Run `/api/finance/reconciliation` for a department/year without a `budget_allotments` row and inspect exceptions.
- **Required correction:** Preserve NULL for “not configured” and report it separately from an exhausted zero balance.

### H-17: Finance due-date/aging uses PO date as the due date

- **Evidence:** `/api/finance/reconciliation` sets `dueDate` from `MAX(po.po_date)`. No payment due date or contract/payment term is used.
- **Impact:** Aging and overdue statuses are based on the order date rather than the actual contractual payment/delivery due date.
- **Verification:** Use a PO with a later delivery/payment term and inspect `agingStatus`.
- **Required correction:** Store and use explicit due dates derived from the approved payment terms or a finance schedule.

### H-18: Finance reconciliation SQL references an IAR column that is not in the schema

- **Evidence:** Its IAR subquery uses `iri.unit_price`; `schema.sql` defines `iar_items` with `quantity_delivered` and `is_accepted`, not `unit_price`.
- **Impact:** `/api/finance/reconciliation` can fail with an unknown-column SQL error on a database created from the repository schema.
- **Verification:** Run the endpoint against a clean schema and inspect the SQL error; compare the query with the `iar_items` definition.
- **Required correction:** Use PO item unit cost or add a deliberate IAR valuation column with migration and business rules.

### H-19: Reporting duplicates or distorts records through one-to-many joins

- **Evidence:** `getReportingDataset` joins `purchase_requests` to `pr_items` and `ppmp_items`, then groups by `ppmp.category` while also joining aggregated PO/IAR/payment subqueries. A PR with multiple categories can produce multiple rows, and the aggregate sums each row.
- **Impact:** Department/category/mode spending, obligations, supplier reliability, and exported totals can be overstated or split inconsistently.
- **Verification:** Create one PR with two item categories and one PO; compare API totals with source totals.
- **Required correction:** Aggregate item categories separately or at a stable PR/PO grain before joining financial aggregates.

### H-20: Frontend analytics calculates PO spending from PR totals, not PO values

- **Evidence:** `src/components/ProcurementAnalytics.tsx` enriches each PO with `matchingPR.total_amount` and uses that as `amount`; it never uses `po_items.total_cost` or an API-provided PO amount.
- **Impact:** Spending, public-bidding ratio, department trends, and lead-time cards can display incorrect figures whenever the PO differs from the PR.
- **Verification:** Use a PR total of 245,000 and PO total of 238,500; compare the analytics card to the PO ledger.
- **Required correction:** Consume source-backed reporting metrics or load PO item totals.

### H-21: Budget dashboard category obligations are permanently displayed as zero

- **Evidence:** `src/components/BudgetUtilizationDashboard.tsx` returns `Obligations: 0` for every category and contains comments acknowledging the calculation is only an approximation that was not implemented.
- **Impact:** Switching to “By Category” produces a false chart and makes category utilization unusable.
- **Verification:** Select the category breakdown with active PRs and observe all obligation bars are zero.
- **Required correction:** Load PR item/category mappings and aggregate obligations by category, or label the view unavailable until implemented.

### H-22: Frontend analytics ignores the source-backed reporting endpoint

- **Evidence:** `src/App.tsx` passes local `departments`, `prs`, and `pos` into `ProcurementAnalytics`; the component computes its own simplified metrics instead of using `/api/reporting/metrics`.
- **Impact:** The UI and backend report/export can disagree, and frontend filters cannot represent the backend's date, supplier, status, and mode filters.
- **Verification:** Compare the analytics screen with `/api/reporting/metrics` for the same period and records.
- **Required correction:** Use one report dataset and shared filter state for cards, charts, and exports.

## Medium Findings

### M-01: IIRUP list route has dead End User filtering and does not match the documented access matrix

- **Evidence:** `GET /api/iirup` requires only GSO Officer or Mayor, but its response contains an End User branch that can never run.
- **Impact:** The implementation and access documentation disagree; there is no supported department-scoped End User disposal view.
- **Required correction:** Either deliberately exclude End Users everywhere or add the documented role and scope.

### M-02: Payment list route has dead End User filtering and payment creation is broader than documented

- **Evidence:** `GET /api/payments` excludes End User in `requireRoles` but contains an End User filter. `POST /api/payments` permits GSO Officer and Mayor as creators, while the role matrix assigns payment processing to Finance.
- **Impact:** The UI/API contract is inconsistent and non-Finance users can create financial records.
- **Required correction:** Align route roles, UI navigation, and the role matrix; enforce finance separation of duties.

### M-03: `/api/rfq` has dead End User filtering and the frontend/API role matrix is inconsistent

- **Evidence:** The route requires GSO/BAC/Mayor, yet filters as if End User can access it. The module access map also includes Finance Officer while this route does not.
- **Impact:** Finance navigation/API expectations can fail, while dead code obscures the intended policy.
- **Required correction:** Centralize module access and remove contradictory route branches.

### M-04: PR numbering, RFQ numbering, PO numbering, and related sequences are race-prone

- **Evidence:** Multiple handlers query the latest number and then insert the next number without a lock or unique-conflict retry.
- **Impact:** Concurrent requests can generate duplicate numbers and return 500 errors after partially doing work.
- **Required correction:** Use database sequences/locked counters or insert with retry under a unique constraint.

### M-05: Runtime DDL silently hides deployment/schema failures

- **Evidence:** `ensureDocumentRecordsTable` catches and logs errors without failing the request; `ensureSupplierPortalTables` ignores `ER_BAD_FIELD_ERROR` for the status alteration; several tables are created lazily inside request handlers.
- **Impact:** A deployment can appear healthy while features fail later or operate against an incomplete schema.
- **Required correction:** Apply versioned migrations before startup, fail readiness on missing required schema, and remove request-time DDL.

### M-06: Document migration is not idempotent

- **Evidence:** `migration_2026_09_15_document_management.sql` creates `document_records` with `mime_type`, `file_data`, and `extracted_text`, then unconditionally runs `ALTER TABLE ... ADD COLUMN` for the same columns.
- **Impact:** Running this migration against a fresh database fails, contradicting the documented date-ordered migration process.
- **Required correction:** Use conditional migration logic or remove duplicate ALTER statements.

### M-07: Database verification checks too few tables for the application

- **Evidence:** `scripts/verify-database.mjs` checks only 15 tables, while routes use payments documents, RFQ invitation/quotation tables, inventory, RIS, IIRUP, NOA/NTP, PhilGEPS, notifications, and others.
- **Impact:** `npm run db:verify` can pass while required runtime tables are missing.
- **Required correction:** Verify every required table, key columns, enums, indexes, and migration version.

### M-08: Document metadata endpoint can bypass validation when `file_size` is zero/missing

- **Evidence:** `POST /api/documents` runs `validateDocumentPayload` but only rejects when `file_size` is truthy. A missing/zero file size skips validation entirely.
- **Impact:** Unsupported MIME types, invalid names, and impossible metadata records can be stored through the metadata API.
- **Required correction:** Always validate required file metadata, or separate metadata-only records from uploaded content with explicit rules.

### M-09: Document upload accepts caller-supplied extracted text without integrity or provenance controls

- **Evidence:** `/api/documents/upload` uses `extracted_text` from the request instead of OCR and marks it Completed.
- **Impact:** Search and compliance can rely on unverified text that was not derived from the uploaded file.
- **Required correction:** Treat client text as a note or require privileged override with audit; otherwise derive and hash OCR output server-side.

### M-10: OCR worker cleanup is not guaranteed on recognition failure

- **Evidence:** `src/ocr.ts` terminates the Tesseract worker only after the recognition loop succeeds.
- **Impact:** Repeated OCR failures can leak worker resources and eventually make uploads hang or fail.
- **Required correction:** Use `try/finally` around worker creation/use and always terminate it.

### M-11: Encryption key handling permits a predictable development key and no key rotation path

- **Evidence:** `src/documentEncryption.ts` uses a fixed development fallback key outside production and stores only an integer encryption version.
- **Impact:** Any development database/document export encrypted with the fallback is decryptable by anyone with the source; production key rotation is not supported by the data model.
- **Required correction:** Require an explicit key outside tests, store key version/key identifiers, and define migration/rotation procedures.

### M-12: PhilGEPS posting is a simulated local record, not an external integration

- **Evidence:** `server_mysql.ts` `/api/philgeps/post` constructs XML and hardcodes `HTTP/1.1 200 OK`, success response, sender, agency, and compliance text. No external PhilGEPS API call or acknowledgement is made.
- **Impact:** The UI can report a posting as successful when nothing was submitted externally.
- **Required correction:** Integrate with the approved endpoint or label the feature as draft/export-only and require human confirmation.

### M-13: PhilGEPS award endpoint does not validate required inputs or posting state

- **Evidence:** `/api/philgeps/award` checks only `posting_id` existence and updates it to Awarded; `winning_supplier_name`, `award_amount`, and `noa_id` can be missing or unrelated.
- **Impact:** Any existing posting can be marked awarded with false or incomplete award details.
- **Required correction:** Validate the posting lifecycle, linked NOA, supplier, amount, and award authorization.

### M-14: Chatbot behavior is inconsistent because two `/api/chat` handlers exist

- **Evidence:** `server_mysql.ts` registers a Gemini-backed chat handler before `attachAllRoutes`; `server_mysql.routes_patch.ts` later registers a simulated fixed-response handler.
- **Impact:** Behavior depends on route registration order, and the later route is effectively unreachable under Express's first-response flow. The source gives contradictory expectations about whether AI is real or simulated.
- **Required correction:** Keep one handler and one documented configuration path.

### M-15: Finance exception resolution does not verify the exception is open or verify the underlying issue is fixed

- **Evidence:** `/api/finance/exceptions/:id/resolve` updates any row to Resolved, regardless of current status or new evidence.
- **Impact:** Open reconciliation discrepancies can be closed without correction or approval.
- **Required correction:** Require a resolution note/evidence, restrict transitions, and prevent resolving already closed records.

### M-16: Inventory stock balance calculation treats all transaction types identically

- **Evidence:** `/api/supplies/transactions` validates source stock with `to_department_id = source ? quantity : -quantity`, regardless of `RECEIVE`, `RETURN`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`, or `DISPOSAL` semantics.
- **Impact:** Stock can increase or decrease incorrectly for transfers, returns, adjustments, and disposal; negative/incorrect balances propagate to the inventory dashboard.
- **Required correction:** Define signed effects per transaction type and validate source/destination rules accordingly.

### M-17: Asset transfer and return hardcode GSO department ID 4

- **Evidence:** The return route explicitly comments `Department 4 is General Services Office` and writes 4; transfer accepts an arbitrary old assignment without verifying current assignment or locking the asset.
- **Impact:** Deployments with different master data or changed department IDs assign assets to the wrong office. Concurrent transfers can lose custody history.
- **Required correction:** Resolve GSO by stable code, validate current custody, and lock/update the asset in one transaction.

### M-18: Asset disposal marks assets Condemned at Approved, before Disposed

- **Evidence:** IIRUP status handling updates active assets to `Condemned` when status becomes `Approved`; status `Disposed` only adds movement records.
- **Impact:** Inventory status says condemned before final disposal and does not distinguish approved-for-disposal from completed disposal.
- **Required correction:** Use explicit statuses and update custody only at the correct lifecycle transition.

### M-19: Admin ledger is not a full system ledger despite its label

- **Evidence:** `/api/ledger/export` omits NOAs, NTPs, payments, payment documents, RIS, IIRUP, supplies inventory, notifications, document records, finance exceptions, quotation data, and delivery confirmations. The printable component also renders only a subset.
- **Impact:** The official-looking export can be mistaken for a complete archive while omitting key legal and financial records.
- **Required correction:** Include all lifecycle entities or rename it to a clearly scoped snapshot with an included-record manifest.

### M-20: Audit log behavior is not immutable and bulk deletion is allowed

- **Evidence:** `/api/audit-logs/clear` deletes records older than 90 days. The admin ledger also logs the export after the exported audit snapshot has already been read, so the export omits its own audit event.
- **Impact:** The audit trail can be destroyed and exported evidence is incomplete.
- **Required correction:** Use archival/retention storage instead of deletion, restrict emergency purge, and log before snapshot or include the export event explicitly.

## Low Findings / Documentation and Test Gaps

### L-01: Focused tests pass but there are no integration tests for live workflows

- **Evidence:** `package.json` defines tests for workflow, supplier, document, encryption, OCR, finance, and reporting pure modules, but none starts Express, uses a database, or tests route authorization/transactions.
- **Impact:** The current green test result cannot detect most findings in this report.
- **Required correction:** Add clean-database integration tests for every mutation family, role boundary, and rollback path.

### L-02: Documentation marks incomplete phases as implemented

- **Evidence:** `GSO_SYSTEM_COMPLETION_TODO.md` marks broad workflow, supplier, document, finance, reporting, and production items complete while its own notes leave explicit gaps: BAC/NOA/NTP mutation coverage, full UI action filtering, clarification notifications, migration tests, integration tests, backup encryption/scheduling, external alerts, legal compliance confirmation, and UAT.
- **Impact:** Project status and acceptance decisions are unreliable.
- **Required correction:** Make checklist status evidence-based and link each completed item to an automated test or operational proof.

### L-03: User-role matrix is stale and contradicts live routes

- **Evidence:** `USER_ROLE_ACCESS_MATRIX.md` omits the Finance Officer in the main role tables and describes stricter department and endpoint permissions than the code. It also documents actions/routes that do not exist or are dead branches.
- **Impact:** Administrators and testers cannot use the matrix as an authorization contract.
- **Required correction:** Generate or test the matrix from the actual policy definitions.

### L-04: Seed/dump data contains inconsistent dates and status combinations

- **Evidence:** `procurement_management_ocr.sql` contains future delivery/disposal dates relative to its dump date, and `seed_end_to_end_procurement_record.sql` contains records whose legal chronology spans future months while audit timestamps are earlier. It also uses `ON DUPLICATE KEY UPDATE` patterns where several tables lack matching unique keys.
- **Impact:** Demo dashboards, aging calculations, and workflow tests can show impossible timelines or duplicate seed rows after reruns.
- **Required correction:** Maintain a deterministic fixture database with explicit scenario IDs and validate chronology before loading.

### L-05: Legacy JSON database code and MySQL code define divergent schemas/statuses

- **Evidence:** `src/db.ts` still contains an older database model and narrower status unions, while `server.ts` delegates to MySQL and the live schema has added roles/columns/statuses.
- **Impact:** Developers can accidentally use stale helpers/types or seed data and believe the wrong data path is active.
- **Required correction:** Remove/archive the legacy implementation or clearly isolate it from the build and update types from the live schema.

### L-06: Sessions are process-local and the sessions file is not used as durable session storage

- **Evidence:** `server_mysql.ts` keeps sessions in an in-memory `Map`; `SESSIONS_FILE` is declared but not used for active sessions.
- **Impact:** Restarting the server logs out all users, and multiple Node instances do not share authentication state.
- **Required correction:** Use a durable session store with rotation/revocation and explicit cleanup.

### L-07: Frontend approval history mutates input data while rendering

- **Evidence:** `ApprovalHistory` calls `audit.sort(...)` directly on the prop array.
- **Impact:** Rendering a modal changes shared audit state order and can cause inconsistent lists or hard-to-reproduce UI updates.
- **Required correction:** Sort a copied array.

## Validation Results

- `npm run lint`: **passed**.
- `npm run test:workflow`: **passed**.
- `npm run test:supplier`: **passed**.
- `npm run test:documents`: **passed**.
- `npm run test:encryption`: **passed**.
- `npm run test:ocr`: **passed**.
- `npm run test:finance`: **passed**.
- `npm run test:reporting`: **passed**.
- `npm run db:verify`: **not run** because no database verification was performed during this review; a live MySQL connection/configuration was not assumed.
- Browser/UI end-to-end testing: **not run**; findings were verified by code/data-path tracing and should be confirmed against a clean database with representative role accounts.

## Recommended Verification Order

1. Fix and test authorization/data isolation: C-01 through C-06, H-04, M-02, M-03.
2. Add transactional boundaries and strict server-side DTO validation: H-01 through H-03, H-06, H-09, H-10, H-12.
3. Correct procurement and financial truth sources: H-11, H-13 through H-22.
4. Repair migration/startup/operational controls: M-05 through M-07, M-11, M-12, M-19, M-20.
5. Add integration/UAT coverage and reconcile documentation: L-01 through L-06.

This report is intended as a review baseline. Each finding should be reproduced against a disposable database before implementation changes are accepted.

## Todo Tasks

### Priority 1 — Security and authorization
- [ ] Fix supplier isolation in the supplier portal summary and other cross-scope reads.
- [ ] Enforce user-scoped notification reads and remove arbitrary notification creation by any authenticated user.
- [ ] Add record-level permission checks to document archive/sign routes and global document listings.
- [ ] Restrict asset movement history access to authorized department/role holders.
- [ ] Enforce department + role scope for PR, RFQ, PO, payment, and inventory actions.

### Priority 2 — Transactional integrity and workflow enforcement
- [ ] Wrap PR creation and PR edits in database transactions with full rollback handling.
- [ ] Validate PR item payloads server-side and recompute totals from quantity and unit cost.
- [ ] Enforce PR status transition rules and disallow edits on finalized records.
- [ ] Make RFQ creation, bid replacement, BAC award, and NOA creation atomic and auditable.
- [ ] Validate supplier eligibility and invitation status before bid submissions and award creation.

### Priority 3 — Procurement, finance, and reporting correctness
- [ ] Validate document completeness using real stored documents rather than placeholder values.
- [ ] Ensure PO totals and line items are derived from the approved PR and cannot exceed the approved amount.
- [ ] Correct IAR delivery acceptance logic so only accepted quantities can complete a PO/payment pathway.
- [ ] Repair finance reconciliation queries and due-date/aging logic against the actual schema and source data.
- [ ] Fix reporting joins and analytics to use source-backed PO values and category totals instead of placeholder estimates.

### Priority 4 — Data integrity, migration, and operational controls
- [ ] Remove runtime DDL and make schema readiness fail fast during startup.
- [ ] Fix migration idempotency, verify all required tables/columns, and align the database verification script to the live schema.
- [ ] Replace hardcoded department assumptions and explicit GSO IDs with stable lookup/role-driven logic.
- [ ] Harden document metadata/upload validation, OCR handling, and encryption key rotation procedures.
- [ ] Add immutable audit retention rules and remove bulk-deletion paths that erase evidence.

### Priority 5 — Testing, documentation, and release readiness
- [ ] Add integration tests covering authorization boundaries, role enforcement, and transaction rollback paths.
- [ ] Update role/access documentation to match the live route policies and remove stale dead branches.
- [ ] Reconcile seed data and demo records to a deterministic chronology before operational use.
- [ ] Validate the UI workflow against the backend registry so status labels, actions, and documentation match reality.
- [ ] Run end-to-end verification on a disposable database before sign-off on the next release.

### Implementation order
1. Authorization and data isolation fixes.
2. Atomic workflow and mutation fixes.
3. Financial/reporting accuracy corrections.
4. Migration/startup and operational safety upgrades.
5. Integration coverage and user-facing documentation cleanup.

