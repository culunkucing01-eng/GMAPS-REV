import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import JSZip from 'jszip';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

const firebaseConfig = loadFirebaseConfig();
const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const BOOTSTRAPPED_ADMIN_EMAIL = 'lulukqueen17@gmail.com';

// Konfigurasi PIN khusus server (tidak pernah dikirim ke browser)
const ADMIN_ACCESS_PIN = (process.env.ADMIN_ACCESS_PIN || '4321').trim();
const SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE_NAME = 'nafma_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 jam

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 menit

interface AdminSessionRecord {
  sid: string;
  uid: string;
  email: string;
  expiresAt: number;
}

interface PinAttemptRecord {
  attempts: number;
  lockedUntil: number;
}

interface VerifiedUserClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  idToken: string;
}

const activeSessions = new Map<string, AdminSessionRecord>();
const pinAttempts = new Map<string, PinAttemptRecord>();

let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const response = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!response.ok) {
    throw new Error('Gagal mengambil sertifikat publik autentikasi.');
  }
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = (await response.json()) as Record<string, string>;
  certsExpiresAt = now + maxAgeSec * 1000;
  return cachedCerts;
}

function base64UrlToBuffer(str: string): Buffer {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<VerifiedUserClaims | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(
      base64UrlToBuffer(headerB64).toString('utf-8')
    ) as { alg?: string; kid?: string };
    const payload = JSON.parse(
      base64UrlToBuffer(payloadB64).toString('utf-8')
    ) as {
      iss?: string;
      aud?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      email?: string;
      email_verified?: boolean;
    };

    if (header.alg !== 'RS256' || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
      payload.aud !== PROJECT_ID ||
      !payload.sub ||
      typeof payload.sub !== 'string' ||
      !payload.exp ||
      payload.exp <= nowSec ||
      !payload.iat ||
      payload.iat > nowSec + 300 ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return null;
    }

    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const isValidSig = verifier.verify(cert, base64UrlToBuffer(signatureB64));
    if (!isValidSig) return null;

    return {
      uid: payload.sub,
      email: payload.email,
      emailVerified: true,
      idToken,
    };
  } catch {
    return null;
  }
}

