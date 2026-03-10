import { config } from '../config/env.ts'

export interface PaperlessDocument {
  id: number
  title: string
  content: string
  tags: number[]
  document_type: number | null
  created: string
  original_file_name: string
  download_url: string
}

interface TaskStatus {
  task_id: string
  status: string
  related_document: number | null
}

interface PaginatedResult<T> {
  results: T[]
}

interface TagOrType {
  id: number
  name: string
}

export class PaperlessClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor () {
    this.baseUrl = config.PAPERLESS_URL
    this.headers = {
      Authorization: `Token ${config.PAPERLESS_TOKEN}`,
      Accept: 'application/json',
    }
  }

  private async request<T> (
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`
    const headers: Record<string, string> = { ...this.headers }
    let bodyContent: string | undefined

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      bodyContent = JSON.stringify(body)
    }

    const res = await fetch(url, { method, headers, body: bodyContent })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Paperless API ${method} ${endpoint} → ${res.status}: ${text}`)
    }

    if (res.status === 204) return {} as T
    return res.json() as Promise<T>
  }

  async upload (
    file: Buffer,
    filename: string,
    metadata?: { title?: string; tags?: number[]; documentType?: number }
  ): Promise<string> {
    const form = new FormData()
    form.append('document', new Blob([file.buffer as ArrayBuffer]), filename)

    if (metadata?.title) form.append('title', metadata.title)
    if (metadata?.tags) {
      for (const tag of metadata.tags) form.append('tags', String(tag))
    }
    if (metadata?.documentType) form.append('document_type', String(metadata.documentType))

    const url = `${this.baseUrl}/api/documents/post_document/`
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: this.headers.Authorization as string },
      body: form,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Paperless upload failed ${res.status}: ${text}`)
    }

    return res.json() as Promise<string>
  }

  async awaitTask (taskId: string, timeoutMs = 120_000): Promise<number> {
    const start = Date.now()
    const interval = 2000

    while (Date.now() - start < timeoutMs) {
      const tasks = await this.request<TaskStatus[]>('GET', `/tasks/?task_id=${taskId}`)
      const task = tasks[0]

      if (!task) throw new Error(`Task ${taskId} not found`)
      if (task.status === 'SUCCESS' && task.related_document !== null) {
        return task.related_document
      }
      if (task.status === 'FAILURE') {
        throw new Error(`Paperless task ${taskId} failed`)
      }

      await sleep(interval)
    }

    throw new Error(`Paperless task ${taskId} timed out after ${timeoutMs}ms`)
  }

  async getDocument (id: number): Promise<PaperlessDocument> {
    return this.request<PaperlessDocument>('GET', `/documents/${id}/`)
  }

  async downloadOriginal (id: number): Promise<Buffer> {
    const url = `${this.baseUrl}/api/documents/${id}/download/`
    const res = await fetch(url, { headers: this.headers })
    if (!res.ok) throw new Error(`Paperless download failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async downloadArchived (id: number): Promise<Buffer> {
    const url = `${this.baseUrl}/api/documents/${id}/preview/`
    const res = await fetch(url, { headers: this.headers })
    if (!res.ok) throw new Error(`Paperless archived download failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async search (query: string, limit = 10): Promise<PaperlessDocument[]> {
    const params = new URLSearchParams({ query, page_size: String(limit) })
    const result = await this.request<PaginatedResult<PaperlessDocument>>(
      'GET',
      `/documents/?${params}`
    )
    return result.results
  }

  async list (page = 1, pageSize = 25): Promise<PaperlessDocument[]> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const result = await this.request<PaginatedResult<PaperlessDocument>>(
      'GET',
      `/documents/?${params}`
    )
    return result.results
  }

  async ensureTag (name: string): Promise<number> {
    const existing = await this.request<PaginatedResult<TagOrType>>(
      'GET',
      `/tags/?name=${encodeURIComponent(name)}`
    )
    if (existing.results.length > 0) return existing.results[0].id

    const created = await this.request<TagOrType>('POST', '/tags/', { name })
    return created.id
  }

  async ensureDocumentType (name: string): Promise<number> {
    const existing = await this.request<PaginatedResult<TagOrType>>(
      'GET',
      `/document_types/?name=${encodeURIComponent(name)}`
    )
    if (existing.results.length > 0) return existing.results[0].id

    const created = await this.request<TagOrType>('POST', '/document_types/', { name })
    return created.id
  }

  async updateDocument (id: number, updates: Partial<PaperlessDocument>): Promise<void> {
    await this.request<unknown>('PATCH', `/documents/${id}/`, updates)
  }
}

function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
