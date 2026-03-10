import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'

const TMP_DIR = path.join(os.tmpdir(), 'paperclaw')

export async function ensureTmpDir (): Promise<void> {
  await fs.mkdir(TMP_DIR, { recursive: true })
}

export async function saveTmpFile (buffer: Buffer, filename: string): Promise<string> {
  await ensureTmpDir()
  const ext = path.extname(filename)
  const tmpPath = path.join(TMP_DIR, `${uuidv4()}${ext}`)
  await fs.writeFile(tmpPath, buffer)
  return tmpPath
}

export async function readFile (filePath: string): Promise<Buffer> {
  return fs.readFile(filePath)
}

export async function deleteTmpFile (filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // ignore
  }
}

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export function getMimeType (filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}
