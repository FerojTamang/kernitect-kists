import { Router } from 'express';
import type { Pool } from 'pg';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import { requireTrustedMutation } from '../../middleware/auth-security.js';
import type { AuthService } from '../auth/auth.service.js';
import { ScenarioController } from './scenario.controller.js';
import { ScenarioRepository } from './scenario.repository.js';
import { ScenarioService } from './scenario.service.js';

export function createScenarioRouter(
  database: Pick<Pool, 'query'>,
  authService: AuthService,
) {
  const router = Router();
  const controller = new ScenarioController(
    new ScenarioService(new ScenarioRepository(database)),
  );

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuthentication(authService), requireSystemRole('trainee'));
  router.get('/:assignmentId/scenario', controller.detail);
  router.post(
    '/:assignmentId/scenario/hazards/:hazardId/respond',
    requireTrustedMutation,
    controller.answerHazard,
  );
  return router;
}
