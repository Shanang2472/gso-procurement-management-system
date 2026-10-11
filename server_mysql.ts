import express from 'express';
import path from 'path';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { networkInterfaces } from 'os';
import { config as loadEnv } from 'dotenv';
import { db, hashPasswordScrypt, verifyPassword } from './src/db_mysql.js';
import { testConnection } from './src/mysql.js';
import { getHealthSnapshot } from './src/mysql.js';
import { runtimeConfig, validateRuntimeConfig } from './src/config.js';
import { GoogleGenAI } from '@google/genai';

loadEnv({ path: ['.env.local', '.env'] });

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const app = express();
const PORT = runtimeConfig.port;
const HOST = runtimeConfig.host;
const notificationClients = new Set<any>();
(globalThis as any).notificationClients = notificationClients;

const configValidation = validateRuntimeConfig();
if (!configValidation.valid) throw new Error(`Invalid runtime configuration: ${configValidation.errors.join(' ')}`);

app.use(express.json({ limit: '5mb' }));

app.get('/health/live', (_req, res) => res.json({ status: 'ok', service: 'gso-procurement' }));
app.get('/health/ready', async (_req, res) => {
  try {
    const database = await getHealthSnapshot();
    res.json({ status: 'ready', ...database });
  } catch (error: any) {
    res.status(503).json({ status: 'not_ready', error: error?.message || 'Database unavailable.' });
  }
});

const authenticateNotificationStream = (req: any, res: any, next: any) => {
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  if (!queryToken) return authenticate(req, res, next);

  const session = activeSessions.get(queryToken);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) activeSessions.delete(queryToken);
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  req.user = session;
  next();
};

app.get('/api/notifications/stream', authenticateNotificationStream, (req: any, res: any) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const client = {
    id: crypto.randomUUID(),
    userId: req.user?.id || null,
    role: req.user?.role || null,
    departmentId: req.user?.department_id || null,
    res
  };

  notificationClients.add(client);
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true })}\n\n`);

  req.on('close', () => {
    notificationClients.delete(client);
  });
});

// --- AUTHENTICATION & RBAC ENGINE ---

const SESSIONS_FILE = path.join(process.cwd(), 'sessions.json');

type Role = 'End User' | 'GSO Officer' | 'BAC Secretariat' | 'Budget Officer' | 'Mayor' | 'Finance Officer' | 'Supplier';
const VALID_USER_ROLES: Role[] = ['End User', 'GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'Supplier'];

type Session = {
  id: number;
  username: string;
  name: string;
  role: Role;
  department_id: number | null;
  supplier_id?: number | null;
  expiresAt: number;
};

type OtpChallenge = {
  hash: string;
  expiresAt: number;
  attempts: number;
};

const sanitizeUserRecord = (user: any) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  department_id: user.department_id,
  supplier_id: user.supplier_id,
  created_at: user.created_at
});

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const activeSessions = new Map<string, Session>();
const passwordResetOtps = new Map<string, OtpChallenge>();
const loginAttempts = new Map<string, { count: number; windowStartedAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const createSession = async (user: any) => {
  const sessionData: Session = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department_id: user.department_id,
    supplier_id: user.supplier_id,
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, sessionData);
  await db.logAudit('users', user.id, 'STATUS_CHANGE', null, 'User login successful', user.role, user.name);
  return { token, user: sessionData };
};

const getMailer = () => {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
};

const hashOtp = (email: string, otp: string) => crypto
  .createHash('sha256')
  .update(`${email.toLowerCase()}:${otp}:${process.env.OTP_SECRET || 'gso-password-reset'}`)
  .digest('hex');

const passwordResetEmail = (otp: string) => `
  <div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dce4ef;border-radius:18px;overflow:hidden">
      <div style="background:#1455c0;padding:24px 28px;color:#ffffff"><div style="font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">GSO Procurement Portal</div><h1 style="font-size:24px;margin:12px 0 0">Reset your password</h1></div>
      <div style="padding:28px"><p style="font-size:15px;line-height:1.6;margin-top:0">Use the verification code below to create a new password. This code expires in 10 minutes.</p><div style="background:#eef4ff;border:1px solid #cfe0ff;border-radius:12px;padding:18px;text-align:center;margin:24px 0"><div style="font-size:12px;color:#50617a;text-transform:uppercase;letter-spacing:2px">One-time password</div><div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#1455c0;margin-top:8px">${otp}</div></div><p style="font-size:12px;color:#64748b;line-height:1.5;margin-bottom:0">If you did not request this reset, you can safely ignore this email. Never share this code with anyone.</p></div>
    </div>
  </div>`;

export function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  const session = activeSessions.get(token);

  if (!session || session.expiresAt <= Date.now()) {
    if (session) activeSessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }
  req.user = session;
  next();
}

export function requireRoles(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: Action requires one of the following roles: ${roles.join(', ')}` });
    }
    next();
  };
}

