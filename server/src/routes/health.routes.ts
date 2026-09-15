import { Router } from 'express';

export const healthRouter = Router();

// Liveness only: this deliberately does not claim that PostgreSQL is ready.
healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'KISTS API' });
});
