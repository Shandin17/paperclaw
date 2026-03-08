import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─── Fill Fillable PDF Form ──────────────────────────────

export interface FillResult {
  buffer: Buffer;
  filled: string[];
  missing: string[];
  allFields: string[];
}

export async function fillPdfForm(
  pdfBytes: Buffer,
  fieldData: Record<string, string>,
): Promise<FillResult> {
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  const filled: string[] = [];
  const missing: string[] = [];
  const allFields: string[] = [];

  for (const field of fields) {
    const name = field.getName();
    allFields.push(name);
    const value = fieldData[name];

    if (!value) {
      missing.push(name);
      continue;
    }

    try {
      const typeName = field.constructor.name;
      if (typeName === 'PDFTextField') {
        const textField = form.getTextField(name);
        textField.setText(value);
        filled.push(name);
      } else if (typeName === 'PDFCheckBox') {
        const checkbox = form.getCheckBox(name);
        if (value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes') {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
        filled.push(name);
      } else if (typeName === 'PDFDropdown') {
        const dropdown = form.getDropdown(name);
        dropdown.select(value);
        filled.push(name);
      }
    } catch (err) {
      console.warn(`[pdf-filler] Failed to fill field "${name}":`, err);
      missing.push(name);
    }
  }

  const resultBytes = await pdf.save();
  return {
    buffer: Buffer.from(resultBytes),
    filled,
    missing,
    allFields,
  };
}

// ─── List Form Fields ────────────────────────────────────

export async function listFormFields(pdfBytes: Buffer): Promise<string[]> {
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  return form.getFields().map((f) => {
    const type = f.constructor.name.replace('PDF', '').replace('Field', '');
    return `${f.getName()} (${type})`;
  });
}

// ─── Generate PDF Report ─────────────────────────────────

export interface ReportSection {
  heading: string;
  body: string;
}

export async function generateReport(
  title: string,
  sections: ReportSection[],
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const margin = 50;
  const lineHeight = 16;
  let y = height - margin;

  // Title
  page.drawText(title, {
    x: margin,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 35;

  // Date
  page.drawText(`Generated: ${new Date().toISOString().split('T')[0]}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 30;

  // Sections
  for (const section of sections) {
    // Check if we need a new page
    if (y < margin + 60) {
      page = pdf.addPage([595, 842]);
      y = height - margin;
    }

    // Section heading
    page.drawText(section.heading, {
      x: margin,
      y,
      size: 14,
      font: boldFont,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 22;

    // Section body — simple word wrap
    const maxWidth = width - 2 * margin;
    const words = section.body.split(' ');
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, 11);

      if (testWidth > maxWidth && line) {
        if (y < margin + 20) {
          page = pdf.addPage([595, 842]);
          y = height - margin;
        }
        page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      if (y < margin + 20) {
        page = pdf.addPage([595, 842]);
        y = height - margin;
      }
      page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
      y -= lineHeight;
    }

    y -= 15; // gap between sections
  }

  return Buffer.from(await pdf.save());
}
