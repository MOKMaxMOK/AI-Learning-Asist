/**
 * HTTP / SSE 客戶端 —— 【後端接入說明】
 * ============================================================
 * 1. 環境變數：複製 .env.example 為 .env.local，設定
 *      NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
 *    前端所有請求都會自動加上此前綴，程式內沒有任何 hardcode 網址
 *    （uploadFiles 因使用 XMLHttpRequest 需手動取值，見該函數）。
 *
 * 2. 身分驗證：若後端需要登入，請修改 authHeaders()，例如：
 *      return { Authorization: `Bearer ${getToken()}` }
 *    token 來源依你的登入實作（cookie / zustand persist 皆可）。
 *
 * 3. 統一錯誤格式（ApiError 會讀取 body.error）：
 *      失敗時回傳 HTTP 4xx/5xx + JSON：
 *      { "error": { "code": "CONVERSATION_NOT_FOUND", "message": "..." } }
 *
 * 4. SSE 串流協議（AI 回覆）見 streamChat() 內註解。
 */

import type { MessageAnnotation } from '@/lib/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeaders(): Record<string, string> {
  // TODO(後端接入): 需要登入時在此加入 Authorization header
  return {}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let code = 'UNKNOWN'
    let message = `請求失敗（HTTP ${res.status}）`
    try {
      const body = await res.json()
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      /* body 非 JSON 時使用預設訊息 */
    }
    throw new ApiError(res.status, code, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/* ============================================================
 * SSE 串流（AI 回覆）
 * ------------------------------------------------------------
 * 【後端接口】POST /api/conversations/:id/chat
 *   Headers: Authorization（如有）、Content-Type: application/json
 *   Request Body:
 *     { "content": "用戶訊息",
 *       "attachmentIds": ["..."],
 *       "regenerateOf": "訊息id(重新生成時)",
 *       "subjectId": "本次對話的學科id" }
 *   Response: Content-Type: text/event-stream（HTTP 200）
 *     文字片段：  data: {"delta": "片段文字"}\n\n
 *     標註資訊：  data: {"annotation": {
 *                    "subjectId": "...", "subjectName": "數學",
 *                    "knowledgePoints": [{ "id": "kp-1", "name": "三角函數", "status": "weak" }],
 *                    "mistakes": [{ "id": "m-1", "type": "計算錯誤", "question": "..." }],
 *                    "studyType": "learn", "studySeconds": 180
 *                  }}\n\n
 *     結束信號：  data: [DONE]\n\n
 *     annotation 事件可出現在串流任何位置（通常為最後一筆），
 *     前端收到後掛到該則 AI 訊息上，供 Analyze 板塊統計使用。
 *   錯誤：串流建立前回傳 4xx/5xx JSON（錯誤格式同上方說明）；
 *         串流中途斷線會由前端 catch，將訊息標為 error 並提供重試。
 * ============================================================ */
export interface StreamHandlers {
  /** 每收到一段文字就呼叫（前端逐字渲染 + 游標閃爍） */
  onDelta: (delta: string) => void
  /** 收到 AI 標註（學科 / 知識點 / 錯題 / 學習型態）時呼叫 */
  onAnnotation?: (annotation: MessageAnnotation) => void
  /** 收到後端真正落庫的訊息 id（校正樂觀插入的臨時 id） */
  onIds?: (ids: { userMessageId?: string; assistantMessageId?: string }) => void
  /** 由 AbortController 提供，供「停止生成」使用 */
  signal?: AbortSignal
}

export async function streamChat(
  conversationId: string,
  payload: {
    content: string
    attachmentIds?: string[]
    regenerateOf?: string
    subjectId?: string
    /** 前端樂觀插入的訊息 id；後端沿用同一 id，重整後不會出現重複訊息 */
    userMessageId?: string
  },
  { onDelta, onAnnotation, onIds, signal }: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok || !res.body) {
    let message = '串流請求失敗'
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, 'STREAM_FAILED', message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data) as {
          delta?: string
          annotation?: MessageAnnotation
          ids?: { userMessageId?: string; assistantMessageId?: string }
          error?: { code?: string; message?: string }
        }
        if (parsed.error) {
          // 串流中途的錯誤（例如 LLM 未綁定、模型呼叫失敗）→ 交由呼叫端標為錯誤並提供重試
          throw new ApiError(502, parsed.error.code ?? 'STREAM_ERROR', parsed.error.message ?? '生成回覆失敗')
        }
        if (parsed.delta) onDelta(parsed.delta)
        if (parsed.annotation) onAnnotation?.(parsed.annotation)
        if (parsed.ids) onIds?.(parsed.ids)
      } catch (e) {
        if (e instanceof ApiError) throw e
        /* 忽略非 JSON 的行（例如 heartbeat） */
      }
    }
  }
}
