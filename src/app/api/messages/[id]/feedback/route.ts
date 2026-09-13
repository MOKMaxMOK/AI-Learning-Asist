import { errorResponse, handleRouteError, readJson } from '@/lib/server/http'
import { findMessage } from '@/lib/server/queries'
import { getRawDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/** POST /api/messages/:id/feedback { feedback: 'up' | 'down', reason? } → 204 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const message = findMessage(params.id)
    if (!message) return errorResponse(404, 'MESSAGE_NOT_FOUND', '找不到這則訊息')

    const body = await readJson<{ feedback?: string; reason?: string }>(req)
    if (body.feedback !== 'up' && body.feedback !== 'down') {
      return errorResponse(400, 'INVALID_FEEDBACK', 'feedback 必須是 up 或 down')
    }

    getRawDb()
      .prepare(`UPDATE messages SET feedback = ?, feedback_reason = ? WHERE id = ?`)
      .run(body.feedback, body.reason ?? null, params.id)

    return new Response(null, { status: 204 })
  } catch (e) {
    return handleRouteError(e)
  }
}
