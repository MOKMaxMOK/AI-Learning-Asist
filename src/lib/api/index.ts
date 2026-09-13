/**
 * 後端 API 接口總表 —— 【接入說明】
 * ============================================================
 * 基礎網址：NEXT_PUBLIC_API_BASE_URL（.env.local）
 * 驗證方式：修改 src/lib/api/client.ts 的 authHeaders()
 * 錯誤格式：{ "error": { "code": string, "message": string } }
 *
 * 「學科」= 舊版文件中的 Tag，API 路徑沿用 /api/tags 以維持相容，
 * 另提供 /api/subjects 作為學科列表的語意化別名。
 *
 * | 方法   | 路徑                                          | 說明                     | 函數                       |
 * |--------|-----------------------------------------------|--------------------------|----------------------------|
 * | GET    | /api/tags                                     | 學科列表                 | listTags / listSubjects    |
 * | POST   | /api/tags                                     | 新增學科 { name }        | createTag                  |
 * | GET    | /api/conversations                            | 對話列表（含學科）       | listConversations          |
 * | POST   | /api/conversations                            | 建立對話 { title, tagId }| createConversation         |
 * | PATCH  | /api/conversations/:id                        | 重新命名/更改學科        | updateConversation         |
 * | DELETE | /api/conversations/:id                        | 刪除對話                 | deleteConversation         |
 * | GET    | /api/conversations/:id/messages?cursor=&limit=| 訊息列表（分頁）         | listMessages               |
 * | POST   | /api/conversations/:id/messages               | 送訊息 → SSE 串流        | streamChat（client.ts）    |
 * | POST   | /api/messages/:id/feedback                    | 訊息反饋                 | postFeedback               |
 * | POST   | /api/uploads                                  | 檔案上傳（multipart）    | uploadFiles                |
 * | GET    | /api/conversations/:id/export?format=pdf      | 匯出 PDF（前端已預留）   | exportConversation         |
 *
 * 各函數回傳型別定義在 src/lib/types.ts，前後端欄位需保持一致。
 */

import { apiFetch } from './client'
import type {
  AnalyzeOverview,
  AttachmentMeta,
  ChecklistItem,
  Conversation,
  DailyChecklist,
  DailyChecklistWeek,
  LlmBindingInput,
  LlmSettingsPayload,
  LlmTestResult,
  Message,
  MistakeStats,
  ResetOptions,
  ResetSummary,
  StudyTimeDetail,
  StudyTimeTimeline,
  Subject,
  SubjectHeatmap,
  Tag,
  TimeGranularity,
} from '@/lib/types'

export { streamChat, ApiError } from './client'
import { ApiError } from './client'

/* ---------- 學科（Subjects / 舊稱 Tags） ---------- */

/** GET /api/tags → 學科列表 */
export function listTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('/api/tags')
}

/** 學科列表：GET /api/subjects（後端未實作時退回 /api/tags） */
export async function listSubjects(): Promise<Subject[]> {
  try {
    return await apiFetch<Subject[]>('/api/subjects')
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return apiFetch<Subject[]>('/api/tags')
    throw e
  }
}

/** POST /api/subjects { name } → 學科；重複名稱回傳 409 code: SUBJECT_DUPLICATE */
export function createTag(name: string): Promise<Tag> {
  return apiFetch<Tag>('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) })
}

/* ---------- Conversations ---------- */

/** GET /api/conversations → Conversation[]（建議依 updatedAt 降序） */
export function listConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/conversations')
}

/** POST /api/conversations { title, tagId } → Conversation */
export function createConversation(input: { title: string; tagId: string }): Promise<Conversation> {
  return apiFetch<Conversation>('/api/conversations', { method: 'POST', body: JSON.stringify(input) })
}

/** PATCH /api/conversations/:id { title?, tagId? } → Conversation */
export function updateConversation(
  id: string,
  patch: { title?: string; tagId?: string },
): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** DELETE /api/conversations/:id → 204 */
export function deleteConversation(id: string): Promise<void> {
  return apiFetch<void>(`/api/conversations/${id}`, { method: 'DELETE' })
}

/* ---------- Messages ---------- */

/** GET /api/conversations/:id/messages?cursor=&limit= → { items: Message[], nextCursor: string | null }
 *  若後端直接回傳 Message[] 也可，請把 listMessages 的回傳型別改成 Message[]。 */
export function listMessages(
  conversationId: string,
  cursor?: string,
): Promise<{ items: Message[]; nextCursor: string | null }> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return apiFetch<{ items: Message[]; nextCursor: string | null }>(
    `/api/conversations/${conversationId}/messages${qs}`,
  )
}

