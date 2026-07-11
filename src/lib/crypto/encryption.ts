import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

export function encrypt(plaintext: Buffer, key: Buffer): EncryptedData {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: encrypted, iv, tag };
}

export function decrypt(data: EncryptedData, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }
  const decipher = createDecipheriv(ALGORITHM, key, data.iv);
  decipher.setAuthTag(data.tag);
  return Buffer.concat([decipher.update(data.ciphertext), decipher.final()]);
}

export function encryptToBuffer(plaintext: Buffer, key: Buffer): Buffer {
  const { ciphertext, iv, tag } = encrypt(plaintext, key);
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptFromBuffer(data: Buffer, key: Buffer): Buffer {
  if (data.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Data too short");
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  return decrypt({ ciphertext, iv, tag }, key);
}

export function generateEncryptionKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}
