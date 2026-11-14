import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TTL_DAYS = 7;
const REMEMBER_REFRESH_TTL_DAYS = 30;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to start the backend');
  }
  return secret;
}

export interface AccessTokenPayload {
  sub: string;
  role: 'USER' | 'ADMIN';
  verified: boolean;
}

export function createAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(
    { role: payload.role, verified: payload.verified },
    getJwtSecret(),
    { subject: payload.sub, expiresIn: ACCESS_TOKEN_TTL_SECONDS }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  const role = payload.role;
  if (role !== 'USER' && role !== 'ADMIN') {
    throw new Error('Invalid token role');
  }
  return { sub: payload.sub, role, verified: Boolean(payload.verified) };
}

export function tokenHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function refreshTokenExpiry(rememberMe: boolean): Date {
  const days = rememberMe ? REMEMBER_REFRESH_TTL_DAYS : DEFAULT_REFRESH_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function verificationTokenExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

export function passwordResetTokenExpiry(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

export function passwordStrongEnough(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export const AUTH_COOKIE_NAME = 'thniyti_refresh';
export const CSRF_COOKIE_NAME = 'thniyti_csrf';
export const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;
