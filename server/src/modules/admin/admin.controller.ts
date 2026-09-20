import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { AdminService } from './admin.service.js';
import type { SettingsService } from '../settings/settings.service.js';

export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly settingsService: SettingsService,
  ) {}

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
    const user = req.authenticatedUser as AuthUser;
    res.json(await this.service.updateTrainee(user, Number(req.params.id), req.body));
  };

  traineeAvatar: RequestHandler = async (req, res) => {
    const traineeId = Number(req.params.id);
    if (!(await this.service.traineeExists(traineeId)))
      throw new HttpError(404, 'Trainee account not found.', 'USER_NOT_FOUND');
    const avatar = await this.settingsService.avatar(traineeId);
    res.set({ 'Content-Type': avatar.contentType, 'Cache-Control': 'private, no-cache' }).send(avatar.bytes);
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
