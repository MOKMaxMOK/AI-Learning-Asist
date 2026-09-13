import { ApiError } from '@/lib/api/client'
import { toSubject } from '@/lib/db/mappers'
import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { createSubject, findSubjectByName, listSubjects } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/subjects → 學科列表（含預設三學科） */
export async function GET() {
  try {
    return json(listSubjects().map(toSubject))
  } catch (e) {
    return handleRouteError(e)
  }
}

/** POST /api/subjects { name, color? } → 新增學科 */
export async function POST(req: Request) {
  try {
    const body = await readJson<{ name?: string; color?: string }>(req)
    const name = body.name?.trim()
    if (!name) return errorResponse(400, 'INVALID_NAME', '請輸入學科名稱')
    if (name.length > 20) return errorResponse(400, 'INVALID_NAME', '學科名稱最多 20 個字')
    if (findSubjectByName(name)) {
      return errorResponse(409, 'SUBJECT_DUPLICATE', '此學科已存在')
    }
    const created = createSubject({ name, color: body.color })
    return json(toSubject(created), { status: 201 })
  } catch (e) {
    if (e instanceof ApiError) return handleRouteError(e)
    return handleRouteError(e)
  }
}
