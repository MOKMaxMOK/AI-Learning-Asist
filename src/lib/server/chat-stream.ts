/**
 * Chat 串流主流程（POST /api/conversations/:id/chat）
 * ============================================================
 * 流程：
 *   1. 存入使用者訊息（沿用前端帶來的 userMessageId）
 *   2. 載入對話歷史 → 交給 LLM 串流回覆（Vercel AI SDK）
 *   3. 逐段把 delta 以 SSE 推給前端
 *   4. 串流結束 → 抽出 AI 標註（學科 / 知識點 / 錯題 / 學習型態 / 學習秒數）
 *   5. 存入 AI 訊息 + 標註 + 知識點 + 錯題 + 學習時間（Analyze 的資料來源）
 *   6. 以 SSE 送出訊息 id 與標註，最後送 [DONE]
 *
 * 使用的模型來自「設置 → LLM 綁定」目前使用中的那筆綁定；
 * 未綁定或呼叫失敗時，串流中以錯誤事件回報，前端可重試。
 */

import { streamText } from 'ai'
import { createLanguageModel, resolveLlmConfig, validateLlmConfig } from '@/lib/llm/client'
import { extractAnnotation } from '@/lib/llm/annotate'
import {
  applyAnnotation,
  findConversation,
  insertMessage,
  listMessages,
  listSubjects,
} from '@/lib/server/queries'
import { getRawDb } from '@/lib/db'
import { SseStream } from '@/lib/server/sse'
import type { MessageAnnotation } from '@/lib/types'

/** 給 LLM 的教師人格 */
const TEACHER_SYSTEM_PROMPT = `你是一位耐心、專業的 AI 老師，協助學生學習。
要求：
1. 用學生使用的語言回答（預設繁體中文）。
2. 解說要循序漸進、條理分明；數學與理科請寫出推導步驟。
3. 學生答錯時，先指出錯在哪裡，再給正確做法與提醒，不要只給答案。
4. 内容使用純文字與簡單 Markdown（粗體、清單、程式碼區塊），不要輸出 HTML。
5. 回覆長度適中，重點清楚，不要客套話。`

export interface ChatRequestPayload {
  content: string
  attachmentIds?: string[]
  regenerateOf?: string
  subjectId?: string
  /** 前端樂觀插入的使用者訊息 id；後端沿用同一個 id，避免重整後出現重複訊息 */
  userMessageId?: string
}

export interface RunChatStreamOptions {
  conversationId: string
  payload: ChatRequestPayload
  /** 直接提供已有的 SseStream（給需要先寫入 header 的路由用） */
  sse?: SseStream
}

export function createChatStream({ conversationId, payload }: RunChatStreamOptions): SseStream {
  const sse = new SseStream()
  void runChat({ conversationId, payload, sse })
  return sse
}

