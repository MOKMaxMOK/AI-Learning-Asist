import fs from 'node:fs'
import path from 'node:path'
import { errorResponse, handleRouteError, json } from '@/lib/server/http'
import type { AttachmentMeta } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 上傳限制（與前端 UI 一致） */
const ALLOWED_EXT = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

function uploadDir(): string {
  const dir = path.join(process.cwd(), 'data', 'uploads')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * POST /api/uploads —— multipart/form-data，欄位名「files」（可多檔）
 * 檔案存到 ./data/uploads/<id>.<ext>，回傳 AttachmentMeta[]（順序與上傳檔案一致）
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const files = form.getAll('files').filter((f): f is File => f instanceof File)

    if (files.length === 0) return errorResponse(400, 'NO_FILE', '沒有收到任何檔案')
    if (files.length > MAX_FILES) {
      return errorResponse(400, 'TOO_MANY_FILES', `單次最多 ${MAX_FILES} 個檔案`)
    }

    const results: AttachmentMeta[] = []
    for (const file of files) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()
      if (!ALLOWED_EXT.includes(ext)) {
        return errorResponse(400, 'UNSUPPORTED_TYPE', `不支援的檔案格式：${file.name}`)
      }
      if (file.size > MAX_SIZE) {
        return errorResponse(400, 'FILE_TOO_LARGE', `檔案超過 10MB：${file.name}`)
      }

      const id = `att_${crypto.randomUUID()}`
      const stored = `${id}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
      fs.writeFileSync(path.join(uploadDir(), stored), buffer)

      results.push({
        id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || MIME_BY_EXT[ext] || 'application/octet-stream',
        fileUrl: `/api/uploads/${stored}`,
      })
    }

    return json(results, { status: 201 })
  } catch (e) {
    return handleRouteError(e)
  }
}