/** POST /api/messages/:id/feedback { feedback: 'up' | 'down', reason? } → 204 */
export function postFeedback(
  messageId: string,
  input: { feedback: 'up' | 'down'; reason?: string },
): Promise<void> {
  return apiFetch<void>(`/api/messages/${messageId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/* ---------- Uploads ---------- */

export interface UploadResult extends AttachmentMeta {
  /** 前端暫存用：上傳進度 0-100 */
  progress?: number
}

/**
 * POST /api/uploads —— multipart/form-data，欄位名「files」（可多檔）
 * 回傳 AttachmentMeta[]，順序與上傳檔案一致。
 * 使用 XMLHttpRequest 以取得真實上傳進度事件。
 */
export function uploadFiles(
  files: File[],
  onProgress: (percent: number) => void,
): Promise<AttachmentMeta[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api/uploads`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as AttachmentMeta[])
        } catch {
          reject(new Error('上傳回應格式錯誤'))
        }
      } else {
        let message = `上傳失敗（HTTP ${xhr.status}）`
        try {
          message = (JSON.parse(xhr.responseText) as { error?: { message?: string } })?.error?.message ?? message
        } catch {
          /* ignore */
        }
        reject(new Error(message))
      }
    }
    xhr.onerror = () => reject(new Error('網路錯誤，上傳失敗'))
    xhr.send(form)
  })
}

/* ---------- Export ---------- */

/** GET /api/conversations/:id/export?format=pdf → 二進位檔案（Content-Disposition: attachment）
 *  前端使用方式見 components/dialogs.tsx 的 ExportDialog（動態 import 避免 SSR 問題）。 */
