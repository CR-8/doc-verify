import { PDFDocument } from "pdf-lib";

export interface SignaturePlacement {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  method: "acroform" | "layout" | "append" | "manual";
}

export async function findSignatureLocation(
  pdfDoc: PDFDocument,
  preferredPage?: number
): Promise<SignaturePlacement> {
  if (preferredPage !== undefined) {
    const pageCount = pdfDoc.getPageCount();
    const pageIndex = Math.min(preferredPage - 1, pageCount - 1);
    return {
      pageIndex,
      x: 50,
      y: 50,
      width: 200,
      height: 80,
      method: "manual",
    };
  }

  const acroformResult = await detectAcroFormSignatureFields(pdfDoc);
  if (acroformResult) {
    return acroformResult;
  }

  const layoutResult = await detectLayoutSignatureRegions(pdfDoc);
  if (layoutResult) {
    return layoutResult;
  }

  return {
    pageIndex: pdfDoc.getPageCount() - 1,
    x: 50,
    y: 50,
    width: 200,
    height: 80,
    method: "append",
  };
}

async function detectAcroFormSignatureFields(
  pdfDoc: PDFDocument
): Promise<SignaturePlacement | null> {
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    for (const field of fields) {
      const name = field.getName().toLowerCase();
      if (name.includes("signature") || name.includes("sign") || name.includes("sig")) {
        const widget = (field as unknown as { getWidgets: () => Array<{ getPage: () => number; getRectangle: () => { x: number; y: number; width: number; height: number } }> }).getWidgets();
        if (widget.length > 0) {
          const firstWidget = widget[0];
          const pageIndex = firstWidget.getPage();
          const rect = firstWidget.getRectangle();
          if (pageIndex >= 0) {
            return {
              pageIndex,
              x: rect.x + rect.width + 10,
              y: rect.y + rect.height - 40,
              width: 200,
              height: 80,
              method: "acroform",
            };
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function detectLayoutSignatureRegions(
  pdfDoc: PDFDocument
): Promise<SignaturePlacement | null> {
  const pages = pdfDoc.getPages();
  for (let i = pages.length - 1; i >= 0; i--) {
    const page = pages[i];
    const { height } = page.getSize();
    const bottomQuarter = height * 0.25;
    return {
      pageIndex: i,
      x: 50,
      y: bottomQuarter + 10,
      width: 200,
      height: 80,
      method: "layout",
    };
  }
  return null;
}

export async function appendSignaturePage(pdfDoc: PDFDocument): Promise<SignaturePlacement> {
  const page = pdfDoc.addPage([612, 792]);
  return {
    pageIndex: pdfDoc.getPageCount() - 1,
    x: 50,
    y: 400,
    width: 200,
    height: 80,
    method: "append",
  };
}
