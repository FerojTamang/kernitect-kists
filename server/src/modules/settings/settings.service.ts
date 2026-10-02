import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../../utils/http-error.js';
import { hashPassword, verifyPassword } from '../auth/auth.password.js';
import type { SettingsRepository } from './settings.repository.js';

const avatarDirectory = fileURLToPath(
  new URL('../../../uploads/avatars/', import.meta.url),
);
const validFilename = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const formats = {
  'image/jpeg': {
    ext: 'jpg',
    valid: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  'image/png': {
    ext: 'png',
    valid: (b: Buffer) =>
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  'image/webp': {
    ext: 'webp',
    valid: (b: Buffer) =>
      b.subarray(0, 4).toString() === 'RIFF' &&
      b.subarray(8, 12).toString() === 'WEBP',
  },
} as const;

export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}
  async updateName(userId: number, input: unknown) {
    const value = input as Record<string, unknown> | null;
    if (typeof value?.fullName !== 'string')
      throw new HttpError(400, 'Enter your full name.', 'INVALID_PROFILE_NAME');
    const fullName = value.fullName.trim().replace(/\s+/g, ' ');
    const separator = fullName.indexOf(' ');
    if (
      separator < 1 ||
      fullName.length > 120 ||
      separator === fullName.length - 1
    )
      throw new HttpError(
        400,
        'Enter a first and last name of no more than 120 characters.',
        'INVALID_PROFILE_NAME',
      );
    await this.repository.updateName(
      userId,
      fullName.slice(0, separator),
      fullName.slice(separator + 1),
    );
  }
  async changePassword(userId: number, input: unknown) {
    const value = input as Record<string, unknown>;
    if (
      typeof value?.currentPassword !== 'string' ||
      typeof value?.newPassword !== 'string'
    )
      throw new HttpError(
        400,
        'Current and new passwords are required.',
        'INVALID_PASSWORD_INPUT',
      );
    const account = await this.repository.account(userId);
    if (
      !account ||
      !(await verifyPassword(value.currentPassword, account.passwordHash))
    )
      throw new HttpError(
        400,
        'The current password is incorrect.',
        'CURRENT_PASSWORD_INCORRECT',
      );
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(value.newPassword);
    } catch {
      throw new HttpError(
        400,
        'New password must contain at least 12 characters and at most 72 UTF-8 bytes.',
        'PASSWORD_POLICY',
      );
    }
    await this.repository.updatePassword(userId, passwordHash);
  }
  async saveAvatar(
    userId: number,
    contentType: string | undefined,
    body: unknown,
  ) {
    const format = formats[contentType as keyof typeof formats];
    const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);
    if (
      !format ||
      bytes.length === 0 ||
      bytes.length > 2 * 1024 * 1024 ||
      !format.valid(bytes)
    )
      throw new HttpError(
        400,
        'Choose a valid JPEG, PNG or WebP image up to 2 MB.',
        'INVALID_AVATAR',
      );
    await mkdir(avatarDirectory, { recursive: true });
    const filename = `${randomBytes(16).toString('hex')}.${format.ext}`;
    const temporary = `${filename}.tmp`;
    await writeFile(`${avatarDirectory}${temporary}`, bytes, { flag: 'wx' });
    await rename(
      `${avatarDirectory}${temporary}`,
      `${avatarDirectory}${filename}`,
    );
    const previous = (await this.repository.account(userId))?.avatarFilename;
    try {
      await this.repository.updateAvatar(userId, filename);
    } catch (error) {
      await unlink(`${avatarDirectory}${filename}`).catch(() => undefined);
      throw error;
    }
    if (previous && validFilename.test(previous))
      await unlink(`${avatarDirectory}${previous}`).catch(() => undefined);
  }
  async removeAvatar(userId: number) {
    const previous = (await this.repository.account(userId))?.avatarFilename;
    await this.repository.updateAvatar(userId, null);
    if (previous && validFilename.test(previous))
      await unlink(`${avatarDirectory}${previous}`).catch(() => undefined);
  }
  async avatar(userId: number) {
    const filename = (await this.repository.account(userId))?.avatarFilename;
    if (!filename || !validFilename.test(filename))
      throw new HttpError(404, 'Profile photo not found.', 'AVATAR_NOT_FOUND');
    const extension = filename.split('.').pop()!;
    return {
      bytes: await readFile(`${avatarDirectory}${filename}`),
      contentType: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
    };
  }
}
