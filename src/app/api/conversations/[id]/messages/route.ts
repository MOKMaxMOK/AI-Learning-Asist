import { toMessage } from '@/lib/db/mappers'
import { errorResponse, handleRouteError, json } from '@/lib/server/http'
import { findConversation, loadConversationMessages } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/**
 * GET /api/conversations/:id/messages?cursor=&limit=
 * 回傳 { items: Message[], nextCursor: string | null }（前端契約）
 * 目前一次回傳整個對話（本地 SQLite，資料量小），cursor 保留給未來分頁。
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const conversation = findConversation(params.id)
    if (!conversation) return errorResponse(404, 'CONVERSATION_NOT_FOUND', '找不到這個對話')

    const url = new URL(req.url)
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw))) : null

    const all = loadConversationMessages(params.id)
    const items = limit ? all.slice(-limit) : all

    return json({
      items: items.map((m) =>
        toMessage(
          {
            id: m.id,
            conversationId: m.conversationId,
            role: m.role,
            content: m.content,
            attachments: m.attachments,
            feedback: m.feedback,
            feedbackReason: m.feedbackReason,
            createdAt: m.createdAt,
          },
          m.annotation,
        ),
      ),
      nextCursor: null,
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