// --- AUTHENTICATION ENDPOINTS ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const attemptKey = `${req.ip || 'unknown'}:${String(username || '').trim().toLowerCase()}`;
  const now = Date.now();
  const attempts = loginAttempts.get(attemptKey);
  if (attempts && now - attempts.windowStartedAt < LOGIN_WINDOW_MS && attempts.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  if (attempts && now - attempts.windowStartedAt >= LOGIN_WINDOW_MS) loginAttempts.delete(attemptKey);
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const users = await db.getTable<any>('users');
  const user = users.find((u: any) => u.username === username);
  if (!user) {
    const current = loginAttempts.get(attemptKey) || { count: 0, windowStartedAt: now };
    loginAttempts.set(attemptKey, { count: current.count + 1, windowStartedAt: current.windowStartedAt });
    return res.status(400).json({ error: 'Invalid username or password' });
  }

  if (!verifyPassword(password, user.password_hash, user.salt)) {
    const current = loginAttempts.get(attemptKey) || { count: 0, windowStartedAt: now };
    loginAttempts.set(attemptKey, { count: current.count + 1, windowStartedAt: current.windowStartedAt });
    return res.status(400).json({ error: 'Invalid username or password' });
  }

  loginAttempts.delete(attemptKey);

  if (!user.password_hash.startsWith('scrypt$')) {
    const migratedPassword = hashPasswordScrypt(password);
    await db.update('users', user.id, {
      password_hash: migratedPassword.hash,
      salt: migratedPassword.salt
    });
  }

  res.json(await createSession(user));
});

app.post('/api/auth/google', async (req, res) => {
  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!credential || !clientId) return res.status(400).json({ error: 'Google sign-in is not configured.' });

  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const profile = await response.json() as { aud?: string; email?: string; email_verified?: string; name?: string };
    if (!response.ok || profile.aud !== clientId || profile.email_verified !== 'true' || !profile.email) {
      return res.status(401).json({ error: 'Google account verification failed.' });
    }
    const user = (await db.getTable<any>('users')).find((candidate: any) =>
      String(candidate.email || '').toLowerCase() === profile.email!.toLowerCase()
    );
    if (!user) return res.status(403).json({ error: 'This Google account is not linked to an authorized system user.' });
    res.json(await createSession(user));
  } catch {
    res.status(502).json({ error: 'Unable to verify the Google account right now.' });
  }
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const genericResponse = { message: 'If an account matches that email, a verification code has been sent.' };
  if (!email) return res.json(genericResponse);
  const mailer = getMailer();
  if (!mailer) return res.status(503).json({ error: 'Password reset email is not configured on the server.' });
  const user = (await db.getTable<any>('users')).find((candidate: any) => String(candidate.email || '').toLowerCase() === email);
  if (!user) return res.json(genericResponse);

  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  passwordResetOtps.set(email, { hash: hashOtp(email, otp), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER,
      to: email,
      subject: 'GSO Procurement Portal password reset code',
      html: passwordResetEmail(otp),
      text: `Your GSO Procurement Portal password reset code is ${otp}. It expires in 10 minutes.`
    });
    res.json(genericResponse);
  } catch {
    passwordResetOtps.delete(email);
    res.status(502).json({ error: 'The verification email could not be sent.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const challenge = passwordResetOtps.get(email);
  if (!challenge || challenge.expiresAt <= Date.now() || challenge.attempts >= 5 || !/^\d{6}$/.test(otp) || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Invalid or expired code, or password does not meet the minimum requirements.' });
  }
  challenge.attempts += 1;
  if (hashOtp(email, otp) !== challenge.hash) return res.status(400).json({ error: 'Invalid or expired verification code.' });
  const user = (await db.getTable<any>('users')).find((candidate: any) => String(candidate.email || '').toLowerCase() === email);
  if (!user) return res.status(400).json({ error: 'Invalid or expired verification code.' });
  const passwordBundle = hashPasswordScrypt(newPassword);
  await db.update('users', user.id, { password_hash: passwordBundle.hash, salt: passwordBundle.salt });
  passwordResetOtps.delete(email);
  await db.logAudit('users', user.id, 'UPDATE', null, 'Password reset completed by email OTP', user.role, user.name);
  res.json({ success: true });
});

app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = activeSessions.get(token);
    if (session) {
      await db.logAudit('users', session.id, 'STATUS_CHANGE', null, 'User logout successful', session.role, session.name);
      activeSessions.delete(token);
    }
  }
  res.json({ success: true });
});

app.get('/api/auth/me', authenticate, (req: any, res: any) => {
  res.json(req.user);
});

