import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { verifyPassword } from './auth.password.js';
import { AuthRepository } from './auth.repository.js';
import type { LoginInput } from './auth.types.js';

export const SESSION_SECONDS = 8 * 60 * 60;
export const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export const isSessionToken = (token: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(token);

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async login(input: LoginInput, previousToken?: string) {
    const credentials = await this.repository.findCredentials(input.email);
    const passwordMatches = await verifyPassword(
      input.password,
      credentials?.passwordHash,
    );
    const rejected = () =>
      new HttpError(
        401,
        'Email or password is incorrect, or your account is unavailable. Contact your administrator if you need help.',
        'INVALID_CREDENTIALS',
      );
    if (!passwordMatches || !credentials?.isActive) throw rejected();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const lifetime = input.rememberMe ? REMEMBER_SECONDS : SESSION_SECONDS;
    if (
      !(await this.repository.createSession(
        credentials.id,
        credentials.passwordHash,
        tokenHash,
        lifetime,
        previousToken && isSessionToken(previousToken)
          ? hashToken(previousToken)
          : null,
      ))
    )
      throw rejected();
    const user = await this.repository.findSessionUser(tokenHash);
    if (!user) throw rejected();
    return { user, token, lifetime };
  }

  async authenticate(token?: string) {
    if (!token || !isSessionToken(token)) return undefined;
    return this.repository.findSessionUser(hashToken(token));
  }

  async logout(token?: string): Promise<void> {
    if (token && isSessionToken(token))
      await this.repository.revokeSession(hashToken(token));
  }
}
