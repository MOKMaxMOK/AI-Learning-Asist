/**
 * DB row → 前端 API 契約 的轉換
 * ============================================================
 * DB 欄位為 snake_case，前端（src/lib/types.ts）使用 camelCase 契約。
 * 所有 API Route 都必須透過這裡輸出，確保契約一致。
 */

import type {
  AttachmentMeta,
  ChecklistItem,
  Conversation,
  KnowledgePointStat,
  KnowledgeStatus,
  Message,
  MessageAnnotation,
  MistakeItem,
  MistakeTypeCount,
  StudyTimeBucket,
  StudyType,
  Subject,
  SubjectStat,
} from '@/lib/types'

/* ---------------- 基本 ---------------- */

/** SQLite 的 datetime('now') 是 UTC 'YYYY-MM-DD HH:MM:SS'，轉成 ISO 8601 */
export function toIso(value: string | null | undefined): string {
  if (!value) return new Date().toISOString()
  const normalized = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export interface SubjectRow {
  id: string
  name: string
  color: string | null
}

export function toSubject(row: SubjectRow): Subject {
  return { id: row.id, name: row.name, ...(row.color ? { color: row.color } : {}) }
}

export interface ConversationRow {
  id: string
  title: string
  subjectId: string
  createdAt: string
  updatedAt: string
  subjectName?: string | null
  subjectColor?: string | null
}

/** 前端契約：conversation.tagId / conversation.tag（學科） */
export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    tagId: row.subjectId,
    tag: row.subjectName
      ? { id: row.subjectId, name: row.subjectName, ...(row.subjectColor ? { color: row.subjectColor } : {}) }
      : undefined,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  }
}

export interface MessageRow {
  id: string
  conversationId: string
  role: string
  content: string
  attachments: string | null
  feedback: string | null
  feedbackReason: string | null
  createdAt: string
}

export interface AnnotationParts {
  subjectId?: string | null
  subjectName?: string | null
  studyType?: string | null
  studySeconds?: number | null
  knowledgePoints?: Array<{ id: string; name: string; status: string }>
  mistakes?: Array<{
    id: string
    type: string
    question?: string | null
    correction?: string | null
    knowledgePointId?: string | null
    knowledgePointName?: string | null
  }>
}

export function buildAnnotation(parts: AnnotationParts): MessageAnnotation | undefined {
  const hasAny =
    !!parts.subjectName ||
    !!parts.subjectId ||
    (parts.knowledgePoints?.length ?? 0) > 0 ||
    (parts.mistakes?.length ?? 0) > 0 ||
    !!parts.studyType
  if (!hasAny) return undefined

  return {
    subjectId: parts.subjectId ?? undefined,
    subjectName: parts.subjectName ?? undefined,
    knowledgePoints: parts.knowledgePoints?.length
      ? parts.knowledgePoints.map((kp) => ({
          id: kp.id,
          name: kp.name,
          status: kp.status as KnowledgeStatus,
        }))
      : undefined,
    mistakes: parts.mistakes?.length
      ? parts.mistakes.map((m) => ({
          id: m.id,
          type: m.type,
          question: m.question ?? undefined,
          correction: m.correction ?? undefined,
          knowledgePointId: m.knowledgePointId ?? undefined,
          knowledgePointName: m.knowledgePointName ?? undefined,
        }))
      : undefined,
    studyType: (parts.studyType as StudyType | null) ?? undefined,
    studySeconds: parts.studySeconds ?? undefined,
  }
}

export function toMessage(row: MessageRow, annotation?: MessageAnnotation): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Message['role'],
    content: row.content,
    attachments: parseJson<AttachmentMeta[]>(row.attachments, []).length
      ? parseJson<AttachmentMeta[]>(row.attachments, [])
      : undefined,
    annotation,
    feedback: (row.feedback as 'up' | 'down' | null) ?? undefined,
    feedbackReason: row.feedbackReason ?? undefined,
    status: 'done',
    createdAt: toIso(row.createdAt),
  }
}

/* ---------------- Analyze ---------------- */

export interface RawSubjectStat {
  subjectId: string
  subjectName: string
  color: string | null
  conversationCount: number
  messageCount: number
  knowledgePoints: number
  mistakes: number
  studySeconds: number
  lastStudiedAt: string | null
}

