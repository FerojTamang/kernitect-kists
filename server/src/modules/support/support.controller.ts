import type { RequestHandler } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import type { SupportService } from './support.service.js';

export class SupportController {
  constructor(private readonly service: SupportService) {}

  create: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser;
    res.status(201).json(await this.service.create(user.id, req.body));
  };

  list: RequestHandler = async (_req, res) => {
    res.json(await this.service.list());
  };

  listOwn: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser;
    res.json(await this.service.listForTrainee(user.id));
  };

  adminNotifications: RequestHandler = async (_req, res) => {
    res.json(await this.service.adminNotifications());
  };

  traineeNotifications: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser;
    res.json(await this.service.traineeNotifications(user.id));
  };

  markAdminNotificationRead: RequestHandler = async (req, res) => {
    await this.service.markAdminNotificationRead(Number(req.params.messageId));
    res.status(204).end();
  };

  markTraineeNotificationRead: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser;
    await this.service.markTraineeNotificationRead(
      Number(req.params.messageId),
      user.id,
      req.body?.respondedAt,
    );
    res.status(204).end();
  };

  saveResponse: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser;
    res.json(
      await this.service.saveResponse(
        Number(req.params.messageId),
        user.id,
        req.body,
      ),
    );
  };

  updateStatus: RequestHandler = async (req, res) => {
    res.json(
      await this.service.updateStatus(Number(req.params.messageId), req.body),
    );
  };
}
