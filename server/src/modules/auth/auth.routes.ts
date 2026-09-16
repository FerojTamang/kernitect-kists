import { Router } from 'express';
import { requireAuthentication } from '../../middleware/authentication.js';
import {
  createLoginLimits,
  requireTrustedMutation,
} from '../../middleware/auth-security.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { validateLogin } from './auth.validation.js';

export function createAuthRouter(service: AuthService) {
  const router = Router();
  const controller = new AuthController(service);
  const limits = createLoginLimits();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/login',
    requireTrustedMutation,
    limits.byIp,
    (req, _res, next) => {
      validateLogin(req.body);
      next();
    },
    limits.byEmail,
    controller.login,
  );
  router.post('/logout', requireTrustedMutation, controller.logout);
  router.get('/me', requireAuthentication(service), controller.me);
  return router;
}