async function isAuthorizedAdmin(user: VerifiedUserClaims): Promise<boolean> {
  if (!user.emailVerified) return false;
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      PROJECT_ID
    )}/databases/${encodeURIComponent(DATABASE_ID)}/documents/admins/${encodeURIComponent(
      user.uid
    )}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${user.idToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

function signSessionToken(record: AdminSessionRecord): string {
  const payloadB64 = Buffer.from(JSON.stringify(record), 'utf-8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionCookie(
  rawCookie: string | undefined,
  expectedUid: string
): AdminSessionRecord | null {
  if (!rawCookie) return null;
  const parts = rawCookie.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    ) as AdminSessionRecord;
    const stored = activeSessions.get(parsed.sid);
    if (!stored) return null;
    if (stored.uid !== expectedUid) return null;
    if (Date.now() > stored.expiresAt) {
      activeSessions.delete(parsed.sid);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function constantTimePinMatch(inputPin: string, expectedPin: string): boolean {
  const hashA = crypto.createHash('sha256').update(inputPin).digest();
  const hashB = crypto.createHash('sha256').update(expectedPin).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function isHttpsRequest(req: Request): boolean {
  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string') {
    return xfProto.split(',')[0].trim() === 'https';
  }
  return req.secure;
}

function setAdminSessionCookie(req: Request, res: Response, token: string) {
  const secure = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearAdminSessionCookie(req: Request, res: Response) {
  const secure = isHttpsRequest(req);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (secure) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

interface AuthedAdminRequest extends Request {
  adminUser?: VerifiedUserClaims;
  adminSession?: AdminSessionRecord;
}

async function requireAdminWithPin(
  req: AuthedAdminRequest,
  res: Response,
  next: NextFunction
) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Akses tidak diizinkan.' });
    return;
  }

  const verifiedUser = await verifyFirebaseIdToken(token);
  if (!verifiedUser) {
    res.status(401).json({ error: 'Akses tidak diizinkan.' });
    return;
  }

  const authorized = await isAuthorizedAdmin(verifiedUser);
  if (!authorized) {
    res.status(403).json({ error: 'Akses tidak diizinkan.' });
    return;
  }

  const cookies = parseCookies(req);
  const session = verifySessionCookie(
    cookies[SESSION_COOKIE_NAME],
    verifiedUser.uid
  );
  if (!session) {
    res.status(401).json({ error: 'Verifikasi PIN keamanan admin diperlukan.' });
    return;
  }

  req.adminUser = verifiedUser;
  req.adminSession = session;
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  // Endpoint health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Cek status sesi autentikasi Google + Admin + PIN
  app.get('/api/admin/session', async (req, res) => {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({
        authenticated: false,
        authorized: false,
        pinVerified: false,
      });
      return;
    }

    const verifiedUser = await verifyFirebaseIdToken(token);
    if (!verifiedUser) {
      res.status(401).json({
        authenticated: false,
        authorized: false,
        pinVerified: false,
      });
      return;
    }

    const authorized = await isAuthorizedAdmin(verifiedUser);
    if (!authorized) {
      res.status(403).json({
        authenticated: true,
        authorized: false,
        pinVerified: false,
      });
      return;
    }

    const cookies = parseCookies(req);
    const session = verifySessionCookie(
      cookies[SESSION_COOKIE_NAME],
      verifiedUser.uid
    );

    res.json({
      authenticated: true,
      authorized: true,
      pinVerified: Boolean(session),
      expiresAt: session?.expiresAt ?? null,
    });
  });

  // Verifikasi PIN keamanan admin di server
  app.post('/api/admin/verify-pin', async (req, res) => {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Akses tidak diizinkan.' });
      return;
    }

    const verifiedUser = await verifyFirebaseIdToken(token);
    if (!verifiedUser) {
      res.status(401).json({ error: 'Akses tidak diizinkan.' });
      return;
    }

    const authorized = await isAuthorizedAdmin(verifiedUser);
    if (!authorized) {
      res.status(403).json({ error: 'Akses tidak diizinkan.' });
      return;
    }

    const attemptKey = `${getClientIp(req)}:${verifiedUser.uid}`;
    const now = Date.now();
    const record = pinAttempts.get(attemptKey) ?? {
      attempts: 0,
      lockedUntil: 0,
    };

    if (record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      res.status(429).json({
        error:
          'Terlalu banyak percobaan gagal. Silakan tunggu sementara sebelum mencoba lagi.',
        locked: true,
        retryAfterSeconds,
      });
      return;
    }

    const submittedPin =
      typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';

    if (!/^\d{4}$/.test(submittedPin)) {
      res.status(400).json({
        error: 'Masukkan PIN keamanan 4 digit yang valid.',
      });
      return;
    }

    if (!constantTimePinMatch(submittedPin, ADMIN_ACCESS_PIN)) {
      const nextAttempts = record.attempts + 1;
      if (nextAttempts >= MAX_PIN_ATTEMPTS) {
        pinAttempts.set(attemptKey, {
          attempts: 0,
          lockedUntil: now + LOCKOUT_DURATION_MS,
        });
        res.status(429).json({
          error:
            'Terlalu banyak percobaan gagal. Silakan tunggu 5 menit sebelum mencoba lagi.',
          locked: true,
          retryAfterSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
        });
        return;
      }

      pinAttempts.set(attemptKey, {
        attempts: nextAttempts,
        lockedUntil: 0,
      });

      res.status(401).json({
        error: 'Verifikasi keamanan gagal. Periksa kembali PIN Anda.',
        remainingAttempts: MAX_PIN_ATTEMPTS - nextAttempts,
      });
      return;
    }

    // PIN valid -> hapus riwayat gagal & buat sesi terverifikasi server
    pinAttempts.delete(attemptKey);

    const sessionRecord: AdminSessionRecord = {
      sid: crypto.randomBytes(24).toString('hex'),
      uid: verifiedUser.uid,
      email: verifiedUser.email,
      expiresAt: now + SESSION_TTL_MS,
    };
    activeSessions.set(sessionRecord.sid, sessionRecord);

    const signedCookie = signSessionToken(sessionRecord);
    setAdminSessionCookie(req, res, signedCookie);

    res.json({
      verified: true,
      expiresAt: sessionRecord.expiresAt,
    });
  });

  // Logout & cabut sesi admin di server
  app.post('/api/admin/logout', (req, res) => {
    const cookies = parseCookies(req);
    const rawCookie = cookies[SESSION_COOKIE_NAME];
    if (rawCookie) {
      const parts = rawCookie.split('.');
      if (parts.length === 2) {
        try {
          const parsed = JSON.parse(
            Buffer.from(parts[0], 'base64url').toString('utf-8')
          ) as { sid?: string };
          if (parsed.sid) {
            activeSessions.delete(parsed.sid);
          }
        } catch {
          // Abaikan cookie rusak
        }
      }
    }
    clearAdminSessionCookie(req, res);
    res.json({ loggedOut: true });
  });

  // Endpoint admin terlindungi untuk memverifikasi keamanan & sesi aktif
  app.get(
    '/api/admin/security-summary',
    requireAdminWithPin,
    (req: AuthedAdminRequest, res) => {
      res.json({
        status: 'terverifikasi',
        adminEmail: req.adminUser?.email,
        sessionExpiresAt: req.adminSession?.expiresAt,
        pinConfigured: Boolean(ADMIN_ACCESS_PIN),
      });
    }
  );

  // --- Layanan Email SMTP (Server-Only, Tanpa Kredensial di Browser) ---
  const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
  const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
  const SMTP_USER = (process.env.SMTP_USER || '').trim();
  const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
  const SMTP_FROM =
    (process.env.SMTP_FROM || '').trim() ||
    (SMTP_USER ? `Google Maps Service Portal <${SMTP_USER}>` : 'Google Maps Service Portal <no-reply@localhost>');
  const ADMIN_NOTIFICATION_EMAIL =
    (process.env.ADMIN_NOTIFICATION_EMAIL || BOOTSTRAPPED_ADMIN_EMAIL).trim();

  function isSmtpConfigured(): boolean {
    return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
  }

  function maskEmailAddress(email: string): string {
    const parts = email.trim().split('@');
    if (parts.length !== 2) return '***';
    const [local, domain] = parts;
    const shown = local.slice(0, Math.min(2, local.length));
    return `${shown}***@${domain}`;
  }

  function isValidEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  function isValidGoogleMapsUrlServer(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl.trim());
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'maps.app.goo.gl' ||
        host === 'g.page' ||
        host === 'maps.google.com' ||
        host === 'business.google.com'
      ) {
        return true;
      }
      if (host === 'goo.gl') {
        return parsed.pathname.toLowerCase().startsWith('/maps');
      }
      if (
        host === 'google.com' ||
        host === 'www.google.com' ||
        host === 'google.co.id' ||
        host === 'www.google.co.id'
      ) {
        return (
          parsed.pathname.toLowerCase().startsWith('/maps') ||
          parsed.searchParams.has('cid') ||
          parsed.searchParams.has('q')
        );
      }
      return false;
    } catch {
      return false;
    }
  }

  function formatIndonesianDateTime(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' WIB';
  }

  function generateBookingCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `BK-${y}${m}${d}-${suffix}`;
  }

  function computeLookupHash(bookingCode: string, email: string): string {
    return crypto
      .createHash('sha256')
      .update(`${bookingCode.trim().toUpperCase()}:${email.trim().toLowerCase()}`)
      .digest('hex');
  }

  async function sendSmtpEmail(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{
    deliveryStatus: 'sent' | 'pending_config' | 'failed';
    statusNote: string;
  }> {
    if (!isSmtpConfigured()) {
      return {
        deliveryStatus: 'pending_config',
        statusNote:
          'SMTP server belum dikonfigurasi pada environment variable server. Pesan dicatat di log admin.',
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
      });

      await transporter.sendMail({
        from: SMTP_FROM,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      return {
        deliveryStatus: 'sent',
        statusNote: 'Email berhasil dikirim melalui SMTP server.',
      };
    } catch (err) {
      return {
        deliveryStatus: 'failed',
        statusNote:
          err instanceof Error
            ? err.message.slice(0, 260)
            : 'Gagal mengirim email melalui SMTP.',
      };
    }
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildNewBookingEmailContent(data: {
    customerName: string;
    customerEmail: string;
    customerWhatsapp: string;
    businessName: string;
    businessCategory: string;
    businessAddress: string;
    businessCity: string;
    googleMapsUrl: string;
    bookingCode: string;
    serviceType: string;
    submittedAtLabel: string;
  }) {
    const fullLocation = `${data.businessAddress}, ${data.businessCity}`;
    const subject = `[Booking Baru] ${data.bookingCode} — ${data.businessName}`;
    const text = `Halo Admin,

Ada permohonan booking jasa baru yang masuk ke sistem.

**Informasi Customer**
- Nama: ${data.customerName}
- Email: ${data.customerEmail}
- WhatsApp: ${data.customerWhatsapp}

**Informasi Bisnis**
- Nama Bisnis: ${data.businessName}
- Kategori: ${data.businessCategory}
- Lokasi: ${fullLocation}
- Google Maps: ${data.googleMapsUrl}

**Informasi Booking**
- Nomor Booking: ${data.bookingCode}
- Layanan: ${data.serviceType}
- Waktu Pengajuan: ${data.submittedAtLabel}
- Status: Pending Approval

Silakan buka Admin Dashboard untuk memeriksa dan memproses permohonan.

Google Maps Service Portal
Notifikasi otomatis. Mohon tidak membalas email ini.`;

    const html = `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
      <p>Halo Admin,</p>
      <p>Ada permohonan booking jasa baru yang masuk ke sistem.</p>
      <p><strong>Informasi Customer</strong></p>
      <ul>
        <li>Nama: ${escapeHtml(data.customerName)}</li>
        <li>Email: ${escapeHtml(data.customerEmail)}</li>
        <li>WhatsApp: ${escapeHtml(data.customerWhatsapp)}</li>
      </ul>
      <p><strong>Informasi Bisnis</strong></p>
      <ul>
        <li>Nama Bisnis: ${escapeHtml(data.businessName)}</li>
        <li>Kategori: ${escapeHtml(data.businessCategory)}</li>
        <li>Lokasi: ${escapeHtml(fullLocation)}</li>
        <li>Google Maps: <a href="${escapeHtml(data.googleMapsUrl)}">${escapeHtml(data.googleMapsUrl)}</a></li>
      </ul>
      <p><strong>Informasi Booking</strong></p>
      <ul>
        <li>Nomor Booking: <strong>${escapeHtml(data.bookingCode)}</strong></li>
        <li>Layanan: ${escapeHtml(data.serviceType)}</li>
        <li>Waktu Pengajuan: ${escapeHtml(data.submittedAtLabel)}</li>
        <li>Status: <strong>Pending Approval</strong></li>
      </ul>
      <p>Silakan buka Admin Dashboard untuk memeriksa dan memproses permohonan.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="font-size:12px;color:#64748b">Google Maps Service Portal<br/>Notifikasi otomatis. Mohon tidak membalas email ini.</p>
    </div>`;

    return { subject, text, html };
  }

  // Rate limit & proteksi spam booking publik
  const bookingRateMap = new Map<string, { count: number; resetAt: number }>();
  const recentSubmissionMap = new Map<string, number>();
  const statusCheckRateMap = new Map<string, { count: number; resetAt: number }>();

  app.post('/api/bookings/submit', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();

    // Cek rate limit IP (maks 6 pengajuan per 10 menit)
    const rate = bookingRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 6) {
        const retryAfterSeconds = Math.ceil((rate.resetAt - now) / 1000);
        res.status(429).json({
          error:
            'Terlalu banyak pengajuan booking dari jaringan Anda. Silakan tunggu beberapa menit sebelum mencoba lagi.',
          retryAfterSeconds,
        });
        return;
      }
      rate.count += 1;
    } else {
      bookingRateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    // Honeypot anti-spam (kolom tersembunyi harus kosong)
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      res.status(400).json({ error: 'Permintaan tidak dapat diproses.' });
      return;
    }

    const customerName =
      typeof body.customerName === 'string' ? body.customerName.trim() : '';
    const customerEmail =
      typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
    const customerWhatsapp =
      typeof body.customerWhatsapp === 'string' ? body.customerWhatsapp.trim() : '';
    const businessName =
      typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const googleMapsUrl =
      typeof body.googleMapsUrl === 'string' ? body.googleMapsUrl.trim() : '';
    const businessCategory =
      typeof body.businessCategory === 'string' ? body.businessCategory.trim() : '';
    const businessAddress =
      typeof body.businessAddress === 'string' ? body.businessAddress.trim() : '';
    const businessCity =
      typeof body.businessCity === 'string' ? body.businessCity.trim() : '';
    const serviceType =
      typeof body.serviceType === 'string' ? body.serviceType.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

    if (customerName.length < 2 || customerName.length > 120) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter (maks 120).' });
      return;
    }
    if (!isValidEmailFormat(customerEmail) || customerEmail.length > 160) {
      res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
      return;
    }
    const digitsOnly = customerWhatsapp.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 16 || customerWhatsapp.length > 30) {
      res.status(400).json({ error: 'Masukkan nomor WhatsApp yang valid (8–15 digit).' });
      return;
    }
    if (businessName.length < 2 || businessName.length > 120) {
      res.status(400).json({ error: 'Nama bisnis minimal 2 karakter.' });
      return;
    }
    if (!isValidGoogleMapsUrlServer(googleMapsUrl) || googleMapsUrl.length > 500) {
      res.status(400).json({
        error:
          'URL Google Maps harus diawali https:// dan menggunakan domain Google Maps resmi (google.com/maps, maps.app.goo.gl, atau g.page).',
      });
      return;
    }
    if (!businessCategory || businessCategory.length > 60) {
      res.status(400).json({ error: 'Pilih kategori bisnis yang sesuai.' });
      return;
    }
    if (businessAddress.length < 5 || businessAddress.length > 250) {
      res.status(400).json({ error: 'Alamat lengkap bisnis minimal 5 karakter.' });
      return;
    }
    if (businessCity.length < 2 || businessCity.length > 80) {
      res.status(400).json({ error: 'Kota/Kabupaten minimal 2 karakter.' });
      return;
    }
    if (serviceType.length < 2 || serviceType.length > 120) {
      res.status(400).json({ error: 'Pilih jenis layanan yang diinginkan.' });
      return;
    }
    if (notes.length > 1000) {
      res.status(400).json({ error: 'Catatan maksimal 1000 karakter.' });
      return;
    }

    // Cek duplikasi pengajuan identik dalam 5 menit terakhir
    const dedupKey = crypto
      .createHash('sha256')
      .update(
        `${customerEmail.toLowerCase()}|${businessName.toLowerCase()}|${serviceType.toLowerCase()}`
      )
      .digest('hex');
    const prevTime = recentSubmissionMap.get(dedupKey);
    if (prevTime && now - prevTime < 5 * 60 * 1000) {
      res.status(409).json({
        error:
          'Permohonan booking yang sama baru saja dikirim. Silakan cek email atau gunakan halaman Cek Status Booking.',
      });
      return;
    }
    recentSubmissionMap.set(dedupKey, now);

    const bookingCode = generateBookingCode();
    const lookupHash = computeLookupHash(bookingCode, customerEmail);
    const submittedAtLabel = formatIndonesianDateTime(new Date(now));

    const emailContent = buildNewBookingEmailContent({
      customerName,
      customerEmail,
      customerWhatsapp,
      businessName,
      businessCategory,
      businessAddress,
      businessCity,
      googleMapsUrl,
      bookingCode,
      serviceType,
      submittedAtLabel,
    });

    const emailResult = await sendSmtpEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    res.json({
      ok: true,
      bookingCode,
      lookupHash,
      submittedAtLabel,
      emailNotification: {
        eventType: 'new_booking_admin',
        recipientMasked: maskEmailAddress(ADMIN_NOTIFICATION_EMAIL),
        subject: emailContent.subject,
        deliveryStatus: emailResult.deliveryStatus,
        statusNote: emailResult.statusNote,
      },
    });
  });

  // Cek Status Booking Publik (Booking ID + Email -> SHA-256 Lookup bebas PII)
  app.post('/api/bookings/check-status', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const rate = statusCheckRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 25) {
        res.status(429).json({
          error: 'Terlalu banyak pengecekan status. Silakan coba beberapa saat lagi.',
        });
        return;
      }
      rate.count += 1;
    } else {
      statusCheckRateMap.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const bookingCode =
      typeof body.bookingCode === 'string' ? body.bookingCode.trim().toUpperCase() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!/^BK-[A-Z0-9-]{4,28}$/.test(bookingCode) || !isValidEmailFormat(email)) {
      res.status(400).json({
        error: 'Masukkan Nomor Booking (contoh: BK-...) dan alamat Email yang valid.',
      });
      return;
    }

    const lookupHash = computeLookupHash(bookingCode, email);
    try {
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        PROJECT_ID
      )}/databases/${encodeURIComponent(
        DATABASE_ID
      )}/documents/bookingStatusIndex/${encodeURIComponent(lookupHash)}`;

      const docRes = await fetch(firestoreUrl);
      if (docRes.status === 404) {
        res.status(404).json({
          error:
            'Data booking tidak ditemukan. Pastikan Nomor Booking dan Email sesuai dengan saat pengajuan.',
        });
        return;
      }
      if (!docRes.ok) {
        res.status(502).json({
          error: 'Gagal mengambil status booking. Coba beberapa saat lagi.',
        });
        return;
      }

      const json = (await docRes.json()) as {
        fields?: Record<string, { stringValue?: string; timestampValue?: string }>;
      };
      const fields = json.fields ?? {};
      res.json({
        found: true,
        bookingCode: fields.bookingCode?.stringValue || bookingCode,
        businessName: fields.businessName?.stringValue || '-',
        businessCategory: fields.businessCategory?.stringValue || '-',
        businessCity: fields.businessCity?.stringValue || '-',
        serviceType: fields.serviceType?.stringValue || '-',
        status: fields.status?.stringValue || 'pending_approval',
        statusMessage: fields.statusMessage?.stringValue || '',
        submittedAtLabel: fields.submittedAtLabel?.stringValue || '-',
        updatedAt: fields.updatedAt?.timestampValue || null,
      });
    } catch {
      res.status(500).json({ error: 'Terjadi kesalahan saat memeriksa status booking.' });
    }
  });

  // --- Program Partisipasi & Survei Pengalaman (Kode PR-... & Lookup Bebas PII) ---
  const participationRateMap = new Map<string, { count: number; resetAt: number }>();
  const recentParticipationMap = new Map<string, number>();
  const participationLookupRateMap = new Map<string, { count: number; resetAt: number }>();

  function generateParticipationCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `PR-${y}${m}${d}-${suffix}`;
  }

  app.post('/api/participation/submit', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();

    const rate = participationRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 8) {
        const retryAfterSeconds = Math.ceil((rate.resetAt - now) / 1000);
        res.status(429).json({
          error:
            'Terlalu banyak pengiriman survei dari jaringan Anda. Silakan tunggu beberapa menit.',
          retryAfterSeconds,
        });
        return;
      }
      rate.count += 1;
    } else {
      participationRateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      res.status(400).json({ error: 'Permintaan tidak dapat diproses.' });
      return;
    }

    const surveyId = typeof body.surveyId === 'string' ? body.surveyId.trim() : '';
    const surveyTitle =
      typeof body.surveyTitle === 'string'
        ? body.surveyTitle.trim()
        : 'Program Survei Pengalaman Pelanggan';
    const businessName =
      typeof body.businessName === 'string' ? body.businessName.trim() : '';
    const respondentName =
      typeof body.respondentName === 'string' ? body.respondentName.trim() : '';
    const respondentEmail =
      typeof body.respondentEmail === 'string' ? body.respondentEmail.trim().toLowerCase() : '';
    const respondentWhatsapp =
      typeof body.respondentWhatsapp === 'string' ? body.respondentWhatsapp.trim() : '';
    const visitDate = typeof body.visitDate === 'string' ? body.visitDate.trim() : '';
    const experienceFeedback =
      typeof body.experienceFeedback === 'string' ? body.experienceFeedback.trim() : '';
    const consentIndependent = body.consentIndependentFromGoogle === true;

    if (!surveyId || surveyId.length > 128) {
      res.status(400).json({ error: 'Program survei tidak valid.' });
      return;
    }
    if (businessName.length < 1 || businessName.length > 120) {
      res.status(400).json({ error: 'Pilih atau isi nama lokasi bisnis yang dikunjungi.' });
      return;
    }
    if (respondentName.length < 2 || respondentName.length > 120) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (!isValidEmailFormat(respondentEmail) || respondentEmail.length > 160) {
      res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
      return;
    }
    const digitsOnly = respondentWhatsapp.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 16 || respondentWhatsapp.length > 30) {
      res.status(400).json({ error: 'Masukkan nomor WhatsApp yang valid (8–15 digit).' });
      return;
    }
    if (visitDate.length < 4 || visitDate.length > 40) {
      res.status(400).json({ error: 'Pilih tanggal kunjungan yang valid.' });
      return;
    }
    if (experienceFeedback.length < 20 || experienceFeedback.length > 1500) {
      res.status(400).json({
        error: 'Tuliskan pengalaman kunjungan Anda secara lengkap (minimal 20 karakter).',
      });
      return;
    }
    if (!consentIndependent) {
      res.status(400).json({
        error:
          'Persetujuan independensi survei dari ulasan Google Maps wajib dicentang.',
      });
      return;
    }

    const dedupKey = crypto
      .createHash('sha256')
      .update(`${respondentEmail}|${surveyId}|${businessName.toLowerCase()}|${visitDate}`)
      .digest('hex');
    const prevTime = recentParticipationMap.get(dedupKey);
    if (prevTime && now - prevTime < 3 * 60 * 1000) {
      res.status(409).json({
        error:
          'Jawaban survei yang sama baru saja dikirim. Gunakan Email dan Kode Partisipasi Anda untuk memantau status pengajuan.',
      });
      return;
    }
    recentParticipationMap.set(dedupKey, now);

    const participationCode = generateParticipationCode();
    const lookupHash = computeLookupHash(participationCode, respondentEmail);
    const submittedAtLabel = formatIndonesianDateTime(new Date(now));

    const adminSubject = `[Survei Baru] ${participationCode} — ${businessName}`;
    const adminText = `Halo Admin,

