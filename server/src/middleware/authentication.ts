import type { RequestHandler } from 'express';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { SystemRole } from '../modules/auth/auth.types.js';
import {
  clearSessionCookie,
  readSessionToken,
} from '../modules/auth/auth.cookie.js';
import { HttpError } from '../utils/http-error.js';

export function requireAuthentication(service: AuthService): RequestHandler {
  return async (req, res, next) => {
    const token = readSessionToken(req);
    const user = await service.authenticate(token);
    if (!user) {
      clearSessionCookie(res);
      throw new HttpError(
        401,
        token
          ? 'Your session has expired. Please sign in again.'
          : 'Please sign in to continue.',
        token ? 'SESSION_EXPIRED' : 'AUTH_REQUIRED',
      );
    }
    req.authenticatedUser = user;
    next();
  };
}

export function requireSystemRole(...roles: SystemRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.authenticatedUser)
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    if (!roles.includes(req.authenticatedUser.systemRole))
      throw new HttpError(
        403,
        'You do not have access to this workspace.',
        'FORBIDDEN',
      );
    next();
  };
}
