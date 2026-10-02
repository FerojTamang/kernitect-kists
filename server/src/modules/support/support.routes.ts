import { Router } from 'express';
import type { Pool } from 'pg';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import { requireTrustedMutation } from '../../middleware/auth-security.js';
import type { AuthService } from '../auth/auth.service.js';
import { SupportController } from './support.controller.js';
import { SupportRepository } from './support.repository.js';
import { SupportService } from './support.service.js';

function controller(database: Pick<Pool, 'query'>) {
  return new SupportController(
    new SupportService(new SupportRepository(database)),
  );
}

export function createTraineeSupportRouter(
  database: Pick<Pool, 'query'>,
  authService: AuthService,
) {
  const router = Router();
  const support = controller(database);
  router.use(requireAuthentication(authService), requireSystemRole('trainee'));
  router.get('/messages', support.listOwn);
  router.post('/messages', requireTrustedMutation, support.create);
  router.get('/notifications', support.traineeNotifications);
  router.post(
    '/notifications/:messageId/read',
    requireTrustedMutation,
    support.markTraineeNotificationRead,
  );
  return router;
}

export function createAdminSupportRouter(
  database: Pick<Pool, 'query'>,
  authService: AuthService,
) {
  const router = Router();
  const support = controller(database);
  router.use(
    requireAuthentication(authService),
    requireSystemRole('administrator'),
  );
  router.get('/messages', support.list);
  router.get('/notifications', support.adminNotifications);
  router.post(
    '/notifications/:messageId/read',
    requireTrustedMutation,
    support.markAdminNotificationRead,
  );
  router.patch(
    '/messages/:messageId/response',
    requireTrustedMutation,
    support.saveResponse,
  );
  router.patch(
    '/messages/:messageId/status',
    requireTrustedMutation,
    support.updateStatus,
  );
  return router;
}
