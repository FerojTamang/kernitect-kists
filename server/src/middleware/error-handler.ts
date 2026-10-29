import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof HttpError) {
    res
      .status(error.status)
      .json({ error: { message: error.message, code: error.code } });
    return;
  }
  const candidate =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
  const status =
    typeof candidate === 'number' &&
    Number.isInteger(candidate) &&
    candidate >= 400 &&
    candidate < 500
      ? candidate
      : 500;
  if (status === 500) {
  const safeError =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { errorType: typeof error };

  console.error('Unexpected request error:', safeError);
}
  const message =
    status === 413
      ? 'Request body too large'
      : status < 500
        ? 'Invalid request'
        : 'Internal server error';
  res.status(status).json({ error: { message } });
};

