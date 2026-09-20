import express, { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuthentication, requireSystemRole } from '../../middleware/authentication.js';
import { requireTrustedMutation, requireTrustedRequest } from '../../middleware/auth-security.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SystemRole } from '../auth/auth.types.js';
import { SettingsController } from './settings.controller.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';

export function createSettingsRouter(
  database: Pool,
  authService: AuthService,
  role: SystemRole = 'trainee',
) {
  const router = Router();
  const controller = new SettingsController(
    new SettingsService(new SettingsRepository(database)),
    `/api/${role === 'administrator' ? 'admin' : 'trainee'}/settings/avatar`,
  );
  router.use(requireAuthentication(authService), requireSystemRole(role));
  router.get('/avatar', controller.avatar);
  router.post('/avatar', requireTrustedRequest, express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '2mb' }), controller.uploadAvatar);
  router.delete('/avatar', requireTrustedRequest, controller.removeAvatar);
  router.post('/password', requireTrustedMutation, controller.password);
  return router;
}
