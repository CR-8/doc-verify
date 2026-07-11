import { PDFDocument, rgb } from "pdf-lib";
import { generateQrBuffer, generateDocumentQrUrl } from "@/lib/qr/qr-generator";

export async function generatePublicPdf(
  originalBuffer: Buffer,
  documentId: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(originalBuffer);
  const qrUrl = await generateDocumentQrUrl(documentId);
  const qrBuffer = await generateQrBuffer({ url: qrUrl });
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width } = page.getSize();
    const qrSize = 72;
    page.drawImage(qrImage, {
      x: width - qrSize - 10,
      y: 10,
      width: qrSize,
      height: qrSize,
    });
    page.drawText("Verify at " + qrUrl, {
      x: width - qrSize - 10,
      y: qrSize + 15,
      size: 6,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
