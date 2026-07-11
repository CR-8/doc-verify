import * as QRCode from "qrcode";
import { siteConfig } from "@/config/site";

export interface QrOptions {
  url: string;
  size?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export async function generateQrBuffer(options: QrOptions): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(options.url, {
    type: "png",
    width: options.size ?? siteConfig.qrCode.size,
    errorCorrectionLevel: options.errorCorrectionLevel ?? siteConfig.qrCode.errorCorrectionLevel,
    margin: 2,
  });
  return buffer;
}

export async function generateDocumentQrUrl(documentId: string): Promise<string> {
  return `${siteConfig.baseUrl}/verify/${documentId}`;
}

export async function generateSignatureQrUrl(verificationToken: string): Promise<string> {
  return `${siteConfig.baseUrl}/sign/${verificationToken}`;
}

export async function generateCertificateQrUrl(certificateId: string): Promise<string> {
  return `${siteConfig.baseUrl}/certificate/${certificateId}`;
}
