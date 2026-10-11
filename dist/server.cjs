var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config.ts
function validateRuntimeConfig() {
  const errors = [];
  if (!Number.isInteger(runtimeConfig.port) || runtimeConfig.port < 1 || runtimeConfig.port > 65535) errors.push("PORT must be between 1 and 65535.");
  if (!Number.isInteger(runtimeConfig.database.port) || runtimeConfig.database.port < 1 || runtimeConfig.database.port > 65535) errors.push("MYSQL_PORT must be between 1 and 65535.");
  if (!runtimeConfig.database.database) errors.push("MYSQL_DATABASE is required.");
  if (runtimeConfig.nodeEnv === "production" && !process.env.MYSQL_PASSWORD) errors.push("MYSQL_PASSWORD must be set in production.");
  if (runtimeConfig.nodeEnv === "production" && !process.env.OTP_SECRET) errors.push("OTP_SECRET must be set in production.");
  if (runtimeConfig.nodeEnv === "production" && !process.env.DOCUMENT_ENCRYPTION_KEY) errors.push("DOCUMENT_ENCRYPTION_KEY must be set in production.");
  return { valid: errors.length === 0, errors };
}
var import_dotenv, runtimeConfig;
var init_config = __esm({
  "src/config.ts"() {
    import_dotenv = require("dotenv");
    (0, import_dotenv.config)({ path: [".env.local", ".env"] });
    runtimeConfig = {
      nodeEnv: process.env.NODE_ENV || "development",
      host: process.env.HOST || "0.0.0.0",
      port: Number.parseInt(process.env.PORT || "3000", 10),
      database: {
        host: process.env.MYSQL_HOST || "localhost",
        port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
        user: process.env.MYSQL_USER || "root",
        database: process.env.MYSQL_DATABASE || "procurement_management_ocr"
      }
    };
  }
});

// src/mysql.ts
var mysql_exports = {};
__export(mysql_exports, {
  execute: () => execute,
  getHealthSnapshot: () => getHealthSnapshot,
  getPool: () => getPool,
  pool: () => pool,
  query: () => query,
  testConnection: () => testConnection,
  withTransaction: () => withTransaction
});
function getPool() {
  if (!pool) {
    pool = import_promise.default.createPool({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      database: DATABASE,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0
    });
  }
  return pool;
}
async function testConnection() {
  const p = getPool();
  const connection = await p.getConnection();
  connection.release();
}
async function getHealthSnapshot() {
  const startedAt = Date.now();
  await query("SELECT 1 AS ok");
  return { database: "ok", latency_ms: Date.now() - startedAt, database_name: DATABASE };
}
async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}
async function execute(sql, params = []) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return typeof result?.insertId === "number" ? result.insertId : 0;
}
async function withTransaction(callback) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
var import_promise, import_dotenv2, HOST, PORT, USER, PASSWORD, DATABASE, pool;
var init_mysql = __esm({
  "src/mysql.ts"() {
    import_promise = __toESM(require("mysql2/promise"), 1);
    import_dotenv2 = require("dotenv");
    init_config();
    (0, import_dotenv2.config)({ path: [".env.local", ".env"] });
    HOST = runtimeConfig.database.host;
    PORT = runtimeConfig.database.port;
    USER = runtimeConfig.database.user;
    PASSWORD = process.env.MYSQL_PASSWORD ?? "";
    DATABASE = runtimeConfig.database.database;
  }
});

// server_mysql.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto4 = __toESM(require("crypto"), 1);
var import_nodemailer2 = __toESM(require("nodemailer"), 1);
var import_os = require("os");
var import_dotenv3 = require("dotenv");

