import { HttpError } from '../../utils/http-error.js';
import type { LoginInput } from './auth.types.js';

export function validateLogin(body: unknown): LoginInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(
      400,
      'Enter a valid email address and password.',
      'INVALID_LOGIN_INPUT',
    );
  }
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) => !['email', 'password', 'rememberMe'].includes(key),
    ) ||
    typeof value.email !== 'string' ||
    value.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()) ||
    typeof value.password !== 'string' ||
    value.password.length === 0 ||
    Buffer.byteLength(value.password, 'utf8') > 72 ||
    (value.rememberMe !== undefined && typeof value.rememberMe !== 'boolean')
  ) {
    throw new HttpError(
      400,
      'Enter a valid email address and password (maximum 72 UTF-8 bytes).',
      'INVALID_LOGIN_INPUT',
    );
  }
  return {
    email: value.email.trim().toLowerCase(),
    password: value.password,
    rememberMe: value.rememberMe === true,
  };
}
