import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface Section {
  heading: string;
  body: string;
}

export async function generatePdfReport(
  title: string,
  sections: Section[],
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);

  let page = pdf.addPage();
  const { width, height } = page.getSize();
  const margin = 50;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // Title
  page.drawText(title, {
    x: margin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.5),
  });
  y -= 30;

  // Date
  const dateStr = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  page.drawText(`Generado: ${dateStr}`, {
    x: margin,
    y,
    size: 10,
    font: regularFont,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 30;

  // Horizontal rule
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  for (const section of sections) {
    // Check if we need a new page
    if (y < margin + 60) {
      page = pdf.addPage();
      y = page.getSize().height - margin;
    }

    // Section heading
    page.drawText(section.heading, {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 22;

    // Section body — word wrap
    const words = section.body.split(" ");
    let line = "";

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const textWidth = regularFont.widthOfTextAtSize(testLine, 11);

      if (textWidth > contentWidth && line) {
        if (y < margin + 20) {
          page = pdf.addPage();
          y = page.getSize().height - margin;
        }
        page.drawText(line, {
          x: margin,
          y,
          size: 11,
          font: regularFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 16;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      if (y < margin + 20) {
        page = pdf.addPage();
        y = page.getSize().height - margin;
      }
      page.drawText(line, {
        x: margin,
        y,
        size: 11,
        font: regularFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 16;
    }

    y -= 20;
  }

  return Buffer.from(await pdf.save());
}
