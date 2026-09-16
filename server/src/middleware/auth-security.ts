import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

// Origin + custom header protect login/logout against cross-site request forgery.
export const requireTrustedMutation: RequestHandler = (req, _res, next) => {
  if (
    req.get('origin') !== env.clientUrl ||
    req.get('X-KISTS-Request') !== '1'
  ) {
    throw new HttpError(
      403,
      'This request could not be verified. Reload the page and try again.',
      'UNTRUSTED_REQUEST',
    );
  }
  if (!req.is('application/json'))
    throw new HttpError(
      415,
      'Use application/json for this request.',
      'UNSUPPORTED_MEDIA_TYPE',
    );
  next();
};

export function createLoginLimits() {
  const options = {
    windowMs: 15 * 60 * 1000,
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
      error: {
        message: 'Too many sign-in attempts. Please try again in 15 minutes.',
        code: 'LOGIN_RATE_LIMITED',
      },
    },
  };
  return {
    byIp: rateLimit({ ...options, limit: 30 }),
    byEmail: rateLimit({
      ...options,
      limit: 10,
      keyGenerator: (req) =>
        createHash('sha256')
          .update(String(req.body.email).trim().toLowerCase())
          .digest('hex'),
    }),
  };
}
