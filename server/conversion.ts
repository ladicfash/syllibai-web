/**
 * File conversion utilities for SyllibAI.
 * Supports: PDF→text extraction, DOCX→text extraction, image→PDF embedding.
 * All conversions are done server-side using pure Node.js npm packages.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

// ── PDF → Text ─────────────────────────────────────────────────────────────
// We use the built-in text extraction already in the documents router via
// the LLM pipeline. This module focuses on binary format conversions.

// ── DOCX → Plain text ──────────────────────────────────────────────────────
export async function docxToText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// ── DOCX → HTML (for preview) ──────────────────────────────────────────────
export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  return result.value;
}

// ── Text → DOCX ────────────────────────────────────────────────────────────
export async function textToDocx(text: string, title?: string): Promise<Buffer> {
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [];

  if (title) {
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }
    // Detect markdown-style headings
    if (trimmed.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({ text: trimmed.slice(3), heading: HeadingLevel.HEADING_2 })
      );
    } else if (trimmed.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({ text: trimmed.slice(2), heading: HeadingLevel.HEADING_1 })
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: trimmed.slice(2) })],
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({ children: [new TextRun({ text: trimmed })] })
      );
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ── Image → PDF ─────────────────────────────────────────────────────────────
export async function imageToPdf(imageBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  let image;
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    image = await pdfDoc.embedJpg(imageBuffer);
  } else if (mimeType === "image/png") {
    image = await pdfDoc.embedPng(imageBuffer);
  } else {
    throw new Error(`Unsupported image type for PDF conversion: ${mimeType}. Use JPEG or PNG.`);
  }

  const { width, height } = image.scale(1);
  // A4 dimensions in points: 595 x 842
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;

  const maxW = pageWidth - margin * 2;
  const maxH = pageHeight - margin * 2;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const scaledW = width * scale;
  const scaledH = height * scale;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - scaledW) / 2,
    y: (pageHeight - scaledH) / 2,
    width: scaledW,
    height: scaledH,
  });

  return Buffer.from(await pdfDoc.save());
}

// ── Text → PDF ──────────────────────────────────────────────────────────────
export async function textToPdf(text: string, title?: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 50;
  const lineHeight = 16;
  const fontSize = 11;
  const titleSize = 18;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const writeLine = (line: string, opts: { bold?: boolean; size?: number; indent?: number } = {}) => {
    const { bold = false, size = fontSize, indent = 0 } = opts;
    const usedFont = bold ? boldFont : font;
    const maxWidth = pageWidth - margin * 2 - indent;

    // Word-wrap
    const words = line.split(" ");
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = usedFont.widthOfTextAtSize(testLine, size);
      if (testWidth > maxWidth && currentLine) {
        if (y < margin + lineHeight) addPage();
        page.drawText(currentLine, {
          x: margin + indent,
          y,
          size,
          font: usedFont,
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      if (y < margin + lineHeight) addPage();
      page.drawText(currentLine, {
        x: margin + indent,
        y,
        size,
        font: usedFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= lineHeight;
    }
  };

  if (title) {
    writeLine(title, { bold: true, size: titleSize });
    y -= 10;
  }

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { y -= lineHeight / 2; continue; }
    if (trimmed.startsWith("## ")) {
      y -= 6;
      writeLine(trimmed.slice(3), { bold: true, size: 13 });
      y -= 4;
    } else if (trimmed.startsWith("# ")) {
      y -= 8;
      writeLine(trimmed.slice(2), { bold: true, size: 15 });
      y -= 6;
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      writeLine("• " + trimmed.slice(2), { indent: 12 });
    } else {
      writeLine(trimmed);
    }
  }

  return Buffer.from(await pdfDoc.save());
}
