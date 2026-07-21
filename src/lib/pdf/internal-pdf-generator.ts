import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
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
    // Watermark-style: light enough that page content underneath stays
    // readable, dark enough that scanners still pick it up (EC level M).
    page.drawImage(documentQrImage, {
      x: width - qrSize - 10,
      y: 10,
      width: qrSize,
      height: qrSize,
      opacity: 0.45,
    });
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const SLOTS_PER_ROW = 5;
  const sigQrSize = 48;
  const blockHeight = sigQrSize + 58;
  const sideMargin = 30;
  const bottomMargin = 95;
  const slotsUsed = new Map<number, number>();

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max - 1) + "…" : text;

  const formatSignedAt = (value: string): string => {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : format(date, "dd MMM yyyy, hh:mm a");
  };

  // Max signature blocks that physically fit on a page (grid grows upward
  // from bottomMargin; keep ~30pt headroom for the block's header text).
  const capacityOf = (pageIndex: number): number => {
    const { height } = pdfDoc.getPages()[pageIndex].getSize();
    const rows = Math.max(1, Math.floor((height - bottomMargin - 30) / blockHeight));
    return rows * SLOTS_PER_ROW;
  };

  let overflowPageIndex: number | null = null;

  for (const sig of signatures) {
    const placement = await findSignatureLocation(pdfDoc, sig.preferredPage);
    const needsAppend = placement.method === "append" &&
      placement.pageIndex >= pdfDoc.getPageCount() - 1;

    let targetPage = needsAppend
      ? (await appendSignaturePage(pdfDoc)).pageIndex
      : placement.pageIndex;

    // Page full? Spill onto appended signature pages — no upper bound.
    if ((slotsUsed.get(targetPage) ?? 0) >= capacityOf(targetPage)) {
      if (
        overflowPageIndex === null ||
        (slotsUsed.get(overflowPageIndex) ?? 0) >= capacityOf(overflowPageIndex)
      ) {
        overflowPageIndex = (await appendSignaturePage(pdfDoc)).pageIndex;
      }
      targetPage = overflowPageIndex;
    }

    const page = pdfDoc.getPages()[targetPage];
    const { width } = page.getSize();

    const sigQrUrl = await generateSignatureQrUrl(sig.verificationToken);
    const sigQrBuffer = await generateQrBuffer({ url: sigQrUrl });
    const sigQrImage = await pdfDoc.embedPng(sigQrBuffer);

    const slot = slotsUsed.get(targetPage) ?? 0;
    slotsUsed.set(targetPage, slot + 1);

    const slotWidth = (width - sideMargin * 2) / SLOTS_PER_ROW;
    const col = slot % SLOTS_PER_ROW;
    const row = Math.floor(slot / SLOTS_PER_ROW);
    const sigX = sideMargin + col * slotWidth;
    const sigY = bottomMargin + row * blockHeight;

    page.drawImage(sigQrImage, {
      x: sigX,
      y: sigY,
      width: sigQrSize,
      height: sigQrSize,
      opacity: 0.6,
    });

    page.drawText("Approved & Signed", {
      x: sigX,
      y: sigY + sigQrSize + 4,
      size: 7,
      font: boldFont,
      color: rgb(0, 0, 0.5),
      opacity: 0.6,
    });

    page.drawText(truncate(sig.signerName, 22), {
      x: sigX,
      y: sigY - 11,
      size: 8,
      font: boldFont,
      color: rgb(0, 0, 0),
      opacity: 0.6,
    });

    page.drawText(formatSignedAt(sig.signedAt), {
      x: sigX,
      y: sigY - 21,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
      opacity: 0.6,
    });

    if (sig.signerDesignation) {
      page.drawText(truncate(sig.signerDesignation, 26), {
        x: sigX,
        y: sigY - 30,
        size: 6,
        font,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.6,
      });
    }

    page.drawText(`${sha256(sig.signatureHash).slice(0, 12)}…`, {
      x: sigX,
      y: sigY - 39,
      size: 5.5,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.6,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
