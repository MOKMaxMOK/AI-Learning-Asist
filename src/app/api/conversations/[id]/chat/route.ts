import { ApiError } from '@/lib/api/client'
import { errorResponse, handleRouteError, readJson } from '@/lib/server/http'
import { findConversation } from '@/lib/server/queries'
import { createChatStream, type ChatRequestPayload } from '@/lib/server/chat-stream'
import { SSE_HEADERS } from '@/lib/server/sse'

export const runtime = 'nodejs'
/** 串流回覆必須動態執行，不能被靜態化或快取 */
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/**
 * POST /api/conversations/:id/chat
 * Body: { content, attachmentIds?, regenerateOf?, subjectId? }
 * Response: text/event-stream
 *   data: {"delta": "..."}
 *   data: {"annotation": {...}}
 *   data: [DONE]
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const conversation = findConversation(params.id)
    if (!conversation) return errorResponse(404, 'CONVERSATION_NOT_FOUND', '找不到這個對話')

    const payload = await readJson<ChatRequestPayload>(req)
    if (!payload.content?.trim() && !payload.regenerateOf) {
      return errorResponse(400, 'EMPTY_MESSAGE', '訊息內容不可為空')
    }

    const sse = createChatStream({ conversationId: params.id, payload })
    return new Response(sse.stream, { headers: { ...SSE_HEADERS } })
  } catch (e) {
    if (e instanceof ApiError) return handleRouteError(e)
    return handleRouteError(e)
  }
}