export function toSubjectStat(row: RawSubjectStat): SubjectStat {
  return {
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    color: row.color ?? undefined,
    conversationCount: Number(row.conversationCount ?? 0),
    messageCount: Number(row.messageCount ?? 0),
    knowledgePoints: Number(row.knowledgePoints ?? 0),
    mistakes: Number(row.mistakes ?? 0),
    studySeconds: Number(row.studySeconds ?? 0),
    lastStudiedAt: row.lastStudiedAt ? toIso(row.lastStudiedAt) : undefined,
  }
}

export interface KnowledgePointRow {
  id: string
  name: string
  unit: string | null
  status: string
  useCount: number
  mistakeCount: number
  mastery: number
  lastStudiedAt: string | null
}

export function toKnowledgePointStat(row: KnowledgePointRow): KnowledgePointStat {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit ?? undefined,
    status: row.status as KnowledgeStatus,
    useCount: Number(row.useCount ?? 0),
    mistakeCount: Number(row.mistakeCount ?? 0),
    mastery: Math.round(Number(row.mastery ?? 0)),
    lastStudiedAt: row.lastStudiedAt ? toIso(row.lastStudiedAt) : undefined,
  }
}

export interface MistakeRow {
  id: string
  conversationId: string
  conversationTitle?: string | null
  question: string | null
  userAnswer: string | null
  correction: string | null
  type: string
  createdAt: string
}

export function toMistakeItem(row: MistakeRow): MistakeItem {
  return {
    id: row.id,
    conversationId: row.conversationId,
    conversationTitle: row.conversationTitle ?? undefined,
    question: row.question ?? '（未記錄題目）',
    userAnswer: row.userAnswer ?? undefined,
    correction: row.correction ?? undefined,
    mistakeType: row.type,
    createdAt: toIso(row.createdAt),
  }
}

export function toMistakeTypeCount(rows: Array<{ type: string; count: number }>): MistakeTypeCount[] {
  return rows.map((r) => ({ type: r.type, count: Number(r.count ?? 0) }))
}

export interface StudySessionRow {
  day: string
  studyType: string
  seconds: number
}

/** 把 SQL 聚合結果轉成前端 StudyTimeBucket（key 統一為 day 或 month） */
export function toStudyTimeBucket(
  key: string,
  label: string,
  startDate: string,
  endDate: string,
  totalSeconds: number,
  byType: Partial<Record<StudyType, number>>,
): StudyTimeBucket {
  return { key, label, startDate, endDate, totalSeconds, byType }
}

export interface ChecklistRow {
  id: string
  content: string
  done: boolean | number
  knowledgePointId: string | null
  knowledgePointName?: string | null
  subjectId: string | null
  subjectName?: string | null
  sortOrder: number
  createdAt: string
}

export function toChecklistItem(row: ChecklistRow): ChecklistItem {
  return {
    id: row.id,
    content: row.content,
    done: !!row.done,
    knowledgePointId: row.knowledgePointId ?? undefined,
    knowledgePointName: row.knowledgePointName ?? undefined,
    subjectId: row.subjectId ?? undefined,
    subjectName: row.subjectName ?? undefined,
    order: Number(row.sortOrder ?? 0),
    createdAt: toIso(row.createdAt),
  }
}

/* ---------------- 知識點狀態推估 ---------------- */

/**
 * 依「出現次數 / 錯題數 / 熟練度」推估知識點狀態。
 * LLM 標註時若直接給了狀態則以 LLM 為準（見 annotate.ts）。
 */
export function deriveKnowledgeStatus(input: {
  useCount: number
  mistakeCount: number
  correctedCount: number
  mastery?: number
}): KnowledgeStatus {
  const { useCount, mistakeCount, correctedCount } = input
  const mastery =
    input.mastery ??
    (useCount === 0 ? 0 : Math.max(0, Math.round((1 - mistakeCount / useCount) * 100)))

  if (mistakeCount >= 2 && mastery < 60) return 'weak'
  if (mastery >= 85 && useCount >= 2) return 'mastered'
  if (useCount >= 4) return 'frequent'
  if (useCount >= 2) return 'learning'
  if (useCount === 1) return mistakeCount > 0 ? 'weak' : 'new'
  return correctedCount > 0 ? 'learning' : 'new'
}
