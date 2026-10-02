import type { RequestHandler } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import type { SettingsService } from './settings.service.js';

export class SettingsController {
  constructor(
    private readonly service: SettingsService,
    private readonly avatarUrl: string,
  ) {}
  updateName: RequestHandler = async (req, res) => {
    await this.service.updateName(
      (req.authenticatedUser as AuthUser).id,
      req.body,
    );
    res.status(204).end();
  };
  password: RequestHandler = async (req, res) => {
    await this.service.changePassword(
      (req.authenticatedUser as AuthUser).id,
      req.body,
    );
    res.status(204).end();
  };
  uploadAvatar: RequestHandler = async (req, res) => {
    await this.service.saveAvatar(
      (req.authenticatedUser as AuthUser).id,
      req.get('content-type'),
      req.body,
    );
    res.json({ avatarUrl: `${this.avatarUrl}?v=${Date.now()}` });
  };
  removeAvatar: RequestHandler = async (req, res) => {
    await this.service.removeAvatar((req.authenticatedUser as AuthUser).id);
    res.status(204).end();
  };
  avatar: RequestHandler = async (req, res) => {
    const avatar = await this.service.avatar(
      (req.authenticatedUser as AuthUser).id,
    );
    res
      .set({
        'Content-Type': avatar.contentType,
        'Cache-Control': 'private, no-cache',
      })
      .send(avatar.bytes);
  };
}
