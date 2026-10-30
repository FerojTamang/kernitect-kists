import bcrypt from 'bcryptjs';

const password = process.env.KISTS_ADMIN_PASSWORD;

if (!password) {
  console.error('Missing password input.');
  process.exitCode = 1;
} else if (
  password.length < 12 ||
  Buffer.byteLength(password, 'utf8') > 72
) {
  console.error('Password must be 12–72 UTF-8 bytes.');
  process.exitCode = 1;
} else {
  console.log('BCRYPT_HASH=' + await bcrypt.hash(password, 12));
}