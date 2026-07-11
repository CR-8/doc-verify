import { v2 as cloudinary } from "cloudinary";
import { siteConfig } from "@/config/site";
import { getKeyManagementService } from "@/lib/crypto/key-management";
import { encryptToBuffer, decryptFromBuffer } from "@/lib/crypto/encryption";
import { v4 as uuid } from "uuid";
import { AppError, ErrorCodes } from "@/constants/errors";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const tempStore = new Map<string, Buffer>();

function publicId(prefix: string, id: string, suffix: string): string {
  return `${prefix}/${id}/${suffix}`;
}

export const storageService = {
  async generateUploadUrl(): Promise<{ uploadUrl: string; uploadId: string }> {
    const uploadId = uuid();
    return { uploadUrl: "", uploadId };
  },

  async acceptUpload(uploadId: string, buffer: Buffer): Promise<void> {
    if (buffer.length > siteConfig.maxFileSizeBytes) {
      throw new AppError(ErrorCodes.FILE_TOO_LARGE, `File exceeds maximum size of ${siteConfig.maxFileSizeBytes} bytes`, 400);
    }
    if (buffer.slice(0, 5).toString() !== "%PDF-") {
      throw new AppError(ErrorCodes.INVALID_FILE_TYPE, "File is not a valid PDF", 400);
    }
    tempStore.set(uploadId, buffer);
  },

  async verifyAndFinalize(uploadId: string): Promise<{ buffer: Buffer; fileSize: number }> {
    const buffer = tempStore.get(uploadId);
    if (!buffer) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Upload not found. Please upload again.", 404);
    }
    return { buffer, fileSize: buffer.length };
  },

  async storeOriginal(documentId: string, buffer: Buffer): Promise<{ encryptedDataKey: string; encryptionIv: string }> {
    const kms = getKeyManagementService();
    const { plaintext: dataKey, ciphertext: encryptedDataKey } = await kms.generateDataKey();
    const encrypted = encryptToBuffer(buffer, dataKey);
    const id = publicId(siteConfig.storage.documentsPrefix, documentId, "original");
    const b64 = encrypted.toString("base64");
    await cloudinary.uploader.upload(`data:application/octet-stream;base64,${b64}`, {
      public_id: id,
      resource_type: "raw",
    });
    return {
      encryptedDataKey: encryptedDataKey.toString("base64"),
      encryptionIv: "",
    };
  },

  async storePublicPdf(documentId: string, buffer: Buffer): Promise<string> {
    const id = publicId(siteConfig.storage.documentsPrefix, documentId, "public");
    const b64 = buffer.toString("base64");
    await cloudinary.uploader.upload(`data:application/pdf;base64,${b64}`, {
      public_id: id,
      resource_type: "raw",
    });
    return id;
  },

  async storeInternalPdf(documentId: string, buffer: Buffer): Promise<string> {
    const id = publicId(siteConfig.storage.documentsPrefix, documentId, "internal");
    const b64 = buffer.toString("base64");
    await cloudinary.uploader.upload(`data:application/pdf;base64,${b64}`, {
      public_id: id,
      resource_type: "raw",
    });
    return id;
  },

  async storeCertificate(certificateId: string, buffer: Buffer): Promise<string> {
    const id = publicId(siteConfig.storage.certificatesPrefix, certificateId, "certificate");
    const b64 = buffer.toString("base64");
    await cloudinary.uploader.upload(`data:application/pdf;base64,${b64}`, {
      public_id: id,
      resource_type: "raw",
    });
    return id;
  },

  async getSignedDownloadUrl(path: string): Promise<string> {
    const url = cloudinary.url(path, { resource_type: "raw", secure: true });
    if (!url) {
      throw new AppError(ErrorCodes.NOT_FOUND, "File not found", 404);
    }
    return url;
  },

  async getOriginalBuffer(documentId: string, encryptedDataKeyBase64: string): Promise<Buffer> {
    const id = publicId(siteConfig.storage.documentsPrefix, documentId, "original");
    const result = await cloudinary.api.resource(id, { resource_type: "raw" });
    const response = await fetch(result.secure_url);
    if (!response.ok) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Original document not found", 404);
    }
    const arrayBuffer = await response.arrayBuffer();
    const encrypted = Buffer.from(arrayBuffer);
    if (encryptedDataKeyBase64) {
      const kms = getKeyManagementService();
      const encryptedDataKey = Buffer.from(encryptedDataKeyBase64, "base64");
      const dataKey = await kms.decryptDataKey(encryptedDataKey);
      return decryptFromBuffer(encrypted, dataKey);
    }
    return encrypted;
  },

  async getDocumentBuffer(documentId: string, type: "public" | "internal"): Promise<Buffer> {
    const id = publicId(siteConfig.storage.documentsPrefix, documentId, type);
    const result = await cloudinary.api.resource(id, { resource_type: "raw" }).catch(() => null);
    if (!result) {
      throw new AppError(ErrorCodes.NOT_FOUND, `${type} PDF not found`, 404);
    }
    const response = await fetch(result.secure_url);
    if (!response.ok) {
      throw new AppError(ErrorCodes.NOT_FOUND, `${type} PDF not found`, 404);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },

  async cleanupTemp(uploadId: string): Promise<void> {
    tempStore.delete(uploadId);
  },

  async cleanupDocument(documentId: string): Promise<void> {
    const types = ["original", "public", "internal"];
    await Promise.all(
      types.map((t) =>
        cloudinary.uploader.destroy(publicId(siteConfig.storage.documentsPrefix, documentId, t), { resource_type: "raw" }).catch(() => {})
      )
    );
  },
};
