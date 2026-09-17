import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { AdminService } from './admin.service.js';

export class AdminController {
  constructor(private readonly service: AdminService) {}

  dashboard: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }

    res.json(await this.service.dashboard(user));
  };

  users: RequestHandler = async (_req, res) => {
    res.json(await this.service.users());
  };

  createTrainee: RequestHandler = async (req, res) => {
    const result = await this.service.createTrainee(req.body);
    res.status(201).json(result);
  };

  updateTrainee: RequestHandler = async (req, res) => {
    res.json(await this.service.updateTrainee(Number(req.params.id), req.body));
  };

  assignments: RequestHandler = async (_req, res) => {
    res.json(await this.service.assignments());
  };

  progress: RequestHandler = async (_req, res) => {
    res.json(await this.service.progress());
  };

  createAssignment: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }

    const result = await this.service.createAssignment(user, req.body);
    res.status(201).json(result);
  };
}