Ada pengajuan survei pengalaman pelanggan baru yang masuk ke Portal Ulasan Maps.

Informasi Peserta:
- Kode Partisipasi: ${participationCode}
- Nama: ${respondentName}
- Email: ${respondentEmail}
- WhatsApp: ${respondentWhatsapp}

Detail Survei:
- Program: ${surveyTitle}
- Lokasi Bisnis: ${businessName}
- Tanggal Kunjungan: ${visitDate}
- Waktu Pengiriman: ${submittedAtLabel}

Silakan buka Admin Dashboard > Data Partisipan untuk memeriksa dan memverifikasi pengajuan.

Portal Partisipasi & Layanan Maps
Notifikasi otomatis. Mohon tidak membalas email ini.`;

    const adminHtml = `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
      <p>Halo Admin,</p>
      <p>Ada pengajuan survei pengalaman pelanggan baru yang masuk ke sistem.</p>
      <ul>
        <li>Kode Partisipasi: <strong>${escapeHtml(participationCode)}</strong></li>
        <li>Peserta: ${escapeHtml(respondentName)} (${escapeHtml(respondentEmail)})</li>
        <li>WhatsApp: ${escapeHtml(respondentWhatsapp)}</li>
        <li>Program: ${escapeHtml(surveyTitle)}</li>
        <li>Lokasi Bisnis: ${escapeHtml(businessName)}</li>
        <li>Tanggal Kunjungan: ${escapeHtml(visitDate)}</li>
        <li>Waktu Kirim: ${escapeHtml(submittedAtLabel)}</li>
      </ul>
      <p>Silakan buka Admin Dashboard &gt; Data Partisipan untuk memproses verifikasi.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="font-size:12px;color:#64748b">Portal Partisipasi &amp; Layanan Maps · Notifikasi otomatis.</p>
    </div>`;

    const participantSubject = `[Konfirmasi Survei] ${participationCode} — Pengajuan Anda Diterima`;
    const participantText = `Halo ${respondentName},

