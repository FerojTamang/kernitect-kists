import { Router } from 'express';
import type { Pool } from 'pg';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import type { AuthService } from '../auth/auth.service.js';
import { CertificateController } from './certificate.controller.js';
import { CertificateRepository } from './certificate.repository.js';
import { CertificateService } from './certificate.service.js';

export function createCertificateRouter(
  database: Pool,
  authService: AuthService,
) {
  const router = Router();
  const controller = new CertificateController(
    new CertificateService(new CertificateRepository(database)),
  );

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuthentication(authService), requireSystemRole('trainee'));
  router.get('/', controller.status);

  return router;
}
