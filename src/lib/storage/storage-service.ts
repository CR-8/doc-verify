import { v2 as cloudinary } from "cloudinary";
import { siteConfig } from "@/config/site";
import { getKeyManagementService } from "@/lib/crypto/key-management";
import { encryptToBuffer, decryptFromBuffer } from "@/lib/crypto/encryption";
import { v4 as uuid } from "uuid";
import { AppError, ErrorCodes } from "@/constants/errors";
import { logger } from "@/lib/logger/logger";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

function publicId(prefix: string, id: string, suffix: string): string {
  return `${prefix}/${id}/${suffix}`;
}

function tempId(uploadId: string): string {
  return publicId(siteConfig.storage.tempPrefix, uploadId, "upload");
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
    // Persist to shared storage rather than process memory so the two-step
    // upload → complete flow survives across requests, instances and restarts.
    const id = tempId(uploadId);
    const b64 = buffer.toString("base64");
    logger.info("Storage: uploading temp file to Cloudinary", {
      action: "storage_temp_upload",
      metadata: { uploadId, publicId: id, bytes: buffer.length },
    });
    try {
      const result = await cloudinary.uploader.upload(`data:application/pdf;base64,${b64}`, {
        public_id: id,
        resource_type: "raw",
      });
      logger.info("Storage: temp file uploaded", {
        action: "storage_temp_upload_ok",
        metadata: { uploadId, publicId: result.public_id, url: result.secure_url },
      });
    } catch (error) {
      logger.error("Storage: temp upload failed", {
        action: "storage_temp_upload_error",
        metadata: { uploadId, publicId: id, error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  },

  async verifyAndFinalize(uploadId: string): Promise<{ buffer: Buffer; fileSize: number }> {
    const id = tempId(uploadId);
    logger.info("Storage: looking up temp file", {
      action: "storage_temp_lookup",
      metadata: { uploadId, publicId: id },
    });
    const resource = await cloudinary.api
      .resource(id, { resource_type: "raw" })
      .catch((error) => {
        logger.warn("Storage: temp resource lookup failed", {
          action: "storage_temp_lookup_miss",
          metadata: { uploadId, publicId: id, error: error instanceof Error ? error.message : String(error) },
        });
        return null;
      });
    if (!resource) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Upload not found. Please upload again.", 404);
    }
    const response = await fetch(resource.secure_url);
    if (!response.ok) {
      logger.warn("Storage: temp file download failed", {
        action: "storage_temp_download_fail",
        metadata: { uploadId, publicId: id, status: response.status },
      });
      throw new AppError(ErrorCodes.NOT_FOUND, "Upload not found. Please upload again.", 404);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    logger.info("Storage: temp file retrieved", {
      action: "storage_temp_retrieved",
      metadata: { uploadId, publicId: id, bytes: buffer.length },
    });
    return { buffer, fileSize: buffer.length };
  },

  async storeOriginal(documentId: string, buffer: Buffer): Promise<{ encryptedDataKey: string; encryptionIv: string; path: string }> {
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
      path: id,
    };
  },

  async storePublicPdf(documentId: string, buffer: Buffer): Promise<string> {
    // Stored as an extension-less raw object: Cloudinary blocks delivery of
    // .pdf URLs by default, so downloads are proxied through our API instead.
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
    const id = `${siteConfig.storage.certificatesPrefix}/${certificateId}`;
    const b64 = buffer.toString("base64");
    await cloudinary.uploader.upload(`data:application/pdf;base64,${b64}`, {
      public_id: id,
      resource_type: "raw",
    });
    return id;
  },

  async getRawBuffer(path: string): Promise<Buffer> {
    const result = await cloudinary.api.resource(path, { resource_type: "raw" }).catch(() => null);
    if (!result) {
      throw new AppError(ErrorCodes.NOT_FOUND, "File not found", 404);
    }
    const response = await fetch(result.secure_url);
    if (!response.ok) {
      throw new AppError(ErrorCodes.NOT_FOUND, "File not found", 404);
    }
    return Buffer.from(await response.arrayBuffer());
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
    await cloudinary.uploader
      .destroy(tempId(uploadId), { resource_type: "raw" })
      .catch(() => {});
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
