import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { generateQrBuffer, generateCertificateQrUrl } from "@/lib/qr/qr-generator";

export interface CertificateData {
  certificateId: string;
  documentTitle: string;
  documentId: string;
  signerName: string;
  signerDesignation: string;
  signedAt: string;
  documentHash: string;
  verificationToken: string;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const lineHeight = 20;
  let y = height - 80;

  page.drawText("CERTIFICATE OF APPROVAL", {
    x: 50,
    y: y,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0.5),
  });
  y -= lineHeight * 2;

  page.drawText(`Certificate ID: ${data.certificateId}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= lineHeight;

  page.drawText(`Document: ${data.documentTitle}`, {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight;

  page.drawText(`Document ID: ${data.documentId}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= lineHeight * 2;

  page.drawText("Signed by:", {
    x: 50,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight;

  page.drawText(`Name: ${data.signerName}`, {
    x: 50,
    y,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight;

  if (data.signerDesignation) {
    page.drawText(`Designation: ${data.signerDesignation}`, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }

  page.drawText(`Date: ${data.signedAt}`, {
    x: 50,
    y,
    size: 11,
    font,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight * 2;

  page.drawText("Document Integrity", {
    x: 50,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight;

  page.drawText(`SHA-256: ${data.documentHash}`, {
    x: 50,
    y,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= lineHeight + 10;

  page.drawText(`Verification Token: ${data.verificationToken.slice(0, 32)}...`, {
    x: 50,
    y,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const qrUrl = await generateCertificateQrUrl(data.certificateId);
  const qrBuffer = await generateQrBuffer({ url: qrUrl });
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  page.drawImage(qrImage, {
    x: width - 130,
    y: 40,
    width: 90,
    height: 90,
  });

  page.drawText("Scan to verify this certificate", {
    x: width - 130,
    y: 30,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText("doc-verify - Secure Document Verification Platform", {
    x: 50,
    y: 40,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