export function exportConversationUrl(conversationId: string, format: 'pdf'): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api/conversations/${conversationId}/export?format=${format}`
}


/* ---------- Analyze（分析板塊） ----------
 * 【後端接入】分析圖表資料由 Chat 板塊非同步產生：每則 AI 回覆都會附帶
 * annotation（學科 / 知識點 / 錯題 / 學習型態 / 學習秒數，見 types.ts
 * MessageAnnotation），後端彙整後由下列接口提供前端查詢。
 *
 * 導覽層級與對應接口：
 *   一級入口（/analyze 首頁）
 *     ├─ 1. 學科分析   GET /api/analyze/overview              圓餅圖（學科佔比）
 *     │     └─ 二級    GET /api/analyze/subjects/:id/heatmap   知識點熱力圖
 *     │           └─ 三級 GET /api/analyze/knowledge-points/:id/mistakes 錯題統計
 *     ├─ 2. 學習時間記錄 GET /api/analyze/study-time?granularity=week|month|year
 *     │                 GET /api/analyze/study-time/:date      當日明細
 *     └─ 3. 每日清單    GET /api/daily-checklist?date=
 *                       POST /api/daily-checklist             新增清單項
 *                       PATCH /api/daily-checklist/:id        勾選 / 編輯
 *                       DELETE /api/daily-checklist/:id       刪除
 */

/** GET /api/analyze/overview?subjectId= → 學科分析總覽（圓餅圖 + 首頁摘要） */
export function getAnalyzeOverview(subjectId?: string): Promise<AnalyzeOverview> {
  const qs = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : ''
  return apiFetch<AnalyzeOverview>(`/api/analyze/overview${qs}`)
}

/** GET /api/analyze/subjects/:id/heatmap → 二級：該學科的知識點熱力圖 */
export function getSubjectHeatmap(subjectId: string): Promise<SubjectHeatmap> {
  return apiFetch<SubjectHeatmap>(`/api/analyze/subjects/${subjectId}/heatmap`)
}

/** GET /api/analyze/knowledge-points/:id/mistakes → 三級：錯題統計 + 類型排行 */
export function getKnowledgePointMistakes(
  knowledgePointId: string,
  params?: { subjectId?: string; limit?: number; cursor?: string },
): Promise<MistakeStats> {
  const qs = new URLSearchParams()
  if (params?.subjectId) qs.set('subjectId', params.subjectId)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.cursor) qs.set('cursor', params.cursor)
  const suffix = qs.toString() ? `?${qs}` : ''
  return apiFetch<MistakeStats>(
    `/api/analyze/knowledge-points/${knowledgePointId}/mistakes${suffix}`,
  )
}

/** GET /api/analyze/study-time?granularity=&anchor= → 二級：學習時間柱形圖（可縮放時間線） */
export function getStudyTimeTimeline(
  granularity: TimeGranularity,
  anchor?: string,
): Promise<StudyTimeTimeline> {
  const qs = new URLSearchParams({ granularity })
  if (anchor) qs.set('anchor', anchor)
  return apiFetch<StudyTimeTimeline>(`/api/analyze/study-time?${qs}`)
}

/** GET /api/analyze/study-time/:date → 點擊某一天柱子後的當日明細 */
export function getStudyTimeDetail(date: string): Promise<StudyTimeDetail> {
  return apiFetch<StudyTimeDetail>(`/api/analyze/study-time/${encodeURIComponent(date)}`)
}

/** GET /api/daily-checklist?date=YYYY-MM-DD → 二級：每日清單 + 建議複習知識點 */
export function getDailyChecklist(date: string): Promise<DailyChecklist> {
  return apiFetch<DailyChecklist>(`/api/daily-checklist?date=${encodeURIComponent(date)}`)
}

/** GET /api/daily-checklist?date=YYYY-MM-DD&week=1 → 該日期所屬那一週（週一 → 週日） */
export function getWeeklyChecklist(date: string): Promise<DailyChecklistWeek> {
  return apiFetch<DailyChecklistWeek>(
    `/api/daily-checklist?week=1&date=${encodeURIComponent(date)}`,
  )
}

/** POST /api/daily-checklist { date, content, knowledgePointId? } → ChecklistItem */
export function createChecklistItem(input: {
  date: string
  content: string
  knowledgePointId?: string
}): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>('/api/daily-checklist', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** PATCH /api/daily-checklist/:id { content?, done? } → ChecklistItem */
export function updateChecklistItem(
  id: string,
  patch: { content?: string; done?: boolean },
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/api/daily-checklist/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** DELETE /api/daily-checklist/:id → 204 */
export function deleteChecklistItem(id: string): Promise<void> {
  return apiFetch<void>(`/api/daily-checklist/${id}`, { method: 'DELETE' })
}


/* ---------- 設置：LLM 綁定（可多筆） ----------
 * | 方法   | 路徑                       | 說明                                   | 函數               |
 * |--------|----------------------------|----------------------------------------|--------------------|
 * | GET    | /api/settings/llm          | 使用中綁定 + 全部綁定 + 廠商目錄（金鑰遮蔽） | getLlmSettings  |
 * | POST   | /api/settings/llm          | 新增綁定（備註/廠商/模型/Base URL/金鑰）  | createLlmBinding  |
 * | PATCH  | /api/settings/llm          | 切換使用中 / 更新綁定內容                | setActiveLlmBinding / updateLlmBinding |
 * | DELETE | /api/settings/llm?id=      | 刪除綁定                               | deleteLlmBinding  |
 * | POST   | /api/settings/llm/test     | 測試連線（可用未儲存的設定或指定綁定）    | testLlmSettings   |
 */

/** GET /api/settings/llm */
export function getLlmSettings(): Promise<LlmSettingsPayload> {
  return apiFetch<LlmSettingsPayload>('/api/settings/llm')
}

/** POST /api/settings/llm → 新增綁定 */
export function createLlmBinding(payload: LlmBindingInput): Promise<LlmSettingsPayload> {
  return apiFetch<LlmSettingsPayload>('/api/settings/llm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** PATCH /api/settings/llm { activeId } → 切換使用中的綁定 */
export function setActiveLlmBinding(activeId: string): Promise<LlmSettingsPayload> {
  return apiFetch<LlmSettingsPayload>('/api/settings/llm', {
    method: 'PATCH',
    body: JSON.stringify({ activeId }),
  })
}

/** PATCH /api/settings/llm { id, ...patch } → 更新綁定（apiKey 留空表示不變更） */
export function updateLlmBinding(
  id: string,
  patch: { remark?: string; model?: string; baseUrl?: string; apiKey?: string },
): Promise<LlmSettingsPayload> {
  return apiFetch<LlmSettingsPayload>('/api/settings/llm', {
    method: 'PATCH',
    body: JSON.stringify({ id, ...patch }),
  })
}

/** DELETE /api/settings/llm?id= → 刪除綁定 */
export function deleteLlmBinding(id: string): Promise<LlmSettingsPayload> {
  return apiFetch<LlmSettingsPayload>(`/api/settings/llm?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** POST /api/settings/llm/test → 測試連線（未帶參數時測目前使用中的綁定） */
export function testLlmSettings(payload?: {
  bindingId?: string
  provider?: LlmBindingInput['provider']
  apiKey?: string
  model?: string
  baseUrl?: string
}): Promise<LlmTestResult> {
  return apiFetch<LlmTestResult>('/api/settings/llm/test', {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

/** POST /api/settings/reset → 清除本機資料（對話 / 分析 / LLM 綁定 / 附件檔案） */
export function resetAppData(options: ResetOptions): Promise<{ ok: boolean; summary: ResetSummary }> {
  return apiFetch<{ ok: boolean; summary: ResetSummary }>('/api/settings/reset', {
    method: 'POST',
    body: JSON.stringify(options),
  })
}
