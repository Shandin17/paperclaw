// OpenClaw skill handler — thin wrapper around PaperClaw Core /ingest

const CORE_URL = process.env.PAPERCLAW_CORE_URL ?? "http://paperclaw-core:8080";

interface IngestInput {
  file?: { buffer: Buffer; filename: string; mimeType: string };
  message?: string;
}

export async function handle(input: IngestInput): Promise<string> {
  if (!input.file) {
    return "Please send a document (PDF, image, etc.) to ingest.";
  }

  const form = new FormData();
  const blob = new Blob([input.file.buffer], { type: input.file.mimeType });
  form.append("file", blob, input.file.filename);

  const res = await fetch(`${CORE_URL}/ingest`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Ingest failed: ${res.status} ${await res.text()}`);
  }

  const result = await res.json() as {
    docType: string;
    agent: string;
    summary: string;
    paperlessId: number;
    extractedFields: Record<string, string>;
  };

  const fields = Object.entries(result.extractedFields)
    .filter(([, v]) => v)
    .map(([k, v]) => `  • ${k}: ${v}`)
    .join("\n");

  return [
    `✅ Document ingested successfully`,
    `📄 Type: ${result.docType}`,
    `🤖 Agent: ${result.agent}`,
    `🆔 Paperless ID: ${result.paperlessId}`,
    ``,
    `📝 Summary: ${result.summary}`,
    fields ? `\n📊 Extracted:\n${fields}` : "",
  ].filter(Boolean).join("\n");
}
