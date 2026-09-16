import { Router } from 'express';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import type { AuthService } from '../auth/auth.service.js';
import { TrainingController } from './training.controller.js';
import { TrainingRepository } from './training.repository.js';
import { TrainingService } from './training.service.js';
import type { Pool } from 'pg';

export function createTrainingRouter(
  database: Pick<Pool, 'query'>,
  authService: AuthService,
) {
  const router = Router();
  const controller = new TrainingController(
    new TrainingService(new TrainingRepository(database)),
  );

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuthentication(authService), requireSystemRole('trainee'));
  router.get('/:assignmentId', controller.detail);
  router.post(
    '/:assignmentId/content/:contentId/complete',
    controller.completeContent,
  );

  return router;
}
