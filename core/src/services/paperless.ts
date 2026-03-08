import { config } from '../config.js';

const headers = () => ({
  Authorization: `Token ${config.PAPERLESS_TOKEN}`,
});

const base = () => config.PAPERLESS_URL;

// ─── Upload Document ─────────────────────────────────────

export async function uploadDocument(
  fileBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const form = new FormData();
  form.append('document', new Blob([new Uint8Array(fileBuffer)]), fileName);

  const res = await fetch(`${base()}/api/documents/post_document/`, {
    method: 'POST',
    headers: headers(),
    body: form,
  });

  if (!res.ok) throw new Error(`Paperless upload failed: ${res.status} ${await res.text()}`);
  const taskId = await res.json();
  return taskId as string;
}

// ─── Poll Task Until Complete ────────────────────────────

export async function waitForTask(taskId: string, maxAttempts = 30): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(10_000);
    const res = await fetch(`${base()}/api/tasks/?task_id=${taskId}`, {
      headers: headers(),
    });
    const tasks = (await res.json()) as any[];
    if (tasks.length > 0) {
      if (tasks[0].status === 'SUCCESS') return tasks[0].related_document;
      if (tasks[0].status === 'FAILURE') throw new Error(`Processing failed: ${tasks[0].result}`);
    }
  }
  throw new Error('Paperless did not finish processing in time');
}

// ─── Get Document Text ───────────────────────────────────

export async function getDocumentText(docId: number): Promise<string> {
  const res = await fetch(`${base()}/api/documents/${docId}/`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to get document ${docId}: ${res.status}`);
  const doc = (await res.json()) as any;
  return doc.content ?? '';
}

// ─── Get Document Metadata ───────────────────────────────

export async function getDocument(docId: number): Promise<any> {
  const res = await fetch(`${base()}/api/documents/${docId}/`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to get document ${docId}: ${res.status}`);
  return res.json();
}

// ─── Download Document File ──────────────────────────────

export async function downloadDocument(docId: number, original = false): Promise<Buffer> {
  const endpoint = original ? 'original' : 'download';
  const res = await fetch(`${base()}/api/documents/${docId}/${endpoint}/`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to download document ${docId}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Update Document Tags ────────────────────────────────

export async function updateDocumentTags(docId: number, tagIds: number[]): Promise<void> {
  const res = await fetch(`${base()}/api/documents/${docId}/`, {
    method: 'PATCH',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: tagIds }),
  });
  if (!res.ok) throw new Error(`Failed to update tags for document ${docId}: ${res.status}`);
}

// ─── Get All Tags (cached) ──────────────────────────────

let tagCache: Map<string, number> | null = null;

export async function getTagMap(): Promise<Map<string, number>> {
  if (tagCache) return tagCache;

  const res = await fetch(`${base()}/api/tags/?page_size=200`, {
    headers: headers(),
  });
  const data = (await res.json()) as any;
  tagCache = new Map(data.results.map((t: any) => [t.name, t.id]));

  // Invalidate cache after 5 minutes
  setTimeout(() => { tagCache = null; }, 5 * 60 * 1000);
  return tagCache;
}

// ─── Search Documents ────────────────────────────────────

export async function searchDocuments(query: string, tagNames?: string[]): Promise<any[]> {
  const params = new URLSearchParams({ query, page_size: '50' });

  if (tagNames?.length) {
    const tagMap = await getTagMap();
    for (const name of tagNames) {
      const id = tagMap.get(name);
      if (id) params.append('tags__id__in', String(id));
    }
  }

  const res = await fetch(`${base()}/api/documents/?${params}`, {
    headers: headers(),
  });
  const data = (await res.json()) as any;
  return data.results ?? [];
}

// ─── Helpers ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
