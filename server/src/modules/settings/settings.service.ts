
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { hashPassword, verifyPassword } from '../auth/auth.password.js';
import type { SettingsRepository } from './settings.repository.js';

const bucket = 'avatars';
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

  private storageUrl(filename: string) {
    return new URL(
      `/storage/v1/object/${bucket}/${filename}`,
      `${env.supabaseUrl}/`,
    );
  }

  private storageHeaders(
    contentType?: string,
  ): Record<string, string> {
    return {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    };
  }

  private async deleteStoredAvatar(filename: string) {
    if (!validFilename.test(filename)) return;

    // Supabase deletes objects through the bucket endpoint using prefixes.
    const response = await fetch(
      new URL(
        `/storage/v1/object/${bucket}`,
        `${env.supabaseUrl}/`,
      ),
      {
        method: 'DELETE',
        headers: this.storageHeaders('application/json'),
        body: JSON.stringify({ prefixes: [filename] }),
      },
    );

    if (!response.ok && response.status !== 404) {
      throw new Error('Could not delete stored avatar');
    }
  }

  async updateName(userId: number, input: unknown) {
    const value = input as Record<string, unknown> | null;

    if (typeof value?.fullName !== 'string') {
      throw new HttpError(
        400,
        'Enter your full name.',
        'INVALID_PROFILE_NAME',
      );
    }

    const fullName = value.fullName.trim().replace(/\s+/g, ' ');
    const separator = fullName.indexOf(' ');

    if (
      separator < 1 ||
      fullName.length > 120 ||
      separator === fullName.length - 1
    ) {
      throw new HttpError(
        400,
        'Enter a first and last name of no more than 120 characters.',
        'INVALID_PROFILE_NAME',
      );
    }

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
    ) {
      throw new HttpError(
        400,
        'Current and new passwords are required.',
        'INVALID_PASSWORD_INPUT',
      );
    }

    const account = await this.repository.account(userId);

    if (
      !account ||
      !(await verifyPassword(value.currentPassword, account.passwordHash))
    ) {
      throw new HttpError(
        400,
        'The current password is incorrect.',
        'CURRENT_PASSWORD_INCORRECT',
      );
    }

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
    ) {
      throw new HttpError(
        400,
        'Choose a valid JPEG, PNG or WebP image up to 2 MB.',
        'INVALID_AVATAR',
      );
    }

    const filename = `${randomBytes(16).toString('hex')}.${format.ext}`;
    const previous = (await this.repository.account(userId))?.avatarFilename;

    let upload: Response;

    try {
      upload = await fetch(this.storageUrl(filename), {
        method: 'POST',
        headers: {
          ...this.storageHeaders(contentType),
          'x-upsert': 'false',
        },
        body: new Uint8Array(bytes),
      });
    } catch {
      throw new HttpError(
        502,
        'Profile photo storage is unavailable. Please try again.',
        'AVATAR_STORAGE_ERROR',
      );
    }

    if (!upload.ok) {
      throw new HttpError(
        502,
        'Profile photo could not be saved. Please try again.',
        'AVATAR_STORAGE_ERROR',
      );
    }

    try {
      await this.repository.updateAvatar(userId, filename);
    } catch (error) {
      await this.deleteStoredAvatar(filename).catch(() => undefined);
      throw error;
    }

    if (
      previous &&
      validFilename.test(previous) &&
      previous !== filename
    ) {
      await this.deleteStoredAvatar(previous).catch(() => undefined);
    }
  }

  async removeAvatar(userId: number) {
    const previous = (await this.repository.account(userId))?.avatarFilename;

    await this.repository.updateAvatar(userId, null);

    if (previous && validFilename.test(previous)) {
      await this.deleteStoredAvatar(previous).catch(() => undefined);
    }
  }

  async avatar(userId: number) {
    const filename = (await this.repository.account(userId))?.avatarFilename;

    if (!filename || !validFilename.test(filename)) {
      throw new HttpError(
        404,
        'Profile photo not found.',
        'AVATAR_NOT_FOUND',
      );
    }

    let response: Response;

    try {
      response = await fetch(this.storageUrl(filename), {
        headers: this.storageHeaders(),
      });
    } catch {
      throw new HttpError(
        502,
        'Profile photo storage is unavailable. Please try again.',
        'AVATAR_STORAGE_ERROR',
      );
    }

    if (response.status === 404) {
      throw new HttpError(
        404,
        'Profile photo not found.',
        'AVATAR_NOT_FOUND',
      );
    }

    if (!response.ok) {
      throw new HttpError(
        502,
        'Profile photo could not be retrieved. Please try again.',
        'AVATAR_STORAGE_ERROR',
      );
    }

    const extension = filename.split('.').pop()!;

    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType:
        extension === 'jpg' ? 'image/jpeg' : `image/${extension}`,
    };
  }
}
