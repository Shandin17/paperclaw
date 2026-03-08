import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from "pdf-lib";

export async function fillPdfForm(
  pdfBytes: Buffer,
  fieldData: Record<string, string>,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  const fields = form.getFields();

  for (const field of fields) {
    const name = field.getName();
    const value = fieldData[name];
    if (!value) continue;

    try {
      if (field instanceof PDFTextField) {
        field.setText(value);
      } else if (field instanceof PDFCheckBox) {
        if (value === "true" || value === "1" || value === "yes") {
          field.check();
        }
      } else if (field instanceof PDFRadioGroup) {
        field.select(value);
      }
    } catch {
      // Skip fields that can't be filled
    }
  }

  const resultBytes = await pdf.save();
  return Buffer.from(resultBytes);
}

export async function listFormFields(pdfBytes: Buffer): Promise<string[]> {
  const pdf = await PDFDocument.load(pdfBytes);
  const form = pdf.getForm();
  return form.getFields().map((f) => `${f.getName()} (${f.constructor.name})`);
}
