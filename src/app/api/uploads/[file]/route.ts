import fs from 'node:fs'
import path from 'node:path'
import { errorResponse, handleRouteError } from '@/lib/server/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { file: string } }

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/** GET /api/uploads/:file → 讀回上傳的檔案（附件預覽用） */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const name = path.basename(decodeURIComponent(params.file))
    const filePath = path.join(process.cwd(), 'data', 'uploads', name)

    // 防目錄穿越
    const uploadsRoot = path.join(process.cwd(), 'data', 'uploads')
    if (!path.resolve(filePath).startsWith(path.resolve(uploadsRoot))) {
      return errorResponse(400, 'INVALID_PATH', '不合法的檔案路徑')
    }
    if (!fs.existsSync(filePath)) {
      return errorResponse(404, 'FILE_NOT_FOUND', '找不到檔案')
    }

    const ext = (name.split('.').pop() ?? '').toLowerCase()
    const buffer = fs.readFileSync(filePath)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
