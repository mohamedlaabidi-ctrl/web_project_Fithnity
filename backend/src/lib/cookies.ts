import { Request, Response } from 'express';
import { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } from './authTokens.js';

export function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return {};
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, cookie) => {
      const [name, ...rest] = cookie.split('=');
      if (!name || rest.length === 0) return acc;
      acc[name] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
}

function cookieBase(isProduction: boolean): string[] {
  return [
    'Path=/',
    'HttpOnly',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    ...(isProduction ? ['Secure'] : []),
  ];
}

export function setAuthCookies(
  res: Response,
  refreshToken: string,
  csrfToken: string,
  expiresAt: Date,
  isProduction: boolean
): void {
  const refresh = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    ...cookieBase(isProduction),
    `Expires=${expiresAt.toUTCString()}`,
  ].join('; ');

  const csrf = [
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}`,
    'Path=/',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    ...(isProduction ? ['Secure'] : []),
    `Expires=${expiresAt.toUTCString()}`,
  ].join('; ');

  res.append('Set-Cookie', refresh);
  res.append('Set-Cookie', csrf);
}

export function clearAuthCookies(res: Response, isProduction: boolean): void {
  const expires = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const refresh = [`${AUTH_COOKIE_NAME}=`, ...cookieBase(isProduction), expires].join('; ');
  const csrf = [
    `${CSRF_COOKIE_NAME}=`,
    'Path=/',
    `SameSite=${isProduction ? 'Strict' : 'Lax'}`,
    ...(isProduction ? ['Secure'] : []),
    expires,
  ].join('; ');
  res.append('Set-Cookie', refresh);
  res.append('Set-Cookie', csrf);
}
