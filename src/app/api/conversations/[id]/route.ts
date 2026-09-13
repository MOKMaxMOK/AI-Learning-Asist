import { toConversation } from '@/lib/db/mappers'
import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { findConversation, findSubjectById } from '@/lib/server/queries'
import { getRawDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/** GET /api/conversations/:id */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const row = findConversation(params.id)
    if (!row) return errorResponse(404, 'CONVERSATION_NOT_FOUND', '找不到這個對話')
    return json(toConversation(row))
  } catch (e) {
    return handleRouteError(e)
  }
}

/** PATCH /api/conversations/:id { title?, tagId? | subjectId? } */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const existing = findConversation(params.id)
    if (!existing) return errorResponse(404, 'CONVERSATION_NOT_FOUND', '找不到這個對話')

    const body = await readJson<{ title?: string; tagId?: string; subjectId?: string }>(req)
    const title = body.title?.trim()
    const subjectId = (body.subjectId ?? body.tagId)?.trim()

    if (subjectId && !findSubjectById(subjectId)) {
      return errorResponse(404, 'SUBJECT_NOT_FOUND', '找不到這個學科')
    }
    if (!title && !subjectId) {
      return errorResponse(400, 'NOTHING_TO_UPDATE', '沒有要更新的欄位')
    }

    const db = getRawDb()
    if (title) db.prepare(`UPDATE conversations SET title = ? WHERE id = ?`).run(title, params.id)
    if (subjectId) {
      db.prepare(`UPDATE conversations SET subject_id = ? WHERE id = ?`).run(subjectId, params.id)
    }
    db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(params.id)

    return json(toConversation(findConversation(params.id)!))
  } catch (e) {
    return handleRouteError(e)
  }
}

/** DELETE /api/conversations/:id（連帶刪除訊息、標註、錯題、學習紀錄） */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const existing = findConversation(params.id)
    if (!existing) return errorResponse(404, 'CONVERSATION_NOT_FOUND', '找不到這個對話')
    getRawDb().prepare(`DELETE FROM conversations WHERE id = ?`).run(params.id)
    return new Response(null, { status: 204 })
  } catch (e) {
    return handleRouteError(e)
  }
}
