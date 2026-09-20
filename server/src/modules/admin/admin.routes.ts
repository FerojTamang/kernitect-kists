import { Router } from 'express';
import type { Pool } from 'pg';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import type { AuthService } from '../auth/auth.service.js';
import { requireTrustedMutation } from '../../middleware/auth-security.js';
import { AdminController } from './admin.controller.js';
import { AdminRepository } from './admin.repository.js';
import { AdminService } from './admin.service.js';
import { SettingsRepository } from '../settings/settings.repository.js';
import { SettingsService } from '../settings/settings.service.js';
import { CertificateIssuanceService } from '../certificates/certificate-issuance.service.js';

export function createAdminRouter(
  database: Pick<Pool, 'query'>,
  authService: AuthService,
) {
  const router = Router();
  const controller = new AdminController(
    new AdminService(
      new AdminRepository(database),
      new CertificateIssuanceService(database),
    ),
    new SettingsService(new SettingsRepository(database)),
  );

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.use(
    requireAuthentication(authService),
    requireSystemRole('administrator'),
  );

  router.get('/dashboard', controller.dashboard);
  router.get('/users', controller.users);
  router.get('/users/:id/avatar', controller.traineeAvatar);
  router.post('/users', requireTrustedMutation, controller.createTrainee);
  router.patch('/users/:id', requireTrustedMutation, controller.updateTrainee);
  router.get('/assignments', controller.assignments);
  router.get('/progress', controller.progress);
  router.post(
    '/assignments',
    requireTrustedMutation,
    controller.createAssignment,
  );

  return router;
}
