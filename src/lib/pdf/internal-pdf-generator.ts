import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { generateQrBuffer, generateDocumentQrUrl, generateSignatureQrUrl } from "@/lib/qr/qr-generator";
import { findSignatureLocation, appendSignaturePage } from "@/lib/pdf/signature-placement";
import { sha256 } from "@/lib/crypto/hash";

export interface SignatureData {
  verificationToken: string;
  signerName: string;
  signerDesignation: string;
  signedAt: string;
  signatureHash: string;
  preferredPage?: number;
}

export async function generateInternalPdf(
  originalBuffer: Buffer,
  documentId: string,
  signatures: SignatureData[]
): Promise<Buffer> {
  // Uploaded PDFs frequently carry permission/owner-password encryption with an
  // empty user password; ignoreEncryption lets pdf-lib load and stamp them.
  const pdfDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true });
  const documentQrUrl = await generateDocumentQrUrl(documentId);
  const documentQrBuffer = await generateQrBuffer({ url: documentQrUrl });
  const documentQrImage = await pdfDoc.embedPng(documentQrBuffer);

  const qrSize = 72;
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width } = page.getSize();
    page.drawImage(documentQrImage, {
      x: width - qrSize - 10,
      y: 10,
      width: qrSize,
      height: qrSize,
    });
  }

  for (const sig of signatures) {
    const placement = await findSignatureLocation(pdfDoc, sig.preferredPage);
    const needsAppend = placement.method === "append" &&
      placement.pageIndex >= pdfDoc.getPageCount() - 1;

    const targetPage = needsAppend
      ? (await appendSignaturePage(pdfDoc)).pageIndex
      : placement.pageIndex;

    const page = pdfDoc.getPages()[targetPage];
    const { width } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const sigQrUrl = await generateSignatureQrUrl(sig.verificationToken);
    const sigQrBuffer = await generateQrBuffer({ url: sigQrUrl });
    const sigQrImage = await pdfDoc.embedPng(sigQrBuffer);

    const sigQrSize = 80;
    const sigX = width - sigQrSize - 50;
    const sigY = 120;

    page.drawImage(sigQrImage, {
      x: sigX,
      y: sigY,
      width: sigQrSize,
      height: sigQrSize,
    });

    page.drawText("Approved & Signed", {
      x: 50,
      y: sigY + sigQrSize + 30,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0.5),
    });

    page.drawText(`Signer: ${sig.signerName}`, {
      x: 50,
      y: sigY + sigQrSize,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    if (sig.signerDesignation) {
      page.drawText(`Designation: ${sig.signerDesignation}`, {
        x: 50,
        y: sigY + sigQrSize - 15,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    }

    page.drawText(`Signed: ${sig.signedAt}`, {
      x: 50,
      y: sigY + sigQrSize - 30,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText(`Hash: ${sha256(sig.signatureHash).slice(0, 16)}...`, {
      x: 50,
      y: sigY + sigQrSize - 45,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
