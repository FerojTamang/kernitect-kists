import type { RequestHandler } from 'express';
import {
  clearSessionCookie,
  readSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './auth.cookie.js';
import type { AuthService } from './auth.service.js';
import { validateLogin } from './auth.validation.js';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  login: RequestHandler = async (req, res) => {
    const { user, token, lifetime } = await this.service.login(
      validateLogin(req.body),
      readSessionToken(req),
    );
    res.cookie(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      maxAge: lifetime * 1000,
    });
    res.json({ user });
  };

  logout: RequestHandler = async (req, res) => {
    await this.service.logout(readSessionToken(req));
    clearSessionCookie(res);
    res.status(204).end();
  };

  me: RequestHandler = (req, res) => {
    res.json({ user: req.authenticatedUser });
  };
}
