/**
 * 學科（向後相容路徑）
 * 前端設定 TAGS 資源為空時會自動 fallback 到 /api/subjects，
 * 這裡提供相同資料，讓 /api/tags 這個舊路徑也能用。
 */

import { toSubject } from '@/lib/db/mappers'
import { handleRouteError, json, readJson, errorResponse } from '@/lib/server/http'
import { createSubject, findSubjectByName, listSubjects } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return json(listSubjects().map(toSubject))
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<{ name?: string }>(req)
    const name = body.name?.trim()
    if (!name) return errorResponse(400, 'INVALID_NAME', '請輸入學科名稱')
    if (findSubjectByName(name)) return errorResponse(409, 'TAG_DUPLICATE', '此學科已存在')
    return json(toSubject(createSubject({ name })), { status: 201 })
  } catch (e) {
    return handleRouteError(e)
  }
}
