// OpenClaw skill handler — thin wrapper around PaperClaw Core /query

const CORE_URL = process.env.PAPERCLAW_CORE_URL ?? "http://paperclaw-core:8080";

interface QueryInput {
  message: string;
  agent?: string;
  file?: { buffer: Buffer; filename: string; mimeType: string };
}

interface QueryOutput {
  text: string;
  attachments?: { filename: string; buffer: Buffer; mimeType: string }[];
}

export async function handle(input: QueryInput): Promise<QueryOutput> {
  if (!input.message) {
    return { text: "Please provide a question or instruction." };
  }

  // If file is attached, use multipart endpoint
  if (input.file) {
    const form = new FormData();
    form.append("message", input.message);
    if (input.agent) form.append("agent", input.agent);
    const blob = new Blob([input.file.buffer], { type: input.file.mimeType });
    form.append("file", blob, input.file.filename);

    const res = await fetch(`${CORE_URL}/query/file`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Query failed: ${res.status}`);
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/pdf")) {
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ?? "filled.pdf";
      const agentName = res.headers.get("X-Agent") ?? "unknown";
      const messageB64 = res.headers.get("X-Message") ?? "";
      const message = messageB64 ? Buffer.from(messageB64, "base64").toString("utf-8") : "";

      return {
        text: `[${agentName}] ${message}`,
        attachments: [{ filename, buffer, mimeType: "application/pdf" }],
      };
    }

    const data = await res.json() as { agent: string; text: string };
    return { text: `[${data.agent}] ${data.text}` };
  }

  // Text-only query
  const res = await fetch(`${CORE_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: input.message, agent: input.agent }),
  });

  if (!res.ok) {
    throw new Error(`Query failed: ${res.status}`);
  }

  const data = await res.json() as { agent: string; text: string };
  return { text: `[${data.agent}] ${data.text}` };
}