Terima kasih telah berpartisipasi dalam survei pengalaman pelanggan di ${businessName}.

Detail Pengajuan Anda:
- Kode Partisipasi: ${participationCode}
- Program Survei: ${surveyTitle}
- Lokasi Bisnis: ${businessName}
- Tanggal Kunjungan: ${visitDate}
- Status Saat Ini: Menunggu Verifikasi Admin

Simpan Email dan Kode Partisipasi Anda untuk memantau status verifikasi dan apresiasi Rp1.500 (bagi pengajuan yang memenuhi ketentuan) melalui menu Program Partisipasi tanpa perlu login.

Catatan Kepatuhan: Program apresiasi survei Rp1.500 hanya berlaku untuk survei internal yang terverifikasi dan tidak berkaitan dengan rating atau ulasan Google Maps.

Portal Partisipasi & Layanan Maps`;

    const participantHtml = `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
      <p>Halo <strong>${escapeHtml(respondentName)}</strong>,</p>
      <p>Terima kasih telah mengirimkan survei pengalaman pelanggan untuk <strong>${escapeHtml(businessName)}</strong>.</p>
      <ul>
        <li>Kode Partisipasi: <strong>${escapeHtml(participationCode)}</strong></li>
        <li>Program Survei: ${escapeHtml(surveyTitle)}</li>
        <li>Tanggal Kunjungan: ${escapeHtml(visitDate)}</li>
        <li>Status: <strong>Menunggu Verifikasi</strong></li>
      </ul>
      <p>Gunakan alamat Email dan Kode Partisipasi Anda pada halaman Program Partisipasi untuk memantau status pengajuan dan penyaluran apresiasi Rp1.500.</p>
      <p style="font-size:12px;color:#475569">Catatan: Apresiasi survei Rp1.500 berlaku khusus untuk survei pengalaman pelanggan internal yang memenuhi syarat, dan tidak diberikan sebagai imbalan atas ulasan Google Maps.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="font-size:12px;color:#64748b">Portal Partisipasi &amp; Layanan Maps · Notifikasi otomatis.</p>
    </div>`;

    const [adminEmailResult, participantEmailResult] = await Promise.all([
      sendSmtpEmail({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: adminSubject,
        text: adminText,
        html: adminHtml,
      }),
      sendSmtpEmail({
        to: respondentEmail,
        subject: participantSubject,
        text: participantText,
        html: participantHtml,
      }),
    ]);

    res.json({
      ok: true,
      participationCode,
      lookupHash,
      submittedAtLabel,
      emailNotifications: {
        admin: {
          eventType: 'new_survey_admin',
          recipientMasked: maskEmailAddress(ADMIN_NOTIFICATION_EMAIL),
          subject: adminSubject,
          deliveryStatus: adminEmailResult.deliveryStatus,
          statusNote: adminEmailResult.statusNote,
        },
        participant: {
          eventType: 'survey_received',
          recipientMasked: maskEmailAddress(respondentEmail),
          subject: participantSubject,
          deliveryStatus: participantEmailResult.deliveryStatus,
          statusNote: participantEmailResult.statusNote,
        },
      },
    });
  });

  app.post('/api/participation/lookup', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const rate = participationLookupRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 30) {
        res.status(429).json({
          error: 'Terlalu banyak pencarian status partisipasi. Silakan coba beberapa saat lagi.',
        });
        return;
      }
      rate.count += 1;
    } else {
      participationLookupRateMap.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const primaryCode =
      typeof body.participationCode === 'string'
        ? body.participationCode.trim().toUpperCase()
        : '';
    const additionalRaw = Array.isArray(body.additionalCodes) ? body.additionalCodes : [];

    if (!isValidEmailFormat(email)) {
      res.status(400).json({ error: 'Masukkan alamat Email peserta yang valid.' });
      return;
    }

    const codeSet = new Set<string>();
    if (primaryCode) {
      if (!/^PR-[A-Z0-9-]{4,28}$/.test(primaryCode)) {
        res.status(400).json({
          error: 'Format Kode Partisipasi tidak valid (contoh: PR-20261118-A1B2).',
        });
        return;
      }
      codeSet.add(primaryCode);
    }

    for (const item of additionalRaw) {
      if (typeof item === 'string') {
        const clean = item.trim().toUpperCase();
        if (/^PR-[A-Z0-9-]{4,28}$/.test(clean) && codeSet.size < 20) {
          codeSet.add(clean);
        }
      }
    }

    if (codeSet.size === 0) {
      res.status(400).json({
        error: 'Masukkan Kode Partisipasi Anda (contoh: PR-20261118-A1B2).',
      });
      return;
    }

    try {
      const codes = Array.from(codeSet);
      const results = await Promise.all(
        codes.map(async (code) => {
          const lookupHash = computeLookupHash(code, email);
          const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
            PROJECT_ID
          )}/databases/${encodeURIComponent(
            DATABASE_ID
          )}/documents/surveyStatusIndex/${encodeURIComponent(lookupHash)}`;

          const docRes = await fetch(firestoreUrl);
          if (!docRes.ok) return null;

          const json = (await docRes.json()) as {
            fields?: Record<
              string,
              { stringValue?: string; integerValue?: string; doubleValue?: number; timestampValue?: string }
            >;
          };
          const f = json.fields ?? {};
          const compVal =
            typeof f.compensationAmount?.doubleValue === 'number'
              ? f.compensationAmount.doubleValue
              : Number(f.compensationAmount?.integerValue ?? 1500);

          return {
            participationCode: f.participationCode?.stringValue || code,
            surveyTitle: f.surveyTitle?.stringValue || 'Program Survei Pengalaman',
            businessName: f.businessName?.stringValue || '-',
            visitDate: f.visitDate?.stringValue || '-',
            compensationAmount: Number.isFinite(compVal) ? compVal : 1500,
            rewardEligibleStatus: f.rewardEligibleStatus?.stringValue || 'pending_review',
            adminNotes: f.adminNotes?.stringValue || '',
            payoutReference: f.payoutReference?.stringValue || '',
            submittedAtLabel: f.submittedAtLabel?.stringValue || '-',
            updatedAt: f.updatedAt?.timestampValue || null,
          };
        })
      );

      const items = results.filter((x): x is NonNullable<typeof x> => x !== null);
      if (items.length === 0) {
        res.status(404).json({
          error:
            'Data partisipasi tidak ditemukan. Pastikan Email dan Kode Partisipasi sesuai dengan saat pengiriman survei.',
        });
        return;
      }

      res.json({ items });
    } catch {
      res.status(500).json({
        error: 'Terjadi kesalahan saat memeriksa status partisipasi.',
      });
    }
  });

  // Status konfigurasi SMTP (khusus Admin terverifikasi PIN, tanpa bocor password)
  app.get('/api/admin/email-status', requireAdminWithPin, (_req, res) => {
    res.json({
      configured: isSmtpConfigured(),
      host: isSmtpConfigured() ? SMTP_HOST : null,
      port: isSmtpConfigured() ? SMTP_PORT : null,
      from: isSmtpConfigured() ? SMTP_FROM : null,
      adminRecipientMasked: maskEmailAddress(ADMIN_NOTIFICATION_EMAIL),
    });
  });

  // Kirim notifikasi email ke Customer saat status berubah (khusus Admin + PIN)
  app.post(
    '/api/admin/bookings/notify-status',
    requireAdminWithPin,
    async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const customerEmail =
        typeof body.customerEmail === 'string' ? body.customerEmail.trim() : '';
      const customerName =
        typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const businessName =
        typeof body.businessName === 'string' ? body.businessName.trim() : '';
      const bookingCode =
        typeof body.bookingCode === 'string' ? body.bookingCode.trim() : '';
      const serviceType =
        typeof body.serviceType === 'string' ? body.serviceType.trim() : '';
      const newStatus =
        typeof body.newStatus === 'string' ? body.newStatus.trim() : '';
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

      if (!isValidEmailFormat(customerEmail) || !bookingCode || !newStatus) {
        res.status(400).json({ error: 'Data notifikasi email tidak lengkap.' });
        return;
      }

      let eventType:
        | 'booking_approved'
        | 'booking_rejected'
        | 'booking_revision'
        | null = null;
      let subject = '';
      let statusLabel = '';
      let extraText = '';

      if (newStatus === 'approved') {
        eventType = 'booking_approved';
        statusLabel = 'Disetujui';
        subject = `[Booking Disetujui] ${bookingCode} — ${businessName}`;
        extraText =
          reason ||
          'Permohonan booking jasa Anda telah disetujui oleh Admin. Tim kami akan segera menghubungi Anda atau memproses layanan sesuai jadwal.';
      } else if (newStatus === 'in_progress') {
        eventType = 'booking_approved';
        statusLabel = 'Sedang Dikerjakan (In Progress)';
        subject = `[Pengerjaan Dimulai] ${bookingCode} — ${businessName}`;
        extraText =
          reason ||
          'Tim kami telah mulai mengerjakan layanan optimasi Google Business Profile Anda.';
      } else if (newStatus === 'waiting_for_customer') {
        eventType = 'booking_revision';
        statusLabel = 'Menunggu Konfirmasi Customer';
        subject = `[Informasi Tambahan Diperlukan] ${bookingCode} — ${businessName}`;
        extraText =
          reason ||
          'Admin memerlukan informasi atau konfirmasi tambahan dari Anda untuk melanjutkan pengerjaan.';
      } else if (newStatus === 'completed') {
        eventType = 'booking_approved';
        statusLabel = 'Selesai';
        subject = `[Booking Selesai] ${bookingCode} — ${businessName}`;
        extraText =
          reason ||
          'Layanan pengelolaan Google Business Profile Anda telah selesai dikerjakan dengan tuntas.';
      } else if (newStatus === 'rejected') {
        eventType = 'booking_rejected';
        statusLabel = 'Ditolak';
        subject = `[Booking Ditolak] ${bookingCode} — ${businessName}`;
        extraText = `Alasan penolakan: ${reason || 'Data belum memenuhi persyaratan layanan saat ini.'}`;
      } else if (newStatus === 'revision_requested') {
        eventType = 'booking_revision';
        statusLabel = 'Membutuhkan Revisi Data';
        subject = `[Permintaan Revisi Booking] ${bookingCode} — ${businessName}`;
        extraText = `Catatan revisi dari Admin: ${reason || 'Mohon periksa kembali tautan Google Maps dan detail bisnis Anda.'}`;
      }

      if (!eventType) {
        res.json({
          skipped: true,
          reason: 'Status tidak memerlukan pengiriman email.',
        });
        return;
      }

      const text = `Halo ${customerName || 'Customer'},

Berikut pembaruan status permohonan booking jasa Anda di Google Maps Service Portal:

- Nomor Booking: ${bookingCode}
- Nama Bisnis: ${businessName}
- Layanan: ${serviceType}
- Status Terbaru: ${statusLabel}

${extraText}

Anda juga dapat memantau status terbaru melalui menu Cek Status Booking di portal dengan memasukkan Nomor Booking dan Email Anda.

Google Maps Service Portal
Notifikasi otomatis. Mohon tidak membalas email ini.`;

      const html = `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
        <p>Halo <strong>${escapeHtml(customerName || 'Customer')}</strong>,</p>
        <p>Berikut pembaruan status permohonan booking jasa Anda di Google Maps Service Portal:</p>
        <ul>
          <li>Nomor Booking: <strong>${escapeHtml(bookingCode)}</strong></li>
          <li>Nama Bisnis: ${escapeHtml(businessName)}</li>
          <li>Layanan: ${escapeHtml(serviceType)}</li>
          <li>Status Terbaru: <strong>${escapeHtml(statusLabel)}</strong></li>
        </ul>
        <p>${escapeHtml(extraText)}</p>
        <p>Anda juga dapat memantau status terbaru melalui menu Cek Status Booking di portal dengan memasukkan Nomor Booking dan Email Anda.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="font-size:12px;color:#64748b">Google Maps Service Portal<br/>Notifikasi otomatis. Mohon tidak membalas email ini.</p>
      </div>`;

      const result = await sendSmtpEmail({
        to: customerEmail,
        subject,
        text,
        html,
      });

      res.json({
        eventType,
        recipientMasked: maskEmailAddress(customerEmail),
        subject,
        deliveryStatus: result.deliveryStatus,
        statusNote: result.statusNote,
      });
    }
  );

  // Kirim notifikasi email ke Peserta saat status survei berubah (khusus Admin + PIN)
  app.post(
    '/api/admin/surveys/notify-status',
    requireAdminWithPin,
    async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const respondentEmail =
        typeof body.respondentEmail === 'string' ? body.respondentEmail.trim().toLowerCase() : '';
      const respondentName =
        typeof body.respondentName === 'string' ? body.respondentName.trim() : '';
      const businessName =
        typeof body.businessName === 'string' ? body.businessName.trim() : '';
      const surveyTitle =
        typeof body.surveyTitle === 'string' ? body.surveyTitle.trim() : '';
      const participationCode =
        typeof body.participationCode === 'string' ? body.participationCode.trim() : '';
      const newStatus =
        typeof body.newStatus === 'string' ? body.newStatus.trim() : '';
      const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes.trim() : '';
      const payoutReference =
        typeof body.payoutReference === 'string' ? body.payoutReference.trim() : '';

      if (!isValidEmailFormat(respondentEmail) || !participationCode || !newStatus) {
        res.status(400).json({ error: 'Data notifikasi survei tidak lengkap.' });
        return;
      }

      let eventType:
        | 'survey_revision_requested'
        | 'survey_approved'
        | 'survey_rejected'
        | null = null;
      let subject = '';
      let statusLabel = '';
      let bodyNote = '';

      if (newStatus === 'revision_requested') {
        eventType = 'survey_revision_requested';
        statusLabel = 'Perlu Perbaikan';
        subject = `[Perlu Perbaikan Survei] ${participationCode} — ${businessName}`;
        bodyNote = `Catatan Admin untuk perbaikan jawaban survei Anda: ${
          adminNotes || 'Mohon lengkapi detail pengalaman kunjungan nyata Anda agar dapat diverifikasi.'
        }`;
      } else if (newStatus === 'eligible' || newStatus === 'paid') {
        eventType = 'survey_approved';
        statusLabel =
          newStatus === 'paid'
            ? 'Apresiasi Disalurkan (Rp1.500)'
            : 'Disetujui · Memenuhi Syarat (Rp1.500)';
        subject =
          newStatus === 'paid'
            ? `[Apresiasi Survei Disalurkan] ${participationCode}`
            : `[Survei Disetujui] ${participationCode} — Layak Apresiasi Rp1.500`;
        bodyNote =
          newStatus === 'paid'
            ? `Apresiasi survei Rp1.500 Anda telah disalurkan.${
                payoutReference ? ` Referensi penyaluran: ${payoutReference}.` : ''
              }${adminNotes ? ` Catatan admin: ${adminNotes}` : ''}`
            : `Selamat! Jawaban survei pengalaman Anda telah disetujui admin dan dinyatakan layak menerima apresiasi Rp1.500.${
                adminNotes ? ` Catatan admin: ${adminNotes}` : ''
              }`;
      } else if (newStatus === 'not_eligible') {
        eventType = 'survey_rejected';
        statusLabel = 'Belum Memenuhi Syarat';
        subject = `[Status Survei] ${participationCode} — Belum Memenuhi Syarat`;
        bodyNote = `Alasan / catatan verifikasi: ${
          adminNotes || 'Jawaban survei belum memenuhi ketentuan kelengkapan partisipasi.'
        }`;
      }

      if (!eventType) {
        res.json({ skipped: true });
        return;
      }

      const text = `Halo ${respondentName || 'Peserta'},

Status pengajuan survei pengalaman pelanggan Anda telah diperbarui:

- Kode Partisipasi: ${participationCode}
- Program Survei: ${surveyTitle || 'Survei Pengalaman Pelanggan'}
- Lokasi Bisnis: ${businessName || '-'}
- Status Terbaru: ${statusLabel}

${bodyNote}

Anda dapat memeriksa detail status pengajuan kapan saja melalui halaman Program Partisipasi dengan memasukkan Email dan Kode Partisipasi Anda.

Portal Partisipasi & Layanan Maps
Notifikasi otomatis. Mohon tidak membalas email ini.`;

      const html = `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
        <p>Halo <strong>${escapeHtml(respondentName || 'Peserta')}</strong>,</p>
        <p>Status pengajuan survei pengalaman pelanggan Anda telah diperbarui:</p>
        <ul>
          <li>Kode Partisipasi: <strong>${escapeHtml(participationCode)}</strong></li>
          <li>Program Survei: ${escapeHtml(surveyTitle || 'Survei Pengalaman Pelanggan')}</li>
          <li>Lokasi Bisnis: ${escapeHtml(businessName || '-')}</li>
          <li>Status Terbaru: <strong>${escapeHtml(statusLabel)}</strong></li>
        </ul>
        <p>${escapeHtml(bodyNote)}</p>
        <p>Cek status terbaru Anda melalui halaman Program Partisipasi menggunakan Email dan Kode Partisipasi Anda.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <p style="font-size:12px;color:#64748b">Portal Partisipasi &amp; Layanan Maps · Notifikasi otomatis.</p>
      </div>`;

      const result = await sendSmtpEmail({
        to: respondentEmail,
        subject,
        text,
        html,
      });

      res.json({
        eventType,
        recipientMasked: maskEmailAddress(respondentEmail),
        subject,
        deliveryStatus: result.deliveryStatus,
        statusNote: result.statusNote,
      });
    }
  );

  // Permintaan Bantuan Peserta -> Validasi + Email SMTP ke Admin
  const helpRateMap = new Map<string, { count: number; resetAt: number }>();

  function generateHelpTicketCode(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `HLP-${y}${m}${d}-${suffix}`;
  }

  app.post('/api/participation/help', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const rate = helpRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 5) {
        res.status(429).json({
          error: 'Terlalu banyak permintaan bantuan dari jaringan Anda. Silakan tunggu beberapa menit.',
        });
        return;
      }
      rate.count += 1;
    } else {
      helpRateMap.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      res.status(400).json({ error: 'Permintaan tidak dapat diproses.' });
      return;
    }

    const participantName =
      typeof body.participantName === 'string' ? body.participantName.trim() : '';
    const participantEmail =
      typeof body.participantEmail === 'string' ? body.participantEmail.trim().toLowerCase() : '';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const participationCode =
      typeof body.participationCode === 'string'
        ? body.participationCode.trim().toUpperCase()
        : '';

    if (participantName.length < 2 || participantName.length > 120) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (!isValidEmailFormat(participantEmail) || participantEmail.length > 160) {
      res.status(400).json({ error: 'Masukkan alamat email yang valid.' });
      return;
    }
    if (topic.length < 2 || topic.length > 120) {
      res.status(400).json({ error: 'Pilih atau tuliskan topik bantuan.' });
      return;
    }
    if (message.length < 10 || message.length > 1200) {
      res.status(400).json({ error: 'Jelaskan kendala atau pertanyaan Anda minimal 10 karakter.' });
      return;
    }

    const ticketCode = generateHelpTicketCode();
    const submittedAtLabel = formatIndonesianDateTime(new Date(now));
    const subject = `[Bantuan Peserta] ${ticketCode} — ${topic}`;
    const text = `Halo Admin,

Ada permintaan bantuan dari peserta Portal Partisipasi & Layanan Maps:

- Nomor Tiket: ${ticketCode}
- Nama Peserta: ${participantName}
- Email Peserta: ${participantEmail}
- Kode Partisipasi Terkait: ${participationCode || '-'}
- Topik: ${topic}
- Waktu Pengiriman: ${submittedAtLabel}

Pesan / Pertanyaan:
${message}

Silakan tindak lanjuti melalui email peserta atau panel Riwayat & Aktivitas Admin.`;

    const html = `<div style="font-family:sans-serif;line-height:1.6;color:#0f172a;max-width:600px">
      <p>Halo Admin,</p>
      <p>Ada permintaan bantuan baru dari peserta:</p>
      <ul>
        <li>Nomor Tiket: <strong>${escapeHtml(ticketCode)}</strong></li>
        <li>Nama: ${escapeHtml(participantName)}</li>
        <li>Email: ${escapeHtml(participantEmail)}</li>
        <li>Kode Partisipasi: ${escapeHtml(participationCode || '-')}</li>
        <li>Topik: ${escapeHtml(topic)}</li>
        <li>Waktu: ${escapeHtml(submittedAtLabel)}</li>
      </ul>
      <p><strong>Pesan Peserta:</strong></p>
      <blockquote style="margin:8px 0;padding:12px;background:#f8fafc;border-left:3px solid #0f766e">${escapeHtml(message)}</blockquote>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
      <p style="font-size:12px;color:#64748b">Portal Partisipasi &amp; Layanan Maps · Notifikasi otomatis.</p>
    </div>`;

    const result = await sendSmtpEmail({
      to: ADMIN_NOTIFICATION_EMAIL,
      subject,
      text,
      html,
    });

    res.json({
      ok: true,
      ticketCode,
      submittedAtLabel,
      emailNotification: {
        eventType: 'participant_help_admin',
        recipientMasked: maskEmailAddress(ADMIN_NOTIFICATION_EMAIL),
        subject,
        deliveryStatus: result.deliveryStatus,
        statusNote: result.statusNote,
      },
    });
  });

  // --- Pengunduhan Galeri Foto Aman (Verifikasi Server-Side Izin & Anti-SSRF) ---
  const galleryDownloadRateMap = new Map<string, { count: number; resetAt: number }>();

  function isPrivateOrBlockedHostname(hostname: string): boolean {
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      h === 'localhost' ||
      h === '::1' ||
      h === '0.0.0.0' ||
      h === 'metadata.google.internal' ||
      h.endsWith('.local') ||
      h.endsWith('.internal')
    ) {
      return true;
    }
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) {
      return true;
    }
    const m172 = h.match(/^172\.(\d+)\./);
    if (m172) {
      const second = Number(m172[1]);
      if (second >= 16 && second <= 31) return true;
    }
    if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) {
      return true;
    }
    return false;
  }

  function sanitizeSafeFileName(raw: string, fallback: string, ext: string): string {
    const base = (raw || fallback)
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return `${base || fallback}.${ext}`;
  }

  function inferExtFromContentType(contentType: string, fallbackUrl: string): string {
    const ct = contentType.toLowerCase();
    if (ct.includes('png')) return 'png';
    if (ct.includes('webp')) return 'webp';
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
    const urlClean = fallbackUrl.split('?')[0].toLowerCase();
    if (urlClean.endsWith('.png')) return 'png';
    if (urlClean.endsWith('.webp')) return 'webp';
    return 'jpg';
  }

  async function fetchSafeGalleryImageBytes(
    imageUrl: string
  ): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('/src/assets/')) {
      const assetsRoot = path.resolve(__dirname, 'src', 'assets');
      const relPart = trimmed.slice('/src/assets/'.length);
      const targetPath = path.resolve(assetsRoot, relPart);
      if (!targetPath.startsWith(assetsRoot + path.sep)) {
        throw new Error('Jalur aset gambar tidak valid.');
      }
      const extMatch = targetPath.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);
      if (!extMatch) {
        throw new Error('Format berkas gambar aset tidak didukung.');
      }
      const buffer = await fs.promises.readFile(targetPath);
      const ext = extMatch[1] === 'jpeg' ? 'jpg' : extMatch[1];
      const contentType =
        ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return { buffer, contentType, ext };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('URL gambar tidak valid.');
    }

    if (parsed.protocol !== 'https:' || isPrivateOrBlockedHostname(parsed.hostname)) {
      throw new Error('Sumber URL gambar tidak diizinkan.');
    }

    const fetchRes = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!fetchRes.ok) {
      throw new Error(`Gagal mengambil berkas gambar (HTTP ${fetchRes.status}).`);
    }

    const contentType = fetchRes.headers.get('content-type') || '';
    if (
      !contentType.toLowerCase().startsWith('image/') &&
      !trimmed.includes('firebasestorage.googleapis.com')
    ) {
      throw new Error('Respons server sumber bukan berkas gambar yang valid.');
    }

    const arrayBuf = await fetchRes.arrayBuffer();
    if (arrayBuf.byteLength > 10 * 1024 * 1024) {
      throw new Error('Ukuran gambar melebihi batas maksimum pengunduhan (10 MB).');
    }

    const ext = inferExtFromContentType(contentType, trimmed);
    return {
      buffer: Buffer.from(arrayBuf),
      contentType:
        contentType.toLowerCase().startsWith('image/')
          ? contentType
          : ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg',
      ext,
    };
  }

  async function verifyPermittedGalleryImage(
    businessId: string,
    imageId: string
  ): Promise<{
    businessName: string;
    fileName: string;
    title: string;
    imageUrl: string;
  }> {
    const bizUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      PROJECT_ID
    )}/databases/${encodeURIComponent(DATABASE_ID)}/documents/businesses/${encodeURIComponent(
      businessId
    )}`;
    const bizRes = await fetch(bizUrl);
    if (!bizRes.ok) {
      throw Object.assign(new Error('Lokasi bisnis tidak aktif atau tidak ditemukan.'), {
        statusCode: 404,
      });
    }
    const bizJson = (await bizRes.json()) as {
      fields?: {
        isActive?: { booleanValue?: boolean };
        name?: { stringValue?: string };
      };
    };
    if (bizJson.fields?.isActive?.booleanValue !== true) {
      throw Object.assign(new Error('Lokasi bisnis tidak tersedia.'), { statusCode: 403 });
    }

    const imgUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      PROJECT_ID
    )}/databases/${encodeURIComponent(DATABASE_ID)}/documents/businesses/${encodeURIComponent(
      businessId
    )}/gallery/${encodeURIComponent(imageId)}`;
    const imgRes = await fetch(imgUrl);
    if (imgRes.status === 403 || imgRes.status === 404) {
      throw Object.assign(
        new Error('Foto tidak tersedia atau tidak memiliki izin untuk diakses.'),
        { statusCode: 403 }
      );
    }
    if (!imgRes.ok) {
      throw Object.assign(new Error('Gagal memverifikasi izin foto.'), { statusCode: 502 });
    }

    const imgJson = (await imgRes.json()) as {
      fields?: {
        isActive?: { booleanValue?: boolean };
        usagePermission?: { stringValue?: string };
        imageUrl?: { stringValue?: string };
        fileName?: { stringValue?: string };
        title?: { stringValue?: string };
      };
    };
    const fields = imgJson.fields ?? {};
    const isActive = fields.isActive?.booleanValue === true;
    const permission = fields.usagePermission?.stringValue;

    if (!isActive || permission !== 'download_permitted') {
      throw Object.assign(
        new Error('Foto ini tidak memiliki izin unduh untuk peserta.'),
        { statusCode: 403 }
      );
    }

    const imageUrl = fields.imageUrl?.stringValue || '';
    if (!imageUrl) {
      throw Object.assign(new Error('URL foto tidak tersedia.'), { statusCode: 404 });
    }

    return {
      businessName: bizJson.fields?.name?.stringValue || 'bisnis',
      fileName: fields.fileName?.stringValue || fields.title?.stringValue || imageId,
      title: fields.title?.stringValue || 'foto',
      imageUrl,
    };
  }

  app.get('/api/gallery/download-file/:businessId/:imageId', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const rate = galleryDownloadRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 40) {
        res.status(429).json({ error: 'Terlalu banyak permintaan unduhan. Tunggu sebentar.' });
        return;
      }
      rate.count += 1;
    } else {
      galleryDownloadRateMap.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    }

    const { businessId, imageId } = req.params;
    if (
      !/^[a-zA-Z0-9_-]{1,128}$/.test(businessId || '') ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(imageId || '')
    ) {
      res.status(400).json({ error: 'Parameter foto tidak valid.' });
      return;
    }

    try {
      const verified = await verifyPermittedGalleryImage(businessId, imageId);
      const { buffer, contentType, ext } = await fetchSafeGalleryImageBytes(
        verified.imageUrl
      );
      const safeDownloadName = sanitizeSafeFileName(verified.fileName, 'foto-bisnis', ext);
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeDownloadName}"`
      );
      res.setHeader('Content-Length', String(buffer.byteLength));
      res.send(buffer);
    } catch (err) {
      const status =
        typeof (err as { statusCode?: number }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      res.status(status).json({
        error: err instanceof Error ? err.message : 'Gagal mengunduh foto.',
      });
    }
  });

  app.post('/api/gallery/download-zip', async (req, res) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const rate = galleryDownloadRateMap.get(ip);
    if (rate && rate.resetAt > now) {
      if (rate.count >= 25) {
        res.status(429).json({
          error: 'Terlalu banyak permintaan unduhan ZIP. Silakan tunggu beberapa menit.',
        });
        return;
      }
      rate.count += 1;
    } else {
      galleryDownloadRateMap.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const businessId = typeof body.businessId === 'string' ? body.businessId.trim() : '';
    const rawIds = Array.isArray(body.imageIds) ? body.imageIds : [];

    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(businessId)) {
      res.status(400).json({ error: 'ID bisnis tidak valid.' });
      return;
    }

    const uniqueIds: string[] = [];
    const seen = new Set<string>();
    for (const item of rawIds) {
      if (typeof item === 'string') {
        const clean = item.trim();
        if (/^[a-zA-Z0-9_-]{1,128}$/.test(clean) && !seen.has(clean)) {
          seen.add(clean);
          uniqueIds.push(clean);
        }
      }
    }

    if (uniqueIds.length === 0 || uniqueIds.length > 30) {
      res.status(400).json({
        error: 'Pilih antara 1 hingga 30 foto yang diizinkan untuk diunduh sebagai ZIP.',
      });
      return;
    }

    try {
      const zip = new JSZip();
      const usedFileNames = new Set<string>();
      let businessSlug = 'galeri-bisnis';
      let totalBytes = 0;

      for (const imageId of uniqueIds) {
        const verified = await verifyPermittedGalleryImage(businessId, imageId);
        businessSlug =
          verified.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40) || 'galeri-bisnis';

        const { buffer, ext } = await fetchSafeGalleryImageBytes(verified.imageUrl);
        totalBytes += buffer.byteLength;
        if (totalBytes > 40 * 1024 * 1024) {
          res.status(413).json({
            error: 'Total ukuran arsip ZIP melebihi batas 40 MB. Kurangi jumlah foto terpilih.',
          });
          return;
        }

        let candidateName = sanitizeSafeFileName(verified.fileName, imageId, ext);
        if (usedFileNames.has(candidateName.toLowerCase())) {
          const dotIdx = candidateName.lastIndexOf('.');
          const stem = dotIdx > 0 ? candidateName.slice(0, dotIdx) : candidateName;
          candidateName = `${stem}-${imageId.slice(0, 5)}.${ext}`;
        }
        usedFileNames.add(candidateName.toLowerCase());
        zip.file(candidateName, buffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="galeri-${businessSlug}.zip"`
      );
      res.setHeader('Content-Length', String(zipBuffer.byteLength));
      res.send(zipBuffer);
    } catch (err) {
      const status =
        typeof (err as { statusCode?: number }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      res.status(status).json({
        error: err instanceof Error ? err.message : 'Gagal membuat arsip ZIP galeri.',
      });
    }
  });

  // Semua rute /api/* tidak dikenal harus mengembalikan JSON 404 (bukan HTML)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  });

  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);

  // Vite middleware (dev) atau static dist (prod)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        port: PORT,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Portal Ulasan berjalan di http://0.0.0.0:${PORT}`);
  });
}

void startServer();