app.post('/api/chat', authenticate, async (req: any, res: any) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const userMessage = messages
    .filter((message: any) => message?.role === 'user' && typeof message.content === 'string')
    .at(-1)?.content?.trim();

  if (!userMessage) {
    return res.status(400).json({ error: 'A user message is required.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: messages
        .filter((message: any) =>
          (message?.role === 'user' || message?.role === 'assistant') &&
          typeof message.content === 'string'
        )
        .map((message: any) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
      config: {
        systemInstruction: 'You are the GSO Procurement Helpdesk Assistant for a Philippine local government unit. Respond like a thoughtful, approachable human advisor: acknowledge the user\'s question, use warm natural language, explain things in plain terms, and vary your wording instead of repeating canned introductions. Be practical, accurate, and concise, with enough context to make the answer useful. Ask one focused follow-up question when important details are missing. State when a matter requires confirmation against current law, regulations, or the LGU\'s official policies. Do not invent system records or approvals. Do not use asterisks for emphasis or bullet points.'
      }
    });

    const reply = response.text?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'Gemini returned an empty response.' });
    }

    return res.json({ reply });
  } catch (error: any) {
    console.error('Gemini chat request failed:', error);
    return res.status(502).json({ error: 'Unable to get a response from Gemini.' });
  }
});

