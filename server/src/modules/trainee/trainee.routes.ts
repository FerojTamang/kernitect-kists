import { Router } from 'express';
import {
  requireAuthentication,
  requireSystemRole,
} from '../../middleware/authentication.js';
import type { AuthService } from '../auth/auth.service.js';
import { TraineeController } from './trainee.controller.js';
import { TraineeRepository } from './trainee.repository.js';
import { TraineeService } from './trainee.service.js';
import type { Pool } from 'pg';

export function createTraineeRouter(
  database: Pick<Pool, 'query'>,
  authService: AuthService,
) {
  const router = Router();
  const controller = new TraineeController(
    new TraineeService(new TraineeRepository(database)),
  );
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(requireAuthentication(authService), requireSystemRole('trainee'));
  router.get('/dashboard', controller.dashboard);
  return router;
}
