/** ===== 與後端 API 對應的資料型別 =====
 * 這裡的型別就是前後端的資料契約，若後端欄位不同請同步調整。
 * 對照接口表見 src/lib/api/index.ts 頂部說明。
 *
 * 名詞對照：
 *   Subject（學科）= 舊版文件中的 Tag。UI 上一律顯示「學科」，
 *   分析板塊的所有統計都以學科為第一層維度。
 */

export interface Tag {
  id: string
  name: string
  /** 可選：學科代表色（hex），供圖表配色使用 */
  color?: string
}

/* ---------- 學科（Subject） ---------- */

export type Subject = Tag

/** 上傳文件後 AI 抽取出的學習內容摘要（提供「學習紀錄」用） */
export interface StudyRecord {
  id: string
  fileName: string
  subjectId?: string
  subjectName?: string
  /** 一句話摘要 */
  summary: string
  createdAt: string
}

export interface Conversation {
  id: string
  title: string
  /** 學科 id（對應 Subject.id） */
  tagId: string
  tag?: Tag
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface AttachmentMeta {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  /** 上傳成功後由後端回傳，可用於預覽/下載 */
  fileUrl?: string
}

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error'

/* ---------- AI 標註（Analyze 的資料來源） ---------- */

/** 知識點狀態：決定「知識點熱力圖」的顏色 */
export type KnowledgeStatus =
  /** 剛學習：本次對話首次出現 */
  | 'new'
  /** 已學習：已學過但練習次數少 */
  | 'learning'
  /** 使用次數多：反覆出現的知識點 */
  | 'frequent'
  /** 熟練度低：反覆出錯，需加強 */
  | 'weak'
  /** 已熟練：正確率高 */
  | 'mastered'

/** 對話中被 AI 辨識出的錯題 */
export interface MistakeAnnotation {
  id: string
  /** 錯題類型（用於錯題類型排行柱狀圖），例：計算錯誤、觀念不清 */
  type: string
  /** 題目／原文片段 */
  question?: string
  /** AI 給出的正確解法或提醒 */
  correction?: string
  knowledgePointId?: string
  knowledgePointName?: string
}

/**
 * 一則 AI 訊息附帶的結構化標註 —— 前端只負責顯示與傳遞，
 * 後端據此累積出 Analyze 板塊的所有統計。
 */
export interface MessageAnnotation {
  /** 學科（與對話的學科一致，允許 AI 修正） */
  subjectId?: string
  subjectName?: string
  /** 本則訊息涉及的知識點 */
  knowledgePoints?: Array<{ id: string; name: string; status?: KnowledgeStatus }>
  /** 本則訊息辨識出的錯題 */
  mistakes?: MistakeAnnotation[]
  /** 學習型態：新學習 / 複習 / 練習（提供「學習時間記錄」分類） */
  studyType?: StudyType
  /** 這則訊息花費的學習秒數（提供每日學習時間統計） */
  studySeconds?: number
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  attachments?: AttachmentMeta[]
  /** AI 回覆附帶的標註（學科／知識點／錯題），供 Analyze 計算 */
  annotation?: MessageAnnotation
  feedback?: 'up' | 'down'
  feedbackReason?: string
  /** 前端樂觀更新用；後端回傳的歷史訊息通常不含此欄位，視為 done */
  status?: MessageStatus
  createdAt: string
}

export interface SendMessagePayload {
  content: string
  attachmentIds?: string[]
  /** 重新生成時帶上被重新生成訊息的 id，供後端參考 */
  regenerateOf?: string
  /** 本次對話使用的學科；後端據此標註 AI 回覆的 annotation.subjectId */
  subjectId?: string
}


/* ============================================================
 * Analyze（分析板塊）
 * ------------------------------------------------------------
 * 導覽層級：
 *   一級入口（分析首頁 3 張卡片）
 *     1. 學科分析   → 二級：知識點熱力圖 → 三級：錯題統計
 *     2. 學習時間記錄
 *     3. 每日清單
 * ============================================================ */

/** 學習型態（學習時間記錄的堆疊維度） */
export type StudyType = 'learn' | 'review' | 'practice'

/* ---------- 一級：分析首頁摘要（GET /api/analyze/overview） ---------- */

export interface SubjectStat {
  subjectId: string
  subjectName: string
  /** 學科代表色（hex），未提供時前端會自動配色 */
  color?: string
  conversationCount: number
  messageCount: number
  /** AI 標註的知識點數量 */
  knowledgePoints: number
  /** AI 標註的錯題數量 */
  mistakes: number
  /** 累計學習秒數 */
  studySeconds: number
  /** 最近一次學習時間 */
  lastStudiedAt?: string
}

export interface AnalyzeOverview {
  subjects: SubjectStat[]
  /** 今日學習秒數 */
  todayStudySeconds: number
  /** 連續學習天數 */
  streakDays: number
  /** 近 30 天累計學習秒數 */
  studySeconds30d: number
  /** 每日清單今日完成度 */
  todayChecklist: { done: number; total: number }
  generatedAt: string
}

/* ---------- 二級 1：知識點熱力圖（GET /api/analyze/subjects/:id/heatmap） ---------- */

export interface KnowledgePointStat {
  id: string
  name: string
  /** 所屬章節／單元（可選，用於分組） */
  unit?: string
  status: KnowledgeStatus
  /** 出現次數（使用次數） */
  useCount: number
  /** 錯題數量 */
  mistakeCount: number
  /** 0–100 熟練度；未提供時前端由錯題率推估顯示 */
  mastery?: number
  lastStudiedAt?: string
}

export interface SubjectHeatmap {
  subjectId: string
  subjectName: string
  knowledgePoints: KnowledgePointStat[]
  generatedAt: string
}

/* ---------- 三級：錯題統計（GET /api/analyze/knowledge-points/:id/mistakes） ---------- */

export interface MistakeTypeCount {
  /** 錯題類型名稱 */
  type: string
  count: number
}

export interface MistakeItem {
  id: string
  /** 出處對話 */
  conversationId: string
  conversationTitle?: string
  /** 題目／原文片段 */
  question: string
  /** 我的答案 */
  userAnswer?: string
  /** 正確答案或 AI 提醒 */
  correction?: string
  mistakeType: string
  createdAt: string
}

export interface MistakeStats {
  knowledgePointId: string
  knowledgePointName: string
  subjectId?: string
  subjectName?: string
  /** 錯題總數 */
  total: number
  /** 已訂正數量 */
  corrected: number
  /** 錯題類型排行（柱形圖） */
  typeRanking: MistakeTypeCount[]
  /** 錯題列表（分頁） */
  items: MistakeItem[]
}

/* ---------- 二級 2：學習時間記錄（GET /api/analyze/study-time） ---------- */

/** 時間線粒度：週 / 月 / 年 */
export type TimeGranularity = 'week' | 'month' | 'year'

export interface StudyTimeBucket {
  /** 桶的識別碼，例：2024-05-20（週/日）或 2024-05（月） */
  key: string
  /** 顯示標籤，例：5/20、第 21 週 */
  label: string
  /** 該桶的起訖日期（ISO），供點擊後查詢明細 */
  startDate: string
  endDate: string
  /** 總秒數 */
  totalSeconds: number
  /** 依學習型態拆分（堆疊柱狀圖） */
  byType: Partial<Record<StudyType, number>>
}

export interface StudyTimeTimeline {
  granularity: TimeGranularity
  buckets: StudyTimeBucket[]
  /** 期間總計秒數 */
  totalSeconds: number
}

/** 點擊某一天／某一桶後顯示的明細 */
export interface StudyTimeDetail {
  date: string
  totalSeconds: number
  entries: Array<{
    id: string
    subjectId?: string
    subjectName?: string
    knowledgePointName?: string
    studyType: StudyType
    seconds: number
    conversationId?: string
    conversationTitle?: string
  }>
}

/* ---------- 二級 3：每日清單（GET /api/daily-checklist?date=） ---------- */

export interface ChecklistItem {
  id: string
  /** 用戶自己輸入的清單內容 */
  content: string
  done: boolean
  /** 綁定的知識點（複習知識點用） */
  knowledgePointId?: string
  knowledgePointName?: string
  subjectId?: string
  subjectName?: string
  /** 排序 */
  order: number
  createdAt: string
}

export interface DailyChecklist {
  date: string
  items: ChecklistItem[]
  /** 系統依遺忘曲線排定的複習知識點（與用戶清單分開呈現） */
  reviewKnowledgePoints: Array<{
    id: string
    name: string
    subjectId?: string
    subjectName?: string
    status: KnowledgeStatus
    /** 建議複習原因，例：已 7 天未複習 */
    reason?: string
    lastStudiedAt?: string
  }>
}

/** 一週中的某一天（週一 = 0 … 週日 = 6） */
export interface DailyChecklistDay {
  date: string
  weekday: number
  isToday: boolean
  isFuture: boolean
  items: ChecklistItem[]
  doneCount: number
  totalCount: number
  /** 這天的任務是否全部完成 */
  allDone: boolean
}

/** 週清單（週一 → 週日） */
export interface DailyChecklistWeek {
  weekStart: string
  weekEnd: string
  days: DailyChecklistDay[]
  totalCount: number
  doneCount: number
  allDone: boolean
  reviewKnowledgePoints: DailyChecklist['reviewKnowledgePoints']
}

/* ============================================================
 * 設置：LLM 綁定（可多筆）
 * ============================================================ */

export type LlmProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'glm'
  | 'kimi'
  | 'grok'
  | 'custom'

/** 廠商目錄（GET /api/settings/llm 回傳，不含金鑰） */
export interface LlmProviderOption {
  id: LlmProviderId
  label: string
  baseUrl: string
  /** 官方目前可用的模型 id（僅提示用，介面不提供快捷選擇） */
  models: string[]
  defaultModel: string
  keyUrl: string | null
  /** 官方模型文件連結（查最新官方名稱用） */
  docsUrl: string | null
  requiresBaseUrl: boolean
  editableBaseUrl: boolean
}

/** 一筆已儲存的綁定（金鑰遮蔽） */
export interface LlmBinding {
  id: string
  provider: LlmProviderId
  providerLabel: string
  /** 使用者備註（儲存區塊顯示為「備註 + 模型名稱」） */
  remark: string
  /** 官方模型 id */
  model: string
  baseUrl: string
  apiKeyMasked: string
  createdAt: string
  updatedAt: string
  /** 是否為目前使用中的綁定 */
  isActive: boolean
}

export interface LlmSettingsPayload {
  activeId: string | null
  active: LlmBinding | null
  bindings: LlmBinding[]
  providers: LlmProviderOption[]
}

export interface LlmTestResult {
  ok: boolean
  provider?: LlmProviderId
  model?: string
  baseUrl?: string
  latencyMs: number
  reply?: string
  error?: string
}

/** 新增綁定的輸入 */
export interface LlmBindingInput {
  provider: LlmProviderId
  /** 備註（顯示於儲存區塊） */
  remark: string
  /** 官方模型 id */
  model: string
  baseUrl: string
  apiKey: string
}

/* ---------- 設置：清除資料 ---------- */

export interface ResetOptions {
  /** 對話與訊息（含 Chat 中自訂新增的學科 Tag） */
  chat: boolean
  /** 知識點 / 錯題 / 學習時間 / 每日清單（含自訂學科） */
  analysis: boolean
  /** LLM 綁定與設定 */
  llm: boolean
  /** 一併刪除 data/uploads 內的實體檔案 */
  files: boolean
}

/** 各表實際刪除的筆數 */
export interface ResetSummary {
  conversations: number
  messages: number
  annotations: number
  knowledgePoints: number
  mistakes: number
  studySessions: number
  checklistItems: number
  llmBindings: number
  settings: number
  /** 被清除的自訂學科數（Chat 中自行新增的學科；預設三學科保留） */
  customSubjects: number
  files: number
}

/** 尚未綁定 LLM 時的錯誤碼（Chat 會據此提示並引導到「設置 → LLM 綁定」） */
export const LLM_NOT_CONFIGURED = 'LLM_NOT_CONFIGURED'