async function runChat({ conversationId, payload, sse }: Required<RunChatStreamOptions>) {
  try {
    const conversation = findConversation(conversationId)
    if (!conversation) {
      sse.sendError('找不到這個對話', 'CONVERSATION_NOT_FOUND')
      sse.done()
      return
    }

    const content = payload.content?.trim() ?? ''
    const subjectId = payload.subjectId || conversation.subjectId
    const subjectName =
      listSubjects().find((s) => s.id === subjectId)?.name ?? conversation.subjectName ?? '未分類'

    /* 1. 使用者訊息（重新生成時不重複寫入） */
    if (!payload.regenerateOf) {
      insertMessage({
        id: payload.userMessageId,
        conversationId,
        role: 'user',
        content,
      })
    } else {
      // 重新生成：把原本的 AI 回覆與其標註一起移除後重做
      removeMessageCascade(payload.regenerateOf)
    }

    /* 2. 對話歷史（最近 20 則，避免過長） */
    const history = listMessages(conversationId)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.content.trim().length > 0)
      .slice(-20)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    /* 3. LLM 綁定檢查（金鑰只來自「設置 → LLM 綁定」的使用者輸入） */
    const config = resolveLlmConfig()
    const problem = validateLlmConfig(config)
    if (problem || !config) {
      sse.sendError(problem ?? '尚未綁定模型', 'LLM_NOT_CONFIGURED')
      sse.done()
      return
    }
    const boundModel = config.model

    const model = createLanguageModel(config)
    const result = streamText({
      model,
      system: TEACHER_SYSTEM_PROMPT,
      messages: history.length ? history : [{ role: 'user', content }],
      temperature: 0.6,
    })

    let fullText = ''
    for await (const delta of result.textStream) {
      if (sse.aborted) break
      fullText += delta
      sse.sendDelta(delta)
    }

    if (sse.aborted) {
      // 使用者按了停止：保留已生成內容
      if (fullText.trim()) persistAssistant({ conversationId, content: fullText, model: boundModel })
      sse.done()
      return
    }

    if (!fullText.trim()) {
      // 模型沒有輸出（例如只回 reasoning_content）
      const fallback = await safeReasoningText(result)
      fullText = fallback || '（模型沒有回傳內容，請確認模型名稱與 Base URL 是否正確，或再試一次。）'
      sse.sendDelta(fullText)
    }

    /* 4. AI 標註抽取 */
    const knownKnowledgePoints = findKnowledgePointNames(subjectId)
    const { annotation } = await extractAnnotation({
      subjectId,
      subjectName,
      userMessage: content,
      assistantMessage: fullText,
      knownKnowledgePoints,
    })

    /* 5. 寫入訊息 + 標註 */
    const assistantMessageId = persistAssistant({
      conversationId,
      content: fullText,
      model: boundModel,
    })

    let resolvedAnnotation: MessageAnnotation = annotation
    if (assistantMessageId) {
      const applied = applyAnnotation({
        messageId: assistantMessageId,
        conversationId,
        annotation,
        fallbackSubjectId: subjectId,
      })

      // 把 tmp id 換成資料庫真正的 id，回傳給前端顯示
      const kpIds = applied.knowledgePointIds
      resolvedAnnotation = {
        ...annotation,
        subjectId: applied.subjectId,
        knowledgePoints: annotation.knowledgePoints?.map((kp, i) => ({
          id: kpIds[i] ?? kp.id,
          name: kp.name,
          status: kp.status,
        })),
        mistakes: annotation.mistakes?.map((m, i) => ({
          ...m,
          id: applied.mistakeIds[i] ?? m.id,
        })),
      }
    }

    /* 6. 送出訊息 id + 標註 + 結束 */
    sse.sendIds({
      userMessageId: payload.userMessageId,
      assistantMessageId: assistantMessageId ?? undefined,
    })
    sse.sendAnnotation(resolvedAnnotation)
    sse.done()
  } catch (e) {
    const message = e instanceof Error ? e.message : '生成回覆時發生未知錯誤'
    console.error('[chat-stream]', e)
    sse.sendError(message, 'STREAM_FAILED')
    sse.done()
  }
}

/** 模型只回 reasoning 時，盡量取出可讀文字 */
async function safeReasoningText(result: {
  reasoningText: PromiseLike<string | undefined>
}): Promise<string> {
  try {
    const text = await result.reasoningText
    return (text ?? '').trim()
  } catch {
    return ''
  }
}

function persistAssistant(input: {
  conversationId: string
  content: string
  model: string
}): string | null {
  try {
    const row = insertMessage({
      conversationId: input.conversationId,
      role: 'assistant',
      content: input.content,
      model: input.model,
    })
    return row.id
  } catch (e) {
    console.error('[chat-stream] 儲存 AI 訊息失敗', e)
    return null
  }
}

/** 重新生成時清掉舊的 AI 訊息（連帶標註 / 錯題 / 學習紀錄） */
function removeMessageCascade(messageId: string) {
  const db = getRawDb()
  db.prepare(`DELETE FROM messages WHERE id = ?`).run(messageId)
  db.prepare(`DELETE FROM study_sessions WHERE message_id = ?`).run(messageId)
  db.prepare(`DELETE FROM mistakes WHERE message_id = ?`).run(messageId)
  db.prepare(`DELETE FROM message_knowledge_points WHERE message_id = ?`).run(messageId)
}

function findKnowledgePointNames(subjectId: string): string[] {
  const rows = getRawDb()
    .prepare(`SELECT name FROM knowledge_points WHERE subject_id = ? ORDER BY use_count DESC LIMIT 40`)
    .all(subjectId) as Array<{ name: string }>
  return rows.map((r) => r.name)
}
