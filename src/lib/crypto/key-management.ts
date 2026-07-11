import { createHmac, randomBytes } from "crypto";
import { encryptToBuffer, decryptFromBuffer, generateEncryptionKey } from "./encryption";

export interface IKeyManagementService {
  generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: Buffer }>;
  decryptDataKey(ciphertextDataKey: Buffer): Promise<Buffer>;
  encryptDataKey(plaintextDataKey: Buffer): Promise<Buffer>;
  getKeyVersion(): Promise<string>;
}

export class LocalKms implements IKeyManagementService {
  private masterKey: Buffer;
  private keyVersion: string;

  constructor(masterKeyHex?: string, keyVersion?: string) {
    const hex = masterKeyHex || process.env.ENCRYPTION_MASTER_KEY;
    if (!hex) {
      throw new Error("ENCRYPTION_MASTER_KEY environment variable is required");
    }
    this.masterKey = Buffer.from(hex, "hex");
    if (this.masterKey.length !== 32) {
      throw new Error("ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)");
    }
    this.keyVersion = keyVersion || process.env.ENCRYPTION_KEY_VERSION || "v1";
  }

  async generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: Buffer }> {
    const plaintext = generateEncryptionKey();
    const ciphertext = await this.encryptDataKey(plaintext);
    return { plaintext, ciphertext };
  }

  async decryptDataKey(ciphertextDataKey: Buffer): Promise<Buffer> {
    return decryptFromBuffer(ciphertextDataKey, this.masterKey);
  }

  async encryptDataKey(plaintextDataKey: Buffer): Promise<Buffer> {
    return encryptToBuffer(plaintextDataKey, this.masterKey);
  }

  async getKeyVersion(): Promise<string> {
    return this.keyVersion;
  }
}

let kmsInstance: IKeyManagementService | null = null;

export function getKeyManagementService(): IKeyManagementService {
  if (!kmsInstance) {
    kmsInstance = new LocalKms();
  }
  return kmsInstance;
}
