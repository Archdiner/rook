import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getKey(): Buffer {
  const hex = process.env.ZYBIT_SECRET_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ZYBIT_SECRET_KEY must be a 64-char hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  return Buffer.from(hex, 'hex');
}

/** AES-256-GCM encrypt. Returns `iv:authTag:ciphertext` (all hex). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** AES-256-GCM decrypt. Throws on tampered ciphertext or wrong key. */
export function decryptSecret(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format');
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
