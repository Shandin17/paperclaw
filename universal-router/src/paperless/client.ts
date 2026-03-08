export interface PaperlessDocument {
  id: number;
  title: string;
  content: string; // OCR text
  created: string;
  added: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  original_file_name: string;
  archived_file_name: string | null;
}

export interface PaperlessTag {
  id: number;
  name: string;
  colour: number;
}

export interface PaperlessCorrespondent {
  id: number;
  name: string;
}

export interface PaperlessDocumentType {
  id: number;
  name: string;
}

export interface UploadOptions {
  title?: string;
  created?: string; // ISO date
  correspondentName?: string;
  documentTypeName?: string;
  tagNames?: string[];
}

export interface SearchOptions {
  query?: string;
  tags?: number[];
  correspondent?: number;
  documentType?: number;
  createdAfter?: string;  // ISO date
  createdBefore?: string; // ISO date
  pageSize?: number;
}

export class PaperlessClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Token ${this.token}`,
      Accept: "application/json",
    };
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), { headers: this.headers() });
    if (!res.ok) throw new Error(`Paperless GET ${path} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: FormData | Record<string, unknown>): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: isForm ? this.headers() : { ...this.headers(), "Content-Type": "application/json" },
      body: isForm ? body : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Paperless POST ${path} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Paperless PATCH ${path} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  async getTags(): Promise<PaperlessTag[]> {
    const res = await this.get<{ results: PaperlessTag[] }>("/api/tags/", { page_size: "1000" });
    return res.results;
  }

  async getOrCreateTag(name: string): Promise<PaperlessTag> {
    const tags = await this.getTags();
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return this.post<PaperlessTag>("/api/tags/", { name });
  }

  // ── Correspondents ───────────────────────────────────────────────────────────

  async getCorrespondents(): Promise<PaperlessCorrespondent[]> {
    const res = await this.get<{ results: PaperlessCorrespondent[] }>("/api/correspondents/", { page_size: "1000" });
    return res.results;
  }

  async getOrCreateCorrespondent(name: string): Promise<PaperlessCorrespondent> {
    const list = await this.getCorrespondents();
    const existing = list.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return this.post<PaperlessCorrespondent>("/api/correspondents/", { name });
  }

  // ── Document types ───────────────────────────────────────────────────────────

  async getDocumentTypes(): Promise<PaperlessDocumentType[]> {
    const res = await this.get<{ results: PaperlessDocumentType[] }>("/api/document_types/", { page_size: "1000" });
    return res.results;
  }

  async getOrCreateDocumentType(name: string): Promise<PaperlessDocumentType> {
    const list = await this.getDocumentTypes();
    const existing = list.find((d) => d.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return this.post<PaperlessDocumentType>("/api/document_types/", { name });
  }

  // ── Documents ────────────────────────────────────────────────────────────────

  async uploadDocument(
    fileBuffer: Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<number> {
    const form = new FormData();
    form.append("document", new Blob([fileBuffer]), filename);

    if (options.title) form.append("title", options.title);
    if (options.created) form.append("created", options.created);

    if (options.correspondentName) {
      const c = await this.getOrCreateCorrespondent(options.correspondentName);
      form.append("correspondent", String(c.id));
    }

    if (options.documentTypeName) {
      const dt = await this.getOrCreateDocumentType(options.documentTypeName);
      form.append("document_type", String(dt.id));
    }

    if (options.tagNames?.length) {
      const tags = await Promise.all(options.tagNames.map((n) => this.getOrCreateTag(n)));
      for (const tag of tags) {
        form.append("tags", String(tag.id));
      }
    }

    const res = await this.post<{ task_id: string }>("/api/documents/post_document/", form);
    return this.waitForDocument(res.task_id);
  }

  private async waitForDocument(taskId: string, timeoutMs = 60_000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const tasks = await this.get<Array<{ task_id: string; related_document: number | null; status: string }>>(
        "/api/tasks/",
        { task_id: taskId }
      );
      const task = tasks[0];
      if (task?.status === "SUCCESS" && task.related_document !== null) {
        return task.related_document;
      }
      if (task?.status === "FAILURE") {
        throw new Error(`Paperless task ${taskId} failed`);
      }
    }
    throw new Error(`Paperless task ${taskId} timed out after ${timeoutMs}ms`);
  }

  async getDocument(id: number): Promise<PaperlessDocument> {
    return this.get<PaperlessDocument>(`/api/documents/${id}/`);
  }

  async updateDocument(id: number, fields: Partial<Pick<PaperlessDocument, "title" | "created" | "correspondent" | "document_type" | "tags">>): Promise<PaperlessDocument> {
    return this.patch<PaperlessDocument>(`/api/documents/${id}/`, fields as Record<string, unknown>);
  }

  async searchDocuments(options: SearchOptions = {}): Promise<PaperlessDocument[]> {
    const params: Record<string, string> = {
      page_size: String(options.pageSize ?? 100),
    };
    if (options.query) params["query"] = options.query;
    if (options.correspondent) params["correspondent__id"] = String(options.correspondent);
    if (options.documentType) params["document_type__id"] = String(options.documentType);
    if (options.createdAfter) params["created__date__gte"] = options.createdAfter;
    if (options.createdBefore) params["created__date__lte"] = options.createdBefore;
    if (options.tags?.length) params["tags__id__all"] = options.tags.join(",");

    const res = await this.get<{ results: PaperlessDocument[] }>("/api/documents/", params);
    return res.results;
  }

  async getDocumentsByQuarter(year: number, quarter: 1 | 2 | 3 | 4): Promise<PaperlessDocument[]> {
    const starts = ["01-01", "04-01", "07-01", "10-01"];
    const ends   = ["03-31", "06-30", "09-30", "12-31"];
    return this.searchDocuments({
      createdAfter:  `${year}-${starts[quarter - 1]}`,
      createdBefore: `${year}-${ends[quarter - 1]}`,
    });
  }
}
