import { ApiError } from '@/lib/api/client'
import { toConversation } from '@/lib/db/mappers'
import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { createConversation, findSubjectById, listConversations } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/conversations → 對話列表（含學科，依 updatedAt 降序） */
export async function GET() {
  try {
    return json(listConversations().map(toConversation))
  } catch (e) {
    return handleRouteError(e)
  }
}

/** POST /api/conversations { title, tagId | subjectId } → 建立對話 */
export async function POST(req: Request) {
  try {
    const body = await readJson<{ title?: string; tagId?: string; subjectId?: string }>(req)
    const title = body.title?.trim()
    const subjectId = (body.subjectId ?? body.tagId ?? '').trim()
    if (!title) return errorResponse(400, 'INVALID_TITLE', '請輸入對話名稱')
    if (!subjectId) return errorResponse(400, 'INVALID_SUBJECT', '請選擇學科')
    if (!findSubjectById(subjectId)) {
      return errorResponse(404, 'SUBJECT_NOT_FOUND', '找不到這個學科')
    }
    return json(toConversation(createConversation({ title, subjectId })), { status: 201 })
  } catch (e) {
    if (e instanceof ApiError) return handleRouteError(e)
    return handleRouteError(e)
  }
}
