import fs from 'fs/promises'
import type { ToolRegistry } from './registry.ts'
import { PaperlessClient } from '../clients/paperless.ts'

const paperless = new PaperlessClient()

export function registerPaperlessTools (registry: ToolRegistry): void {
  registry.register('paperless_upload', async (input) => {
    const { filePath, title, tags, documentType } = input as {
      filePath: string
      title?: string
      tags?: string[]
      documentType?: string
    }

    const file = await fs.readFile(filePath)
    const filename = filePath.split('/').pop() ?? 'document'

    const tagIds: number[] = []
    if (tags) {
      for (const tag of tags) tagIds.push(await paperless.ensureTag(tag))
    }

    let documentTypeId: number | undefined
    if (documentType) {
      documentTypeId = await paperless.ensureDocumentType(documentType)
    }

    const taskId = await paperless.upload(file, filename, {
      title,
      tags: tagIds.length > 0 ? tagIds : undefined,
      documentType: documentTypeId,
    })

    const documentId = await paperless.awaitTask(taskId)
    const doc = await paperless.getDocument(documentId)
    return { documentId, title: doc.title, content: doc.content }
  })

  registry.register('paperless_get', async (input) => {
    const { documentId } = input as { documentId: number }
    return paperless.getDocument(documentId)
  })

  registry.register('paperless_download', async (input) => {
    const { documentId } = input as { documentId: number }
    const buffer = await paperless.downloadOriginal(documentId)
    return { data: buffer.toString('base64'), mimeType: 'application/octet-stream' }
  })

  registry.register('paperless_search', async (input) => {
    const { query, limit } = input as { query: string; limit?: number }
    return paperless.search(query, limit)
  })

  registry.register('paperless_list', async (input) => {
    const { page, pageSize } = input as { page?: number; pageSize?: number }
    return paperless.list(page, pageSize)
  })

  registry.register('paperless_update', async (input) => {
    const { documentId, title, tags, documentType } = input as {
      documentId: number
      title?: string
      tags?: string[]
      documentType?: string
    }

    const tagIds: number[] = []
    if (tags) {
      for (const tag of tags) tagIds.push(await paperless.ensureTag(tag))
    }

    let documentTypeId: number | undefined
    if (documentType) {
      documentTypeId = await paperless.ensureDocumentType(documentType)
    }

    await paperless.updateDocument(documentId, {
      title,
      tags: tagIds.length > 0 ? tagIds : undefined,
      document_type: documentTypeId ?? null,
    })

    return { success: true }
  })
}
