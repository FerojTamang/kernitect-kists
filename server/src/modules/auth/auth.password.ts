import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

export const PASSWORD_COST = 12;
const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), PASSWORD_COST);

export async function verifyPassword(
  password: string,
  passwordHash?: string,
): Promise<boolean> {
  const supported =
    typeof passwordHash === 'string' &&
    /^\$2[ab]\$\d\d\$[./A-Za-z0-9]{53}$/.test(passwordHash);
  const matched = await bcrypt.compare(
    password,
    supported ? passwordHash : await dummyHash,
  );
  return supported && matched;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error(
      'Development passwords must contain at least 12 characters and at most 72 UTF-8 bytes.',
    );
  }
  return bcrypt.hash(password, PASSWORD_COST);
}
