import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readJson, writeJson } from './blob';

const BLOB_KEY = 'password-resets.json';

export const RESET_TTL_MINUTES = 60;

/** One reset email per user per minute — a cheap guard against mailbox flooding. */
const RESEND_COOLDOWN_MS = 60 * 1000;

/** Used/expired records are kept this long so the page can say *why* a link failed. */
const PRUNE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * The blob store is PUBLIC, so this file must never contain anything that grants
 * access on its own. Only the SHA-256 of the token is stored — the raw token exists
 * in exactly two places: the email, and the URL the user clicks.
 */
export interface ResetTokenRecord {
  tokenHash: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

async function loadRecords(): Promise<ResetTokenRecord[]> {
  return readJson<ResetTokenRecord[]>(BLOB_KEY, []);
}

async function saveRecords(records: ResetTokenRecord[]): Promise<void> {
  await writeJson(BLOB_KEY, records);
}

function isLive(r: ResetTokenRecord, now: number): boolean {
  return !r.usedAt && new Date(r.expiresAt).getTime() > now;
}

function prune(records: ResetTokenRecord[], now: number): ResetTokenRecord[] {
  const cutoff = now - PRUNE_GRACE_MS;
  return records.filter(r => new Date(r.expiresAt).getTime() > cutoff);
}

/**
 * Mints a reset token for a user. Returns null when the user already asked within
 * the cooldown window — the caller still reports success so the cooldown is not
 * observable from outside.
 */
export async function createResetToken(
  userId: string,
  email: string
): Promise<{ token: string; expiresAt: string } | null> {
  const now = Date.now();
  const records = prune(await loadRecords(), now);

  const recent = records.find(
    r => r.userId === userId && isLive(r, now) && now - new Date(r.createdAt).getTime() < RESEND_COOLDOWN_MS
  );
  if (recent) return null;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(now + RESET_TTL_MINUTES * 60 * 1000).toISOString();

  records.push({
    tokenHash: hashToken(token),
    userId,
    email,
    createdAt: new Date(now).toISOString(),
    expiresAt,
  });
  await saveRecords(records);

  return { token, expiresAt };
}

export type ResetLookup =
  | { valid: true; record: ResetTokenRecord }
  | { valid: false; reason: 'unknown' | 'used' | 'expired' };

export async function lookupResetToken(token: string): Promise<ResetLookup> {
  const now = Date.now();
  const hash = hashToken(token);
  const records = await loadRecords();

  const record = records.find(r => safeEqualHex(r.tokenHash, hash));
  if (!record) return { valid: false, reason: 'unknown' };
  if (record.usedAt) return { valid: false, reason: 'used' };
  if (new Date(record.expiresAt).getTime() <= now) return { valid: false, reason: 'expired' };

  return { valid: true, record };
}

/**
 * Burns every outstanding token for a user, not just the one that was redeemed —
 * a second reset email sitting in the inbox must not still work afterwards.
 */
export async function consumeResetTokensForUser(userId: string): Promise<void> {
  const now = Date.now();
  const records = prune(await loadRecords(), now);
  const stamp = new Date(now).toISOString();

  for (const r of records) {
    if (r.userId === userId && !r.usedAt) r.usedAt = stamp;
  }

  await saveRecords(records);
}

/**
 * Absolute base URL for links that leave the app. Prefers explicit config, then the
 * host Vercel reports, and only falls back to the request's own Host header — which
 * a caller can set, so it is the last resort rather than the first choice.
 */
export function getAppBaseUrl(req: Request): string {
  const explicit = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return `https://${vercelHost}`;

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || '';
  return host ? `${proto}://${host}` : '';
}
