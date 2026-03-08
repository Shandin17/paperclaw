import { config } from "../config.js";

const BASE = config.PAPERLESS_URL;

function headers(): Record<string, string> {
  return {
    Authorization: `Token ${config.PAPERLESS_TOKEN}`,
    Accept: "application/json",
  };
}

export interface PaperlessDocument {
  id: number;
  title: string;
  content: string;
  created: string;
  tags: number[];
  custom_fields: { field: number; value: string }[];
}

export interface PaperlessTag {
  id: number;
  name: string;
  slug: string;
}

export interface PaperlessCustomField {
  id: number;
  name: string;
  data_type: string;
}

// ── Documents ─────────────────────────────────────────────────

export async function uploadDocument(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<number> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
  form.append("document", blob, filename);

  const res = await fetch(`${BASE}/api/documents/post_document/`, {
    method: "POST",
    headers: { Authorization: `Token ${config.PAPERLESS_TOKEN}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Paperless upload failed: ${res.status}`);
  const taskId = await res.text();
  return waitForDocument(taskId.replace(/"/g, ""));
}

async function waitForDocument(taskId: string, retries = 30): Promise<number> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${BASE}/api/tasks/?task_id=${taskId}`, {
      headers: headers(),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { results: { status: string; related_document: number }[] };
    const task = data.results[0];
    if (task?.status === "SUCCESS" && task.related_document) {
      return task.related_document;
    }
    if (task?.status === "FAILURE") {
      throw new Error("Paperless OCR task failed");
    }
  }
  throw new Error("Timeout waiting for Paperless document");
}

export async function getDocument(id: number): Promise<PaperlessDocument> {
  const res = await fetch(`${BASE}/api/documents/${id}/`, { headers: headers() });
  if (!res.ok) throw new Error(`Paperless getDocument failed: ${res.status}`);
  return res.json() as Promise<PaperlessDocument>;
}

export async function updateDocument(
  id: number,
  updates: Partial<{ title: string; tags: number[]; custom_fields: { field: number; value: string }[] }>,
): Promise<void> {
  const res = await fetch(`${BASE}/api/documents/${id}/`, {
    method: "PATCH",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Paperless updateDocument failed: ${res.status}`);
}

export async function searchDocuments(
  query: string,
  tags?: number[],
): Promise<PaperlessDocument[]> {
  const params = new URLSearchParams({ query });
  if (tags?.length) params.append("tags__id__all", tags.join(","));

  const res = await fetch(`${BASE}/api/documents/?${params}`, { headers: headers() });
  if (!res.ok) throw new Error(`Paperless search failed: ${res.status}`);
  const data = (await res.json()) as { results: PaperlessDocument[] };
  return data.results;
}

export async function getDocumentContent(id: number): Promise<string> {
  const doc = await getDocument(id);
  return doc.content;
}

// ── Tags ──────────────────────────────────────────────────────

export async function getTags(): Promise<PaperlessTag[]> {
  const res = await fetch(`${BASE}/api/tags/?page_size=100`, { headers: headers() });
  if (!res.ok) throw new Error(`Paperless getTags failed: ${res.status}`);
  const data = (await res.json()) as { results: PaperlessTag[] };
  return data.results;
}

export async function createTag(name: string): Promise<PaperlessTag> {
  const res = await fetch(`${BASE}/api/tags/`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Paperless createTag failed: ${res.status}`);
  return res.json() as Promise<PaperlessTag>;
}

export async function ensureTag(name: string): Promise<number> {
  const tags = await getTags();
  const existing = tags.find((t) => t.name === name);
  if (existing) return existing.id;
  const created = await createTag(name);
  return created.id;
}

// ── Custom Fields ─────────────────────────────────────────────

export async function getCustomFields(): Promise<PaperlessCustomField[]> {
  const res = await fetch(`${BASE}/api/custom_fields/?page_size=100`, { headers: headers() });
  if (!res.ok) throw new Error(`Paperless getCustomFields failed: ${res.status}`);
  const data = (await res.json()) as { results: PaperlessCustomField[] };
  return data.results;
}

export async function createCustomField(name: string, dataType = "string"): Promise<PaperlessCustomField> {
  const res = await fetch(`${BASE}/api/custom_fields/`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, data_type: dataType }),
  });
  if (!res.ok) throw new Error(`Paperless createCustomField failed: ${res.status}`);
  return res.json() as Promise<PaperlessCustomField>;
}

export async function ensureCustomField(name: string, dataType = "string"): Promise<number> {
  const fields = await getCustomFields();
  const existing = fields.find((f) => f.name === name);
  if (existing) return existing.id;
  const created = await createCustomField(name, dataType);
  return created.id;
}
