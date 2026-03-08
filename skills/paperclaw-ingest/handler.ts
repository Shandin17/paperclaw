/**
 * OpenClaw skill: Process documents through PaperClaw.
 * Called when user sends a file via Telegram/WhatsApp.
 */
const CORE_URL = process.env.PAPERCLAW_CORE_URL || 'http://paperclaw-core:8080';

export default async function handler(context) {
  const { filePath, fileName, message } = context;

  if (!filePath) {
    return 'Please send a document (PDF, image, or scan) and I will process it.';
  }

  try {
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);

    const form = new FormData();
    form.append('file', new Blob([fileBuffer]), fileName || 'document.pdf');

    const response = await fetch(`${CORE_URL}/ingest`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const err = await response.text();
      return `Error processing document: ${err}`;
    }

    const result = await response.json();
    const c = result.classification;
    const f = result.extractedFields;

    let summary = `✅ Document processed!\n`;
    summary += `Type: ${c.doc_type}\n`;
    summary += `Assigned to: ${c.agent} agent\n`;
    if (f.vendor) summary += `From: ${f.vendor}\n`;
    if (f.total) summary += `Amount: €${f.total}\n`;
    if (f.date) summary += `Date: ${f.date}\n`;
    if (f.diagnosis) summary += `Diagnosis: ${Array.isArray(f.diagnosis) ? f.diagnosis.join(', ') : f.diagnosis}\n`;
    summary += `\n${result.chunksStored} text chunks indexed for search.`;

    return summary;
  } catch (err) {
    return `Failed to process document: ${err.message}`;
  }
}
