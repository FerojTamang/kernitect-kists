import type { RequestHandler } from 'express';
import { HttpError } from '../../utils/http-error.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { CertificateService } from './certificate.service.js';

export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  status: RequestHandler = async (req, res) => {
    const user = req.authenticatedUser as AuthUser | undefined;
    if (!user) {
      throw new HttpError(401, 'Please sign in to continue.', 'AUTH_REQUIRED');
    }

    res.json(await this.service.status(user.id));
  };
}
