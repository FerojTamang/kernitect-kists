import type { RequestHandler } from 'express';
import type { TraineeService } from './trainee.service.js';

export class TraineeController {
  constructor(private readonly service: TraineeService) {}

  dashboard: RequestHandler = async (req, res) => {
    res.json(await this.service.getDashboard(req.authenticatedUser!));
  };
}
