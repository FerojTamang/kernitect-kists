import type { ErrorRequestHandler, RequestHandler } from 'express';

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
  if (status === 500) console.error('An unexpected request error occurred.');
  const message =
    status === 413
      ? 'Request body too large'
      : status < 500
        ? 'Invalid request'
        : 'Internal server error';
  res.status(status).json({ error: { message } });
};
