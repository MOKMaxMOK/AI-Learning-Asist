import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { getRawDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

function findItem(id: string) {
  return getRawDb()
    .prepare(`SELECT id, date, content, done FROM daily_checklist WHERE id = ?`)
    .get(id) as { id: string; date: string; content: string; done: number } | undefined
}

/** PATCH /api/daily-checklist/:id { content?, done? } → 勾選 / 編輯 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const item = findItem(params.id)
    if (!item) return errorResponse(404, 'CHECKLIST_NOT_FOUND', '找不到這個清單項')

    const body = await readJson<{ content?: string; done?: boolean }>(req)
    const db = getRawDb()

    if (typeof body.content === 'string') {
      const content = body.content.trim()
      if (!content) return errorResponse(400, 'EMPTY_CONTENT', '清單內容不可為空')
      db.prepare(`UPDATE daily_checklist SET content = ? WHERE id = ?`).run(content, params.id)
    }
    if (typeof body.done === 'boolean') {
      db.prepare(`UPDATE daily_checklist SET done = ? WHERE id = ?`).run(body.done ? 1 : 0, params.id)
    }

    const updated = findItem(params.id)!
    return json({
      id: updated.id,
      content: updated.content,
      done: !!updated.done,
      order: 0,
      createdAt: new Date().toISOString(),
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

/** DELETE /api/daily-checklist/:id → 204 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const item = findItem(params.id)
    if (!item) return errorResponse(404, 'CHECKLIST_NOT_FOUND', '找不到這個清單項')
    getRawDb().prepare(`DELETE FROM daily_checklist WHERE id = ?`).run(params.id)
    return new Response(null, { status: 204 })
  } catch (e) {
    return handleRouteError(e)
  }
}
