import { Router } from 'express';
import type { Pool } from 'pg';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import { requireTrustedMutation } from '../../middleware/auth-security.js';
import type { AuthService } from '../auth/auth.service.js';
import { AssessmentController } from './assessment.controller.js';
import { AssessmentRepository } from './assessment.repository.js';
import { AssessmentService } from './assessment.service.js';

export function createAssessmentRouter(
  database: Pool,
  authService: AuthService,
) {
  const router = Router();
  const controller = new AssessmentController(
    new AssessmentService(new AssessmentRepository(database)),
  );

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.use(requireAuthentication(authService), requireSystemRole('trainee'));

  router.get('/:assignmentId/assessment', controller.detail);
  router.post(
    '/:assignmentId/assessment/submit',
    requireTrustedMutation,
    controller.submit,
  );

  return router;
}