app.get('/api/users', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
  try {
    const users = await db.getTable<any>('users');
    res.json(users.map((user: any) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      supplier_id: user.supplier_id,
      created_at: user.created_at
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load users' });
  }
});

app.post('/api/users', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
  try {
    const { username, password, name, email, role, department_id, supplier_id } = req.body;
    const normalizedUsername = String(username || '').trim();
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedUsername || !password || !normalizedName || !normalizedEmail || !role) {
      return res.status(400).json({ error: 'Username, password, full name, email, and role are required.' });
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
      return res.status(400).json({ error: 'Username contains invalid characters. Use letters, numbers, dot, underscore, or hyphen only.' });
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required for Google sign-in and password reset.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (!['End User', 'GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'Supplier'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected.' });
    }
    if (role === 'Supplier' && !supplier_id) {
      return res.status(400).json({ error: 'Supplier accounts must be linked to a supplier registry record.' });
    }

    const existingUsers = await db.getTable<any>('users');
    const duplicate = existingUsers.some((user: any) => user.username.toLowerCase() === normalizedUsername.toLowerCase());
    if (duplicate) {
      return res.status(409).json({ error: 'A user with that username already exists.' });
    }
    if (existingUsers.some((user: any) => String(user.email || '').toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    const passwordBundle = hashPasswordScrypt(password);
    const created = await db.insert<any>('users', {
      username: normalizedUsername,
      password_hash: passwordBundle.hash,
      salt: passwordBundle.salt,
      name: normalizedName,
      email: normalizedEmail,
      role,
      department_id: department_id !== undefined && department_id !== null && department_id !== '' ? Number(department_id) : null,
      supplier_id: role === 'Supplier' ? Number(supplier_id) : null,
      created_at: new Date().toISOString()
    });

    await db.logAudit('users', created.id, 'CREATE', null, JSON.stringify({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

app.put('/api/users/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const existing = await db.getById<any>('users', userId);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const { username, name, email, role, department_id, supplier_id, password } = req.body;
    const normalizedUsername = String(username || '').trim();
    const normalizedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedUsername || !normalizedName || !normalizedEmail || !role) {
      return res.status(400).json({ error: 'Username, full name, email, and role are required.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required for Google sign-in and password reset.' });
    }

    if (!['End User', 'GSO Officer', 'BAC Secretariat', 'Budget Officer', 'Mayor', 'Finance Officer', 'Supplier'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected.' });
    }
    if (role === 'Supplier' && !supplier_id) {
      return res.status(400).json({ error: 'Supplier accounts must be linked to a supplier registry record.' });
    }

    const duplicate = (await db.getTable<any>('users')).some((user: any) =>
      user.id !== userId && user.username.toLowerCase() === normalizedUsername.toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({ error: 'Another user already uses that username.' });
    }
    if ((await db.getTable<any>('users')).some((user: any) => user.id !== userId && String(user.email || '').toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: 'Another user already uses that email.' });
    }

    const updates: any = {
      username: normalizedUsername,
      name: normalizedName,
      email: normalizedEmail,
      role,
      department_id: department_id !== undefined && department_id !== null && department_id !== '' ? Number(department_id) : null,
      supplier_id: role === 'Supplier' ? Number(supplier_id) : null
    };

    if (password && String(password).trim()) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }
      const passwordBundle = hashPasswordScrypt(String(password));
      updates.password_hash = passwordBundle.hash;
      updates.salt = passwordBundle.salt;
    }

    const updated = await db.update<any>('users', userId, updates);
    await db.logAudit('users', userId, 'UPDATE', JSON.stringify(existing), JSON.stringify(updated), req.user.role, req.user.name);
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

app.delete('/api/users/:id', authenticate, requireRoles(['Mayor']), async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID.' });
    if (req.user.id === userId) return res.status(400).json({ error: 'You cannot delete your own account while logged in.' });

    const existing = await db.getById<any>('users', userId);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    await db.delete('users', userId);
    await db.logAudit('users', userId, 'DELETE', JSON.stringify(existing), null, req.user.role, req.user.name);
    res.json({ success: true, deletedUserId: userId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// --- PhilGEPS REMOVED ---
// PhilGEPS integration has been removed. The previous implementation generated
// fake reference numbers and fabricated XML transmissions without connecting to
// the actual PhilGEPS gateway. All procurement notices must be posted manually
// at https://www.philgeps.gov.ph
// The philgeps_postings table is retained in the database for audit purposes only.
app.all('/api/philgeps/*', (_req, res) => {
  res.status(410).json({
    error: 'PhilGEPS integration has been removed. Please post procurement notices directly at https://www.philgeps.gov.ph'
  });
});

// --- System Settings ---

app.get('/api/settings', authenticate, async (req, res) => {
  const settingsList = await db.getTable<any>('system_settings');
  if (settingsList.length === 0) {
    const defaultSettings = {
      id: 1,
      system_name: 'GovProcure MS',
      municipal_name: 'MUNICIPALITY OF CAINTA',
      province_name: 'Province of Rizal',
      mayor_name: 'HON. [Mayor Name — Update in System Settings]',
      gso_officer_name: 'Arthur N. Ramos',
      budget_officer_name: 'Engr. Roberto D. Santos',
      accountant_name: 'Mrs. Teresa V. Jose',
      bac_chairman_name: 'Atty. Susan Cruz',
      treasurer_name: 'Mr. Arthur N. Ramos',
      penalty_clause_text: 'A penalty of one-tenth (1/10) of one percent (1%) of the total value of the delayed goods/services for every day of delay shall be imposed.'
    };
    await db.insert<any>('system_settings', defaultSettings);
    return res.json(defaultSettings);
  }
  res.json(settingsList[0]);
});

app.put('/api/settings', authenticate, requireRoles(['Mayor', 'GSO Officer', 'Finance Officer']), async (req: any, res: any) => {
  const settingsList = await db.getTable<any>('system_settings');
  const existingId = settingsList.length > 0 ? settingsList[0].id : 1;
  const updates = { ...req.body };

  if (updates.logo_data !== undefined && updates.logo_data !== null && updates.logo_data !== '') {
    if (typeof updates.logo_data !== 'string' || !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(updates.logo_data) || updates.logo_data.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Logo must be a PNG, JPEG, GIF, or WebP image smaller than 3 MB.' });
    }
  } else {
    updates.logo_data = null;
  }

  let updated: any;
  if (settingsList.length === 0) {
    updated = await db.insert<any>('system_settings', updates);
  } else {
    updated = await db.update<any>('system_settings', existingId, updates);
  }

  await db.logAudit('system_settings', existingId, 'UPDATE', JSON.stringify(settingsList[0] || {}), JSON.stringify(updated || {}), req.user.role, req.user.name);
  res.json(updated);
});

// NOTE: For brevity, the rest of your routes should be migrated similarly.
// This file establishes the correct MySQL async patterns and replaces the previous broken server.ts.
// If you want, I can migrate the remaining endpoints in the same safe/consistent way.

import { attachDepartmentsRoutes } from './server_mysql.departments_patch.ts';
import { attachAllRoutes } from './server_mysql.routes_patch.ts';

// Attach missing routes (JSON API)
attachDepartmentsRoutes(app);
attachAllRoutes(app, authenticate, requireRoles);

const startApp = async () => {
  try {
    await testConnection();
    console.log('MySQL connection established.');
  } catch (error: any) {
    console.error(`MySQL connection failed for database "${process.env.MYSQL_DATABASE || 'procurement_management_ocr'}" at ${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || '3306'}.`);
    console.error(error?.message || error);
    process.exitCode = 1;
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`GSO Procurement MS backend (MySQL) listening on port ${PORT}`);
    console.log(`Local:   http://localhost:${PORT}`);

    for (const networkInterface of Object.values(networkInterfaces()).flat()) {
      if (networkInterface && networkInterface.family === 'IPv4' && !networkInterface.internal) {
        console.log(`Network: http://${networkInterface.address}:${PORT}`);
      }
    }
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Set PORT in .env.local or stop the process using it.`);
    } else {
      console.error('Failed to bind the application server:', error.message);
    }
    process.exitCode = 1;
  });
};

startApp().catch(err => console.error('Failed to start server:', err));

