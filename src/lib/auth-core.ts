import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import { forbidden, unauthorized, AppError } from "./errors";
import { isAtLeastRole, type Role } from "./constants";

// ------------------------------------------------------------------
// Password hashing (scrypt, per-password salt, constant-time compare)
// ------------------------------------------------------------------

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SCRYPT_MAXMEM = 128 * 1024 * 1024;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, keyHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scryptCb(
      password,
      salt,
      expected.length,
      { N, r, p, maxmem: SCRYPT_MAXMEM },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// ------------------------------------------------------------------
// Token hashing. Raw tokens are only ever sent to the client; the database
// stores an HMAC of the token, keyed with a server-side pepper. A database
// leak therefore does not expose usable session or reset tokens.
// ------------------------------------------------------------------

function pepper(): string {
  const value = process.env.SESSION_PEPPER;
  if (!value || value.length < 16) {
    throw new Error(
      "SESSION_PEPPER is missing or too short. Set a 32+ byte random value in .env.",
    );
  }
  return value;
}

export function hashToken(token: string): string {
  return createHmac("sha256", pepper()).update(token).digest("hex");
}

export const SESSION_COOKIE = "rf_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  state: string | null;
  timezone: string;
  emailVerifiedAt: Date | null;
  status: string;
  isDemo: boolean;
};

export type AuthContext = {
  user: SessionUser;
  sessionId: string;
  token: string;
};

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });
  return { token, sessionId: session.id, expiresAt };
}

export async function getAuthFromToken(token: string): Promise<AuthContext | null> {
  if (!token || token.length < 32) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  if (session.user.status !== "ACTIVE") return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }
  return {
    sessionId: session.id,
    token,
    user: {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      displayName: session.user.displayName,
      role: session.user.role,
      state: session.user.state,
      timezone: session.user.timezone,
      emailVerifiedAt: session.user.emailVerifiedAt,
      status: session.user.status,
      isDemo: session.user.isDemo,
    },
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function requireRole(user: SessionUser, min: Role): void {
  if (!isAtLeastRole(user.role, min)) {
    throw forbidden();
  }
}

export function assertAuthenticated(ctx: AuthContext | null): asserts ctx is AuthContext {
  if (!ctx) throw unauthorized();
}

export function assertEmailVerified(user: SessionUser): void {
  if (!user.emailVerifiedAt) {
    throw new AppError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email address before continuing.",
    );
  }
}

// ------------------------------------------------------------------
// Single-use token helpers (email verification, password reset)
// ------------------------------------------------------------------

export async function issueEmailVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
    },
  });
  return token;
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 min
    },
  });
  return token;
}

export const devExposeTokens = () => process.env.AUTH_DEV_EXPOSE_TOKENS === "true";
export const autoVerifyEmail = () => process.env.AUTH_AUTO_VERIFY_EMAIL === "true";
