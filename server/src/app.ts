import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Pool } from 'pg';
import { pool } from './config/database.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createTraineeRouter } from './modules/trainee/trainee.routes.js';
import { createTrainingRouter } from './modules/training/training.routes.js';
import { createScenarioRouter } from './modules/scenarios/scenario.routes.js';
import { createAssessmentRouter } from './modules/assessments/assessment.routes.js';
import { createCertificateRouter } from './modules/certificates/certificate.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import {
  createAdminSupportRouter,
  createTraineeSupportRouter,
} from './modules/support/support.routes.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

export function createApp(database: Pool = pool) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || origin === env.clientUrl),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  const authService = new AuthService(new AuthRepository(database));

  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/trainee', createTraineeRouter(database, authService));
  app.use(
    '/api/trainee/support',
    createTraineeSupportRouter(database, authService),
  );
  app.use('/api/trainee/settings', createSettingsRouter(database, authService));
  app.use(
    '/api/admin/settings',
    createSettingsRouter(database, authService, 'administrator'),
  );
  app.use('/api/trainee/training', createTrainingRouter(database, authService));
  app.use('/api/trainee/training', createScenarioRouter(database, authService));
  app.use(
    '/api/trainee/training',
    createAssessmentRouter(database, authService),
  );
  app.use(
    '/api/trainee/certificates',
    createCertificateRouter(database, authService),
  );
  app.use('/api/admin', createAdminRouter(database, authService));
  app.use(
    '/api/admin/support',
    createAdminSupportRouter(database, authService),
  );
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
