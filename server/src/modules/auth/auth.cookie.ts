import type { CookieOptions, Request, Response } from 'express';
import { parseCookie } from 'cookie';
import { env } from '../../config/env.js';

export const SESSION_COOKIE = 'kists_session';
export const sessionCookieOptions = (
  production = env.cookieSecure,
): CookieOptions => ({
  httpOnly: true,
  secure: production,
  sameSite: 'lax',
  path: '/',
});
export function readSessionToken(request: Request): string | undefined {
  return parseCookie(request.headers.cookie ?? '')[SESSION_COOKIE];
}
export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
}
