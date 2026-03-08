/**
 * OpenClaw skill: Query PaperClaw agents.
 * Routes questions to gestor/doctor/id_docs agents.
 * Can also handle file attachments for form filling.
 */
const CORE_URL = process.env.PAPERCLAW_CORE_URL || 'http://paperclaw-core:8080';

export default async function handler(context) {
  const { message, filePath, fileName } = context;

  if (!message) {
    return 'What would you like to know? I can help with tax questions (/gestor), medical documents (/doctor), or personal IDs (/id_docs).';
  }

  try {
    // Detect explicit agent prefix
    let agent = undefined;
    let cleanMessage = message;
    const prefixMatch = message.match(/^\/(gestor|doctor|id_docs)\s+(.*)/s);
    if (prefixMatch) {
      agent = prefixMatch[1];
      cleanMessage = prefixMatch[2];
    }

    let result;

    if (filePath) {
      // Query with file attachment (for form filling)
      const fs = await import('fs');
      const fileBuffer = fs.readFileSync(filePath);

      const form = new FormData();
      form.append('message', cleanMessage);
      if (agent) form.append('agent', agent);
      form.append('file', new Blob([fileBuffer]), fileName || 'form.pdf');

      const response = await fetch(`${CORE_URL}/query-with-file`, {
        method: 'POST',
        body: form,
      });
      result = await response.json();
    } else {
      // Text-only query
      const response = await fetch(`${CORE_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, message: cleanMessage }),
      });
      result = await response.json();
    }

    if (result.error) {
      return `Error: ${result.error}`;
    }

    let reply = `[${result.agent}] ${result.text}`;

    // Handle PDF attachments in response
    if (result.attachments?.length) {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      for (const att of result.attachments) {
        const buffer = Buffer.from(att.base64, 'base64');
        const tmpPath = path.join(os.tmpdir(), att.filename);
        fs.writeFileSync(tmpPath, buffer);
        reply += `\n📎 ${att.filename}`;
        // OpenClaw will pick up files written to context.outputFiles
        if (context.outputFiles) {
          context.outputFiles.push({ path: tmpPath, name: att.filename });
        }
      }
    }

    return reply;
  } catch (err) {
    return `Failed to query agent: ${err.message}`;
  }
}