// src/db_mysql.ts
init_mysql();
var import_crypto = __toESM(require("crypto"), 1);
function hashPassword(password, salt) {
  return import_crypto.default.createHash("sha256").update(password + salt).digest("hex");
}
function hashPasswordScrypt(password) {
  const salt = import_crypto.default.randomBytes(16).toString("base64url");
  const derivedKey = import_crypto.default.scryptSync(password, salt, 64);
  return {
    hash: `scrypt$${derivedKey.toString("base64url")}`,
    salt
  };
}
function verifyPassword(password, storedHash, salt) {
  if (storedHash.startsWith("scrypt$")) {
    const encodedKey = storedHash.slice("scrypt$".length);
    try {
      const expected2 = Buffer.from(encodedKey, "base64url");
      const actual2 = import_crypto.default.scryptSync(password, salt, expected2.length);
      return expected2.length === actual2.length && import_crypto.default.timingSafeEqual(expected2, actual2);
    } catch {
      return false;
    }
  }
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  return expected.length === actual.length && import_crypto.default.timingSafeEqual(expected, actual);
}
function assertSafeTableName(table) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
}
var DatabaseMySQL = class {
  async getTable(table) {
    assertSafeTableName(table);
    const sql = "SELECT * FROM `" + table + "`";
    return query(sql);
  }
  async getById(table, id) {
    assertSafeTableName(table);
    const sql = "SELECT * FROM `" + table + "` WHERE id = ? LIMIT 1";
    const rows = await query(sql, [id]);
    return rows.length ? rows[0] : null;
  }
  async insert(table, value) {
    assertSafeTableName(table);
    const keys = Object.keys(value);
    if (keys.length === 0) throw new Error("Insert requires at least one column");
    for (const k of keys) {
      assertSafeTableName(k);
    }
    const columns = keys.map((k) => "`" + k + "`").join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const sql = "INSERT INTO `" + table + "` (" + columns + ") VALUES (" + placeholders + ")";
    const params = keys.map((k) => value[k]);
    const insertId = await execute(sql, params);
    const row = await this.getById(table, insertId);
    if (!row) throw new Error(`Insert succeeded but row not found for table ${table} id=${insertId}`);
    return row;
  }
  async update(table, id, updates) {
    assertSafeTableName(table);
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.getById(table, id);
    for (const k of keys) {
      assertSafeTableName(k);
    }
    const setClause = keys.map((k) => "`" + k + "` = ?").join(", ");
    const params = keys.map((k) => updates[k]);
    params.push(id);
    const sql = "UPDATE `" + table + "` SET " + setClause + " WHERE id = ?";
    await execute(sql, params);
    return this.getById(table, id);
  }
  async delete(table, id) {
    assertSafeTableName(table);
    const sql = "DELETE FROM `" + table + "` WHERE id = ?";
    await execute(sql, [id]);
    return true;
  }
  async deleteWhere(table, column, value) {
    assertSafeTableName(table);
    assertSafeTableName(column);
    const sql = "DELETE FROM `" + table + "` WHERE `" + column + "` = ?";
    await execute(sql, [value]);
    return true;
  }
  async logAudit(tableName, recordId, action, oldValue, newValue, userRole = "Staff", userName = "LGU Officer") {
    await this.insert("audit_logs", {
      table_name: tableName,
      record_id: recordId,
      action,
      old_value: oldValue,
      new_value: newValue,
      user_role: userRole,
      user_name: userName,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
};
var db = new DatabaseMySQL();

// server_mysql.ts
init_mysql();
init_mysql();
init_config();
var import_genai = require("@google/genai");

// server_mysql.departments_patch.ts
function attachDepartmentsRoutes(app2) {
  app2.get("/api/departments", async (_req, res) => {
    try {
      const rows = await db.getTable("departments");
      res.json(
        rows.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          head_name: d.head_name,
          head_designation: d.head_designation,
          created_at: d.created_at
        }))
      );
    } catch (e) {
      console.error("GET /api/departments failed:", e);
      res.status(500).json({ error: e?.message || "Failed to fetch departments" });
    }
  });
  app2.post("/api/departments", authenticate, requireRoles(["Mayor"]), async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const code = String(req.body?.code || "").trim().toUpperCase();
      const headName = String(req.body?.head_name || "").trim();
      const headDesignation = String(req.body?.head_designation || "").trim();
      if (!name || !code || !headName || !headDesignation) {
        return res.status(400).json({ error: "Department name, code, head name, and head designation are required." });
      }
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
        return res.status(400).json({ error: "Department code may contain only letters, numbers, underscores, and hyphens." });
      }
      const created = await db.insert("departments", {
        name,
        code,
        head_name: headName,
        head_designation: headDesignation,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      await db.logAudit("departments", created.id, "CREATE", null, JSON.stringify(created), req.user.role, req.user.name);
      res.status(201).json({
        id: created.id,
        name: created.name,
        code: created.code,
        head_name: created.head_name,
        head_designation: created.head_designation,
        created_at: created.created_at
      });
    } catch (e) {
      if (e?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "A department with that code already exists." });
      }
      console.error("POST /api/departments failed:", e);
      res.status(500).json({ error: e?.message || "Failed to create department" });
    }
  });
  app2.put("/api/departments/:id", authenticate, requireRoles(["Mayor"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.getById("departments", id);
      if (!existing) return res.status(404).json({ error: "Department not found." });
      const name = String(req.body?.name || "").trim();
      const code = String(req.body?.code || "").trim().toUpperCase();
      const headName = String(req.body?.head_name || "").trim();
      const headDesignation = String(req.body?.head_designation || "").trim();
      if (!name || !code || !headName || !headDesignation) {
        return res.status(400).json({ error: "Department name, code, head name, and head designation are required." });
      }
      if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(code)) {
        return res.status(400).json({ error: "Department code may contain only letters, numbers, underscores, and hyphens." });
      }
      const updated = await db.update("departments", id, { name, code, head_name: headName, head_designation: headDesignation });
      await db.logAudit("departments", id, "UPDATE", JSON.stringify(existing), JSON.stringify(updated), req.user.role, req.user.name);
      res.json(updated);
    } catch (e) {
      if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "A department with that code already exists." });
      console.error("PUT /api/departments/:id failed:", e);
      res.status(500).json({ error: e?.message || "Failed to update department" });
    }
  });
  app2.delete("/api/departments/:id", authenticate, requireRoles(["Mayor"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await db.getById("departments", id);
      if (!existing) return res.status(404).json({ error: "Department not found." });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const references = await query2(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE department_id = ?) AS users_count,
          (SELECT COUNT(*) FROM ppmp_items WHERE department_id = ?) AS ppmp_count,
          (SELECT COUNT(*) FROM purchase_requests WHERE department_id = ?) AS pr_count,
          (SELECT COUNT(*) FROM ris_records WHERE department_id = ?) AS ris_count,
          (SELECT COUNT(*) FROM iirup_records WHERE department_id = ?) AS iirup_count,
          (SELECT COUNT(*) FROM inventory_assets WHERE assigned_to_user_id = ?) AS assets_count,
          (SELECT COUNT(*) FROM inventory_transactions WHERE from_department_id = ? OR to_department_id = ?) AS transactions_count`,
        [id, id, id, id, id, id, id, id]
      );
      const referenceRow = references[0] || {};
      const referenceCount = Object.values(referenceRow).reduce((sum, value) => sum + Number(value || 0), 0);
      if (referenceCount > 0) return res.status(409).json({ error: "This department is already used by system records and cannot be deleted. Reassign or archive its records first." });
      await db.logAudit("departments", id, "DELETE", JSON.stringify(existing), null, req.user.role, req.user.name);
      await db.delete("departments", id);
      res.json({ success: true, deleted_id: id });
    } catch (e) {
      console.error("DELETE /api/departments/:id failed:", e);
      res.status(500).json({ error: e?.message || "Failed to delete department" });
    }
  });
}

// server_mysql.routes_patch.ts
var import_crypto3 = __toESM(require("crypto"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
init_mysql();

// src/workflowRules.ts
var PR_STATUSES = [
  "Draft",
  "Submitted",
  "Pending",
  "Budget_Review",
  "GSO_Review",
  "For_Approval",
  "Approved",
  "Returned",
  "For_Correction",
  "Disapproved",
  "Cancelled"
];
var PR_TRANSITIONS = {
  Draft: ["Submitted", "Cancelled"],
  Submitted: ["Pending", "Returned", "Cancelled"],
  Pending: ["Budget_Review", "Returned", "Cancelled"],
  Budget_Review: ["GSO_Review", "Disapproved", "Returned", "Cancelled"],
  GSO_Review: ["For_Approval", "Disapproved", "Returned", "Cancelled"],
  For_Approval: ["Approved", "Disapproved", "Returned", "Cancelled"],
  Returned: ["For_Correction", "Submitted", "Cancelled"],
  For_Correction: ["Submitted", "Cancelled"]
};
var PR_STATUS_ROLES = {
  Submitted: ["End User", "GSO Officer"],
  Pending: ["Budget Officer"],
  Budget_Review: ["Budget Officer"],
  GSO_Review: ["GSO Officer"],
  For_Approval: ["GSO Officer"],
  Approved: ["Mayor"],
  Returned: ["End User", "GSO Officer"],
  For_Correction: ["End User"],
  Disapproved: ["Mayor"],
  Cancelled: ["End User", "GSO Officer"]
};
var PR_REQUIRED_FIELDS = {
  Budget_Review: ["alobs_number", "alobs_date"],
  For_Approval: ["mode_of_procurement"],
  Approved: ["alobs_number", "alobs_date", "mode_of_procurement"]
};
var ENTITY_WORKFLOW_RULES = {
  RFQ: {
    statuses: ["Draft", "Published", "Closed"],
    transitions: { Draft: ["Published"], Published: ["Closed"], Closed: [] },
    responsibleRoles: {
      Published: ["GSO Officer", "BAC Secretariat"],
      Closed: ["GSO Officer", "BAC Secretariat"]
    }
  },
  Quotation: {
    statuses: ["Draft", "Submitted", "Withdrawn", "Disqualified"],
    transitions: {
      Draft: ["Submitted", "Withdrawn"],
      Submitted: ["Submitted", "Withdrawn", "Disqualified"],
      Withdrawn: [],
      Disqualified: []
    },
    responsibleRoles: {
      Submitted: ["Supplier"],
      Withdrawn: ["Supplier", "BAC Secretariat"],
      Disqualified: ["BAC Secretariat"]
    }
  },
  BACResolution: {
    statuses: ["Draft", "Approved", "Signed"],
    transitions: { Draft: ["Approved", "Signed"], Approved: ["Signed"], Signed: [] },
    responsibleRoles: {
      Approved: ["Mayor", "BAC Secretariat"],
      Signed: ["BAC Secretariat", "Mayor"]
    }
  },
  NOA: {
    statuses: ["Issued", "Accepted"],
    transitions: { Issued: ["Accepted"], Accepted: [] },
    responsibleRoles: { Accepted: ["Supplier", "GSO Officer", "BAC Secretariat"] }
  },
  NTP: {
    statuses: ["Issued", "Active", "Completed"],
    transitions: { Issued: ["Active"], Active: ["Completed"], Completed: [] },
    responsibleRoles: {
      Active: ["GSO Officer", "Supplier"],
      Completed: ["GSO Officer", "Supplier"]
    }
  },
  RIS: {
    statuses: ["Draft", "Issued", "Returned", "Cancelled"],
    transitions: {
      Draft: ["Issued", "Cancelled"],
      Issued: ["Returned", "Cancelled"],
      Returned: ["Issued", "Cancelled"],
      Cancelled: []
    },
    responsibleRoles: {
      Issued: ["GSO Officer", "Mayor"],
      Returned: ["End User", "GSO Officer"],
      Cancelled: ["GSO Officer", "Mayor"]
    }
  },
  PO: {
    statuses: ["Draft", "Issued", "Signed", "Partially_Delivered", "Fully_Delivered", "Completed", "Cancelled"],
    transitions: {
      Draft: ["Issued", "Signed", "Cancelled"],
      Issued: ["Signed", "Cancelled"],
      Signed: ["Partially_Delivered", "Fully_Delivered", "Cancelled"],
      Partially_Delivered: ["Fully_Delivered", "Cancelled"],
      Fully_Delivered: ["Completed"],
      Completed: [],
      Cancelled: []
    },
    responsibleRoles: {
      Issued: ["GSO Officer", "Mayor"],
      Signed: ["GSO Officer", "Mayor"],
      Partially_Delivered: ["GSO Officer"],
      Fully_Delivered: ["GSO Officer"],
      Completed: ["Finance Officer", "GSO Officer"],
      Cancelled: ["GSO Officer", "Mayor"]
    }
  },
  IAR: {
    statuses: ["Draft", "Submitted", "Partial", "Completed"],
    transitions: {
      Draft: ["Submitted", "Partial", "Completed"],
      Submitted: ["Partial", "Completed"],
      Partial: ["Partial", "Completed"],
      Completed: []
    },
    responsibleRoles: {
      Submitted: ["GSO Officer", "End User"],
      Partial: ["GSO Officer", "End User"],
      Completed: ["GSO Officer", "End User"]
    }
  },
  Payment: {
    statuses: ["Pending", "For_Verification", "Approved", "Disbursed", "Completed", "Cancelled"],
    transitions: {
      Pending: ["For_Verification", "Cancelled"],
      For_Verification: ["Approved", "Cancelled"],
      Approved: ["Disbursed", "Cancelled"],
      Disbursed: ["Completed"],
      Completed: [],
      Cancelled: []
    },
    responsibleRoles: {
      For_Verification: ["Finance Officer", "GSO Officer"],
      Approved: ["Finance Officer", "Mayor"],
      Disbursed: ["Finance Officer"],
      Completed: ["Finance Officer"],
      Cancelled: ["Finance Officer", "Mayor", "GSO Officer"]
    },
    requiredFields: {
      Approved: ["remarks"],
      Disbursed: ["remarks"],
      Completed: ["remarks"]
    }
  },
  IIRUP: {
    statuses: ["Draft", "Submitted", "Approved", "Disposed", "Cancelled"],
    transitions: {
      Draft: ["Submitted", "Cancelled"],
      Submitted: ["Approved", "Cancelled"],
      Approved: ["Disposed", "Cancelled"],
      Disposed: [],
      Cancelled: []
    },
    responsibleRoles: {
      Submitted: ["GSO Officer"],
      Approved: ["Mayor"],
      Disposed: ["GSO Officer", "Mayor"],
      Cancelled: ["GSO Officer", "Mayor"]
    },
    requiredFields: { Disposed: ["coa_authority_no"] }
  }
};
var hasValue = (value) => value !== void 0 && value !== null && String(value).trim() !== "";
function validatePRTransition(input) {
  const errors = [];
  const { fromStatus, toStatus, role, fields = {} } = input;
  if (!PR_STATUSES.includes(toStatus)) {
    errors.push(`Invalid PR status: ${toStatus}`);
  }
  const allowedTargets = PR_TRANSITIONS[fromStatus] || [];
  if (!allowedTargets.includes(toStatus)) {
    errors.push(`PR cannot move from ${fromStatus} to ${toStatus}.`);
  }
  const allowedRoles = PR_STATUS_ROLES[toStatus];
  if (allowedRoles && !allowedRoles.includes(role)) {
    errors.push(`Forbidden: Only ${allowedRoles.join(", ")} can change status to ${toStatus}.`);
  }
  for (const field of PR_REQUIRED_FIELDS[toStatus] || []) {
    if (!hasValue(fields[field])) {
      errors.push(`${toStatus} requires ${field.replace(/_/g, " ")}.`);
    }
  }
  if (input.hasRequiredDocument === false) {
    errors.push(`${toStatus} requires its supporting document before the transition can be completed.`);
  }
  return {
    valid: errors.length === 0,
    errors,
    nextAction: errors.length ? "Fix the transition requirements." : "Proceed to the next lifecycle state."
  };
}
function validateEntityTransition(entity, input) {
  const rule = ENTITY_WORKFLOW_RULES[entity];
  if (!rule) {
    return { valid: false, errors: [`Unknown workflow entity: ${entity}.`], nextAction: "Use a registered workflow entity." };
  }
  const errors = [];
  const fields = input.fields || {};
  if (!rule.statuses.includes(input.toStatus)) errors.push(`Invalid ${entity} status: ${input.toStatus}.`);
  if (!rule.transitions[input.fromStatus]?.includes(input.toStatus)) {
    errors.push(`${entity} cannot move from ${input.fromStatus} to ${input.toStatus}.`);
  }
  const roles = rule.responsibleRoles[input.toStatus];
  if (roles && !roles.includes(input.role)) {
    errors.push(`Forbidden: Only ${roles.join(", ")} can change ${entity} to ${input.toStatus}.`);
  }
  for (const field of rule.requiredFields?.[input.toStatus] || []) {
    if (!hasValue(fields[field])) errors.push(`${input.toStatus} requires ${field.replace(/_/g, " ")}.`);
  }
  return {
    valid: errors.length === 0,
    errors,
    nextAction: errors.length ? "Fix the transition requirements." : "Proceed to the next lifecycle state."
  };
}
function getPRWorkflowRules() {
  return {
    statuses: [...PR_STATUSES],
    transitions: PR_TRANSITIONS,
    responsibleRoles: PR_STATUS_ROLES,
    requiredFields: PR_REQUIRED_FIELDS,
    requiredDocuments: {
      Budget_Review: "ALOBS / budget certification",
      GSO_Review: "GSO technical review record",
      For_Approval: "Reviewed Purchase Request with remarks",
      Approved: "Approved Purchase Request and budget certification",
      RFQ: "Published RFQ and invitation list",
      BAC: "BAC resolution and NOA",
      PO: "Purchase Order and supplier acceptance",
      IAR: "Inspection and Acceptance Report"
    },
    entities: ENTITY_WORKFLOW_RULES
  };
}

// src/complianceRules.ts
var COMPLIANCE_DOCUMENT_CHECKLISTS = {
  RFQ: ["Approved Purchase Request", "ALOBS / Budget Certification", "Technical Specifications"],
  Evaluation: ["Published RFQ", "Supplier Quotations", "Abstract of Canvass"],
  Award: ["BAC Resolution", "Notice of Award"],
  PO: ["Approved Purchase Request", "Notice of Award", "Purchase Order"],
  IAR: ["Purchase Order", "Delivery Receipt", "Inspection and Acceptance Report"],
  Payment: ["Purchase Order", "Inspection and Acceptance Report", "Payment Voucher"]
};
var numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};
var PROCUREMENT_THRESHOLDS = {
  shoppingMaximum: numberFromEnv("PROCUREMENT_SHOPPING_MAX", 5e4),
  smallValueMaximum: numberFromEnv("PROCUREMENT_SMALL_VALUE_MAX", 2e5)
};
var normalize = (value) => String(value || "").trim().toLowerCase();
function expectedProcurementMode(amount) {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (amount <= PROCUREMENT_THRESHOLDS.shoppingMaximum) return "Shopping";
  if (amount <= PROCUREMENT_THRESHOLDS.smallValueMaximum) return "Small Value Procurement";
  return "Public Bidding";
}
function getComplianceDocumentChecklist(stage) {
  return COMPLIANCE_DOCUMENT_CHECKLISTS[stage] || [];
}
function evaluateProcurementCompliance(input) {
  const checks = [];
  const requiredDocuments = input.requiredDocuments || [];
  const availableDocuments = new Set((input.availableDocuments || []).map(normalize));
  const expectedMode = expectedProcurementMode(Number(input.amount));
  const actualMode = normalize(input.modeOfProcurement);
  if (!Number.isFinite(Number(input.amount)) || Number(input.amount) < 0) {
    checks.push({ code: "INVALID_AMOUNT", level: "error", message: "The procurement amount must be a non-negative number." });
  } else {
    checks.push({ code: "AMOUNT_VALID", level: "pass", message: "The procurement amount is valid." });
  }
  if (expectedMode && !actualMode) {
    checks.push({ code: "MODE_REQUIRED", level: "error", message: `Procurement mode is required. Based on the configured threshold, the expected mode is ${expectedMode}.` });
  } else if (expectedMode && actualMode !== normalize(expectedMode)) {
    checks.push({ code: "MODE_MISMATCH", level: "error", message: `The selected procurement mode (${input.modeOfProcurement}) does not match the configured threshold result (${expectedMode}).` });
  } else if (expectedMode) {
    checks.push({ code: "MODE_VALID", level: "pass", message: `Procurement mode ${input.modeOfProcurement} matches the configured threshold result.` });
  }
  if (input.supplier) {
    if (!String(input.supplier.name || "").trim() || !String(input.supplier.tin || "").trim() || !String(input.supplier.email || "").trim()) {
      checks.push({ code: "SUPPLIER_QUALIFICATION_INCOMPLETE", level: "error", message: "Supplier name, TIN, and email are required before evaluation or award." });
    } else {
      checks.push({ code: "SUPPLIER_QUALIFICATION_PRESENT", level: "pass", message: "Required supplier identity fields are present." });
    }
  }
  for (const document of requiredDocuments) {
    if (!availableDocuments.has(normalize(document))) {
      checks.push({ code: "MISSING_DOCUMENT", level: "error", message: `Required document is missing: ${document}.` });
    }
  }
  if (requiredDocuments.length > 0 && requiredDocuments.every((document) => availableDocuments.has(normalize(document)))) {
    checks.push({ code: "DOCUMENTS_COMPLETE", level: "pass", message: "All required documents are present." });
  }
  if (input.hasPhilGEPSPosting === false) {
    checks.push({ code: "MISSING_POSTING", level: "error", message: "The required PhilGEPS posting record is missing." });
  } else if (input.hasPhilGEPSPosting === true) {
    checks.push({ code: "POSTING_PRESENT", level: "pass", message: "The required posting record is present." });
  }
  if (input.openDate && input.closeDate && new Date(input.closeDate).getTime() <= new Date(input.openDate).getTime()) {
    checks.push({ code: "INVALID_TIMELINE", level: "error", message: "The closing date must be after the opening date." });
  } else if (input.openDate && input.closeDate) {
    checks.push({ code: "TIMELINE_VALID", level: "pass", message: "The procurement opening and closing dates are valid." });
  }
  if (input.requiredApprovalRole && normalize(input.approvalRole) !== normalize(input.requiredApprovalRole)) {
    checks.push({ code: "APPROVAL_AUTHORITY_MISMATCH", level: "error", message: `This action requires approval by ${input.requiredApprovalRole}.` });
  } else if (input.requiredApprovalRole) {
    checks.push({ code: "APPROVAL_AUTHORITY_VALID", level: "pass", message: `Approval authority ${input.requiredApprovalRole} is satisfied.` });
  }
  return {
    compliant: !checks.some((check) => check.level === "error"),
    checks,
    expectedMode,
    requiredDocuments
  };
}

// src/supplierPortalRules.ts
var SUPPLIER_STATUSES = ["Pending_Verification", "Pending_Approval", "Active", "Suspended", "Rejected"];
var isValidSupplierEmail = (email) => /^\S+@\S+\.\S+$/.test(email.trim().toLowerCase());
var normalizeSupplierProfile = (input) => ({
  name: String(input.name || "").trim(),
  address: String(input.address || "").trim(),
  tin: String(input.tin || "").trim(),
  contact_person: String(input.contact_person || "").trim(),
  contact_no: String(input.contact_no || "").trim(),
  email: String(input.email || "").trim().toLowerCase()
});
var validateSupplierProfile = (profile) => {
  const errors = [];
  if (profile.name.length < 2) errors.push("Supplier name is required.");
  if (!profile.address) errors.push("Supplier address is required.");
  if (!profile.tin) errors.push("Supplier TIN is required.");
  if (!profile.contact_person) errors.push("Supplier contact person is required.");
  if (!profile.contact_no) errors.push("Supplier contact number is required.");
  if (!isValidSupplierEmail(profile.email)) errors.push("A valid supplier email address is required.");
  return { valid: errors.length === 0, errors };
};

// src/documentRules.ts
var DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
var ALLOWED_DOCUMENT_TYPES = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "text/plain": ".txt"
};
var isAllowedDocumentType = (mimeType) => Object.prototype.hasOwnProperty.call(ALLOWED_DOCUMENT_TYPES, mimeType);
var isSafeDocumentName = (fileName) => {
  const normalized = fileName.trim();
  return normalized.length > 0 && normalized.length <= 255 && !/[\\/\0]/.test(normalized);
};
var validateDocumentPayload = (input) => {
  const errors = [];
  if (!isSafeDocumentName(input.fileName)) errors.push("Document file name is invalid.");
  if (!isAllowedDocumentType(input.mimeType)) errors.push("Unsupported document type. Allowed types are PDF, JPEG, PNG, WebP, and text files.");
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > DOCUMENT_MAX_BYTES) errors.push("Document size must be between 1 byte and 5 MB.");
  return { valid: errors.length === 0, errors };
};

// src/ocr.ts
var MAX_OCR_PAGES = 5;
var MAX_OCR_TEXT_LENGTH = 1e6;
async function extractDocumentText(buffer, mimeType) {
  if (mimeType === "text/plain") {
    return { status: "Completed", text: buffer.toString("utf8").slice(0, MAX_OCR_TEXT_LENGTH), pages: 1 };
  }
  if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return { status: "Skipped", text: null, pages: 0 };
  }
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const pages = [];
    if (mimeType === "application/pdf") {
      const { pdf } = await import("pdf-to-img");
      const document = await pdf(buffer, { scale: 1.5, format: "png" });
      let pageCount = 0;
      for await (const page of document) {
        pages.push(page);
        pageCount += 1;
        if (pageCount >= MAX_OCR_PAGES) break;
      }
      await document.destroy();
    } else {
      pages.push(buffer);
    }
    const textParts = [];
    for (const page of pages) {
      const result = await worker.recognize(page);
      if (result.data.text.trim()) textParts.push(result.data.text.trim());
    }
    await worker.terminate();
    const text = textParts.join("\n\n").slice(0, MAX_OCR_TEXT_LENGTH);
    return { status: "Completed", text: text || null, pages: pages.length };
  } catch (error) {
    return { status: "Failed", text: null, pages: 0, error: error?.message || "OCR processing failed." };
  }
}

// src/financeRules.ts
function evaluateFinanceSnapshot(snapshot) {
  const exceptions = [];
  const prAmount = Number(snapshot.prAmount || 0);
  const poAmount = Number(snapshot.poAmount || 0);
  const iarAmount = Number(snapshot.iarAmount || 0);
  const paidAmount = Number(snapshot.paidAmount || 0);
  const allotmentBalance = snapshot.allotmentBalance == null ? null : Number(snapshot.allotmentBalance);
  if (poAmount > prAmount) exceptions.push({ code: "PO_EXCEEDS_PR", message: "Purchase Order value exceeds the approved Purchase Request amount.", severity: "error" });
  if (iarAmount > poAmount) exceptions.push({ code: "IAR_EXCEEDS_PO", message: "Accepted inspection value exceeds the Purchase Order value.", severity: "error" });
  if (paidAmount > poAmount) exceptions.push({ code: "PAYMENT_EXCEEDS_PO", message: "Cumulative payments exceed the Purchase Order value.", severity: "error" });
  if (allotmentBalance != null && poAmount > allotmentBalance) exceptions.push({ code: "PO_EXCEEDS_ALLOTMENT", message: "Purchase Order value exceeds the available allotment balance.", severity: "error" });
  if (paidAmount > iarAmount && iarAmount > 0) exceptions.push({ code: "PAYMENT_EXCEEDS_IAR", message: "Payments exceed accepted inspection value.", severity: "warning" });
  let agingStatus = "Not_Due";
  if (snapshot.dueDate) {
    const due = new Date(snapshot.dueDate).getTime();
    if (paidAmount >= poAmount && poAmount > 0) agingStatus = "Paid";
    else if (Number.isFinite(due) && due < Date.now()) agingStatus = "Overdue";
    else agingStatus = "Open";
  }
  return {
    compliant: !exceptions.some((exception) => exception.severity === "error"),
    exceptions,
    remainingObligation: Math.max(0, prAmount - poAmount),
    remainingPayable: Math.max(0, poAmount - paidAmount),
    agingStatus
  };
}

// src/reportingRules.ts
function aggregateReportingRecords(records) {
  const spendingByDepartment = /* @__PURE__ */ new Map();
  const spendingByCategory = /* @__PURE__ */ new Map();
  const spendingByMode = /* @__PURE__ */ new Map();
  const supplierReliability = /* @__PURE__ */ new Map();
  let leadTimeTotal = 0;
  let leadTimeCount = 0;
  let openObligations = 0;
  let lateDeliveries = 0;
  for (const record of records) {
    const amount = Number(record.po_amount || 0);
    const department = record.department_name || `Department ${record.department_id || "Unknown"}`;
    const category = record.category || "Uncategorized";
    const mode = record.mode_of_procurement || "Unspecified";
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

// src/documentEncryption.ts
var import_crypto2 = __toESM(require("crypto"), 1);
var ENCRYPTION_VERSION = 1;
var IV_BYTES = 12;
var AUTH_TAG_BYTES = 16;
function getEncryptionKey() {
  const configured = process.env.DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!configured && process.env.NODE_ENV !== "production") {
    return import_crypto2.default.createHash("sha256").update("gso-development-document-encryption-key").digest();
  }
  if (!configured) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  return key.length === 32 ? key : null;
}
function encryptDocument(buffer) {
  const key = getEncryptionKey();
  if (!key) throw new Error("DOCUMENT_ENCRYPTION_KEY is not configured or is not a valid 32-byte key.");
  const iv = import_crypto2.default.randomBytes(IV_BYTES);
  const cipher = import_crypto2.default.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { version: ENCRYPTION_VERSION, data: Buffer.concat([iv, authTag, ciphertext]) };
}
function decryptDocument(buffer, version) {
  if (Number(version || 0) !== ENCRYPTION_VERSION) return buffer;
  const key = getEncryptionKey();
  if (!key) throw new Error("DOCUMENT_ENCRYPTION_KEY is required to read encrypted documents.");
  if (buffer.length <= IV_BYTES + AUTH_TAG_BYTES) throw new Error("Encrypted document payload is invalid.");
  const iv = buffer.subarray(0, IV_BYTES);
  const authTag = buffer.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buffer.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = import_crypto2.default.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// server_mysql.routes_patch.ts
function attachAllRoutes(app2, authenticate2, requireRoles2) {
  const MODULE_ROLE_ACCESS = {
    supplier: ["Supplier"],
    planning: ["End User", "GSO Officer", "Budget Officer", "Mayor", "Finance Officer"],
    pr: ["End User", "GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"],
    rfq: ["GSO Officer", "BAC Secretariat", "Mayor", "Finance Officer"],
    bidding: ["BAC Secretariat", "GSO Officer", "Mayor", "Finance Officer"],
    bac: ["BAC Secretariat", "Mayor", "GSO Officer", "Budget Officer", "Finance Officer"],
    po: ["End User", "GSO Officer", "Budget Officer", "Mayor", "Finance Officer"],
    iar: ["GSO Officer", "Mayor", "End User", "Finance Officer"],
    inventory: ["GSO Officer", "Mayor", "End User"],
    distribution: ["GSO Officer", "Mayor", "End User", "Finance Officer"],
    disposal: ["GSO Officer", "Mayor", "Finance Officer"],
    philgeps: ["BAC Secretariat", "GSO Officer", "Mayor", "Finance Officer"],
    audit: ["GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"],
    analytics: ["GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"],
    settings: ["Mayor", "GSO Officer", "Finance Officer"],
    admin: ["Mayor", "GSO Officer", "Finance Officer"]
  };
  const canAccessDepartment = (user, departmentId) => user.role !== "End User" || Number(user.department_id) === Number(departmentId);
  const canAccessModule = (user, moduleName) => (MODULE_ROLE_ACCESS[moduleName] || []).includes(user.role);
  const notifyStakeholders = async (notification) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      await query2(
        `INSERT INTO notifications (user_id, user_name, department_id, target_role, title, message, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          notification.user_id || null,
          notification.user_name || null,
          notification.department_id || null,
          notification.target_role || null,
          notification.title,
          notification.message,
          notification.type || "info"
        ]
      );
      const payload = {
        ...notification,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        type: notification.type || "info"
      };
      try {
        const event = `event: notification
data: ${JSON.stringify(payload)}

`;
        const clients = globalThis.notificationClients || /* @__PURE__ */ new Set();
        for (const client of Array.from(clients)) {
          const clientUserId = Number(client.userId);
          const clientDeptId = Number(client.departmentId);
          const inScope = payload.user_id != null && Number(payload.user_id) === clientUserId || payload.department_id != null && Number(payload.department_id) === clientDeptId || payload.target_role != null && payload.target_role === client.role || !payload.user_id && !payload.department_id && !payload.target_role;
          if (inScope) {
            try {
              client.res.write(event);
            } catch {
              clients.delete(client);
            }
          }
        }
      } catch {
      }
    } catch (e) {
      console.error("Failed to record notification:", e);
    }
  };
  const ensureDocumentRecordsTable = async () => {
    try {
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      await mysqlQuery(`
        CREATE TABLE IF NOT EXISTS document_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          table_name VARCHAR(80) NOT NULL DEFAULT 'procurement',
          record_id INT NOT NULL DEFAULT 0,
          document_type VARCHAR(80) NOT NULL DEFAULT 'Attachment',
          file_name VARCHAR(255) NOT NULL,
          file_url VARCHAR(500) NULL,
          file_size INT NOT NULL DEFAULT 0,
          checksum VARCHAR(128) NULL,
          metadata TEXT NULL,
          mime_type VARCHAR(120) NULL,
          file_data MEDIUMBLOB NULL,
          encryption_version INT NOT NULL DEFAULT 0,
          extracted_text LONGTEXT NULL,
          ocr_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
          version INT NOT NULL DEFAULT 1,
          status ENUM('Draft', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
          created_by VARCHAR(120) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `, []);
      const alterStatements = [
        `ALTER TABLE document_records ADD COLUMN mime_type VARCHAR(120) NULL`,
        `ALTER TABLE document_records ADD COLUMN file_data MEDIUMBLOB NULL`,
        `ALTER TABLE document_records ADD COLUMN extracted_text LONGTEXT NULL`,
        `ALTER TABLE document_records ADD COLUMN ocr_status VARCHAR(20) NOT NULL DEFAULT 'Pending'`,
        `ALTER TABLE document_records ADD COLUMN encryption_version INT NOT NULL DEFAULT 0`
      ];
      for (const statement of alterStatements) {
        try {
          await mysqlQuery(statement, []);
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") throw error;
        }
      }
      await mysqlQuery(`
        CREATE TABLE IF NOT EXISTS document_signatures (
          id INT AUTO_INCREMENT PRIMARY KEY,
          document_id INT NOT NULL,
          signature_hash VARCHAR(128) NOT NULL,
          signer_id INT NULL,
          signer_name VARCHAR(150) NOT NULL,
          signer_role VARCHAR(100) NOT NULL,
          signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_document_signature (document_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `, []);
    } catch (e) {
      console.error("Failed to ensure document_records table:", e);
    }
  };
  const ensureComplianceChecksTable = async () => {
    const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS compliance_checks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        table_name VARCHAR(80) NOT NULL,
        record_id INT NOT NULL,
        compliant BOOLEAN NOT NULL DEFAULT FALSE,
        checks TEXT NOT NULL,
        evaluated_by INT NULL,
        evaluated_by_name VARCHAR(150) NULL,
        evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_compliance_record (table_name, record_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  };
  const ensureFinanceTables = async () => {
    const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS finance_reconciliation_exceptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pr_id INT NOT NULL,
        code VARCHAR(80) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Open',
        resolved_by VARCHAR(150) NULL,
        resolved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_finance_exception_pr (pr_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS budget_allotments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        department_id INT NOT NULL,
        fiscal_year INT NOT NULL,
        allotment_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        utilized_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_budget_allotment (department_id, fiscal_year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  };
  const ensureSupplierPortalTables = async () => {
    const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
    const alterStatements = [
      `ALTER TABLE suppliers ADD COLUMN supplier_status VARCHAR(40) NOT NULL DEFAULT 'Active'`,
      `ALTER TABLE suppliers ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE`,
      `ALTER TABLE suppliers ADD COLUMN compliance_notes TEXT NULL`,
      `ALTER TABLE suppliers ADD COLUMN approved_at TIMESTAMP NULL`,
      `ALTER TABLE suppliers ADD COLUMN approved_by VARCHAR(150) NULL`,
      `ALTER TABLE rfq_supplier_invitations MODIFY COLUMN status ENUM('Invited', 'Accepted', 'Responded', 'Declined', 'Expired') NOT NULL DEFAULT 'Invited'`
    ];
    for (const statement of alterStatements) {
      try {
        await mysqlQuery(statement, []);
      } catch (error) {
        if (!["ER_DUP_FIELDNAME", "ER_BAD_FIELD_ERROR"].includes(error.code)) throw error;
      }
    }
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS supplier_email_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        email VARCHAR(150) NOT NULL,
        code_hash VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        verified_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_supplier_verification (supplier_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS supplier_quotation_revisions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        quotation_id INT NOT NULL,
        revision_no INT NOT NULL,
        payload TEXT NOT NULL,
        submitted_by_user_id INT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_quotation_revision (quotation_id, revision_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
    await mysqlQuery(`
      CREATE TABLE IF NOT EXISTS supplier_delivery_confirmations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        supplier_id INT NOT NULL,
        confirmation_no VARCHAR(100) NOT NULL UNIQUE,
        delivery_date DATE NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
        remarks TEXT NULL,
        created_by_user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `, []);
  };
  const sendSupplierVerificationEmail = async (email, code) => {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
    if (!user || !pass) return false;
    const mailer = import_nodemailer.default.createTransport({ service: "gmail", auth: { user, pass } });
    await mailer.sendMail({
      from: process.env.SMTP_FROM?.trim() || user,
      to: email,
      subject: "GSO Supplier Portal email verification",
      text: `Your supplier portal verification code is ${code}. It expires in 15 minutes.`
    });
    return true;
  };
  const evaluateStoredPRCompliance = async (prId, user) => {
    const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
    const rows = await mysqlQuery(`
      SELECT pr.*, COALESCE(SUM(pri.total_cost), 0) AS amount
      FROM purchase_requests pr
      LEFT JOIN pr_items pri ON pri.pr_id = pr.id
      WHERE pr.id = ?
      GROUP BY pr.id
    `, [prId]);
    if (!rows.length) return null;
    const pr = rows[0];
    const documents = await mysqlQuery(
      `SELECT document_type FROM document_records WHERE table_name = 'purchase_requests' AND record_id = ? AND status <> 'Archived'`,
      [prId]
    );
    const postings = await mysqlQuery(
      `SELECT id FROM philgeps_postings WHERE associated_id = ? AND LOWER(associated_type) IN ('pr', 'rfq') AND status IN ('Posted', 'Awarded') LIMIT 1`,
      [prId]
    );
    return evaluateProcurementCompliance({
      amount: Number(pr.amount),
      modeOfProcurement: pr.mode_of_procurement,
      availableDocuments: documents.map((document) => document.document_type),
      hasPhilGEPSPosting: postings.length > 0
    });
  };
  const canAccessDocumentRecord = async (user, tableName, recordId) => {
    if (["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer"].includes(user.role)) return true;
    const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
    if (user.role === "Supplier" && tableName === "suppliers") return Number(user.supplier_id) === recordId;
    if (user.role === "End User" && tableName === "purchase_requests") {
      const rows = await mysqlQuery("SELECT department_id FROM purchase_requests WHERE id = ?", [recordId]);
      return rows.length > 0 && canAccessDepartment(user, rows[0].department_id);
    }
    return false;
  };
  const parseDocumentData = (value) => {
    const source = String(value || "");
    const match = source.match(/^data:([^;]+);base64,(.+)$/);
    return match ? { mimeType: match[1], buffer: Buffer.from(match[2], "base64") } : null;
  };
  app2.get("/api/workflow/rules", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const overview = await mysqlQuery(`
        SELECT status, COUNT(*) AS count
        FROM purchase_requests
        GROUP BY status
        ORDER BY status
      `, []);
      const rules = {
        workflow: "PR -> RFQ -> BAC -> PO -> IAR -> Inventory/Distribution/Disposal",
        ...getPRWorkflowRules()
      };
      res.json({ rules, statusCounts: overview, compliant: true });
    } catch (e) {
      res.status(500).json({ error: e.message || "Workflow rule catalog unavailable." });
    }
  });
  app2.post("/api/supplier/register", async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const profile = normalizeSupplierProfile(req.body || {});
      const validation = validateSupplierProfile(profile);
      if (!validation.valid) return res.status(400).json({ error: validation.errors.join(" "), errors: validation.errors });
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      if (!/^[a-zA-Z0-9._-]{3,}$/.test(username)) return res.status(400).json({ error: "A valid supplier username with at least 3 characters is required." });
      if (password.length < 8) return res.status(400).json({ error: "Supplier password must be at least 8 characters long." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const duplicates = await mysqlQuery(
        "SELECT id FROM suppliers WHERE LOWER(email) = ? OR tin = ? LIMIT 1",
        [profile.email, profile.tin]
      );
      if (duplicates.length) return res.status(409).json({ error: "A supplier with this email or TIN already exists." });
      const userDuplicates = await mysqlQuery("SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1", [username.toLowerCase(), profile.email]);
      if (userDuplicates.length) return res.status(409).json({ error: "A user with this username or email already exists." });
      const supplier = await db.insert("suppliers", {
        ...profile,
        supplier_status: "Pending_Verification",
        email_verified: false,
        performance_rating: 0,
        performance_notes: null
      });
      const passwordBundle = hashPasswordScrypt(password);
      const supplierUser = await db.insert("users", {
        username,
        password_hash: passwordBundle.hash,
        salt: passwordBundle.salt,
        name: profile.contact_person,
        email: profile.email,
        role: "Supplier",
        department_id: null,
        supplier_id: supplier.id
      });
      const code = String(import_crypto3.default.randomInt(0, 1e6)).padStart(6, "0");
      const codeHash = import_crypto3.default.createHash("sha256").update(`${supplier.id}:${profile.email}:${code}:${process.env.OTP_SECRET || "gso-supplier-verification"}`).digest("hex");
      await mysqlQuery(
        `INSERT INTO supplier_email_verifications (supplier_id, email, code_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
        [supplier.id, profile.email, codeHash]
      );
      let emailSent = false;
      try {
        emailSent = await sendSupplierVerificationEmail(profile.email, code);
      } catch {
        emailSent = false;
      }
      await db.logAudit("suppliers", supplier.id, "CREATE", null, JSON.stringify({ ...supplier, supplier_status: "Pending_Verification" }), "Supplier", profile.name);
      res.status(201).json({ id: supplier.id, user_id: supplierUser.id, username, email: profile.email, supplier_status: "Pending_Verification", email_sent: emailSent, message: emailSent ? "Supplier registration created. Check email for the verification code." : "Supplier registration created. Email delivery is not configured; request administrator verification." });
    } catch (e) {
      res.status(500).json({ error: e.message || "Supplier registration failed." });
    }
  });
  app2.post("/api/supplier/verify-email", async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.body?.supplier_id);
      const email = String(req.body?.email || "").trim().toLowerCase();
      const code = String(req.body?.code || "").trim();
      if (!supplierId || !email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Supplier ID, email, and six-digit verification code are required." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery(`SELECT * FROM supplier_email_verifications WHERE supplier_id = ? AND email = ? AND verified_at IS NULL ORDER BY id DESC LIMIT 1`, [supplierId, email]);
      const challenge = rows[0];
      const codeHash = import_crypto3.default.createHash("sha256").update(`${supplierId}:${email}:${code}:${process.env.OTP_SECRET || "gso-supplier-verification"}`).digest("hex");
      if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now() || challenge.attempts >= 5 || challenge.code_hash !== codeHash) {
        if (challenge) await mysqlQuery("UPDATE supplier_email_verifications SET attempts = attempts + 1 WHERE id = ?", [challenge.id]);
        return res.status(400).json({ error: "Invalid or expired supplier verification code." });
      }
      const supplier = await db.getById("suppliers", supplierId);
      if (!supplier || String(supplier.email).toLowerCase() !== email) return res.status(404).json({ error: "Supplier record not found." });
      await mysqlQuery("UPDATE supplier_email_verifications SET verified_at = NOW() WHERE id = ?", [challenge.id]);
      const updated = await db.update("suppliers", supplierId, { email_verified: true, supplier_status: "Pending_Approval" });
      await db.logAudit("suppliers", supplierId, "STATUS_CHANGE", JSON.stringify(supplier), JSON.stringify(updated), "Supplier", supplier.name);
      res.json({ id: supplierId, supplier_status: "Pending_Approval", email_verified: true, message: "Email verified. Supplier approval is now pending." });
    } catch (e) {
      res.status(500).json({ error: e.message || "Supplier email verification failed." });
    }
  });
  app2.get("/api/suppliers/:id/profile", authenticate2, async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.params.id);
      if (req.user.role === "Supplier" && Number(req.user.supplier_id) !== supplierId) return res.status(403).json({ error: "You may only view your own supplier profile." });
      const supplier = await db.getById("suppliers", supplierId);
      if (!supplier) return res.status(404).json({ error: "Supplier not found." });
      res.json(supplier);
    } catch (e) {
      res.status(500).json({ error: e.message || "Supplier profile could not be loaded." });
    }
  });
  app2.put("/api/suppliers/:id/status", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Mayor"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.params.id);
      const status = String(req.body?.supplier_status || "");
      if (!SUPPLIER_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid supplier lifecycle status." });
      const supplier = await db.getById("suppliers", supplierId);
      if (!supplier) return res.status(404).json({ error: "Supplier not found." });
      if (status === "Active" && !supplier.email_verified) return res.status(409).json({ error: "Supplier email must be verified before activation." });
      const updated = await db.update("suppliers", supplierId, { supplier_status: status, compliance_notes: req.body?.compliance_notes || supplier.compliance_notes || null, approved_at: status === "Active" ? /* @__PURE__ */ new Date() : supplier.approved_at, approved_by: status === "Active" ? req.user.name : supplier.approved_by });
      await db.logAudit("suppliers", supplierId, "STATUS_CHANGE", JSON.stringify(supplier), JSON.stringify(updated), req.user.role, req.user.name);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message || "Supplier status update failed." });
    }
  });
  app2.post("/api/workflow/validate", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      const { entity, fromStatus, toStatus, hasRequiredDocument, fields } = req.body;
      const input = {
        fromStatus: String(fromStatus || ""),
        toStatus: String(toStatus || ""),
        role: req.user.role,
        hasRequiredDocument,
        fields
      };
      const result = entity ? validateEntityTransition(String(entity), input) : validatePRTransition(input);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message || "Workflow validation failed." });
    }
  });
  app2.post("/api/compliance/validate", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      const result = evaluateProcurementCompliance(req.body || {});
      res.status(result.compliant ? 200 : 422).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message || "Compliance validation failed." });
    }
  });
  app2.get("/api/compliance/checklist/:stage", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    const stage = String(req.params.stage || "");
    res.json({ stage, requiredDocuments: getComplianceDocumentChecklist(stage) });
  });
  app2.get("/api/pr/:id/compliance", authenticate2, requireRoles2(["End User", "GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      const prId = Number(req.params.id);
      const pr = await db.getById("purchase_requests", prId);
      if (!pr) return res.status(404).json({ error: "PR not found." });
      if (!canAccessDepartment(req.user, pr.department_id)) return res.status(403).json({ error: "You are not allowed to evaluate this Purchase Request." });
      await ensureDocumentRecordsTable();
      await ensureComplianceChecksTable();
      const result = await evaluateStoredPRCompliance(prId, req.user);
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      await mysqlQuery(
        `INSERT INTO compliance_checks (table_name, record_id, compliant, checks, evaluated_by, evaluated_by_name) VALUES ('purchase_requests', ?, ?, ?, ?, ?)`,
        [prId, result?.compliant ? 1 : 0, JSON.stringify(result), req.user.id, req.user.name]
      );
      await db.logAudit("purchase_requests", prId, "COMPLIANCE_CHECK", null, JSON.stringify(result), req.user.role, req.user.name);
      res.status(result?.compliant ? 200 : 422).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message || "Purchase Request compliance evaluation failed." });
    }
  });
  app2.get("/api/supplier/portal/summary", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Mayor", "Budget Officer", "Finance Officer", "Supplier"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const supplierSummary = await mysqlQuery(`
        SELECT
          (SELECT COUNT(*) FROM suppliers) AS supplier_count,
          (SELECT COUNT(*) FROM rfq_supplier_invitations WHERE status = 'Invited') AS invited_count,
          (SELECT COUNT(*) FROM rfq_supplier_invitations WHERE status = 'Responded') AS responded_count,
          (SELECT COUNT(*) FROM supplier_quotations WHERE status = 'Submitted') AS quotations_count
      `, []);
      const supplierPerformance = await mysqlQuery(`
        SELECT id, name, email, tin, performance_rating, performance_notes
        FROM suppliers
        ORDER BY performance_rating DESC
      `, []);
      res.json({ summary: supplierSummary[0] || {}, supplierPerformance });
    } catch (e) {
      res.status(500).json({ error: e.message || "Supplier portal summary unavailable." });
    }
  });
  app2.get("/api/documents", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "End User", "Supplier"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const tableName = String(req.query.table_name || "");
      const recordId = Number(req.query.record_id || 0);
      if (tableName && recordId > 0 && !await canAccessDocumentRecord(req.user, tableName, recordId)) {
        return res.status(403).json({ error: "You are not allowed to access these documents." });
      }
      const conditions = [];
      const params = [];
      if (tableName) {
        conditions.push("table_name = ?");
        params.push(tableName);
      }
      if (recordId > 0) {
        conditions.push("record_id = ?");
        params.push(recordId);
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const rows = await mysqlQuery(`SELECT id, table_name, record_id, document_type, file_name, file_url, file_size, checksum, metadata, mime_type, extracted_text, version, status, created_by, created_at FROM document_records ${where} ORDER BY id DESC`, params);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message || "Document list could not be loaded." });
    }
  });
  app2.post("/api/documents", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "End User"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { table_name, record_id, document_type, file_name, file_url, file_size, checksum, metadata, version, status, mime_type, extracted_text } = req.body;
      if (!table_name || !record_id || !document_type || !file_name) {
        return res.status(400).json({ error: "table_name, record_id, document_type, and file_name are required." });
      }
      if (!await canAccessDocumentRecord(req.user, String(table_name), Number(record_id))) return res.status(403).json({ error: "You are not allowed to attach documents to this record." });
      const documentValidation = validateDocumentPayload({ fileName: String(file_name), mimeType: String(mime_type || "application/octet-stream"), fileSize: Number(file_size) || 0 });
      if (file_size && !documentValidation.valid) return res.status(400).json({ error: documentValidation.errors.join(" "), errors: documentValidation.errors });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const result = await mysqlQuery(`
        INSERT INTO document_records (table_name, record_id, document_type, file_name, file_url, file_size, checksum, metadata, mime_type, extracted_text, version, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        String(table_name),
        Number(record_id),
        String(document_type),
        String(file_name),
        file_url || null,
        Number(file_size) || 0,
        checksum || null,
        metadata ? JSON.stringify(metadata) : null,
        mime_type || null,
        extracted_text || null,
        Number(version) || 1,
        status || "Draft",
        req.user?.name || "System User"
      ]);
      const inserted = await mysqlQuery("SELECT * FROM document_records WHERE id = LAST_INSERT_ID()", []);
      await db.logAudit("document_records", inserted[0].id, "CREATE", null, JSON.stringify({ ...inserted[0], file_data: void 0 }), req.user.role, req.user.name);
      res.status(201).json(inserted[0]);
    } catch (e) {
      res.status(500).json({ error: e.message || "Document metadata could not be stored." });
    }
  });
  app2.post("/api/documents/upload", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "End User", "Supplier"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { table_name, record_id, document_type, file_name, data, metadata, extracted_text, status } = req.body || {};
      const parsed = parseDocumentData(data);
      if (!table_name || !record_id || !document_type || !file_name || !parsed) return res.status(400).json({ error: "table_name, record_id, document_type, file_name, and a base64 data URL are required." });
      if (!await canAccessDocumentRecord(req.user, String(table_name), Number(record_id))) return res.status(403).json({ error: "You are not allowed to upload documents to this record." });
      if (parsed.buffer.length > DOCUMENT_MAX_BYTES) return res.status(413).json({ error: "Document exceeds the 5 MB size limit." });
      const validation = validateDocumentPayload({ fileName: String(file_name), mimeType: parsed.mimeType, fileSize: parsed.buffer.length });
      if (!validation.valid) return res.status(400).json({ error: validation.errors.join(" "), errors: validation.errors });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const checksum = import_crypto3.default.createHash("sha256").update(parsed.buffer).digest("hex");
      const encrypted = encryptDocument(parsed.buffer);
      const ocr = extracted_text ? { status: "Completed", text: String(extracted_text).slice(0, 1e6), pages: 0 } : await extractDocumentText(parsed.buffer, parsed.mimeType);
      const latest = await mysqlQuery("SELECT COALESCE(MAX(version), 0) AS version FROM document_records WHERE table_name = ? AND record_id = ? AND document_type = ?", [String(table_name), Number(record_id), String(document_type)]);
      const version = Number(latest[0]?.version || 0) + 1;
      const inserted = await mysqlQuery(`
        INSERT INTO document_records (table_name, record_id, document_type, file_name, file_size, checksum, metadata, mime_type, file_data, encryption_version, extracted_text, ocr_status, version, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [String(table_name), Number(record_id), String(document_type), String(file_name), parsed.buffer.length, checksum, metadata ? JSON.stringify(metadata) : null, parsed.mimeType, encrypted.data, encrypted.version, ocr.text, ocr.status, version, status || "Draft", req.user.name]);
      const documentId = inserted.insertId;
      await db.logAudit("document_records", documentId, "CREATE", null, JSON.stringify({ table_name, record_id, document_type, file_name, checksum, version }), req.user.role, req.user.name);
      res.status(201).json({ id: documentId, table_name, record_id: Number(record_id), document_type, file_name, file_size: parsed.buffer.length, checksum, mime_type: parsed.mimeType, ocr_status: ocr.status, ocr_pages: ocr.pages, ocr_error: ocr.error, version, status: status || "Draft" });
    } catch (e) {
      res.status(500).json({ error: e.message || "Document upload failed." });
    }
  });
  app2.get("/api/documents/:id/history", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "End User", "Supplier"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT id, table_name, record_id, document_type, file_name, file_size, checksum, mime_type, version, status, created_by, created_at FROM document_records WHERE id = ? OR (table_name = (SELECT table_name FROM document_records WHERE id = ?) AND record_id = (SELECT record_id FROM document_records WHERE id = ?) AND document_type = (SELECT document_type FROM document_records WHERE id = ?)) ORDER BY version DESC, id DESC", [Number(req.params.id), Number(req.params.id), Number(req.params.id), Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: "Document not found." });
      if (!await canAccessDocumentRecord(req.user, rows[0].table_name, Number(rows[0].record_id))) return res.status(403).json({ error: "You are not allowed to view document history." });
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message || "Document history could not be loaded." });
    }
  });
  app2.put("/api/documents/:id/archive", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT * FROM document_records WHERE id = ? LIMIT 1", [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: "Document not found." });
      const updated = await db.update("document_records", Number(req.params.id), { status: "Archived" });
      await db.logAudit("document_records", Number(req.params.id), "UPDATE", JSON.stringify(rows[0]), JSON.stringify(updated), req.user.role, req.user.name);
      res.json({ id: Number(req.params.id), status: "Archived" });
    } catch (e) {
      res.status(500).json({ error: e.message || "Document archive failed." });
    }
  });
  app2.post("/api/documents/:id/sign", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT id, checksum, status FROM document_records WHERE id = ? LIMIT 1", [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: "Document not found." });
      if (!rows[0].checksum) return res.status(409).json({ error: "Only content-addressed documents can be signed." });
      const signatureHash = import_crypto3.default.createHash("sha256").update(`${rows[0].checksum}:${req.user.id}:${req.user.role}:${process.env.DOCUMENT_SIGNATURE_SECRET || "gso-document-signature"}`).digest("hex");
      await mysqlQuery("INSERT INTO document_signatures (document_id, signature_hash, signer_id, signer_name, signer_role) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE signature_hash = VALUES(signature_hash), signer_id = VALUES(signer_id), signer_name = VALUES(signer_name), signer_role = VALUES(signer_role), signed_at = CURRENT_TIMESTAMP", [rows[0].id, signatureHash, req.user.id, req.user.name, req.user.role]);
      await db.logAudit("document_records", rows[0].id, "SIGN", null, JSON.stringify({ signature_hash: signatureHash, signer: req.user.name }), req.user.role, req.user.name);
      res.json({ document_id: rows[0].id, signature_hash: signatureHash, signer_name: req.user.name, signer_role: req.user.role });
    } catch (e) {
      res.status(500).json({ error: e.message || "Document signing failed." });
    }
  });
  app2.get("/api/documents/:id/download", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "End User", "Supplier"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT * FROM document_records WHERE id = ? LIMIT 1", [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: "Document not found." });
      const document = rows[0];
      if (!await canAccessDocumentRecord(req.user, document.table_name, Number(document.record_id))) return res.status(403).json({ error: "You are not allowed to download this document." });
      if (!document.file_data) return res.status(404).json({ error: "Document content is not stored." });
      const content = decryptDocument(document.file_data, Number(document.encryption_version || 0));
      await db.logAudit("document_records", document.id, "READ", null, JSON.stringify({ file_name: document.file_name, version: document.version }), req.user.role, req.user.name);
      res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${String(document.file_name).replace(/"/g, "")}"`);
      res.send(content);
    } catch (e) {
      res.status(500).json({ error: e.message || "Document download failed." });
    }
  });
  app2.get("/api/documents/search", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "End User", "Supplier"]), async (req, res) => {
    try {
      await ensureDocumentRecordsTable();
      const term = String(req.query.q || "").trim();
      if (!term) return res.status(400).json({ error: "Search term is required." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery(`SELECT id, table_name, record_id, document_type, file_name, checksum, mime_type, version, status, created_by, created_at FROM document_records WHERE file_name LIKE ? OR extracted_text LIKE ? OR metadata LIKE ? ORDER BY id DESC LIMIT 100`, [`%${term}%`, `%${term}%`, `%${term}%`]);
      const accessible = [];
      for (const row of rows) if (await canAccessDocumentRecord(req.user, row.table_name, Number(row.record_id))) accessible.push(row);
      res.json(accessible);
    } catch (e) {
      res.status(500).json({ error: e.message || "Document search failed." });
    }
  });
  app2.get("/api/finance/reconciliation", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      await ensureFinanceTables();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery(`
        SELECT
          pr.id AS pr_id,
          pr.pr_no,
          pr.department_id,
          pr.status,
          COALESCE(pr_totals.total_amount, 0) AS pr_amount,
          COALESCE(po_total.po_amount, 0) AS po_amount,
          COALESCE(iar_total.iar_amount, 0) AS iar_amount,
          COALESCE(payment_total.payment_amount, 0) AS payment_amount,
          COALESCE(allotment.allotment_amount, 0) AS allotment_amount,
          COALESCE(allotment.utilized_amount, 0) AS allotment_utilized,
          MAX(po.po_date) AS po_date
        FROM purchase_requests pr
        LEFT JOIN (
          SELECT pr_id, SUM(quantity * unit_cost) AS total_amount
          FROM pr_items
          GROUP BY pr_id
        ) pr_totals ON pr_totals.pr_id = pr.id
        LEFT JOIN (
          SELECT pr_id, SUM(amount) AS po_amount
          FROM purchase_orders
          GROUP BY pr_id
        ) po_total ON po_total.pr_id = pr.id
        LEFT JOIN (
          SELECT po.pr_id, SUM(iri.quantity_delivered * iri.unit_price) AS iar_amount
          FROM iar_records ir
          JOIN iar_items iri ON iri.iar_id = ir.id
          JOIN purchase_orders po ON po.id = ir.po_id
          GROUP BY po.pr_id
        ) iar_total ON iar_total.pr_id = pr.id
        LEFT JOIN (
          SELECT po.pr_id, SUM(p.amount) AS payment_amount
          FROM payments p
          JOIN purchase_orders po ON po.id = p.po_id
          GROUP BY po.pr_id
        ) payment_total ON payment_total.pr_id = pr.id
        LEFT JOIN purchase_orders po ON po.pr_id = pr.id
        LEFT JOIN budget_allotments allotment ON allotment.department_id = pr.department_id AND allotment.fiscal_year = YEAR(pr.date)
        GROUP BY pr.id, pr.pr_no, pr.department_id, pr.status, pr_totals.total_amount, po_total.po_amount, iar_total.iar_amount, payment_total.payment_amount, allotment.allotment_amount, allotment.utilized_amount
        ORDER BY pr.id DESC
      `, []);
      const exceptions = [];
      const enrichedRows = rows.map((row) => {
        const finance = evaluateFinanceSnapshot({
          prAmount: Number(row.pr_amount),
          poAmount: Number(row.po_amount),
          iarAmount: Number(row.iar_amount),
          paidAmount: Number(row.payment_amount),
          allotmentBalance: Number(row.allotment_amount || 0) - Number(row.allotment_utilized || 0),
          dueDate: row.po_date ? new Date(row.po_date).toISOString() : null
        });
        for (const exception of finance.exceptions) exceptions.push({ ...exception, pr_id: row.pr_id });
        return { ...row, ...finance };
      });
      for (const exception of exceptions) {
        await mysqlQuery(`INSERT INTO finance_reconciliation_exceptions (pr_id, code, severity, message) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM finance_reconciliation_exceptions WHERE pr_id = ? AND code = ? AND status = 'Open')`, [exception.pr_id, exception.code, exception.severity, exception.message, exception.pr_id, exception.code]);
      }
      const summary = {
        obligations: enrichedRows.reduce((sum, row) => sum + Number(row.pr_amount || 0), 0),
        purchase_orders: enrichedRows.reduce((sum, row) => sum + Number(row.po_amount || 0), 0),
        inspections: enrichedRows.reduce((sum, row) => sum + Number(row.iar_amount || 0), 0),
        payments: enrichedRows.reduce((sum, row) => sum + Number(row.payment_amount || 0), 0),
        open_exceptions: exceptions.length,
        overdue_records: enrichedRows.filter((row) => row.agingStatus === "Overdue").length
      };
      res.json({ summary, records: enrichedRows, exceptions });
    } catch (e) {
      res.status(500).json({ error: e.message || "Finance reconciliation could not be built." });
    }
  });
  app2.get("/api/finance/exceptions", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      await ensureFinanceTables();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT * FROM finance_reconciliation_exceptions WHERE status = ? ORDER BY id DESC", [String(req.query.status || "Open")]);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message || "Finance exceptions could not be loaded." });
    }
  });
  app2.put("/api/finance/exceptions/:id/resolve", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      await ensureFinanceTables();
      const id = Number(req.params.id);
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT * FROM finance_reconciliation_exceptions WHERE id = ?", [id]);
      if (!rows.length) return res.status(404).json({ error: "Finance exception not found." });
      await mysqlQuery("UPDATE finance_reconciliation_exceptions SET status = 'Resolved', resolved_by = ?, resolved_at = NOW() WHERE id = ?", [req.user.name, id]);
      await db.logAudit("finance_reconciliation_exceptions", id, "STATUS_CHANGE", JSON.stringify(rows[0]), JSON.stringify({ ...rows[0], status: "Resolved" }), req.user.role, req.user.name);
      res.json({ id, status: "Resolved" });
    } catch (e) {
      res.status(500).json({ error: e.message || "Finance exception resolution failed." });
    }
  });
  const getReportingDataset = async (filters) => {
    await ensureFinanceTables();
    await ensureSupplierPortalTables();
    const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
    const conditions = [];
    const params = [];
    if (filters.from) {
      conditions.push("pr.date >= ?");
      params.push(String(filters.from));
    }
    if (filters.to) {
      conditions.push("pr.date <= ?");
      params.push(String(filters.to));
    }
    if (filters.department_id) {
      conditions.push("pr.department_id = ?");
      params.push(Number(filters.department_id));
    }
    if (filters.status) {
      conditions.push("pr.status = ?");
      params.push(String(filters.status));
    }
    if (filters.mode) {
      conditions.push("pr.mode_of_procurement = ?");
      params.push(String(filters.mode));
    }
    if (filters.supplier_id) {
      conditions.push("po_summary.supplier_id = ?");
      params.push(Number(filters.supplier_id));
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const records = await mysqlQuery(`
      SELECT
        pr.id AS pr_id,
        pr.department_id,
        d.name AS department_name,
        COALESCE(ppmp.category, 'Uncategorized') AS category,
        pr.mode_of_procurement,
        po_summary.supplier_id,
        s.name AS supplier_name,
        COALESCE(pr_total.pr_amount, 0) AS pr_amount,
        COALESCE(po_summary.po_amount, 0) AS po_amount,
        COALESCE(iar_summary.iar_amount, 0) AS iar_amount,
        COALESCE(payment_summary.payment_amount, 0) AS payment_amount,
        GREATEST(COALESCE(pr_total.pr_amount, 0) - COALESCE(po_summary.po_amount, 0), 0) AS open_obligation,
        DATEDIFF(po_summary.po_date, pr.date) AS lead_time_days,
        COALESCE(delivery_summary.late_delivery, FALSE) AS late_delivery
      FROM purchase_requests pr
      JOIN departments d ON d.id = pr.department_id
      LEFT JOIN pr_items pri ON pri.pr_id = pr.id
      LEFT JOIN ppmp_items ppmp ON ppmp.id = pri.ppmp_item_id
      LEFT JOIN (SELECT pr_id, SUM(quantity * unit_cost) AS pr_amount FROM pr_items GROUP BY pr_id) pr_total ON pr_total.pr_id = pr.id
      LEFT JOIN (
        SELECT po.pr_id, po.supplier_id, SUM(poi.total_cost) AS po_amount, MAX(po.po_date) AS po_date, MAX(po.id) AS po_id
        FROM purchase_orders po JOIN po_items poi ON poi.po_id = po.id
        WHERE po.status <> 'Cancelled'
        GROUP BY po.pr_id, po.supplier_id
      ) po_summary ON po_summary.pr_id = pr.id
      LEFT JOIN suppliers s ON s.id = po_summary.supplier_id
      LEFT JOIN (
        SELECT po.pr_id, SUM(ii.quantity_delivered * poi.unit_cost) AS iar_amount
        FROM iar_records ir JOIN iar_items ii ON ii.iar_id = ir.id JOIN po_items poi ON poi.id = ii.po_item_id JOIN purchase_orders po ON po.id = ir.po_id
        WHERE ii.is_accepted = TRUE GROUP BY po.pr_id
      ) iar_summary ON iar_summary.pr_id = pr.id
      LEFT JOIN (
        SELECT po.pr_id, SUM(p.amount) AS payment_amount
        FROM payments p JOIN purchase_orders po ON po.id = p.po_id
        WHERE p.status <> 'Cancelled' GROUP BY po.pr_id
      ) payment_summary ON payment_summary.pr_id = pr.id
      LEFT JOIN (
        SELECT d.po_id, MAX(d.delivery_date > DATE_ADD(po.po_date, INTERVAL 15 DAY)) AS late_delivery
        FROM supplier_delivery_confirmations d JOIN purchase_orders po ON po.id = d.po_id
        GROUP BY d.po_id
      ) delivery_summary ON delivery_summary.po_id = po_summary.po_id
      ${where}
      GROUP BY pr.id, pr.department_id, d.name, ppmp.category, pr.mode_of_procurement, po_summary.supplier_id, s.name, pr_total.pr_amount, po_summary.po_amount, po_summary.po_date, iar_summary.iar_amount, payment_summary.payment_amount, delivery_summary.late_delivery
      ORDER BY pr.id DESC
    `, params);
    return { records, metrics: aggregateReportingRecords(records) };
  };
  app2.get("/api/reporting/metrics", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      const dataset = await getReportingDataset(req.query || {});
      res.json({ filters: req.query || {}, ...dataset });
    } catch (e) {
      res.status(500).json({ error: e.message || "Reporting metrics could not be assembled." });
    }
  });
  app2.get("/api/reporting/export", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      const dataset = await getReportingDataset(req.query || {});
      const headers = ["department", "category", "mode", "supplier", "pr_amount", "po_amount", "iar_amount", "payment_amount", "open_obligation", "lead_time_days", "late_delivery"];
      const lines = [headers.join(",")];
      for (const row of dataset.records) {
        lines.push([
          row.department_name,
          row.category,
          row.mode_of_procurement,
          row.supplier_name || "",
          row.pr_amount,
          row.po_amount,
          row.iar_amount,
          row.payment_amount,
          row.open_obligation,
          row.lead_time_days ?? "",
          row.late_delivery ? "true" : "false"
        ].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","));
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="procurement-report.csv"');
      res.send(lines.join("\n"));
    } catch (e) {
      res.status(500).json({ error: e.message || "Reporting export could not be generated." });
    }
  });
  app2.get("/api/reporting/audit-intelligence", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const auditLogs = await mysqlQuery(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 80`, []);
      const compliance = await mysqlQuery(`
        SELECT
          COUNT(*) AS total_records,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved_records,
          SUM(CASE WHEN status = 'Returned' THEN 1 ELSE 0 END) AS returned_records,
          SUM(CASE WHEN status = 'Disapproved' THEN 1 ELSE 0 END) AS disapproved_records
        FROM purchase_requests
      `, []);
      const payments = await mysqlQuery(`
        SELECT COUNT(*) AS payment_count, COALESCE(SUM(amount), 0) AS payment_total
        FROM payments
      `, []);
      res.json({
        summary: {
          auditLogCount: auditLogs.length,
          compliance: compliance[0] || {},
          payments: payments[0] || { payment_count: 0, payment_total: 0 }
        },
        auditLogs,
        reporting: {
          metricsEndpoint: "/api/reporting/metrics",
          exportEndpoint: "/api/reporting/export",
          spendingTrends: "Source-backed spending by department, category, mode, and fiscal period.",
          procurementLeadTime: "Calculated from PR date to PO date.",
          supplierReliability: "Calculated from supplier delivery confirmations and late-delivery outcomes."
        }
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "Reporting and audit intelligence could not be assembled." });
    }
  });
  app2.get("/api/roadmap/priorities", authenticate2, requireRoles2(["GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      res.json({
        priorities: [
          { id: "workflow", title: "Workflow Engine and Compliance Rules", status: "Implemented", endpoint: "/api/workflow/rules", detail: "Workflow rules, compliance mapping, and transition validation are exposed on the backend." },
          { id: "supplier", title: "Supplier Portal Expansion", status: "Implemented", endpoint: "/api/supplier/portal/summary", detail: "Supplier portal invitations, quotations, and performance intelligence summary are surfaced." },
          { id: "documents", title: "Document Management System", status: "Implemented", endpoint: "/api/documents", detail: "Document records can store metadata and file URLs with version tracking support." },
          { id: "finance", title: "Finance Reconciliation and Payment Controls", status: "Implemented", endpoint: "/api/finance/reconciliation", detail: "Purchase request, PO, IAR, and payment obligations are reconciled in one report." },
          { id: "reporting", title: "Reporting and Audit Intelligence", status: "Implemented", endpoint: "/api/reporting/audit-intelligence", detail: "Audit logs and compliance summary are rolled into an intelligence endpoint." }
        ]
      });
    } catch (e) {
      res.status(500).json({ error: e.message || "Roadmap priority summary could not be loaded." });
    }
  });
  app2.get("/api/ppmp", authenticate2, requireRoles2(["End User", "GSO Officer", "Budget Officer", "Mayor"]), async (req, res) => {
    try {
      const currentUser = req.user;
      if (!canAccessModule(currentUser, "planning")) {
        return res.status(403).json({ error: "Forbidden: Planning module is not available for this role." });
      }
      const rows = await db.getTable("ppmp_items");
      res.json(currentUser.role === "End User" ? rows.filter((row) => canAccessDepartment(currentUser, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/ppmp", authenticate2, requireRoles2(["End User", "GSO Officer", "Budget Officer", "Mayor"]), async (req, res) => {
    try {
      if (!canAccessModule(req.user, "planning")) {
        return res.status(403).json({ error: "Forbidden: Planning module is not available for this role." });
      }
      if (req.body.department_id && !canAccessDepartment(req.user, Number(req.body.department_id))) {
        return res.status(403).json({ error: "You may only create PPMP items for your assigned department." });
      }
      const item = await db.insert("ppmp_items", req.body);
      await db.logAudit("ppmp_items", item.id, "CREATE", null, JSON.stringify(item), req.user.role, req.user.name);
      res.status(201).json(item);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/pr", authenticate2, requireRoles2(["End User", "GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      const currentUser = req.user;
      if (!canAccessModule(currentUser, "pr")) {
        return res.status(403).json({ error: "Forbidden: Requisition module is not available for this role." });
      }
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT pr.*, d.name AS department_name, d.code AS department_code,
                COALESCE(pr_totals.total_amount, 0) AS total_amount,
                COALESCE(pr_totals.total_amount, 0) AS estimated_abc,
                COALESCE(pr_totals.items_count, 0) AS items_count
         FROM purchase_requests pr
         LEFT JOIN departments d ON d.id = pr.department_id
         LEFT JOIN (
           SELECT pr_id, SUM(quantity * unit_cost) AS total_amount, COUNT(*) AS items_count
           FROM pr_items
           GROUP BY pr_id
         ) pr_totals ON pr_totals.pr_id = pr.id
         ORDER BY pr.id DESC`
      );
      res.json(currentUser.role === "End User" ? rows.filter((row) => canAccessDepartment(currentUser, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/pr", authenticate2, requireRoles2(["End User", "GSO Officer", "Budget Officer"]), async (req, res) => {
    try {
      if (!canAccessModule(req.user, "pr")) {
        return res.status(403).json({ error: "Forbidden: Requisition module is not available for this role." });
      }
      const { items, ...prData } = req.body;
      if (!prData.department_id || !prData.purpose || !prData.requested_by_name || !prData.requested_by_designation || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Department, purpose, requester details, and at least one item are required." });
      }
      const department = await db.getById("departments", Number(prData.department_id));
      if (!department) return res.status(400).json({ error: "Invalid department." });
      if (!canAccessDepartment(req.user, department.id)) {
        return res.status(403).json({ error: "You may only create records for your assigned department." });
      }
      const today = /* @__PURE__ */ new Date();
      const date = today.toISOString().slice(0, 10);
      const prefix = `${date.slice(0, 7)}-`;
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const latest = await mysqlQuery("SELECT pr_no FROM purchase_requests WHERE pr_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.pr_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const initialStatus = ["Draft", "Pending", "Submitted"].includes(String(prData.status || "")) ? String(prData.status || "Draft") : "Draft";
      const newPR = await db.insert("purchase_requests", {
        ...prData,
        pr_no: `${prefix}${sequence}`,
        date,
        approved_by_name: department.head_name,
        approved_by_designation: department.head_designation,
        status: initialStatus
      });
      if (items && Array.isArray(items)) {
        for (const item of items) {
          const { id, ...itemData } = item;
          await db.insert("pr_items", { ...itemData, pr_id: newPR.id });
        }
      }
      await db.logAudit("purchase_requests", newPR.id, "CREATE", null, JSON.stringify(newPR), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: "Budget Officer",
        title: "New Purchase Request Submitted",
        message: `New PR ${newPR.pr_no} submitted by ${department.name} for budget availability review.`,
        type: "info"
      });
      res.status(201).json(newPR);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/pr/:id", authenticate2, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pr = await db.getById("purchase_requests", id);
      if (!pr) return res.status(404).json({ error: "PR not found" });
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to access this Purchase Request." });
      }
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const items = await query2("SELECT * FROM `pr_items` WHERE pr_id = ?", [id]);
      const [rfqs, bacResolutions, noas, pos, ntps, iars, payments, deliveries, assets] = await Promise.all([
        query2("SELECT * FROM rfq_records WHERE pr_id = ? ORDER BY id DESC", [id]),
        query2(`SELECT br.* FROM bac_resolutions br JOIN rfq_records rfq ON rfq.id = br.rfq_id WHERE rfq.pr_id = ? ORDER BY br.id DESC`, [id]),
        query2(`SELECT noa.* FROM notices_of_award noa JOIN rfq_records rfq ON rfq.id = noa.rfq_id WHERE rfq.pr_id = ? ORDER BY noa.id DESC`, [id]),
        query2("SELECT * FROM purchase_orders WHERE pr_id = ? ORDER BY id DESC", [id]),
        query2(`SELECT ntp.* FROM notices_to_proceed ntp JOIN purchase_orders po ON po.id = ntp.po_id WHERE po.pr_id = ? ORDER BY ntp.id DESC`, [id]),
        query2(`SELECT iar.* FROM iar_records iar JOIN purchase_orders po ON po.id = iar.po_id WHERE po.pr_id = ? ORDER BY iar.id DESC`, [id]),
        query2(`SELECT p.* FROM payments p JOIN purchase_orders po ON po.id = p.po_id WHERE po.pr_id = ? ORDER BY p.id DESC`, [id]),
        query2(`SELECT d.* FROM supplier_delivery_confirmations d JOIN purchase_orders po ON po.id = d.po_id WHERE po.pr_id = ? ORDER BY d.id DESC`, [id]),
        query2(`SELECT asset.* FROM inventory_assets asset JOIN iar_items ii ON ii.id = asset.iar_item_id JOIN iar_records iar ON iar.id = ii.iar_id JOIN purchase_orders po ON po.id = iar.po_id WHERE po.pr_id = ? ORDER BY asset.id DESC`, [id])
      ]);
      res.json({
        ...pr,
        items,
        linkedRecords: { rfqs, bacResolutions, noas, pos, ntps, iars, payments, deliveries, assets }
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/pr/:id/audit", authenticate2, requireRoles2(["End User", "GSO Officer", "Budget Officer", "Mayor", "BAC Secretariat", "Finance Officer"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pr = await db.getById("purchase_requests", id);
      if (!pr) return res.status(404).json({ error: "PR not found" });
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to view audit logs for this Purchase Request." });
      }
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const logs = await query2('SELECT * FROM `audit_logs` WHERE table_name = "purchase_requests" AND record_id = ? ORDER BY id DESC', [id]);
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/pr/:id", authenticate2, requireRoles2(["End User", "GSO Officer"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const oldPr = await db.getById("purchase_requests", id);
      if (!oldPr) return res.status(404).json({ error: "PR not found" });
      if (!canAccessDepartment(req.user, oldPr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to modify this Purchase Request." });
      }
      const { items, pr_no, date, section, purpose, requested_by_name, requested_by_designation } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "At least one PR item is required." });
      }
      for (const item of items) {
        if (!item.unit || !item.description || Number(item.quantity) <= 0 || Number(item.unit_cost) < 0) {
          return res.status(400).json({ error: "Every item must have a unit, description, quantity, and valid unit cost." });
        }
      }
      const updatedPR = await db.update("purchase_requests", id, {
        ...pr_no && pr_no !== oldPr.pr_no ? { pr_no: String(pr_no).trim() } : {},
        ...date ? { date } : {},
        section: String(section || "Main").trim(),
        purpose: String(purpose || "").trim(),
        requested_by_name: String(requested_by_name || "").trim(),
        requested_by_designation: String(requested_by_designation || "").trim()
      });
      await db.deleteWhere("pr_items", "pr_id", id);
      for (const [index, item] of items.entries()) {
        await db.insert("pr_items", {
          pr_id: id,
          ppmp_item_id: item.ppmp_item_id || null,
          item_no: index + 1,
          unit: String(item.unit).trim(),
          description: String(item.description).trim(),
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          total_cost: Number(item.quantity) * Number(item.unit_cost)
        });
      }
      const savedItems = await (await Promise.resolve().then(() => (init_mysql(), mysql_exports))).query("SELECT * FROM `pr_items` WHERE pr_id = ?", [id]);
      await db.logAudit("purchase_requests", id, "UPDATE", JSON.stringify(oldPr), JSON.stringify(updatedPR), req.user.role, req.user.name);
      res.json({ ...updatedPR, items: savedItems });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/pr/:id/status", authenticate2, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, remarks, alobs_number, alobs_date, mode_of_procurement } = req.body;
      const oldPr = await db.getById("purchase_requests", id);
      if (!oldPr) return res.status(404).json({ error: "PR not found" });
      if (!canAccessDepartment(req.user, oldPr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to modify this Purchase Request." });
      }
      if (!remarks || typeof remarks !== "string" || remarks.trim() === "") {
        return res.status(400).json({ error: "Remarks are required for every PR status change." });
      }
      const validation = validatePRTransition({
        fromStatus: oldPr.status,
        toStatus: status,
        role: req.user.role,
        fields: {
          alobs_number: alobs_number ?? oldPr.alobs_number,
          alobs_date: alobs_date ?? oldPr.alobs_date,
          mode_of_procurement: mode_of_procurement ?? oldPr.mode_of_procurement
        }
      });
      if (!validation.valid) {
        const statusCode = validation.errors.some((error) => error.startsWith("Forbidden:")) ? 403 : 409;
        return res.status(statusCode).json({ error: validation.errors.join(" "), errors: validation.errors, nextAction: validation.nextAction });
      }
      const updates = { status, remarks: remarks.trim() };
      if (alobs_number !== void 0) updates.alobs_number = alobs_number || null;
      if (alobs_date !== void 0) updates.alobs_date = alobs_date || null;
      if (mode_of_procurement !== void 0) updates.mode_of_procurement = mode_of_procurement || null;
      const newPr = await db.update("purchase_requests", id, updates);
      await db.logAudit("purchase_requests", id, "STATUS_CHANGE", JSON.stringify(oldPr), JSON.stringify(newPr), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: oldPr.department_id,
        user_name: oldPr.requested_by_name,
        title: `PR ${newPr.pr_no} Status Update`,
        message: `Purchase Request ${newPr.pr_no} status changed from ${oldPr.status} to ${status}. Remarks: ${remarks.trim()}`,
        type: status === "Approved" ? "success" : status === "Disapproved" ? "error" : "info"
      });
      res.json(newPr);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/rfq", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Mayor"]), async (req, res) => {
    try {
      const currentUser = req.user;
      if (!canAccessModule(currentUser, "rfq")) {
        return res.status(403).json({ error: "Forbidden: RFQ module is not available for this role." });
      }
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(`
        SELECT r.*, pr.pr_no, pr.department_id, d.name as department_name 
        FROM rfq_records r 
        LEFT JOIN purchase_requests pr ON r.pr_id = pr.id 
        LEFT JOIN departments d ON pr.department_id = d.id
      `);
      res.json(currentUser.role === "End User" ? rows.filter((row) => canAccessDepartment(currentUser, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/rfq", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat"]), async (req, res) => {
    try {
      if (!canAccessModule(req.user, "rfq")) {
        return res.status(403).json({ error: "Forbidden: RFQ module is not available for this role." });
      }
      const { items, ...rfqData } = req.body;
      if (!rfqData.pr_id || !rfqData.close_date) return res.status(400).json({ error: "PR and closing date are required." });
      const pr = await db.getById("purchase_requests", Number(rfqData.pr_id));
      if (!pr) return res.status(404).json({ error: "Purchase Request not found." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      if (pr.status !== "Approved") {
        return res.status(409).json({ error: "Only approved Purchase Requests can be used to create an RFQ." });
      }
      const prTotalRows = await mysqlQuery(
        "SELECT COALESCE(SUM(total_cost), 0) AS amount FROM pr_items WHERE pr_id = ?",
        [Number(rfqData.pr_id)]
      );
      const rfqCompliance = evaluateProcurementCompliance({
        amount: Number(prTotalRows[0]?.amount || 0),
        modeOfProcurement: pr.mode_of_procurement,
        openDate: rfqData.open_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        closeDate: rfqData.close_date
      });
      if (!rfqCompliance.compliant) {
        return res.status(422).json({ error: "RFQ compliance validation failed.", compliance: rfqCompliance });
      }
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to create an RFQ for this department." });
      }
      const today = /* @__PURE__ */ new Date();
      const prefix = `RFQ-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-`;
      const existingRfq = await mysqlQuery("SELECT rfq_no FROM rfq_records WHERE pr_id = ? LIMIT 1", [Number(rfqData.pr_id)]);
      if (existingRfq.length > 0) {
        return res.status(409).json({ error: `This Purchase Request already has RFQ ${existingRfq[0].rfq_no}.` });
      }
      const latest = await mysqlQuery("SELECT rfq_no FROM rfq_records WHERE rfq_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.rfq_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const prItems = await mysqlQuery("SELECT * FROM pr_items WHERE pr_id = ?", [Number(rfqData.pr_id)]);
      const newRfq = await db.insert("rfq_records", {
        pr_id: Number(rfqData.pr_id),
        rfq_no: `${prefix}${sequence}`,
        open_date: rfqData.open_date || today.toISOString().slice(0, 10),
        close_date: rfqData.close_date,
        status: "Published",
        terms_and_conditions: rfqData.terms_and_conditions || "Standard LGU procurement terms and conditions."
      });
      for (const item of items && Array.isArray(items) ? items : prItems) {
        await db.insert("rfq_items", {
          rfq_id: newRfq.id,
          pr_item_id: item.pr_item_id || item.id,
          item_no: item.item_no,
          unit: item.unit,
          description: item.description,
          quantity: item.quantity
        });
      }
      const suppliers = await mysqlQuery("SELECT id FROM suppliers");
      for (const supplier of suppliers) {
        await mysqlQuery(
          "INSERT IGNORE INTO rfq_supplier_invitations (rfq_id, supplier_id, status) VALUES (?, ?, 'Invited')",
          [newRfq.id, supplier.id]
        );
        const supplierUsers = await mysqlQuery("SELECT id FROM users WHERE supplier_id = ? AND role = 'Supplier'", [supplier.id]);
        for (const supplierUser of supplierUsers) {
          await notifyStakeholders({ user_id: Number(supplierUser.id), title: "New RFQ Invitation", message: `You have been invited to respond to RFQ ${newRfq.rfq_no}.`, type: "info" });
        }
      }
      res.status(201).json(newRfq);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/supplier/rfqs", authenticate2, requireRoles2(["Supplier"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: "Supplier account is not linked to a supplier registry record." });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT r.*, i.status AS invitation_status, i.responded_at, pr.pr_no
         FROM rfq_supplier_invitations i
         JOIN rfq_records r ON r.id = i.rfq_id
         JOIN purchase_requests pr ON pr.id = r.pr_id
         WHERE i.supplier_id = ? ORDER BY r.id DESC`,
        [Number(req.user.supplier_id)]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/supplier/rfqs/:id", authenticate2, requireRoles2(["Supplier"]), async (req, res) => {
    try {
      if (!req.user.supplier_id) return res.status(403).json({ error: "Supplier account is not linked to a supplier registry record." });
      const id = Number(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT r.*, pr.pr_no, i.status AS invitation_status
         FROM rfq_records r
         JOIN purchase_requests pr ON pr.id = r.pr_id
         JOIN rfq_supplier_invitations i ON i.rfq_id = r.id AND i.supplier_id = ?
         WHERE r.id = ?`,
        [Number(req.user.supplier_id), id]
      );
      if (!rows.length) return res.status(404).json({ error: "RFQ invitation not found." });
      const items = await query2(
        `SELECT ri.pr_item_id, ri.item_no, ri.unit, ri.description, ri.quantity,
                qi.offered_unit_price, qi.is_compliant, qi.remarks
         FROM rfq_items ri
         LEFT JOIN supplier_quotations q ON q.rfq_id = ri.rfq_id AND q.supplier_id = ?
         LEFT JOIN supplier_quotation_items qi ON qi.quotation_id = q.id AND qi.pr_item_id = ri.pr_item_id
         WHERE ri.rfq_id = ? ORDER BY ri.item_no`,
        [Number(req.user.supplier_id), id]
      );
      res.json({ ...rows[0], items });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/supplier/rfqs/:id/accept", authenticate2, requireRoles2(["Supplier"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: "Supplier account is not linked to a supplier registry record." });
      const rfqId = Number(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(`SELECT r.id, r.status, i.status AS invitation_status FROM rfq_records r JOIN rfq_supplier_invitations i ON i.rfq_id = r.id AND i.supplier_id = ? WHERE r.id = ?`, [Number(req.user.supplier_id), rfqId]);
      if (!rows.length) return res.status(404).json({ error: "RFQ invitation not found." });
      if (rows[0].status !== "Published") return res.status(409).json({ error: "Only published RFQs can be accepted." });
      await query2(`UPDATE rfq_supplier_invitations SET status = 'Accepted' WHERE rfq_id = ? AND supplier_id = ? AND status = 'Invited'`, [rfqId, Number(req.user.supplier_id)]);
      await db.logAudit("rfq_supplier_invitations", rfqId, "UPDATE", rows[0].invitation_status, "Accepted", req.user.role, req.user.name);
      res.json({ rfq_id: rfqId, status: "Accepted", message: "RFQ invitation accepted. You may submit a quotation before the deadline." });
    } catch (e) {
      res.status(500).json({ error: e.message || "RFQ invitation acceptance failed." });
    }
  });
  app2.post("/api/supplier/rfqs/:id/quotation", authenticate2, requireRoles2(["Supplier"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: "Supplier account is not linked to a supplier registry record." });
      const supplier = await db.getById("suppliers", Number(req.user.supplier_id));
      if (!supplier || supplier.supplier_status !== "Active" || !supplier.email_verified) return res.status(403).json({ error: "Supplier account must be active and email-verified before submitting quotations." });
      const rfqId = Number(req.params.id);
      const { items, remarks } = req.body;
      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Quotation items are required." });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rfqs = await query2(
        `SELECT r.*, i.status AS invitation_status FROM rfq_records r
         JOIN rfq_supplier_invitations i ON i.rfq_id = r.id AND i.supplier_id = ?
         WHERE r.id = ?`,
        [Number(req.user.supplier_id), rfqId]
      );
      const rfq = rfqs[0];
      if (!rfq) return res.status(404).json({ error: "RFQ invitation not found." });
      if (rfq.status !== "Published") return res.status(409).json({ error: "This RFQ is not accepting quotations." });
      if (new Date(rfq.close_date).getTime() < Date.now()) return res.status(409).json({ error: "The quotation deadline has passed." });
      const quotationRows = await query2(
        "SELECT status FROM supplier_quotations WHERE rfq_id = ? AND supplier_id = ? LIMIT 1",
        [rfqId, Number(req.user.supplier_id)]
      );
      const quotationTransition = validateEntityTransition("Quotation", {
        fromStatus: quotationRows[0]?.status || "Draft",
        toStatus: "Submitted",
        role: req.user.role
      });
      if (!quotationTransition.valid) {
        return res.status(409).json({ error: quotationTransition.errors.join(" "), errors: quotationTransition.errors, nextAction: quotationTransition.nextAction });
      }
      const rfqItems = await query2("SELECT pr_item_id, quantity FROM rfq_items WHERE rfq_id = ?", [rfqId]);
      const incoming = new Map(items.map((item) => [Number(item.pr_item_id), item]));
      if (incoming.size !== rfqItems.length || rfqItems.some((item) => !incoming.has(Number(item.pr_item_id)))) {
        return res.status(400).json({ error: "Submit one quotation price for every RFQ item." });
      }
      const result = await withTransaction(async (connection) => {
        const [quotationResult] = await connection.execute(
          `INSERT INTO supplier_quotations (rfq_id, supplier_id, submitted_by_user_id, status, remarks)
           VALUES (?, ?, ?, 'Submitted', ?)
           ON DUPLICATE KEY UPDATE submitted_by_user_id = VALUES(submitted_by_user_id), submitted_at = CURRENT_TIMESTAMP, status = 'Submitted', remarks = VALUES(remarks)`,
          [rfqId, Number(req.user.supplier_id), Number(req.user.id), remarks || null]
        );
        const [quotationRows2] = await connection.query(
          "SELECT id FROM supplier_quotations WHERE rfq_id = ? AND supplier_id = ?",
          [rfqId, Number(req.user.supplier_id)]
        );
        const quotationId = Number(quotationRows2[0].id);
        const [revisionRows] = await connection.query("SELECT COALESCE(MAX(revision_no), 0) AS revision_no FROM supplier_quotation_revisions WHERE quotation_id = ?", [quotationId]);
        await connection.execute(
          "INSERT INTO supplier_quotation_revisions (quotation_id, revision_no, payload, submitted_by_user_id) VALUES (?, ?, ?, ?)",
          [quotationId, Number(revisionRows[0]?.revision_no || 0) + 1, JSON.stringify({ items, remarks }), Number(req.user.id)]
        );
        await connection.execute("DELETE FROM supplier_quotation_items WHERE quotation_id = ?", [quotationId]);
        await connection.execute("DELETE FROM abstract_bids WHERE rfq_id = ? AND supplier_id = ?", [rfqId, Number(req.user.supplier_id)]);
        for (const rfqItem of rfqItems) {
          const item = incoming.get(Number(rfqItem.pr_item_id));
          const unitPrice = Number(item.offered_unit_price);
          if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Every quotation price must be a valid non-negative amount.");
          const totalPrice = unitPrice * Number(rfqItem.quantity);
          const compliant = item.is_compliant !== false;
          await connection.execute(
            `INSERT INTO supplier_quotation_items (quotation_id, pr_item_id, offered_unit_price, offered_total_price, is_compliant, remarks)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [quotationId, Number(rfqItem.pr_item_id), unitPrice, totalPrice, compliant, item.remarks || null]
          );
          await connection.execute(
            `INSERT INTO abstract_bids (rfq_id, supplier_id, pr_item_id, offered_unit_price, offered_total_price, is_compliant, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [rfqId, Number(req.user.supplier_id), Number(rfqItem.pr_item_id), unitPrice, totalPrice, compliant, item.remarks || null]
          );
        }
        await connection.execute(
          `UPDATE rfq_supplier_invitations SET status = 'Responded', responded_at = CURRENT_TIMESTAMP
           WHERE rfq_id = ? AND supplier_id = ?`,
          [rfqId, Number(req.user.supplier_id)]
        );
        return { id: quotationId, rfq_id: rfqId, supplier_id: Number(req.user.supplier_id), status: "Submitted" };
      });
      await db.logAudit("supplier_quotations", result.id, "CREATE", null, JSON.stringify(result), req.user.role, req.user.name);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/supplier/po/:id/delivery-confirmation", authenticate2, requireRoles2(["Supplier"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      if (!req.user.supplier_id) return res.status(403).json({ error: "Supplier account is not linked to a supplier registry record." });
      const poId = Number(req.params.id);
      const deliveryDate = String(req.body?.delivery_date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
      const remarks = String(req.body?.remarks || "").trim();
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery(`SELECT po.id, po.po_no, po.status, po.supplier_id, pr.department_id FROM purchase_orders po JOIN purchase_requests pr ON pr.id = po.pr_id WHERE po.id = ? AND po.supplier_id = ?`, [poId, Number(req.user.supplier_id)]);
      if (!rows.length) return res.status(404).json({ error: "Purchase Order not found for this supplier." });
      if (!["Signed", "Issued", "Partially_Delivered"].includes(rows[0].status)) return res.status(409).json({ error: `Delivery confirmation is not allowed for PO status ${rows[0].status}.` });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || Number.isNaN(new Date(deliveryDate).getTime())) return res.status(400).json({ error: "A valid delivery date is required." });
      const prefix = `DEL-${(/* @__PURE__ */ new Date()).getFullYear()}-`;
      const latest = await mysqlQuery("SELECT confirmation_no FROM supplier_delivery_confirmations WHERE confirmation_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const sequence = String(Number(latest[0]?.confirmation_no?.match(/(\d+)$/)?.[1] || 0) + 1).padStart(4, "0");
      const confirmation = await db.insert("supplier_delivery_confirmations", {
        po_id: poId,
        supplier_id: Number(req.user.supplier_id),
        confirmation_no: `${prefix}${sequence}`,
        delivery_date: deliveryDate,
        status: "Submitted",
        remarks: remarks || null,
        created_by_user_id: Number(req.user.id)
      });
      await db.logAudit("supplier_delivery_confirmations", confirmation.id, "CREATE", null, JSON.stringify(confirmation), req.user.role, req.user.name);
      await notifyStakeholders({ target_role: "GSO Officer", department_id: rows[0].department_id, title: "Supplier Delivery Confirmation", message: `Supplier confirmed delivery for PO ${rows[0].po_no} under ${confirmation.confirmation_no}.`, type: "info" });
      res.status(201).json(confirmation);
    } catch (e) {
      res.status(500).json({ error: e.message || "Delivery confirmation failed." });
    }
  });
  app2.get("/api/suppliers/:id/performance", authenticate2, requireRoles2(["Supplier", "GSO Officer", "BAC Secretariat", "Mayor", "Budget Officer", "Finance Officer"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const supplierId = Number(req.params.id);
      if (req.user.role === "Supplier" && Number(req.user.supplier_id) !== supplierId) return res.status(403).json({ error: "You may only view your own performance." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const supplier = await db.getById("suppliers", supplierId);
      if (!supplier) return res.status(404).json({ error: "Supplier not found." });
      const deliveries = await mysqlQuery(`SELECT d.*, po.po_no FROM supplier_delivery_confirmations d JOIN purchase_orders po ON po.id = d.po_id WHERE d.supplier_id = ? ORDER BY d.id DESC`, [supplierId]);
      const quotationStats = await mysqlQuery(`SELECT COUNT(*) AS submissions, SUM(status = 'Submitted') AS submitted FROM supplier_quotations WHERE supplier_id = ?`, [supplierId]);
      const score = deliveries.length ? Math.min(100, Math.round(deliveries.filter((delivery) => delivery.status === "Accepted").length / deliveries.length * 100)) : Number(supplier.performance_rating || 0);
      res.json({ supplier_id: supplierId, supplier_status: supplier.supplier_status, email_verified: Boolean(supplier.email_verified), score, compliance_notes: supplier.compliance_notes || null, quotationStats: quotationStats[0] || {}, deliveries });
    } catch (e) {
      res.status(500).json({ error: e.message || "Supplier performance could not be loaded." });
    }
  });
  app2.put("/api/supplier/delivery-confirmations/:id/status", authenticate2, requireRoles2(["GSO Officer", "Mayor", "Finance Officer"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const confirmationId = Number(req.params.id);
      const status = String(req.body?.status || "");
      if (!["Accepted", "Rejected", "Correction_Required"].includes(status)) return res.status(400).json({ error: "Invalid delivery confirmation status." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery("SELECT * FROM supplier_delivery_confirmations WHERE id = ?", [confirmationId]);
      if (!rows.length) return res.status(404).json({ error: "Delivery confirmation not found." });
      const updated = await db.update("supplier_delivery_confirmations", confirmationId, { status, remarks: req.body?.remarks ? String(req.body.remarks).trim() : rows[0].remarks });
      await db.logAudit("supplier_delivery_confirmations", confirmationId, "STATUS_CHANGE", JSON.stringify(rows[0]), JSON.stringify(updated), req.user.role, req.user.name);
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message || "Delivery confirmation status update failed." });
    }
  });
  app2.get("/api/rfq/:id/bids", authenticate2, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rfqRows = await query2(
        "SELECT pr.department_id FROM rfq_records r JOIN purchase_requests pr ON pr.id = r.pr_id WHERE r.id = ?",
        [id]
      );
      if (!rfqRows.length) return res.status(404).json({ error: "RFQ not found" });
      if (!canAccessDepartment(req.user, rfqRows[0].department_id)) {
        return res.status(403).json({ error: "You are not allowed to access this RFQ." });
      }
      const bids = await query2("SELECT * FROM abstract_bids WHERE rfq_id = ?", [id]);
      res.json(bids);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/rfq/:id/bids", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rfqRows = await mysqlQuery(
        "SELECT id, status FROM rfq_records WHERE id = ?",
        [id]
      );
      if (!rfqRows.length) return res.status(404).json({ error: "RFQ not found" });
      if (rfqRows[0].status !== "Published") return res.status(409).json({ error: "Only published RFQs can receive abstract bid entries." });
      if (!Array.isArray(req.body.bids) || req.body.bids.length === 0) return res.status(400).json({ error: "At least one bid is required." });
      const rfqItems = await mysqlQuery(
        `SELECT ri.pr_item_id, ri.quantity, pri.unit_cost
         FROM rfq_items ri JOIN pr_items pri ON pri.id = ri.pr_item_id
         WHERE ri.rfq_id = ?`,
        [id]
      );
      const itemQuantities = new Map(rfqItems.map((item) => [Number(item.pr_item_id), Number(item.quantity)]));
      const itemAbcPrices = new Map(rfqItems.map((item) => [Number(item.pr_item_id), Number(item.unit_cost)]));
      if (itemQuantities.size === 0) return res.status(409).json({ error: "RFQ has no itemized requirements." });
      const normalizedBids = [];
      for (const bid of req.body.bids) {
        const offeredUnitPrice = Number(bid.offered_unit_price);
        const prItemId = Number(bid.pr_item_id);
        if (!bid.supplier_id || !itemQuantities.has(prItemId) || !Number.isFinite(offeredUnitPrice) || offeredUnitPrice < 0) {
          return res.status(400).json({ error: "Each bid requires supplier, item, and a valid non-negative price." });
        }
        normalizedBids.push({
          supplier_id: Number(bid.supplier_id),
          pr_item_id: prItemId,
          offered_unit_price: offeredUnitPrice,
          offered_total_price: offeredUnitPrice * (itemQuantities.get(prItemId) || 1),
          is_compliant: bid.is_compliant !== false && offeredUnitPrice <= (itemAbcPrices.get(prItemId) ?? Number.POSITIVE_INFINITY),
          remarks: bid.remarks || null
        });
      }
      const supplierBids = /* @__PURE__ */ new Map();
      for (const bid of normalizedBids) {
        const current = supplierBids.get(bid.supplier_id) || [];
        current.push(bid);
        supplierBids.set(bid.supplier_id, current);
      }
      const responsiveTotals = /* @__PURE__ */ new Map();
      for (const [supplierId, supplierBidRows] of supplierBids) {
        const bidItemIds = new Set(supplierBidRows.map((bid) => bid.pr_item_id));
        const hasAllItems = bidItemIds.size === itemQuantities.size && [...itemQuantities.keys()].every((itemId) => bidItemIds.has(itemId));
        const isResponsive = hasAllItems && supplierBidRows.length === itemQuantities.size && supplierBidRows.every((bid) => bid.is_compliant);
        if (isResponsive) {
          responsiveTotals.set(supplierId, supplierBidRows.reduce((total, bid) => total + bid.offered_total_price, 0));
        }
      }
      const lowestResponsiveTotal = responsiveTotals.size > 0 ? Math.min(...responsiveTotals.values()) : null;
      await mysqlQuery("DELETE FROM abstract_bids WHERE rfq_id = ?", [id]);
      const bids = [];
      for (const bid of normalizedBids) {
        bids.push(await db.insert("abstract_bids", {
          rfq_id: id,
          ...bid,
          is_lowest_bidder: lowestResponsiveTotal !== null && responsiveTotals.get(bid.supplier_id) === lowestResponsiveTotal
        }));
      }
      res.status(201).json(bids);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/bac-resolutions", authenticate2, requireRoles2(["BAC Secretariat", "Mayor", "GSO Officer", "Budget Officer"]), async (req, res) => {
    try {
      const currentUser = req.user;
      if (!canAccessModule(currentUser, "bac")) {
        return res.status(403).json({ error: "Forbidden: BAC module is not available for this role." });
      }
      const rows = await db.getTable("bac_resolutions");
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/noa", authenticate2, async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(`
        SELECT noa.*, br.rfq_id, rfq.pr_id, pr.pr_no, pr.department_id, s.name as supplier_name,
               br.type_of_bidding
        FROM notices_of_award noa
        JOIN bac_resolutions br ON br.id = noa.bac_resolution_id
        JOIN rfq_records rfq ON rfq.id = br.rfq_id
        JOIN purchase_requests pr ON pr.id = rfq.pr_id
        JOIN suppliers s ON s.id = noa.supplier_id
      `);
      const currentUser = req.user;
      res.json(currentUser.role === "End User" ? rows.filter((row) => canAccessDepartment(currentUser, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/bac-resolutions", authenticate2, requireRoles2(["BAC Secretariat", "Mayor", "GSO Officer"]), async (req, res) => {
    try {
      const { rfq_id, winning_supplier_id, justification, type_of_bidding } = req.body;
      if (!rfq_id || !winning_supplier_id || !justification) {
        return res.status(400).json({ error: "RFQ, winning supplier, and justification are required." });
      }
      const rfq = await db.getById("rfq_records", Number(rfq_id));
      const supplier = await db.getById("suppliers", Number(winning_supplier_id));
      if (!rfq) return res.status(404).json({ error: "RFQ not found." });
      if (!supplier) return res.status(404).json({ error: "Winning supplier not found." });
      const supplierCompliance = evaluateProcurementCompliance({
        amount: 0,
        modeOfProcurement: "Shopping",
        supplier: { name: supplier.name, tin: supplier.tin, email: supplier.email }
      });
      if (!supplierCompliance.compliant) {
        return res.status(422).json({ error: "Supplier qualification validation failed.", compliance: supplierCompliance });
      }
      if (rfq.status === "Closed") return res.status(409).json({ error: "This RFQ has already been awarded and closed." });
      const pr = await db.getById("purchase_requests", Number(rfq.pr_id));
      if (!pr) return res.status(404).json({ error: "Linked Purchase Request not found." });
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to award this department." });
      }
      if (pr.status !== "Approved") {
        return res.status(409).json({ error: "Only approved Purchase Requests may proceed to BAC award." });
      }
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const existingResolution = await mysqlQuery("SELECT id FROM bac_resolutions WHERE rfq_id = ? LIMIT 1", [Number(rfq_id)]);
      if (existingResolution.length) {
        return res.status(409).json({ error: "This RFQ already has a BAC resolution." });
      }
      const rfqItems = await mysqlQuery("SELECT pr_item_id FROM rfq_items WHERE rfq_id = ?", [Number(rfq_id)]);
      if (!rfqItems.length) return res.status(409).json({ error: "RFQ has no itemized requirements." });
      const winningBids = await mysqlQuery(
        `SELECT supplier_id, COUNT(DISTINCT pr_item_id) AS item_count,
                SUM(offered_total_price) AS total_bid,
                SUM(CASE WHEN is_compliant = TRUE THEN 0 ELSE 1 END) AS non_compliant_count
         FROM abstract_bids
         WHERE rfq_id = ? AND supplier_id = ?
         GROUP BY supplier_id`,
        [Number(rfq_id), Number(winning_supplier_id)]
      );
      const allSupplierTotals = await mysqlQuery(
        `SELECT supplier_id, SUM(offered_total_price) AS total_bid
        FROM abstract_bids
        WHERE rfq_id = ?
         GROUP BY supplier_id
        HAVING COUNT(DISTINCT pr_item_id) = ? AND COUNT(*) = ?
          AND SUM(CASE WHEN is_compliant = TRUE THEN 0 ELSE 1 END) = 0`,
        [Number(rfq_id), rfqItems.length, rfqItems.length]
      );
      const winningBid = winningBids[0];
      const lowestTotal = allSupplierTotals.length ? Math.min(...allSupplierTotals.map((row) => Number(row.total_bid))) : null;
      const isValidWinner = winningBid && Number(winningBid.item_count) === rfqItems.length && Number(winningBid.non_compliant_count) === 0 && lowestTotal !== null && Number(winningBid.total_bid) === lowestTotal;
      if (!isValidWinner) {
        return res.status(409).json({ error: "The selected supplier does not have a lowest compliant bid in the abstract." });
      }
      const bacTransition = validateEntityTransition("BACResolution", {
        fromStatus: "Draft",
        toStatus: "Signed",
        role: req.user.role,
        fields: { justification }
      });
      if (!bacTransition.valid) {
        return res.status(403).json({ error: bacTransition.errors.join(" "), errors: bacTransition.errors, nextAction: bacTransition.nextAction });
      }
      const rfqTransition = validateEntityTransition("RFQ", {
        fromStatus: rfq.status,
        toStatus: "Closed",
        role: req.user.role
      });
      if (!rfqTransition.valid) {
        return res.status(409).json({ error: rfqTransition.errors.join(" "), errors: rfqTransition.errors, nextAction: rfqTransition.nextAction });
      }
      const today = /* @__PURE__ */ new Date();
      const prefix = `BAC-${today.getFullYear()}-`;
      const latest = await mysqlQuery("SELECT resolution_no FROM bac_resolutions WHERE resolution_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.resolution_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const newRes = await db.insert("bac_resolutions", {
        resolution_no: `${prefix}${sequence}`,
        rfq_id: Number(rfq_id),
        date_passed: today.toISOString().slice(0, 10),
        winning_supplier_id: Number(winning_supplier_id),
        type_of_bidding: type_of_bidding || "Small Value Procurement",
        justification: String(justification).trim(),
        status: "Signed"
      });
      await db.update("rfq_records", Number(rfq_id), { status: "Closed" });
      const noaPrefix = `NOA-${today.getFullYear()}-`;
      const noaLatest = await mysqlQuery("SELECT noa_no FROM notices_of_award WHERE noa_no LIKE ? ORDER BY id DESC LIMIT 1", [`${noaPrefix}%`]);
      const noaSequence = String((noaLatest[0]?.noa_no?.match(/(\d+)$/)?.[1] ? Number(noaLatest[0].noa_no.match(/(\d+)$/)?.[1]) : 0) + 1).padStart(4, "0");
      const newNoa = await db.insert("notices_of_award", {
        noa_no: `${noaPrefix}${noaSequence}`,
        bac_resolution_id: Number(newRes.id),
        rfq_id: Number(rfq_id),
        supplier_id: Number(winning_supplier_id),
        date_issued: today.toISOString().slice(0, 10),
        status: "Issued"
      });
      await db.logAudit("bac_resolutions", Number(newRes.id), "CREATE", null, JSON.stringify(newRes), req.user.role, req.user.name);
      await db.logAudit("notices_of_award", Number(newNoa.id), "CREATE", null, JSON.stringify(newNoa), req.user.role, req.user.name);
      const winningSupplierUsers = await mysqlQuery("SELECT id FROM users WHERE supplier_id = ? AND role = 'Supplier'", [Number(winning_supplier_id)]);
      for (const supplierUser of winningSupplierUsers) {
        await notifyStakeholders({ user_id: Number(supplierUser.id), title: "Notice of Award Issued", message: `Your supplier account was selected for RFQ ${rfq.rfq_no}. Notice of Award ${newNoa.noa_no} is ready for acceptance.`, type: "success" });
      }
      res.status(201).json({ ...newRes, noa: newNoa });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/noa", authenticate2, requireRoles2(["BAC Secretariat", "Mayor", "GSO Officer"]), async (req, res) => {
    try {
      const { bac_resolution_id } = req.body;
      if (!bac_resolution_id) return res.status(400).json({ error: "BAC resolution is required." });
      const bacResolution = await db.getById("bac_resolutions", Number(bac_resolution_id));
      if (!bacResolution) return res.status(404).json({ error: "BAC resolution not found." });
      const existingNoa = await db.getTable("notices_of_award");
      const duplicate = existingNoa.find((row) => Number(row.bac_resolution_id) === Number(bac_resolution_id));
      if (duplicate) return res.status(409).json({ error: "This BAC resolution already has a Notice of Award." });
      const rfq = await db.getById("rfq_records", Number(bacResolution.rfq_id));
      if (!rfq) return res.status(404).json({ error: "Linked RFQ not found." });
      const pr = await db.getById("purchase_requests", Number(rfq.pr_id));
      if (!pr || pr.status !== "Approved") return res.status(409).json({ error: "A Notice of Award can only be created for an approved PR." });
      const today = /* @__PURE__ */ new Date();
      const prefix = `NOA-${today.getFullYear()}-`;
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const latest = await mysqlQuery("SELECT noa_no FROM notices_of_award WHERE noa_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.noa_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const newNoa = await db.insert("notices_of_award", {
        noa_no: `${prefix}${sequence}`,
        bac_resolution_id: Number(bac_resolution_id),
        rfq_id: Number(rfq.id),
        supplier_id: Number(bacResolution.winning_supplier_id),
        date_issued: today.toISOString().slice(0, 10),
        status: "Issued"
      });
      res.status(201).json(newNoa);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/po", authenticate2, async (req, res) => {
    try {
      const currentUser = req.user;
      if (!canAccessModule(currentUser, "po")) {
        return res.status(403).json({ error: "Forbidden: PO module is not available for this role." });
      }
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT po.*, pr.department_id,
                COALESCE(po_remaining.remaining_quantity, 0) AS remaining_quantity
         FROM purchase_orders po
         JOIN purchase_requests pr ON pr.id = po.pr_id
         LEFT JOIN (
           SELECT poi.po_id,
                  SUM(GREATEST(poi.quantity - COALESCE(delivered.delivered_quantity, 0), 0)) AS remaining_quantity
           FROM po_items poi
           LEFT JOIN (
             SELECT ii.po_item_id, SUM(ii.quantity_delivered) AS delivered_quantity
             FROM iar_items ii
             JOIN iar_records ir ON ir.id = ii.iar_id
             GROUP BY ii.po_item_id
           ) delivered ON delivered.po_item_id = poi.id
           GROUP BY poi.po_id
         ) po_remaining ON po_remaining.po_id = po.id`
      );
      res.json(currentUser.role === "End User" ? rows.filter((row) => canAccessDepartment(currentUser, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/po", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      if (!canAccessModule(req.user, "po")) {
        return res.status(403).json({ error: "Forbidden: PO module is not available for this role." });
      }
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const { items, pr_id, noa_id, supplier_id, mode_of_procurement } = req.body;
      if (!pr_id || !noa_id || !supplier_id || !mode_of_procurement) {
        return res.status(400).json({ error: "PR, NOA, supplier, and procurement mode are required." });
      }
      const [pr, noa, supplier] = await Promise.all([
        db.getById("purchase_requests", Number(pr_id)),
        db.getById("notices_of_award", Number(noa_id)),
        db.getById("suppliers", Number(supplier_id))
      ]);
      if (!pr) return res.status(404).json({ error: `Purchase Request ${pr_id} not found.` });
      if (!noa) return res.status(404).json({ error: `Notice of Award ${noa_id} not found.` });
      if (!supplier) return res.status(404).json({ error: `Supplier ${supplier_id} not found.` });
      if (pr.status !== "Approved") {
        return res.status(409).json({ error: "Only approved Purchase Requests may be converted to a PO." });
      }
      const poPrTotalRows = await mysqlQuery(
        "SELECT COALESCE(SUM(total_cost), 0) AS amount FROM pr_items WHERE pr_id = ?",
        [Number(pr_id)]
      );
      const poCompliance = evaluateProcurementCompliance({
        amount: Number(poPrTotalRows[0]?.amount || 0),
        modeOfProcurement: mode_of_procurement || pr.mode_of_procurement,
        supplier: { name: supplier.name, tin: supplier.tin, email: supplier.email },
        requiredDocuments: ["Approved Purchase Request"],
        availableDocuments: ["Approved Purchase Request"]
      });
      if (!poCompliance.compliant) {
        return res.status(422).json({ error: "PO compliance validation failed.", compliance: poCompliance });
      }
      if (Number(noa.supplier_id) !== Number(supplier_id)) {
        return res.status(409).json({ error: "The selected supplier does not match the Notice of Award." });
      }
      const noaRelationship = await mysqlQuery(
        `SELECT br.rfq_id, rfq.pr_id
         FROM notices_of_award noa
         JOIN bac_resolutions br ON br.id = noa.bac_resolution_id
         JOIN rfq_records rfq ON rfq.id = br.rfq_id
         WHERE noa.id = ?`,
        [Number(noa_id)]
      );
      if (!noaRelationship.length || Number(noaRelationship[0].pr_id) !== Number(pr_id) || !["Issued", "Accepted"].includes(noa.status)) {
        return res.status(409).json({ error: "The Notice of Award is not valid for this approved Purchase Request." });
      }
      if (!canAccessDepartment(req.user, pr.department_id)) {
        return res.status(403).json({ error: "You are not allowed to create a PO for this department." });
      }
      const existingPos = await mysqlQuery(
        "SELECT * FROM `purchase_orders` WHERE noa_id = ? LIMIT 1",
        [Number(noa_id)]
      );
      if (existingPos.length > 0) {
        return res.status(409).json({ error: `NOA ${noa_id} has already been converted to PO ${existingPos[0].po_no || existingPos[0].id}.` });
      }
      const today = /* @__PURE__ */ new Date();
      const dateIssued = today.toISOString().slice(0, 10);
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const latestPo = await mysqlQuery(
        "SELECT po_no FROM `purchase_orders` WHERE po_no LIKE ? ORDER BY id DESC LIMIT 1",
        [`PO-${year}-${month}-%`]
      );
      const latestSequence = latestPo[0]?.po_no?.match(/(\d+)$/)?.[1];
      const poSequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const poData = {
        po_no: `PO-${year}-${month}-${poSequence}`,
        pr_id: Number(pr_id),
        noa_id: Number(noa_id),
        supplier_id: Number(supplier_id),
        po_date: dateIssued,
        mode_of_procurement,
        penalty_clause: "A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed.",
        status: "Signed"
      };
      const prItems = items && Array.isArray(items) ? items : await mysqlQuery("SELECT * FROM `pr_items` WHERE pr_id = ?", [Number(pr_id)]);
      if (prItems.length === 0) return res.status(400).json({ error: "At least one PR item is required to create a PO." });
      const poTransition = validateEntityTransition("PO", {
        fromStatus: "Draft",
        toStatus: "Signed",
        role: req.user.role
      });
      if (!poTransition.valid) {
        return res.status(403).json({ error: poTransition.errors.join(" "), errors: poTransition.errors, nextAction: poTransition.nextAction });
      }
      const latestNtp = await mysqlQuery(
        "SELECT ntp_no FROM `notices_to_proceed` WHERE ntp_no LIKE ? ORDER BY id DESC LIMIT 1",
        [`NTP-${year}-%`]
      );
      const latestNtpSequence = latestNtp[0]?.ntp_no?.match(/(\d+)$/)?.[1];
      const ntpSequence = String((latestNtpSequence ? Number(latestNtpSequence) : 0) + 1).padStart(4, "0");
      const result = await withTransaction(async (connection) => {
        const [poResult] = await connection.execute(
          "INSERT INTO purchase_orders (`po_no`, `pr_id`, `noa_id`, `supplier_id`, `po_date`, `mode_of_procurement`, `penalty_clause`, `status`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [poData.po_no, poData.pr_id, poData.noa_id, poData.supplier_id, poData.po_date, poData.mode_of_procurement, poData.penalty_clause, poData.status]
        );
        const poId = Number(poResult.insertId);
        for (const item of prItems) {
          const quantity = Number(item.quantity);
          const unitCost = Number(item.unit_cost);
          if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
            throw new Error("PO items must have positive integer quantities and non-negative costs.");
          }
          await connection.execute(
            "INSERT INTO po_items (`po_id`, `pr_item_id`, `quantity`, `unit_cost`, `total_cost`) VALUES (?, ?, ?, ?, ?)",
            [poId, Number(item.pr_item_id || item.id), quantity, unitCost, Number(item.total_cost || quantity * unitCost)]
          );
        }
        const [ntpResult] = await connection.execute(
          "INSERT INTO notices_to_proceed (`ntp_no`, `po_id`, `date_issued`, `delivery_period_days`, `status`) VALUES (?, ?, ?, ?, ?)",
          [`NTP-${year}-${ntpSequence}`, poId, dateIssued, 15, "Issued"]
        );
        return {
          newPo: { id: poId, ...poData },
          ntp: { id: Number(ntpResult.insertId), ntp_no: `NTP-${year}-${ntpSequence}`, po_id: poId, date_issued: dateIssued, delivery_period_days: 15, status: "Issued" }
        };
      });
      await db.logAudit("purchase_orders", result.newPo.id, "CREATE", null, JSON.stringify(result.newPo), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: pr.department_id,
        title: "Purchase Order Issued",
        message: `Purchase Order ${result.newPo.po_no} has been issued for PR ${pr.pr_no}.`,
        type: "info"
      });
      res.status(201).json({ ...result.newPo, ntp: result.ntp });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/po/:id", authenticate2, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const po = await db.getById("purchase_orders", id);
      if (!po) return res.status(404).json({ error: "PO not found" });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const ownershipRows = await query2(
        "SELECT pr.department_id FROM purchase_orders p JOIN purchase_requests pr ON pr.id = p.pr_id WHERE p.id = ?",
        [id]
      );
      if (!ownershipRows.length) return res.status(404).json({ error: "PO not found" });
      if (!canAccessDepartment(req.user, ownershipRows[0].department_id)) {
        return res.status(403).json({ error: "You are not allowed to access this PO." });
      }
      const items = await query2(
        `SELECT poi.*,
                COALESCE((
                  SELECT SUM(ii.quantity_delivered)
                  FROM iar_items ii
                  JOIN iar_records ir ON ir.id = ii.iar_id
                  WHERE ii.po_item_id = poi.id AND ir.po_id = poi.po_id
                ), 0) AS delivered_quantity,
                GREATEST(poi.quantity - COALESCE((
                  SELECT SUM(ii.quantity_delivered)
                  FROM iar_items ii
                  JOIN iar_records ir ON ir.id = ii.iar_id
                  WHERE ii.po_item_id = poi.id AND ir.po_id = poi.po_id
                ), 0), 0) AS remaining_quantity
         FROM po_items poi
         WHERE poi.po_id = ?`,
        [id]
      );
      const supplierRows = await query2("SELECT * FROM suppliers WHERE id = ? LIMIT 1", [po.supplier_id]);
      const departmentRows = await query2(
        "SELECT d.* FROM purchase_orders p JOIN purchase_requests pr ON pr.id = p.pr_id JOIN departments d ON d.id = pr.department_id WHERE p.id = ? LIMIT 1",
        [id]
      );
      res.json({ ...po, items, supplier: supplierRows[0] || null, department: departmentRows[0] || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/suppliers", authenticate2, requireRoles2(["GSO Officer", "BAC Secretariat", "Mayor", "Budget Officer"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const rows = await db.getTable("suppliers");
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/suppliers", authenticate2, requireRoles2(["GSO Officer", "Mayor", "BAC Secretariat"]), async (req, res) => {
    try {
      await ensureSupplierPortalTables();
      const profile = normalizeSupplierProfile(req.body || {});
      const validation = validateSupplierProfile(profile);
      if (!validation.valid) return res.status(400).json({ error: validation.errors.join(" "), errors: validation.errors });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const duplicate = await mysqlQuery("SELECT id FROM suppliers WHERE LOWER(email) = ? OR tin = ? LIMIT 1", [profile.email, profile.tin]);
      if (duplicate.length) return res.status(409).json({ error: "A supplier with this email or TIN already exists." });
      const newSup = await db.insert("suppliers", { ...profile, supplier_status: "Active", email_verified: true, performance_rating: 0, performance_notes: req.body.performance_notes || null });
      await db.logAudit("suppliers", newSup.id, "CREATE", null, JSON.stringify(newSup), req.user.role, req.user.name);
      res.status(201).json(newSup);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/iar", authenticate2, requireRoles2(["GSO Officer", "Mayor", "End User"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT iar.*, pr.department_id
         FROM iar_records iar
         JOIN purchase_orders po ON po.id = iar.po_id
         JOIN purchase_requests pr ON pr.id = po.pr_id`
      );
      const user = req.user;
      res.json(user.role === "End User" ? rows.filter((row) => canAccessDepartment(user, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/iar", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const { items, ...iarData } = req.body;
      if (!iarData.po_id || !iarData.invoice_no || !iarData.invoice_date || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "PO, invoice details, and at least one delivered item are required." });
      }
      const po = await db.getById("purchase_orders", Number(iarData.po_id));
      if (!po) return res.status(404).json({ error: "Purchase Order not found." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const poOwnership = await mysqlQuery(
        "SELECT pr.department_id FROM purchase_orders p JOIN purchase_requests pr ON pr.id = p.pr_id WHERE p.id = ?",
        [po.id]
      );
      if (!poOwnership.length) return res.status(404).json({ error: "Purchase Order not found." });
      if (!canAccessDepartment(req.user, poOwnership[0].department_id)) {
        return res.status(403).json({ error: "You are not allowed to record delivery for this PO." });
      }
      const poItems = await mysqlQuery(
        `SELECT poi.*, pri.description, pri.unit, pri.ppmp_item_id, COALESCE(ppmp.category, 'Supplies') AS category, pr.department_id, d.head_name, d.head_designation
         FROM po_items poi
         JOIN pr_items pri ON pri.id = poi.pr_item_id
         LEFT JOIN ppmp_items ppmp ON ppmp.id = pri.ppmp_item_id
         JOIN purchase_requests pr ON pr.id = ?
         JOIN departments d ON d.id = pr.department_id
         WHERE poi.po_id = ?`,
        [po.pr_id, po.id]
      );
      if (poItems.length === 0) return res.status(400).json({ error: "Purchase Order has no valid line items." });
      const poItemMap = new Map(poItems.map((item) => [Number(item.id), item]));
      const submittedItemIds = /* @__PURE__ */ new Set();
      const invalidItem = items.find((item) => {
        const quantityDelivered = Number(item.quantity_delivered);
        const poItemId = Number(item.po_item_id);
        if (!poItemId || submittedItemIds.has(poItemId) || !poItemMap.has(poItemId)) return true;
        submittedItemIds.add(poItemId);
        return !Number.isInteger(quantityDelivered) || quantityDelivered <= 0;
      });
      if (invalidItem) return res.status(400).json({ error: "Each delivery line requires a positive integer quantity." });
      const deliveredRows = await mysqlQuery(
        `SELECT ii.po_item_id, COALESCE(SUM(ii.quantity_delivered), 0) AS delivered_quantity
         FROM iar_items ii JOIN iar_records ir ON ir.id = ii.iar_id
         WHERE ir.po_id = ? GROUP BY ii.po_item_id`,
        [po.id]
      );
      const deliveredByPoItem = new Map(deliveredRows.map((row) => [Number(row.po_item_id), Number(row.delivered_quantity)]));
      for (const item of items) {
        const poItem = poItemMap.get(Number(item.po_item_id));
        const newTotal = (deliveredByPoItem.get(Number(item.po_item_id)) || 0) + Number(item.quantity_delivered);
        if (newTotal > Number(poItem.quantity)) {
          return res.status(400).json({ error: `Delivered quantity for ${poItem.description} exceeds the ordered quantity.` });
        }
      }
      const iarTransition = validateEntityTransition("IAR", {
        fromStatus: "Draft",
        toStatus: iarData.is_partial ? "Partial" : "Completed",
        role: req.user.role
      });
      if (!iarTransition.valid) {
        return res.status(403).json({ error: iarTransition.errors.join(" "), errors: iarTransition.errors, nextAction: iarTransition.nextAction });
      }
      const today = /* @__PURE__ */ new Date();
      const prefix = `IAR-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-`;
      const latest = await mysqlQuery("SELECT iar_no FROM iar_records WHERE iar_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.iar_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const status = iarData.is_partial ? "Partial" : "Completed";
      const result = await withTransaction(async (connection) => {
        const [iarResult] = await connection.execute(
          `INSERT INTO iar_records
           (iar_no, po_id, invoice_no, invoice_date, date_inspected, date_accepted,
            inspection_remarks, acceptance_remarks, status, inspected_by, accepted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${prefix}${sequence}`,
            Number(iarData.po_id),
            iarData.invoice_no,
            iarData.invoice_date,
            today.toISOString().slice(0, 10),
            today.toISOString().slice(0, 10),
            iarData.inspection_remarks || "Delivery inspected against the Purchase Order.",
            iarData.acceptance_remarks || "Items accepted subject to inspection findings.",
            status,
            iarData.inspected_by || req.user.name,
            iarData.accepted_by || req.user.name
          ]
        );
        const iarId = Number(iarResult.insertId);
        let propertySequence = 0;
        const latestProperty = await connection.query(
          "SELECT property_no FROM inventory_assets WHERE property_no LIKE ? ORDER BY id DESC LIMIT 1",
          [`LGU-${today.getFullYear()}-%`]
        );
        const latestPropertyNo = latestProperty[0]?.[0]?.property_no;
        propertySequence = Number(latestPropertyNo?.match(/(\d+)$/)?.[1] || 0);
        for (const item of items) {
          const quantityDelivered = Number(item.quantity_delivered);
          const poItem = poItemMap.get(Number(item.po_item_id));
          const isAccepted = item.is_accepted === true;
          const [iarItemResult] = await connection.execute(
            "INSERT INTO iar_items (iar_id, po_item_id, quantity_delivered, is_accepted) VALUES (?, ?, ?, ?)",
            [iarId, Number(item.po_item_id), quantityDelivered, isAccepted]
          );
          if (isAccepted && quantityDelivered > 0 && poItem.category !== "Supplies") {
            for (let unitIndex = 0; unitIndex < quantityDelivered; unitIndex++) {
              propertySequence += 1;
              const cost = Number(poItem.unit_cost);
              await connection.execute(
                `INSERT INTO inventory_assets
                 (iar_item_id, property_no, description, unit, cost, date_acquired, type,
                  assigned_to_user_id, receiver_name, receiver_designation, issuer_name, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  Number(iarItemResult.insertId),
                  `LGU-${today.getFullYear()}-${String(propertySequence).padStart(4, "0")}`,
                  poItem.description,
                  poItem.unit,
                  cost,
                  today.toISOString().slice(0, 10),
                  cost >= 5e4 ? "PAR" : "ICS",
                  poItem.department_id,
                  poItem.head_name,
                  poItem.head_designation,
                  req.user.name,
                  "Active"
                ]
              );
            }
          }
          if (isAccepted && quantityDelivered > 0 && poItem.category === "Supplies") {
            const itemCode = `PPMP-${poItem.ppmp_item_id}`;
            await connection.execute(
              `INSERT INTO inventory_items (item_code, description, category, unit, reorder_level, active)
               VALUES (?, ?, 'Supplies', ?, 0, TRUE)
               ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), description = VALUES(description), unit = VALUES(unit), active = TRUE`,
              [itemCode, poItem.description, poItem.unit]
            );
            const [inventoryItemRows] = await connection.query("SELECT id FROM inventory_items WHERE item_code = ?", [itemCode]);
            await connection.execute(
              `INSERT INTO inventory_transactions
               (inventory_item_id, transaction_type, quantity, unit_cost, to_department_id, reference_table, reference_id, performed_by, transaction_date, remarks)
               VALUES (?, 'RECEIVE', ?, ?, ?, 'iar_records', ?, ?, ?, ?)`,
              [Number(inventoryItemRows[0].id), quantityDelivered, Number(poItem.unit_cost), Number(poItem.department_id), iarId, req.user.name, today.toISOString().slice(0, 10), `Accepted delivery from PO ${po.po_no}`]
            );
          }
        }
        const [totals] = await connection.query(
          `SELECT poi.id, poi.quantity, COALESCE(SUM(ii.quantity_delivered), 0) AS delivered_quantity
           FROM po_items poi LEFT JOIN iar_items ii ON ii.po_item_id = poi.id
           WHERE poi.po_id = ? GROUP BY poi.id, poi.quantity`,
          [po.id]
        );
        const fullyDelivered = totals.length > 0 && totals.every((row) => Number(row.delivered_quantity) >= Number(row.quantity));
        await connection.execute(
          "UPDATE purchase_orders SET status = ? WHERE id = ?",
          [fullyDelivered ? "Fully_Delivered" : "Partially_Delivered", po.id]
        );
        return { id: iarId, iar_no: `${prefix}${sequence}`, po_id: Number(iarData.po_id), status };
      });
      await db.logAudit("iar_records", result.id, "CREATE", null, JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: poOwnership[0].department_id,
        title: "Delivery Inspected & Accepted (IAR)",
        message: `Delivery for PO ${po.po_no} recorded under ${result.iar_no} (Status: ${result.status}).`,
        type: "success"
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/iar/:id", authenticate2, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const iar = await db.getById("iar_records", id);
      if (!iar) return res.status(404).json({ error: "IAR not found" });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const ownershipRows = await query2(
        "SELECT pr.department_id FROM iar_records iar JOIN purchase_orders po ON po.id = iar.po_id JOIN purchase_requests pr ON pr.id = po.pr_id WHERE iar.id = ?",
        [id]
      );
      if (!ownershipRows.length) return res.status(404).json({ error: "IAR not found" });
      if (!canAccessDepartment(req.user, ownershipRows[0].department_id)) {
        return res.status(403).json({ error: "You are not allowed to access this IAR." });
      }
      const items = await query2("SELECT * FROM `iar_items` WHERE iar_id = ?", [id]);
      const supplierRows = await query2(
        "SELECT s.* FROM iar_records ir JOIN purchase_orders po ON po.id = ir.po_id JOIN suppliers s ON s.id = po.supplier_id WHERE ir.id = ? LIMIT 1",
        [id]
      );
      const departmentRows = await query2(
        "SELECT d.* FROM iar_records ir JOIN purchase_orders po ON po.id = ir.po_id JOIN purchase_requests pr ON pr.id = po.pr_id JOIN departments d ON d.id = pr.department_id WHERE ir.id = ? LIMIT 1",
        [id]
      );
      res.json({ ...iar, items, supplier: supplierRows[0] || null, department: departmentRows[0] || null });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/payments", authenticate2, requireRoles2(["Finance Officer", "GSO Officer", "Mayor", "Budget Officer"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(`
        SELECT p.*, po.po_no, pr.department_id, pr.pr_no
        FROM payments p
        JOIN purchase_orders po ON po.id = p.po_id
        JOIN purchase_requests pr ON pr.id = po.pr_id
        ORDER BY p.id DESC
      `);
      res.json(req.user.role === "End User" ? rows.filter((row) => canAccessDepartment(req.user, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/payments", authenticate2, requireRoles2(["Finance Officer", "GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const { po_id, payment_date, amount, payment_method, reference_no, prepared_by, remarks, document_type, document_no, document_url } = req.body;
      if (!po_id || !payment_date || !amount || !prepared_by || !document_no) {
        return res.status(400).json({ error: "PO, payment date, amount, preparer, and supporting document number are required." });
      }
      const po = await db.getById("purchase_orders", Number(po_id));
      if (!po) return res.status(404).json({ error: "Purchase Order not found." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const poOwner = await mysqlQuery("SELECT pr.department_id, pr.pr_no FROM purchase_orders po JOIN purchase_requests pr ON pr.id = po.pr_id WHERE po.id = ?", [po.id]);
      if (!poOwner.length) return res.status(404).json({ error: "PO ownership not found." });
      if (!canAccessDepartment(req.user, poOwner[0].department_id)) {
        return res.status(403).json({ error: "You are not allowed to create payment records for this PO." });
      }
      const acceptedIar = await mysqlQuery(
        "SELECT id, status FROM iar_records WHERE po_id = ? AND status = 'Completed' ORDER BY id DESC LIMIT 1",
        [po.id]
      );
      if (!acceptedIar.length) {
        return res.status(409).json({ error: "Payment requires completed receiving for the entire PO." });
      }
      const completionRows = await mysqlQuery(
        `SELECT COUNT(*) AS incomplete_lines
         FROM po_items poi
         LEFT JOIN (
           SELECT ii.po_item_id, SUM(CASE WHEN ii.is_accepted = TRUE THEN ii.quantity_delivered ELSE 0 END) AS accepted_quantity
           FROM iar_items ii JOIN iar_records ir ON ir.id = ii.iar_id
           WHERE ir.po_id = ? GROUP BY ii.po_item_id
         ) received ON received.po_item_id = poi.id
         WHERE poi.po_id = ? AND COALESCE(received.accepted_quantity, 0) < poi.quantity`,
        [po.id, po.id]
      );
      if (Number(completionRows[0]?.incomplete_lines || 0) > 0) {
        return res.status(409).json({ error: "Payment requires all PO quantities to be received and accepted." });
      }
      const poTotalRows = await mysqlQuery("SELECT COALESCE(SUM(total_cost), 0) AS po_total FROM po_items WHERE po_id = ?", [po.id]);
      const paidRows = await mysqlQuery("SELECT COALESCE(SUM(amount), 0) AS paid_total FROM payments WHERE po_id = ? AND status <> 'Cancelled'", [po.id]);
      const requestedAmount = Number(amount);
      const poTotal = Number(poTotalRows[0]?.po_total || 0);
      const paidTotal = Number(paidRows[0]?.paid_total || 0);
      if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return res.status(400).json({ error: "Payment amount must be greater than zero." });
      const financeCheck = evaluateFinanceSnapshot({
        prAmount: poTotal,
        poAmount: poTotal,
        iarAmount: poTotal,
        paidAmount: paidTotal + requestedAmount
      });
      if (financeCheck.exceptions.some((exception) => exception.code === "PAYMENT_EXCEEDS_PO")) return res.status(409).json({ error: "Cumulative payments cannot exceed the awarded PO total.", exceptions: financeCheck.exceptions });
      const today = /* @__PURE__ */ new Date();
      const prefix = `PAY-${today.getFullYear()}-`;
      const latest = await mysqlQuery("SELECT payment_no FROM payments WHERE payment_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.payment_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const payment = await db.insert("payments", {
        po_id: Number(po_id),
        payment_no: `${prefix}${sequence}`,
        payment_date,
        amount: Number(amount),
        payment_method: payment_method || "Transfer",
        reference_no: reference_no || null,
        status: "For_Verification",
        prepared_by,
        checked_by: req.user.name,
        remarks: remarks || null
      });
      await db.insert("payment_documents", {
        payment_id: payment.id,
        document_type: document_type || "Payment Support",
        document_no,
        document_url: document_url || null,
        notes: remarks || null
      });
      await db.logAudit("payments", payment.id, "CREATE", null, JSON.stringify(payment), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: "Finance Officer",
        title: "Payment Verification Requested",
        message: `Finance review is required for payment ${payment.payment_no} linked to PO ${po.po_no}.`,
        type: "info"
      });
      res.status(201).json(payment);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/payments/:id/status", authenticate2, requireRoles2(["Finance Officer", "Mayor", "GSO Officer"]), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, remarks } = req.body;
      const payment = await db.getById("payments", id);
      if (!payment) return res.status(404).json({ error: "Payment record not found." });
      const validation = validateEntityTransition("Payment", {
        fromStatus: payment.status,
        toStatus: String(status || ""),
        role: req.user.role,
        fields: { remarks }
      });
      if (!validation.valid) {
        const statusCode = validation.errors.some((error) => error.startsWith("Forbidden:")) ? 403 : 409;
        return res.status(statusCode).json({ error: validation.errors.join(" "), errors: validation.errors, nextAction: validation.nextAction });
      }
      const updated = await db.update("payments", id, {
        status,
        checked_by: req.user.name,
        remarks: remarks ? String(remarks).trim() : payment.remarks || null
      });
      await db.logAudit("payments", id, "STATUS_CHANGE", JSON.stringify(payment), JSON.stringify(updated), req.user.role, req.user.name);
      if (status === "Completed") {
        const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
        const totals = await mysqlQuery(
          `SELECT po.id, po.pr_id, poTotal.po_total, COALESCE(paid.paid_total, 0) AS paid_total
           FROM purchase_orders po
           JOIN (SELECT po_id, SUM(total_cost) AS po_total FROM po_items GROUP BY po_id) poTotal ON poTotal.po_id = po.id
           LEFT JOIN (SELECT po_id, SUM(amount) AS paid_total FROM payments WHERE status = 'Completed' GROUP BY po_id) paid ON paid.po_id = po.id
           WHERE po.id = ?`,
          [payment.po_id]
        );
        if (totals[0] && Number(totals[0].paid_total) >= Number(totals[0].po_total)) {
          await mysqlQuery("UPDATE purchase_orders SET status = 'Completed' WHERE id = ?", [payment.po_id]);
          await mysqlQuery("UPDATE purchase_requests pr JOIN purchase_orders po ON po.pr_id = pr.id SET pr.status = 'Completed' WHERE po.id = ?", [payment.po_id]);
        }
      }
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/inventory", authenticate2, requireRoles2(["GSO Officer", "Mayor", "End User"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT asset.*, pr.department_id
         FROM inventory_assets asset
         JOIN iar_items ii ON ii.id = asset.iar_item_id
         JOIN iar_records iar ON iar.id = ii.iar_id
         JOIN purchase_orders po ON po.id = iar.po_id
         JOIN purchase_requests pr ON pr.id = po.pr_id`
      );
      const user = req.user;
      res.json(user.role === "End User" ? rows.filter((row) => Number(row.assigned_to_user_id) === Number(user.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/supplies/inventory", authenticate2, requireRoles2(["GSO Officer", "Mayor", "End User"]), async (req, res) => {
    try {
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const requestedDepartment = Number(req.query.department_id);
      const departmentId = req.user.role === "End User" ? Number(req.user.department_id) : Number.isInteger(requestedDepartment) && requestedDepartment > 0 ? requestedDepartment : null;
      const params = [];
      const departmentFilter = departmentId ? "AND d.id = ?" : "";
      if (departmentId) params.push(departmentId);
      const rows = await mysqlQuery(
        `SELECT i.id, i.item_code, i.description, i.category, i.unit, i.reorder_level, i.active,
                d.id AS department_id, d.name AS department_name, d.code AS department_code,
                COALESCE(SUM(CASE WHEN t.to_department_id = d.id THEN t.quantity ELSE 0 END), 0) AS received_quantity,
                COALESCE(SUM(CASE WHEN t.from_department_id = d.id THEN t.quantity ELSE 0 END), 0) AS issued_quantity,
                COALESCE(SUM(CASE WHEN t.to_department_id = d.id THEN t.quantity ELSE -t.quantity END), 0) AS quantity_on_hand
         FROM inventory_items i
         JOIN departments d ON EXISTS (
           SELECT 1 FROM inventory_transactions department_transactions
           WHERE department_transactions.inventory_item_id = i.id
             AND (department_transactions.to_department_id = d.id OR department_transactions.from_department_id = d.id)
         )
         LEFT JOIN inventory_transactions t ON t.inventory_item_id = i.id
           AND (t.to_department_id = d.id OR t.from_department_id = d.id)
         WHERE i.active = TRUE ${departmentFilter}
         GROUP BY i.id, i.item_code, i.description, i.category, i.unit, i.reorder_level, i.active,
                  d.id, d.name, d.code
         ORDER BY d.name, i.description`,
        params
      );
      res.json(rows.map((row) => ({ ...row, quantity_on_hand: Number(row.quantity_on_hand), low_stock: Number(row.quantity_on_hand) <= Number(row.reorder_level) })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/supplies/items", authenticate2, requireRoles2(["GSO Officer", "Mayor", "End User"]), async (req, res) => {
    try {
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await mysqlQuery(
        `SELECT id, item_code, description, category, unit, reorder_level, active
         FROM inventory_items
         WHERE active = TRUE
         ORDER BY description`
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/supplies/items", authenticate2, requireRoles2(["GSO Officer"]), async (req, res) => {
    try {
      const { item_code, description, category, unit, reorder_level } = req.body;
      if (!String(item_code || "").trim() || !String(description || "").trim() || !String(unit || "").trim()) {
        return res.status(400).json({ error: "Item code, description, and unit are required." });
      }
      const reorderLevel = Number(reorder_level || 0);
      if (!Number.isFinite(reorderLevel) || reorderLevel < 0) return res.status(400).json({ error: "Reorder level must be non-negative." });
      const item = await db.insert("inventory_items", {
        item_code: String(item_code).trim(),
        description: String(description).trim(),
        category: String(category || "Supplies").trim(),
        unit: String(unit).trim(),
        reorder_level: reorderLevel,
        active: true
      });
      await db.logAudit("inventory_items", item.id, "CREATE", null, JSON.stringify(item), req.user.role, req.user.name);
      res.status(201).json(item);
    } catch (e) {
      res.status(e.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: e.code === "ER_DUP_ENTRY" ? "Item code already exists." : e.message });
    }
  });
  app2.post("/api/supplies/transactions", authenticate2, requireRoles2(["GSO Officer"]), async (req, res) => {
    try {
      const { inventory_item_id, transaction_type, quantity, from_department_id, to_department_id, unit_cost, remarks, reference_id } = req.body;
      const itemId = Number(inventory_item_id);
      const amount = Number(quantity);
      const allowedTypes = ["RECEIVE", "ISSUE", "RETURN", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT", "DISPOSAL"];
      if (!Number.isInteger(itemId) || itemId <= 0 || !allowedTypes.includes(transaction_type) || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Item, valid transaction type, and positive quantity are required." });
      }
      const fromDepartment = from_department_id ? Number(from_department_id) : null;
      const toDepartment = to_department_id ? Number(to_department_id) : null;
      if (transaction_type === "RECEIVE" && !toDepartment) return res.status(400).json({ error: "Receiving requires a destination department." });
      if (["ISSUE", "RETURN", "TRANSFER_IN", "TRANSFER_OUT"].includes(transaction_type) && (!fromDepartment || !toDepartment)) {
        return res.status(400).json({ error: "This stock movement requires both source and destination departments." });
      }
      if (transaction_type === "DISPOSAL" && !fromDepartment) return res.status(400).json({ error: "Disposal requires a source department." });
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const result = await withTransaction(async (connection) => {
        const [items] = await connection.query("SELECT id FROM inventory_items WHERE id = ? AND active = TRUE FOR UPDATE", [itemId]);
        if (!items.length) throw Object.assign(new Error("Inventory item not found."), { statusCode: 404 });
        if (fromDepartment) {
          const [balanceRows] = await connection.query(
            `SELECT COALESCE(SUM(CASE WHEN to_department_id = ? THEN quantity ELSE -quantity END), 0) AS balance
             FROM inventory_transactions WHERE inventory_item_id = ? AND (to_department_id = ? OR from_department_id = ?)`,
            [fromDepartment, itemId, fromDepartment, fromDepartment]
          );
          if (Number(balanceRows[0]?.balance || 0) < amount) throw Object.assign(new Error("Insufficient stock in the source department."), { statusCode: 409 });
        }
        const [insertResult] = await connection.execute(
          `INSERT INTO inventory_transactions
           (inventory_item_id, transaction_type, quantity, unit_cost, from_department_id, to_department_id, reference_table, reference_id, performed_by, transaction_date, remarks)
           VALUES (?, ?, ?, ?, ?, ?, 'inventory_items', ?, ?, ?, ?)`,
          [itemId, transaction_type, amount, unit_cost ? Number(unit_cost) : null, fromDepartment, toDepartment, reference_id ? Number(reference_id) : null, req.user.name, today, remarks ? String(remarks).trim() : null]
        );
        return { id: Number(insertResult.insertId), inventory_item_id: itemId, transaction_type, quantity: amount, from_department_id: fromDepartment, to_department_id: toDepartment };
      });
      await db.logAudit("inventory_transactions", result.id, "CREATE", null, JSON.stringify(result), req.user.role, req.user.name);
      res.status(201).json(result);
    } catch (e) {
      res.status(e.statusCode || 500).json({ error: e.message });
    }
  });
  app2.get("/api/ris", authenticate2, requireRoles2(["GSO Officer", "Mayor", "End User"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT r.*, d.name AS department_name,
          ri.asset_id, ri.quantity AS issued_quantity,
          asset.property_no, asset.description, asset.unit, asset.cost,
          asset.date_acquired, asset.type, asset.assigned_to_user_id,
          asset.receiver_name, asset.receiver_designation, asset.status AS asset_status
         FROM ris_records r
         JOIN departments d ON d.id = r.department_id
         LEFT JOIN ris_items ri ON ri.ris_id = r.id
         LEFT JOIN inventory_assets asset ON asset.id = ri.asset_id
         ORDER BY r.id DESC`
      );
      res.json(req.user.role === "End User" ? rows.filter((row) => canAccessDepartment(req.user, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/ris", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const { department_id, requisitioner_name, requisitioner_designation, purpose, items } = req.body;
      if (!department_id || !requisitioner_name || !requisitioner_designation || !purpose || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Department, requisitioner details, purpose, and at least one asset are required." });
      }
      const department = await db.getById("departments", Number(department_id));
      if (!department) return res.status(400).json({ error: "Invalid department." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const assetIds = items.map((item) => Number(item.asset_id));
      if (assetIds.some((id) => !Number.isInteger(id) || id <= 0) || new Set(assetIds).size !== assetIds.length) {
        return res.status(400).json({ error: "RIS contains invalid or duplicate assets." });
      }
      const assets = await mysqlQuery(
        `SELECT id, status FROM inventory_assets WHERE id IN (${assetIds.map(() => "?").join(", ")})`,
        assetIds
      );
      if (assets.length !== assetIds.length || assets.some((asset) => asset.status !== "Active")) {
        return res.status(409).json({ error: "Only active inventory assets may be issued through RIS." });
      }
      const risTransition = validateEntityTransition("RIS", {
        fromStatus: "Draft",
        toStatus: "Issued",
        role: req.user.role
      });
      if (!risTransition.valid) {
        return res.status(403).json({ error: risTransition.errors.join(" "), errors: risTransition.errors, nextAction: risTransition.nextAction });
      }
      const today = /* @__PURE__ */ new Date();
      const prefix = `RIS-${today.getFullYear()}-`;
      const latest = await mysqlQuery("SELECT ris_no FROM ris_records WHERE ris_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.ris_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const result = await withTransaction(async (connection) => {
        const [recordResult] = await connection.execute(
          `INSERT INTO ris_records
           (ris_no, department_id, requisitioner_name, requisitioner_designation, issued_by, date_issued, purpose, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Issued')`,
          [`${prefix}${sequence}`, Number(department_id), requisitioner_name, requisitioner_designation, req.user.name, today.toISOString().slice(0, 10), purpose]
        );
        const risId = Number(recordResult.insertId);
        for (const item of items) {
          const quantity = Number(item.quantity || 1);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("RIS quantities must be positive integers.");
          const [assetUpdate] = await connection.execute(
            "UPDATE inventory_assets SET assigned_to_user_id = ? WHERE id = ? AND status = 'Active'",
            [Number(department_id), Number(item.asset_id)]
          );
          if (assetUpdate.affectedRows !== 1) throw new Error("An asset is no longer active and cannot be issued.");
          await connection.execute(
            "INSERT INTO ris_items (ris_id, asset_id, quantity) VALUES (?, ?, ?)",
            [risId, Number(item.asset_id), quantity]
          );
          await connection.execute(
            `INSERT INTO asset_movements
             (asset_id, movement_type, to_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
             VALUES (?, 'ISSUED', ?, 'ris_records', ?, ?, ?, ?)`,
            [Number(item.asset_id), Number(department_id), risId, req.user.name, today.toISOString().slice(0, 10), purpose]
          );
        }
        return { id: risId, ris_no: `${prefix}${sequence}`, department_id: Number(department_id), status: "Issued" };
      });
      await db.logAudit("ris_records", result.id, "CREATE", null, JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: Number(department_id),
        title: "Requisition & Issuance Slip Created (RIS)",
        message: `RIS ${result.ris_no} has been issued for ${department.name}. Requisitioner: ${requisitioner_name}.`,
        type: "info"
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/asset-movements/:assetId", authenticate2, async (req, res) => {
    try {
      const assetId = Number(req.params.assetId);
      if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ error: "Invalid asset ID." });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        "SELECT * FROM asset_movements WHERE asset_id = ? ORDER BY id DESC",
        [assetId]
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/iirup", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const rows = await query2(
        `SELECT r.*, d.name AS department_name
         FROM iirup_records r JOIN departments d ON d.id = r.department_id
         ORDER BY r.id DESC`
      );
      res.json(req.user.role === "End User" ? rows.filter((row) => canAccessDepartment(req.user, row.department_id)) : rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/iirup", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const { department_id, reason, disposal_method, items } = req.body;
      if (!department_id || !reason || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Department, reason, and at least one asset are required." });
      }
      const department = await db.getById("departments", Number(department_id));
      if (!department) return res.status(400).json({ error: "Invalid department." });
      const allowedMethods = ["Public Auction", "Negotiated Sale", "Donation", "Destruction", "Transfer"];
      if (disposal_method && !allowedMethods.includes(disposal_method)) return res.status(400).json({ error: "Invalid disposal method." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const assetIds = items.map((item) => Number(item.asset_id));
      if (assetIds.some((id) => !Number.isInteger(id) || id <= 0) || new Set(assetIds).size !== assetIds.length) {
        return res.status(400).json({ error: "IIRUP contains invalid or duplicate assets." });
      }
      const assets = await mysqlQuery(
        `SELECT id, status, assigned_to_user_id FROM inventory_assets WHERE id IN (${assetIds.map(() => "?").join(", ")})`,
        assetIds
      );
      if (assets.length !== assetIds.length || assets.some((asset) => asset.status !== "Active" || Number(asset.assigned_to_user_id) !== Number(department_id))) {
        return res.status(409).json({ error: "IIRUP assets must be active assets assigned to the selected department." });
      }
      const iirupTransition = validateEntityTransition("IIRUP", {
        fromStatus: "Draft",
        toStatus: "Submitted",
        role: req.user.role
      });
      if (!iirupTransition.valid) {
        return res.status(403).json({ error: iirupTransition.errors.join(" "), errors: iirupTransition.errors, nextAction: iirupTransition.nextAction });
      }
      const today = /* @__PURE__ */ new Date();
      const prefix = `IIRUP-${today.getFullYear()}-`;
      const latest = await mysqlQuery("SELECT iirup_no FROM iirup_records WHERE iirup_no LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      const latestSequence = latest[0]?.iirup_no?.match(/(\d+)$/)?.[1];
      const sequence = String((latestSequence ? Number(latestSequence) : 0) + 1).padStart(4, "0");
      const result = await withTransaction(async (connection) => {
        const [recordResult] = await connection.execute(
          `INSERT INTO iirup_records
           (iirup_no, department_id, inspection_date, prepared_by, reason, disposal_method, status)
           VALUES (?, ?, ?, ?, ?, ?, 'Submitted')`,
          [`${prefix}${sequence}`, Number(department_id), today.toISOString().slice(0, 10), req.user.name, reason, disposal_method || null]
        );
        const iirupId = Number(recordResult.insertId);
        for (const item of items) {
          const conditionNotes = String(item.condition_notes || "").trim();
          if (!conditionNotes) throw new Error("Condition notes are required for every IIRUP asset.");
          const appraisedValue = item.appraised_value === void 0 || item.appraised_value === null ? null : Number(item.appraised_value);
          if (appraisedValue !== null && (!Number.isFinite(appraisedValue) || appraisedValue < 0)) throw new Error("Appraised value must be non-negative.");
          await connection.execute(
            "INSERT INTO iirup_items (iirup_id, asset_id, condition_notes, appraised_value) VALUES (?, ?, ?, ?)",
            [iirupId, Number(item.asset_id), conditionNotes, appraisedValue]
          );
          await connection.execute(
            `INSERT INTO asset_movements
              (asset_id, movement_type, from_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
              VALUES (?, 'DISPOSAL_REQUESTED', ?, 'iirup_records', ?, ?, ?, ?)`,
            [Number(item.asset_id), Number(department_id), iirupId, req.user.name, today.toISOString().slice(0, 10), reason]
          );
        }
        return { id: iirupId, iirup_no: `${prefix}${sequence}`, department_id: Number(department_id), status: "Submitted" };
      });
      await db.logAudit("iirup_records", result.id, "CREATE", null, JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: "Mayor",
        title: "New IIRUP Disposal Request Submitted",
        message: `IIRUP ${result.iirup_no} submitted by ${department.name} for disposal review. Reason: ${reason}.`,
        type: "info"
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/iirup/:id/status", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const iirupId = Number(req.params.id);
      const { status, coa_authority_no } = req.body;
      if (!Number.isInteger(iirupId) || iirupId <= 0) return res.status(400).json({ error: "Invalid IIRUP ID." });
      const { query: mysqlQuery } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const records = await mysqlQuery("SELECT * FROM iirup_records WHERE id = ?", [iirupId]);
      if (!records.length) return res.status(404).json({ error: "IIRUP record not found." });
      const record = records[0];
      const validation = validateEntityTransition("IIRUP", {
        fromStatus: record.status,
        toStatus: String(status || ""),
        role: req.user.role,
        fields: { coa_authority_no }
      });
      if (!validation.valid) {
        const statusCode = validation.errors.some((error) => error.startsWith("Forbidden:")) ? 403 : 409;
        return res.status(statusCode).json({ error: validation.errors.join(" "), errors: validation.errors, nextAction: validation.nextAction });
      }
      const result = await withTransaction(async (connection) => {
        const updates = status === "Approved" ? [status, coa_authority_no || null, iirupId] : [status, coa_authority_no || record.coa_authority_no || null, iirupId];
        const [updateResult] = await connection.execute(
          `UPDATE iirup_records SET status = ?, coa_authority_no = ?
           WHERE id = ? AND status = ?`,
          [...updates.slice(0, 2), iirupId, record.status]
        );
        if (updateResult.affectedRows !== 1) throw new Error("IIRUP status changed by another request.");
        const items = await connection.query("SELECT asset_id FROM iirup_items WHERE iirup_id = ?", [iirupId]);
        const movementType = status === "Disposed" ? "DISPOSED" : "DISPOSAL_REQUESTED";
        for (const item of items[0]) {
          if (status === "Approved") {
            await connection.execute("UPDATE inventory_assets SET status = 'Condemned' WHERE id = ? AND status = 'Active'", [item.asset_id]);
          }
          if (status !== "Cancelled") {
            await connection.execute(
              `INSERT INTO asset_movements
               (asset_id, movement_type, from_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
               VALUES (?, ?, ?, 'iirup_records', ?, ?, ?, ?)`,
              [item.asset_id, movementType, record.department_id, iirupId, req.user.name, (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), coa_authority_no || `IIRUP ${status}`]
            );
          }
        }
        return { id: iirupId, status, coa_authority_no: coa_authority_no || record.coa_authority_no || null };
      });
      await db.logAudit("iirup_records", iirupId, "STATUS_CHANGE", JSON.stringify(record), JSON.stringify(result), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: record.department_id,
        title: `IIRUP ${record.iirup_no} Status Update`,
        message: `Disposal request ${record.iirup_no} status changed to ${status}.${coa_authority_no ? ` COA Auth: ${coa_authority_no}` : ""}`,
        type: status === "Approved" || status === "Disposed" ? "success" : "info"
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/inventory/:id/transfer", authenticate2, requireRoles2(["GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const assetId = Number(req.params.id);
      const { to_department_id, receiver_name, receiver_designation, remarks } = req.body;
      if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ error: "Invalid asset ID." });
      if (!to_department_id || !receiver_name || !receiver_designation) {
        return res.status(400).json({ error: "Destination department, receiver name, and receiver designation are required." });
      }
      const department = await db.getById("departments", Number(to_department_id));
      if (!department) return res.status(400).json({ error: "Invalid destination department." });
      const asset = await db.getById("inventory_assets", assetId);
      if (!asset) return res.status(404).json({ error: "Inventory asset not found." });
      if (asset.status !== "Active") return res.status(409).json({ error: `Cannot transfer asset with status ${asset.status}.` });
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const result = await withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE inventory_assets
           SET assigned_to_user_id = ?, receiver_name = ?, receiver_designation = ?, status = 'Active'
           WHERE id = ?`,
          [Number(to_department_id), receiver_name, receiver_designation, assetId]
        );
        await connection.execute(
          `INSERT INTO asset_movements
           (asset_id, movement_type, from_department_id, to_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
           VALUES (?, 'TRANSFERRED', ?, ?, 'inventory_assets', ?, ?, ?, ?)`,
          [assetId, asset.assigned_to_user_id, Number(to_department_id), assetId, req.user.name, today, remarks || "Custody transfer to new department"]
        );
        return { success: true, asset_id: assetId, new_department_id: Number(to_department_id) };
      });
      await db.logAudit("inventory_assets", assetId, "UPDATE", JSON.stringify(asset), JSON.stringify({ ...asset, assigned_to_user_id: to_department_id, receiver_name, receiver_designation }), req.user.role, req.user.name);
      await notifyStakeholders({
        department_id: Number(to_department_id),
        title: "Asset Transferred to Department",
        message: `Asset ${asset.property_no} (${asset.description}) has been transferred to ${department.name}. Custodian: ${receiver_name}.`,
        type: "info"
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/inventory/:id/return", authenticate2, requireRoles2(["End User", "GSO Officer", "Mayor"]), async (req, res) => {
    try {
      const assetId = Number(req.params.id);
      const { remarks, condition_notes } = req.body;
      if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ error: "Invalid asset ID." });
      const asset = await db.getById("inventory_assets", assetId);
      if (!asset) return res.status(404).json({ error: "Inventory asset not found." });
      if (asset.status !== "Active") return res.status(409).json({ error: `Cannot return asset with status ${asset.status}.` });
      if (!canAccessDepartment(req.user, asset.assigned_to_user_id)) {
        return res.status(403).json({ error: "You may only return assets assigned to your department." });
      }
      const gsoDeptId = 4;
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const result = await withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE inventory_assets
           SET assigned_to_user_id = ?, receiver_name = 'GSO Central Storage', receiver_designation = 'Property Custodian', status = 'Active'
           WHERE id = ?`,
          [gsoDeptId, assetId]
        );
        await connection.execute(
          `INSERT INTO asset_movements
           (asset_id, movement_type, from_department_id, to_department_id, reference_table, reference_id, performed_by, movement_date, remarks)
           VALUES (?, 'RETURNED', ?, ?, 'inventory_assets', ?, ?, ?, ?)`,
          [assetId, asset.assigned_to_user_id, gsoDeptId, assetId, req.user.name, today, remarks || condition_notes || "Returned to GSO Central Storage"]
        );
        return { success: true, asset_id: assetId, returned_to_department: gsoDeptId };
      });
      await db.logAudit("inventory_assets", assetId, "UPDATE", JSON.stringify(asset), JSON.stringify({ ...asset, assigned_to_user_id: gsoDeptId, receiver_name: "GSO Central Storage" }), req.user.role, req.user.name);
      await notifyStakeholders({
        target_role: "GSO Officer",
        title: "Asset Returned to Storage",
        message: `Asset ${asset.property_no} has been returned to GSO storage by ${req.user.name}.`,
        type: "info"
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/audit-logs", authenticate2, requireRoles2(["Mayor", "GSO Officer", "BAC Secretariat"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const tableName = req.query.table_name;
      const action = req.query.action;
      const search = req.query.search;
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const conditions = [];
      const params = [];
      if (tableName) {
        conditions.push("table_name = ?");
        params.push(tableName);
      }
      if (action) {
        conditions.push("action = ?");
        params.push(action);
      }
      if (search) {
        conditions.push("(user_name LIKE ? OR new_value LIKE ? OR old_value LIKE ?)");
        const searchWildcard = `%${search}%`;
        params.push(searchWildcard, searchWildcard, searchWildcard);
      }
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      const rows = await query2(sql, params);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/notifications", authenticate2, async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const userId = req.user.id;
      const deptId = req.user.department_id;
      const role = req.user.role;
      const whereClause = `
        (user_id = ?) OR
        (user_id IS NULL AND department_id = ?) OR
        (user_id IS NULL AND department_id IS NULL AND (target_role = ? OR target_role IS NULL))
      `;
      const params = [userId, deptId, role];
      const countRows = await query2(
        `SELECT COUNT(*) AS count FROM notifications WHERE is_read = FALSE AND (${whereClause})`,
        params
      );
      const unreadCount = Number(countRows[0]?.count || 0);
      const rows = await query2(
        `SELECT * FROM notifications WHERE (${whereClause}) ORDER BY id DESC LIMIT 50`,
        params
      );
      res.json({ count: unreadCount, items: rows, notifications: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/notifications", authenticate2, async (req, res) => {
    try {
      const { user_name, user_id, department_id, target_role, title, message, type } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required." });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      let targetUserId = user_id ? Number(user_id) : null;
      if (!targetUserId && user_name) {
        const userMatches = await query2("SELECT id FROM users WHERE name = ? OR username = ? LIMIT 1", [user_name, user_name]);
        if (userMatches.length > 0) {
          targetUserId = userMatches[0].id;
        }
      }
      await query2(
        `INSERT INTO notifications (user_id, user_name, department_id, target_role, title, message, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          targetUserId,
          user_name || null,
          department_id ? Number(department_id) : null,
          target_role || null,
          title || "Procurement Notification",
          message,
          type || "info"
        ]
      );
      res.status(201).json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.put("/api/notifications/:id/read", authenticate2, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid notification ID." });
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      await query2("UPDATE notifications SET is_read = TRUE WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/notifications/read-all", authenticate2, async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const userId = req.user.id;
      const deptId = req.user.department_id;
      const role = req.user.role;
      const whereClause = `
        (user_id = ?) OR
        (user_id IS NULL AND department_id = ?) OR
        (user_id IS NULL AND department_id IS NULL AND (target_role = ? OR target_role IS NULL))
      `;
      await query2(`UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE AND (${whereClause})`, [userId, deptId, role]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.post("/api/chat", authenticate2, async (req, res) => {
    try {
      res.json({ reply: "This is a simulated AI response indicating the backend successfully received your prompt." });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.get("/api/ledger/export", authenticate2, requireRoles2(["Mayor", "GSO Officer", "Finance Officer"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const [
        ppmpItems,
        purchaseRequests,
        prItems,
        rfqRecords,
        suppliers,
        purchaseOrders,
        poItems,
        iarRecords,
        iarItems,
        inventory,
        auditLogs,
        departments,
        philgeps,
        systemSettings,
        users,
        bacResolutions
      ] = await Promise.all([
        db.getTable("ppmp_items"),
        db.getTable("purchase_requests"),
        query2("SELECT * FROM pr_items ORDER BY pr_id, item_no"),
        db.getTable("rfq_records"),
        db.getTable("suppliers"),
        db.getTable("purchase_orders"),
        query2("SELECT * FROM po_items ORDER BY po_id"),
        db.getTable("iar_records"),
        query2("SELECT * FROM iar_items ORDER BY iar_id"),
        db.getTable("inventory_assets"),
        query2("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500"),
        db.getTable("departments"),
        db.getTable("philgeps_postings"),
        db.getTable("system_settings"),
        query2("SELECT id, username, name, role, department_id, created_at FROM users"),
        db.getTable("bac_resolutions")
      ]);
      await db.logAudit("audit_logs", 0, "LEDGER_EXPORT", null, `Full system ledger exported by ${req.user.name}`, req.user.role, req.user.name);
      res.json({
        exported_at: (/* @__PURE__ */ new Date()).toISOString(),
        exported_by: req.user.name,
        exported_by_role: req.user.role,
        ppmpItems,
        purchaseRequests,
        prItems,
        rfqRecords,
        suppliers,
        purchaseOrders,
        poItems,
        iarRecords,
        iarItems,
        inventory,
        auditLogs,
        departments,
        philgeps,
        systemSettings: systemSettings[0] || {},
        users,
        bacResolutions
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/ppmp/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const record = await db.getById("ppmp_items", id);
      if (!record) return res.status(404).json({ error: "PPMP item not found" });
      const references = await query2("SELECT COUNT(*) AS count FROM pr_items WHERE ppmp_item_id = ?", [id]);
      if (Number(references[0]?.count || 0) > 0) {
        return res.status(409).json({ error: "This APP / PPMP item is used by a Purchase Request and cannot be deleted." });
      }
      await db.logAudit("ppmp_items", id, "DELETE", JSON.stringify(record), null, req.user.role, req.user.name);
      await db.delete("ppmp_items", id);
      res.json({ success: true, deleted_id: id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/pr/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const record = await db.getById("purchase_requests", id);
      if (!record) return res.status(404).json({ error: "Purchase Request not found" });
      if (["Approved", "Disapproved"].includes(record.status)) {
        return res.status(409).json({ error: "Finalized Purchase Requests cannot be deleted. Use cancellation or archival instead." });
      }
      const items = await query2("SELECT * FROM pr_items WHERE pr_id = ?", [id]);
      await db.logAudit("purchase_requests", id, "DELETE", JSON.stringify({ ...record, items }), null, req.user.role, req.user.name);
      await query2("DELETE FROM pr_items WHERE pr_id = ?", [id]);
      await db.delete("purchase_requests", id);
      res.json({ success: true, deleted_id: id, cascade_deleted_items: items.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/rfq/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const record = await db.getById("rfq_records", id);
      if (!record) return res.status(404).json({ error: "RFQ not found" });
      if (["Published", "Closed"].includes(record.status)) {
        return res.status(409).json({ error: "Published or closed RFQs cannot be deleted." });
      }
      await db.logAudit("rfq_records", id, "DELETE", JSON.stringify(record), null, req.user.role, req.user.name);
      await query2("DELETE FROM rfq_items WHERE rfq_id = ?", [id]);
      await query2("DELETE FROM abstract_bids WHERE rfq_id = ?", [id]);
      await db.delete("rfq_records", id);
      res.json({ success: true, deleted_id: id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/po/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const record = await db.getById("purchase_orders", id);
      if (!record) return res.status(404).json({ error: "Purchase Order not found" });
      if (["Issued", "Signed", "Partially_Delivered", "Fully_Delivered"].includes(record.status)) {
        return res.status(409).json({ error: "Issued, signed, or delivered Purchase Orders cannot be deleted." });
      }
      const items = await query2("SELECT * FROM po_items WHERE po_id = ?", [id]);
      await db.logAudit("purchase_orders", id, "DELETE", JSON.stringify({ ...record, items }), null, req.user.role, req.user.name);
      await query2("DELETE FROM po_items WHERE po_id = ?", [id]);
      await db.delete("purchase_orders", id);
      res.json({ success: true, deleted_id: id, cascade_deleted_items: items.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/iar/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const record = await db.getById("iar_records", id);
      if (!record) return res.status(404).json({ error: "IAR not found" });
      if (["Submitted", "Partial", "Completed"].includes(record.status)) {
        return res.status(409).json({ error: "Submitted or completed IAR records cannot be deleted." });
      }
      const items = await query2("SELECT * FROM iar_items WHERE iar_id = ?", [id]);
      await db.logAudit("iar_records", id, "DELETE", JSON.stringify({ ...record, items }), null, req.user.role, req.user.name);
      await query2("DELETE FROM iar_items WHERE iar_id = ?", [id]);
      await db.delete("iar_records", id);
      res.json({ success: true, deleted_id: id, cascade_deleted_items: items.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/suppliers/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await db.getById("suppliers", id);
      if (!record) return res.status(404).json({ error: "Supplier not found" });
      await db.logAudit("suppliers", id, "DELETE", JSON.stringify(record), null, req.user.role, req.user.name);
      await db.delete("suppliers", id);
      res.json({ success: true, deleted_id: id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/inventory/:id", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await db.getById("inventory_assets", id);
      if (!record) return res.status(404).json({ error: "Asset not found" });
      await db.logAudit("inventory_assets", id, "DELETE", JSON.stringify(record), null, req.user.role, req.user.name);
      await db.delete("inventory_assets", id);
      res.json({ success: true, deleted_id: id });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app2.delete("/api/audit-logs/clear", authenticate2, requireRoles2(["Mayor"]), async (req, res) => {
    try {
      const { query: query2 } = await Promise.resolve().then(() => (init_mysql(), mysql_exports));
      const cutoffDate = /* @__PURE__ */ new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const cutoffStr = cutoffDate.toISOString();
      const result = await query2("DELETE FROM audit_logs WHERE timestamp < ?", [cutoffStr]);
      await db.logAudit("audit_logs", 0, "BULK_CLEAR", null, `Cleared ${result.affectedRows || 0} audit log entries older than 90 days`, req.user.role, req.user.name);
      res.json({ success: true, cleared_count: result.affectedRows || 0 });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

// server_mysql.ts
(0, import_dotenv3.config)({ path: [".env.local", ".env"] });
var app = (0, import_express.default)();
var PORT2 = runtimeConfig.port;
var HOST2 = runtimeConfig.host;
var notificationClients = /* @__PURE__ */ new Set();
globalThis.notificationClients = notificationClients;
var configValidation = validateRuntimeConfig();
if (!configValidation.valid) throw new Error(`Invalid runtime configuration: ${configValidation.errors.join(" ")}`);
app.use(import_express.default.json({ limit: "5mb" }));
app.get("/health/live", (_req, res) => res.json({ status: "ok", service: "gso-procurement" }));
app.get("/health/ready", async (_req, res) => {
  try {
    const database = await getHealthSnapshot();
    res.json({ status: "ready", ...database });
  } catch (error) {
    res.status(503).json({ status: "not_ready", error: error?.message || "Database unavailable." });
  }
});
var authenticateNotificationStream = (req, res, next) => {
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  if (!queryToken) return authenticate(req, res, next);
  const session = activeSessions.get(queryToken);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) activeSessions.delete(queryToken);
    return res.status(401).json({ error: "Unauthorized: Session expired or invalid" });
  }
  req.user = session;
  next();
};
app.get("/api/notifications/stream", authenticateNotificationStream, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const client = {
    id: import_crypto4.default.randomUUID(),
    userId: req.user?.id || null,
    role: req.user?.role || null,
    departmentId: req.user?.department_id || null,
    res
  };
  notificationClients.add(client);
  res.write(`event: connected
data: ${JSON.stringify({ connected: true })}

`);
  req.on("close", () => {
    notificationClients.delete(client);
  });
});
var SESSIONS_FILE = import_path.default.join(process.cwd(), "sessions.json");
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var activeSessions = /* @__PURE__ */ new Map();
var passwordResetOtps = /* @__PURE__ */ new Map();
var loginAttempts = /* @__PURE__ */ new Map();
var LOGIN_WINDOW_MS = 15 * 60 * 1e3;
var LOGIN_MAX_ATTEMPTS = 10;
var createSession = async (user) => {
  const sessionData = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department_id: user.department_id,
    supplier_id: user.supplier_id,
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  const token = import_crypto4.default.randomBytes(32).toString("hex");
  activeSessions.set(token, sessionData);
  await db.logAudit("users", user.id, "STATUS_CHANGE", null, "User login successful", user.role, user.name);
  return { token, user: sessionData };
};
var getMailer = () => {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !pass) return null;
  return import_nodemailer2.default.createTransport({ service: "gmail", auth: { user, pass } });
};
var hashOtp = (email, otp) => import_crypto4.default.createHash("sha256").update(`${email.toLowerCase()}:${otp}:${process.env.OTP_SECRET || "gso-password-reset"}`).digest("hex");
var passwordResetEmail = (otp) => `
  <div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dce4ef;border-radius:18px;overflow:hidden">
      <div style="background:#1455c0;padding:24px 28px;color:#ffffff"><div style="font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">GSO Procurement Portal</div><h1 style="font-size:24px;margin:12px 0 0">Reset your password</h1></div>
      <div style="padding:28px"><p style="font-size:15px;line-height:1.6;margin-top:0">Use the verification code below to create a new password. This code expires in 10 minutes.</p><div style="background:#eef4ff;border:1px solid #cfe0ff;border-radius:12px;padding:18px;text-align:center;margin:24px 0"><div style="font-size:12px;color:#50617a;text-transform:uppercase;letter-spacing:2px">One-time password</div><div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#1455c0;margin-top:8px">${otp}</div></div><p style="font-size:12px;color:#64748b;line-height:1.5;margin-bottom:0">If you did not request this reset, you can safely ignore this email. Never share this code with anyone.</p></div>
    </div>
  </div>`;
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const token = authHeader.split(" ")[1];
  const session = activeSessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) activeSessions.delete(token);
    return res.status(401).json({ error: "Unauthorized: Session expired or invalid" });
  }
  req.user = session;
  next();
}
function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Action requires one of the following roles: ${roles.join(", ")}` });
    }
    next();
  };
}
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  const attemptKey = `${req.ip || "unknown"}:${String(username || "").trim().toLowerCase()}`;
  const now = Date.now();
  const attempts = loginAttempts.get(attemptKey);
  if (attempts && now - attempts.windowStartedAt < LOGIN_WINDOW_MS && attempts.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many login attempts. Try again later." });
  }
  if (attempts && now - attempts.windowStartedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(attemptKey);
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  const users = await db.getTable("users");
  const user = users.find((u) => u.username === username);
  if (!user) {
    const current = loginAttempts.get(attemptKey) || { count: 0, windowStartedAt: now };
    loginAttempts.set(attemptKey, { count: current.count + 1, windowStartedAt: current.windowStartedAt });
    return res.status(400).json({ error: "Invalid username or password" });
  }
  if (!verifyPassword(password, user.password_hash, user.salt)) {
    const current = loginAttempts.get(attemptKey) || { count: 0, windowStartedAt: now };
    loginAttempts.set(attemptKey, { count: current.count + 1, windowStartedAt: current.windowStartedAt });
    return res.status(400).json({ error: "Invalid username or password" });
  }
  loginAttempts.delete(attemptKey);
  if (!user.password_hash.startsWith("scrypt$")) {
    const migratedPassword = hashPasswordScrypt(password);
    await db.update("users", user.id, {
      password_hash: migratedPassword.hash,
      salt: migratedPassword.salt
    });
  }
  res.json(await createSession(user));
});
app.post("/api/auth/google", async (req, res) => {
  const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!credential || !clientId) return res.status(400).json({ error: "Google sign-in is not configured." });
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const profile = await response.json();
    if (!response.ok || profile.aud !== clientId || profile.email_verified !== "true" || !profile.email) {
      return res.status(401).json({ error: "Google account verification failed." });
    }
    const user = (await db.getTable("users")).find(
      (candidate) => String(candidate.email || "").toLowerCase() === profile.email.toLowerCase()
    );
    if (!user) return res.status(403).json({ error: "This Google account is not linked to an authorized system user." });
    res.json(await createSession(user));
  } catch {
    res.status(502).json({ error: "Unable to verify the Google account right now." });
  }
});
app.post("/api/auth/request-password-reset", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const genericResponse = { message: "If an account matches that email, a verification code has been sent." };
  if (!email) return res.json(genericResponse);
  const mailer = getMailer();
  if (!mailer) return res.status(503).json({ error: "Password reset email is not configured on the server." });
  const user = (await db.getTable("users")).find((candidate) => String(candidate.email || "").toLowerCase() === email);
  if (!user) return res.json(genericResponse);
  const otp = String(import_crypto4.default.randomInt(0, 1e6)).padStart(6, "0");
  passwordResetOtps.set(email, { hash: hashOtp(email, otp), expiresAt: Date.now() + 10 * 60 * 1e3, attempts: 0 });
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER,
      to: email,
      subject: "GSO Procurement Portal password reset code",
      html: passwordResetEmail(otp),
      text: `Your GSO Procurement Portal password reset code is ${otp}. It expires in 10 minutes.`
    });
    res.json(genericResponse);
  } catch {
    passwordResetOtps.delete(email);
    res.status(502).json({ error: "The verification email could not be sent." });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  const challenge = passwordResetOtps.get(email);
  if (!challenge || challenge.expiresAt <= Date.now() || challenge.attempts >= 5 || !/^\d{6}$/.test(otp) || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Invalid or expired code, or password does not meet the minimum requirements." });
  }
  challenge.attempts += 1;
  if (hashOtp(email, otp) !== challenge.hash) return res.status(400).json({ error: "Invalid or expired verification code." });
  const user = (await db.getTable("users")).find((candidate) => String(candidate.email || "").toLowerCase() === email);
  if (!user) return res.status(400).json({ error: "Invalid or expired verification code." });
  const passwordBundle = hashPasswordScrypt(newPassword);
  await db.update("users", user.id, { password_hash: passwordBundle.hash, salt: passwordBundle.salt });
  passwordResetOtps.delete(email);
  await db.logAudit("users", user.id, "UPDATE", null, "Password reset completed by email OTP", user.role, user.name);
  res.json({ success: true });
});
app.post("/api/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const session = activeSessions.get(token);
    if (session) {
      await db.logAudit("users", session.id, "STATUS_CHANGE", null, "User logout successful", session.role, session.name);
      activeSessions.delete(token);
    }
  }
  res.json({ success: true });
});
app.get("/api/auth/me", authenticate, (req, res) => {
  res.json(req.user);
});
app.post("/api/chat", authenticate, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: "Gemini API key is not configured on the server." });
  }
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const userMessage = messages.filter((message) => message?.role === "user" && typeof message.content === "string").at(-1)?.content?.trim();
  if (!userMessage) {
    return res.status(400).json({ error: "A user message is required." });
  }
  try {
    const ai = new import_genai.GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: messages.filter(
        (message) => (message?.role === "user" || message?.role === "assistant") && typeof message.content === "string"
      ).map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      })),
      config: {
        systemInstruction: "You are the GSO Procurement Helpdesk Assistant for a Philippine local government unit. Respond like a thoughtful, approachable human advisor: acknowledge the user's question, use warm natural language, explain things in plain terms, and vary your wording instead of repeating canned introductions. Be practical, accurate, and concise, with enough context to make the answer useful. Ask one focused follow-up question when important details are missing. State when a matter requires confirmation against current law, regulations, or the LGU's official policies. Do not invent system records or approvals. Do not use asterisks for emphasis or bullet points."
      }
    });
    const reply = response.text?.trim();
    if (!reply) {
      return res.status(502).json({ error: "Gemini returned an empty response." });
    }
    return res.json({ reply });
  } catch (error) {
    console.error("Gemini chat request failed:", error);
    return res.status(502).json({ error: "Unable to get a response from Gemini." });
  }
});
app.get("/api/users", authenticate, requireRoles(["Mayor", "GSO Officer", "Finance Officer"]), async (req, res) => {
  try {
    const users = await db.getTable("users");
    res.json(users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      supplier_id: user.supplier_id,
      created_at: user.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to load users" });
  }
});
app.post("/api/users", authenticate, requireRoles(["Mayor", "GSO Officer", "Finance Officer"]), async (req, res) => {
  try {
    const { username, password, name, email, role, department_id, supplier_id } = req.body;
    const normalizedUsername = String(username || "").trim();
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedUsername || !password || !normalizedName || !normalizedEmail || !role) {
      return res.status(400).json({ error: "Username, password, full name, email, and role are required." });
    }
    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters long." });
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
      return res.status(400).json({ error: "Username contains invalid characters. Use letters, numbers, dot, underscore, or hyphen only." });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "A valid email address is required for Google sign-in and password reset." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }
    if (!["End User", "GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "Supplier"].includes(role)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }
    if (role === "Supplier" && !supplier_id) {
      return res.status(400).json({ error: "Supplier accounts must be linked to a supplier registry record." });
    }
    const existingUsers = await db.getTable("users");
    const duplicate = existingUsers.some((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase());
    if (duplicate) {
      return res.status(409).json({ error: "A user with that username already exists." });
    }
    if (existingUsers.some((user) => String(user.email || "").toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: "A user with that email already exists." });
    }
    const passwordBundle = hashPasswordScrypt(password);
    const created = await db.insert("users", {
      username: normalizedUsername,
      password_hash: passwordBundle.hash,
      salt: passwordBundle.salt,
      name: normalizedName,
      email: normalizedEmail,
      role,
      department_id: department_id !== void 0 && department_id !== null && department_id !== "" ? Number(department_id) : null,
      supplier_id: role === "Supplier" ? Number(supplier_id) : null,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    await db.logAudit("users", created.id, "CREATE", null, JSON.stringify({
      id: created.id,
      username: created.username,
      name: created.name,
      email: created.email,
      role: created.role,
      department_id: created.department_id
    }), req.user.role, req.user.name);
    res.status(201).json({
      id: created.id,
      username: created.username,
      name: created.name,
      email: created.email,
      role: created.role,
      department_id: created.department_id,
      supplier_id: created.supplier_id,
      created_at: created.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to create user" });
  }
});
app.put("/api/users/:id", authenticate, requireRoles(["Mayor", "GSO Officer", "Finance Officer"]), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const existing = await db.getById("users", userId);
    if (!existing) return res.status(404).json({ error: "User not found." });
    const { username, name, email, role, department_id, supplier_id, password } = req.body;
    const normalizedUsername = String(username || "").trim();
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedUsername || !normalizedName || !normalizedEmail || !role) {
      return res.status(400).json({ error: "Username, full name, email, and role are required." });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "A valid email address is required for Google sign-in and password reset." });
    }
    if (!["End User", "GSO Officer", "BAC Secretariat", "Budget Officer", "Mayor", "Finance Officer", "Supplier"].includes(role)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }
    if (role === "Supplier" && !supplier_id) {
      return res.status(400).json({ error: "Supplier accounts must be linked to a supplier registry record." });
    }
    const duplicate = (await db.getTable("users")).some(
      (user) => user.id !== userId && user.username.toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({ error: "Another user already uses that username." });
    }
    if ((await db.getTable("users")).some((user) => user.id !== userId && String(user.email || "").toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: "Another user already uses that email." });
    }
    const updates = {
      username: normalizedUsername,
      name: normalizedName,
      email: normalizedEmail,
      role,
      department_id: department_id !== void 0 && department_id !== null && department_id !== "" ? Number(department_id) : null,
      supplier_id: role === "Supplier" ? Number(supplier_id) : null
    };
    if (password && String(password).trim()) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      const passwordBundle = hashPasswordScrypt(String(password));
      updates.password_hash = passwordBundle.hash;
      updates.salt = passwordBundle.salt;
    }
    const updated = await db.update("users", userId, updates);
    await db.logAudit("users", userId, "UPDATE", JSON.stringify(existing), JSON.stringify(updated), req.user.role, req.user.name);
    res.json({
      id: updated?.id,
      username: updated?.username,
      name: updated?.name,
      email: updated?.email,
      role: updated?.role,
      department_id: updated?.department_id,
      supplier_id: updated?.supplier_id,
      created_at: updated?.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});
app.delete("/api/users/:id", authenticate, requireRoles(["Mayor", "GSO Officer", "Finance Officer"]), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid user ID." });
    if (req.user.id === userId) return res.status(400).json({ error: "You cannot delete your own account while logged in." });
    const existing = await db.getById("users", userId);
    if (!existing) return res.status(404).json({ error: "User not found." });
    await db.delete("users", userId);
    await db.logAudit("users", userId, "DELETE", JSON.stringify(existing), null, req.user.role, req.user.name);
    res.json({ success: true, deletedUserId: userId });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
});
app.get("/api/philgeps/postings", authenticate, async (req, res) => {
  const rows = await db.getTable("philgeps_postings");
  res.json(rows);
});
app.post("/api/philgeps/post", authenticate, requireRoles(["BAC Secretariat", "GSO Officer", "Mayor"]), async (req, res) => {
  const { associated_type, associated_id, title, closing_date } = req.body;
  if (!associated_type || !associated_id || !title || !closing_date) {
    return res.status(400).json({ error: "Missing required PhilGEPS fields" });
  }
  const randomSuffix = Math.floor(1e3 + Math.random() * 9e3);
  const refNo = `1048${randomSuffix}29`;
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<PhilGEPSTransmission xmlns="http://www.philgeps.gov.ph/G2B">
  <Header>
    <SenderID>LGU_SAN_JOSE</SenderID>
    <AgencyName>Municipality of San Jose</AgencyName>
    <FormType>${associated_type}</FormType>
    <ReferenceNumber>${refNo}</ReferenceNumber>
    <TransmissionTimestamp>${(/* @__PURE__ */ new Date()).toISOString()}</TransmissionTimestamp>
  </Header>
  <ProcurementDetail>
    <ProjectID>${associated_id}</ProjectID>
    <ProjectTitle><![CDATA[${title}]]></ProjectTitle>
    <ClosingDate>${closing_date}</ClosingDate>
    <ProcuringEntity>Arthur N. Ramos (GSO Officer)</ProcuringEntity>
    <LegalCompliance>COA / RA 9184 Standardized Submission</LegalCompliance>
  </ProcurementDetail>
</PhilGEPSTransmission>`;
  const newPosting = await db.insert("philgeps_postings", {
    ref_no: refNo,
    title,
    associated_type,
    associated_id: parseInt(associated_id),
    publish_date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    closing_date,
    status: "Posted",
    xml_payload: xmlPayload,
    api_response: `HTTP/1.1 200 OK
Content-Type: application/xml

<PhilGEPSResponse>
  <Status>SUCCESS</Status>
  <RefNo>${refNo}</RefNo>
  <Message>Opportunity successfully published to Public Bulletin.</Message>
</PhilGEPSResponse>`,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  await db.logAudit("philgeps_postings", newPosting.id, "CREATE", null, `Published ${associated_type} (Ref: ${refNo}) to PhilGEPS Portal`, req.user.role, req.user.name);
  res.status(201).json(newPosting);
});
app.post("/api/philgeps/award", authenticate, requireRoles(["BAC Secretariat", "Mayor"]), async (req, res) => {
  const { posting_id, winning_supplier_name, award_amount, noa_id } = req.body;
  const posting = await db.getById("philgeps_postings", parseInt(posting_id));
  if (!posting) return res.status(404).json({ error: "PhilGEPS posting not found" });
  const oldVal = JSON.stringify(posting);
  const updated = await db.update("philgeps_postings", posting.id, {
    status: "Awarded",
    api_response: `HTTP/1.1 200 OK

Notice of Award for NOA ID: ${noa_id} submitted to PhilGEPS successfully. Awardee: ${winning_supplier_name}. Contract Sum: Php ${Number(award_amount).toLocaleString()}`
  });
  await db.logAudit("philgeps_postings", posting.id, "STATUS_CHANGE", oldVal, JSON.stringify(updated), req.user.role, req.user.name);
  res.json(updated);
});
app.get("/api/settings", async (req, res) => {
  const settingsList = await db.getTable("system_settings");
  if (settingsList.length === 0) {
    const defaultSettings = {
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
    };
    await db.insert("system_settings", defaultSettings);
    return res.json(defaultSettings);
  }
  res.json(settingsList[0]);
});
app.put("/api/settings", authenticate, requireRoles(["Mayor", "GSO Officer", "Finance Officer"]), async (req, res) => {
  const settingsList = await db.getTable("system_settings");
  const existingId = settingsList.length > 0 ? settingsList[0].id : 1;
  const updates = { ...req.body };
  if (updates.logo_data !== void 0 && updates.logo_data !== null && updates.logo_data !== "") {
    if (typeof updates.logo_data !== "string" || !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(updates.logo_data) || updates.logo_data.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: "Logo must be a PNG, JPEG, GIF, or WebP image smaller than 3 MB." });
    }
  } else {
    updates.logo_data = null;
  }
  let updated;
  if (settingsList.length === 0) {
    updated = await db.insert("system_settings", updates);
  } else {
    updated = await db.update("system_settings", existingId, updates);
  }
  await db.logAudit("system_settings", existingId, "UPDATE", JSON.stringify(settingsList[0] || {}), JSON.stringify(updated || {}), req.user.role, req.user.name);
  res.json(updated);
});
attachDepartmentsRoutes(app);
attachAllRoutes(app, authenticate, requireRoles);
var startApp = async () => {
  try {
    await testConnection();
    console.log("MySQL connection established.");
  } catch (error) {
    console.error(`MySQL connection failed for database "${process.env.MYSQL_DATABASE || "procurement_management_ocr"}" at ${process.env.MYSQL_HOST || "localhost"}:${process.env.MYSQL_PORT || "3306"}.`);
    console.error(error?.message || error);
    process.exitCode = 1;
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => res.sendFile(import_path.default.join(distPath, "index.html")));
  }
  const server = app.listen(PORT2, HOST2, () => {
    console.log(`GSO Procurement MS backend (MySQL) listening on port ${PORT2}`);
    console.log(`Local:   http://localhost:${PORT2}`);
    for (const networkInterface of Object.values((0, import_os.networkInterfaces)()).flat()) {
      if (networkInterface && networkInterface.family === "IPv4" && !networkInterface.internal) {
        console.log(`Network: http://${networkInterface.address}:${PORT2}`);
      }
    }
  });
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT2} is already in use. Set PORT in .env.local or stop the process using it.`);
    } else {
      console.error("Failed to bind the application server:", error.message);
    }
    process.exitCode = 1;
  });
};
startApp().catch((err) => console.error("Failed to start server:", err));
//# sourceMappingURL=server.cjs.map
