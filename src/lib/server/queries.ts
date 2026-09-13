/**
 * 伺服器端共用查詢 / 寫入邏輯
 * ============================================================
 * - 全部走本地 SQLite（better-sqlite3 原生 SQL，聚合統計最直接）
 * - 知識點狀態、熟練度、學習時間等統計的「事實來源」
 */

import { getRawDb } from '@/lib/db'
import { deriveKnowledgeStatus, type RawSubjectStat } from '@/lib/db/mappers'
import type { MessageAnnotation, StudyType } from '@/lib/types'

/** 產生可讀的 id（prefix_uuid），前後端皆可安全使用 */
function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

/* ============================================================
 * 學科
 * ============================================================ */

export interface SubjectRecord {
  id: string
  name: string
  color: string | null
  isDefault: boolean
  sortOrder: number
  createdAt: string
}

export function listSubjects(): SubjectRecord[] {
  return getRawDb()
    .prepare(
      `SELECT id, name, color, is_default as isDefault, sort_order as sortOrder, created_at as createdAt
       FROM subjects ORDER BY sort_order ASC, name ASC`,
    )
    .all() as SubjectRecord[]
}

export function findSubjectById(id: string): SubjectRecord | undefined {
  return getRawDb()
    .prepare(
      `SELECT id, name, color, is_default as isDefault, sort_order as sortOrder, created_at as createdAt
       FROM subjects WHERE id = ?`,
    )
    .get(id) as SubjectRecord | undefined
}

export function findSubjectByName(name: string): SubjectRecord | undefined {
  return getRawDb()
    .prepare(
      `SELECT id, name, color, is_default as isDefault, sort_order as sortOrder, created_at as createdAt
       FROM subjects WHERE name = ?`,
    )
    .get(name) as SubjectRecord | undefined
}

export function createSubject(input: { name: string; color?: string }): SubjectRecord {
  const db = getRawDb()
  const id = newId('subject')
  const max = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM subjects`).get() as { m: number }
  db.prepare(
    `INSERT INTO subjects (id, name, color, is_default, sort_order) VALUES (?, ?, ?, 0, ?)`,
  ).run(id, input.name.trim(), input.color ?? null, Number(max.m) + 1)
  return findSubjectById(id)!
}

/* ============================================================
 * 對話
 * ============================================================ */

export interface ConversationRecord {
  id: string
  title: string
  subjectId: string
  createdAt: string
  updatedAt: string
  subjectName: string | null
  subjectColor: string | null
}

export function listConversations(): ConversationRecord[] {
  return getRawDb()
    .prepare(
      `SELECT c.id, c.title, c.subject_id as subjectId, c.created_at as createdAt, c.updated_at as updatedAt,
              s.name as subjectName, s.color as subjectColor
       FROM conversations c
       LEFT JOIN subjects s ON s.id = c.subject_id
       ORDER BY c.updated_at DESC`,
    )
    .all() as ConversationRecord[]
}

export function findConversation(id: string): ConversationRecord | undefined {
  return getRawDb()
    .prepare(
      `SELECT c.id, c.title, c.subject_id as subjectId, c.created_at as createdAt, c.updated_at as updatedAt,
              s.name as subjectName, s.color as subjectColor
       FROM conversations c
       LEFT JOIN subjects s ON s.id = c.subject_id
       WHERE c.id = ?`,
    )
    .get(id) as ConversationRecord | undefined
}

export function createConversation(input: { title: string; subjectId: string }): ConversationRecord {
  const db = getRawDb()
  const id = newId('conv')
  db.prepare(`INSERT INTO conversations (id, title, subject_id) VALUES (?, ?, ?)`).run(
    id,
    input.title.trim(),
    input.subjectId,
  )
  return findConversation(id)!
}

export function touchConversation(id: string): void {
  getRawDb().prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(id)
}

/* ============================================================
 * 訊息 + AI 標註
 * ============================================================ */

export interface MessageRecord {
  id: string
  conversationId: string
  role: string
  content: string
  attachments: string | null
  feedback: string | null
  feedbackReason: string | null
  model: string | null
  createdAt: string
}

export function listMessages(conversationId: string): MessageRecord[] {
  return getRawDb()
    .prepare(
      `SELECT id, conversation_id as conversationId, role, content, attachments,
              feedback, feedback_reason as feedbackReason, model, created_at as createdAt
       FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`,
    )
    .all(conversationId) as MessageRecord[]
}

export function findMessage(id: string): MessageRecord | undefined {
  return getRawDb()
    .prepare(
      `SELECT id, conversation_id as conversationId, role, content, attachments,
              feedback, feedback_reason as feedbackReason, model, created_at as createdAt
       FROM messages WHERE id = ?`,
    )
    .get(id) as MessageRecord | undefined
}

export function insertMessage(input: {
  id?: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: unknown
  model?: string
}): MessageRecord {
  const id = input.id ?? newId('msg')
  getRawDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, role, content, attachments, model)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.conversationId,
      input.role,
      input.content,
      input.attachments ? JSON.stringify(input.attachments) : null,
      input.model ?? null,
    )
  touchConversation(input.conversationId)
  return findMessage(id)!
}

/** 列出對話中所有 AI 標註（供組裝訊息時附帶） */
export function listAnnotations(conversationId: string): Array<{
  messageId: string
  subjectId: string | null
  studyType: string | null
  studySeconds: number
}> {
  return getRawDb()
    .prepare(
      `SELECT message_id as messageId, subject_id as subjectId, study_type as studyType,
              study_seconds as studySeconds
       FROM message_annotations WHERE conversation_id = ?`,
    )
    .all(conversationId) as Array<{
    messageId: string
    subjectId: string | null
    studyType: string | null
    studySeconds: number
  }>
}

export function listMessageKnowledgePoints(
  conversationId: string,
): Array<{ messageId: string; id: string; name: string; status: string }> {
  return getRawDb()
    .prepare(
      `SELECT mkp.message_id as messageId, kp.id as id, kp.name as name, kp.status as status
       FROM message_knowledge_points mkp
       JOIN knowledge_points kp ON kp.id = mkp.knowledge_point_id
       WHERE mkp.conversation_id = ?`,
    )
    .all(conversationId) as Array<{ messageId: string; id: string; name: string; status: string }>
}

export function listMessageMistakes(conversationId: string): Array<{
  id: string
  messageId: string | null
  type: string
  question: string | null
  correction: string | null
  knowledgePointId: string | null
  knowledgePointName: string | null
}> {
  return getRawDb()
    .prepare(
      `SELECT m.id, m.message_id as messageId, m.type, m.question, m.correction,
              m.knowledge_point_id as knowledgePointId, kp.name as knowledgePointName
       FROM mistakes m
       LEFT JOIN knowledge_points kp ON kp.id = m.knowledge_point_id
       WHERE m.conversation_id = ?`,
    )
    .all(conversationId) as Array<{
    id: string
    messageId: string | null
    type: string
    question: string | null
    correction: string | null
    knowledgePointId: string | null
    knowledgePointName: string | null
  }>
}

/* ============================================================
 * 知識點：upsert + 狀態重算
 * ============================================================ */

export interface KnowledgePointRecord {
  id: string
  subjectId: string
  name: string
  unit: string | null
  status: string
  useCount: number
  mistakeCount: number
  correctedCount: number
  mastery: number
  firstStudiedAt: string | null
  lastStudiedAt: string | null
}

export function findKnowledgePointByName(
  subjectId: string,
  name: string,
): KnowledgePointRecord | undefined {
  return getRawDb()
    .prepare(
      `SELECT id, subject_id as subjectId, name, unit, status, use_count as useCount,
              mistake_count as mistakeCount, corrected_count as correctedCount, mastery,
              first_studied_at as firstStudiedAt, last_studied_at as lastStudiedAt
       FROM knowledge_points WHERE subject_id = ? AND name = ?`,
    )
    .get(subjectId, name) as KnowledgePointRecord | undefined
}

export function findKnowledgePointById(id: string): KnowledgePointRecord | undefined {
  return getRawDb()
    .prepare(
      `SELECT id, subject_id as subjectId, name, unit, status, use_count as useCount,
              mistake_count as mistakeCount, corrected_count as correctedCount, mastery,
              first_studied_at as firstStudiedAt, last_studied_at as lastStudiedAt
       FROM knowledge_points WHERE id = ?`,
    )
    .get(id) as KnowledgePointRecord | undefined
}

/** 重算單一知識點的狀態 / 熟練度（統計事實來源） */
export function refreshKnowledgePoint(kpId: string): void {
  const db = getRawDb()
  const row = db
    .prepare(
      `SELECT use_count as useCount, mistake_count as mistakeCount,
              corrected_count as correctedCount
       FROM knowledge_points WHERE id = ?`,
    )
    .get(kpId) as { useCount: number; mistakeCount: number; correctedCount: number } | undefined
  if (!row) return

  const mastery =
    row.useCount === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round((1 - row.mistakeCount / row.useCount) * 100)))
  const status = deriveKnowledgeStatus({
    useCount: row.useCount,
    mistakeCount: row.mistakeCount,
    correctedCount: row.correctedCount,
    mastery,
  })
  db.prepare(`UPDATE knowledge_points SET mastery = ?, status = ? WHERE id = ?`).run(
    mastery,
    status,
    kpId,
  )
}

/* ============================================================
 * 套用 AI 標註（核心：把一則 AI 回覆的標註寫進統計）
 * ============================================================ */

export function applyAnnotation(input: {
  messageId: string
  conversationId: string
  annotation: MessageAnnotation
  /** 沒標到學科時的預設學科（= 對話的學科） */
  fallbackSubjectId: string
}): { subjectId: string; knowledgePointIds: string[]; mistakeIds: string[] } {
  const db = getRawDb()
  const { messageId, conversationId, annotation } = input
  const subjectId = annotation.subjectId ?? input.fallbackSubjectId
  const subject = findSubjectById(subjectId) ?? findSubjectById(input.fallbackSubjectId)
  const resolvedSubjectId = subject?.id ?? input.fallbackSubjectId
  const day = localDay()
  const studyType: StudyType = annotation.studyType ?? 'learn'
  const studySeconds = Math.max(0, Math.round(annotation.studySeconds ?? 0))

  const knowledgePointIds: string[] = []
  const mistakeIds: string[] = []

  const run = db.transaction(() => {
    /* 1. 標註主表 */
    db.prepare(
      `INSERT INTO message_annotations (message_id, conversation_id, subject_id, study_type, study_seconds, source)
       VALUES (?, ?, ?, ?, ?, 'llm')
       ON CONFLICT(message_id) DO UPDATE SET
         subject_id = excluded.subject_id,
         study_type = excluded.study_type,
         study_seconds = excluded.study_seconds`,
    ).run(messageId, conversationId, resolvedSubjectId, studyType, studySeconds)

    /* 2. 知識點 */
    for (const kp of annotation.knowledgePoints ?? []) {
      const name = kp.name?.trim()
      if (!name) continue
      let record = findKnowledgePointByName(resolvedSubjectId, name)
      if (!record) {
        const id = newId('kp')
        db.prepare(
          `INSERT INTO knowledge_points (id, subject_id, name, status, use_count, first_studied_at, last_studied_at)
           VALUES (?, ?, ?, 'new', 0, datetime('now'), datetime('now'))`,
        ).run(id, resolvedSubjectId, name)
        record = findKnowledgePointById(id)
      }
      if (!record) continue

      db.prepare(
        `UPDATE knowledge_points
         SET use_count = use_count + 1,
             last_studied_at = datetime('now'),
             first_studied_at = COALESCE(first_studied_at, datetime('now'))
         WHERE id = ?`,
      ).run(record.id)

      db.prepare(
        `INSERT INTO message_knowledge_points (message_id, knowledge_point_id, conversation_id)
         VALUES (?, ?, ?) ON CONFLICT(message_id, knowledge_point_id) DO NOTHING`,
      ).run(messageId, record.id, conversationId)

      if (kp.status) {
        // LLM 直接給狀態時，仍以統計事實為準，但允許「剛學習」這種即時訊號優先
        if (kp.status === 'new') {
          db.prepare(`UPDATE knowledge_points SET status = 'new' WHERE id = ? AND use_count <= 1`).run(
            record.id,
          )
        }
      }
      refreshKnowledgePoint(record.id)
      knowledgePointIds.push(record.id)
    }

    /* 3. 錯題 */
    for (const m of annotation.mistakes ?? []) {
      const kpName = m.knowledgePointName?.trim()
      let kpId = m.knowledgePointId ?? null
      if (!kpId && kpName) {
        const existing = findKnowledgePointByName(resolvedSubjectId, kpName)
        if (existing) kpId = existing.id
        else {
          const id = newId('kp')
          db.prepare(
            `INSERT INTO knowledge_points (id, subject_id, name, status, use_count, first_studied_at, last_studied_at)
             VALUES (?, ?, ?, 'new', 0, datetime('now'), datetime('now'))`,
          ).run(id, resolvedSubjectId, kpName)
          kpId = id
        }
      }
      const mistakeId = newId('mis')
      db.prepare(
        `INSERT INTO mistakes (id, conversation_id, message_id, subject_id, knowledge_point_id, type, question, correction)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        mistakeId,
        conversationId,
        messageId,
        resolvedSubjectId,
        kpId,
        m.type?.trim() || '其他',
        m.question ?? null,
        m.correction ?? null,
      )
      if (kpId) {
        db.prepare(`UPDATE knowledge_points SET mistake_count = mistake_count + 1 WHERE id = ?`).run(
          kpId,
        )
        refreshKnowledgePoint(kpId)
      }
      mistakeIds.push(mistakeId)
    }

    /* 4. 學習時間 */
    const seconds = studySeconds > 0 ? studySeconds : 0
    if (seconds > 0) {
      const firstKpId = knowledgePointIds[0] ?? null
      db.prepare(
        `INSERT INTO study_sessions (id, conversation_id, message_id, subject_id, knowledge_point_id, study_type, seconds, day)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId('ses'),
        conversationId,
        messageId,
        resolvedSubjectId,
        firstKpId,
        studyType,
        seconds,
        day,
      )
    }
  })

  run()
  return { subjectId: resolvedSubjectId, knowledgePointIds, mistakeIds }
}

/** 本地時區 YYYY-MM-DD */
export function localDay(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ============================================================
 * 訊息組合（訊息 + 標註 + 知識點 + 錯題）
 * ============================================================ */

export interface AssembledMessage {
  id: string
  conversationId: string
  role: string
  content: string
  attachments: string | null
  feedback: string | null
  feedbackReason: string | null
  createdAt: string
  annotation?: MessageAnnotation
}

/** 取出一整個對話的訊息，並把 AI 標註組裝回每則訊息 */
export function loadConversationMessages(conversationId: string): AssembledMessage[] {
  const rows = listMessages(conversationId)
  const annotations = listAnnotations(conversationId)
  const kpRows = listMessageKnowledgePoints(conversationId)
  const mistakeRows = listMessageMistakes(conversationId)
  const subjectMap = new Map(listSubjects().map((s) => [s.id, s.name]))

  const byMessage = new Map<string, AssembledMessage>()
  for (const row of rows) {
    byMessage.set(row.id, {
      id: row.id,
      conversationId: row.conversationId,
      role: row.role,
      content: row.content,
      attachments: row.attachments,
      feedback: row.feedback,
      feedbackReason: row.feedbackReason,
      createdAt: row.createdAt,
    })
  }

  for (const a of annotations) {
    const target = byMessage.get(a.messageId)
    if (!target) continue
    target.annotation = {
      subjectId: a.subjectId ?? undefined,
      subjectName: a.subjectId ? subjectMap.get(a.subjectId) : undefined,
      studyType: (a.studyType as StudyType | null) ?? undefined,
      studySeconds: a.studySeconds,
    }
  }

  for (const kp of kpRows) {
    const target = byMessage.get(kp.messageId)
    if (!target) continue
    const list = target.annotation?.knowledgePoints ?? []
    list.push({ id: kp.id, name: kp.name, status: kp.status as never })
    target.annotation = { ...(target.annotation ?? {}), knowledgePoints: list }
  }

  for (const m of mistakeRows) {
    if (!m.messageId) continue
    const target = byMessage.get(m.messageId)
    if (!target) continue
    const list = target.annotation?.mistakes ?? []
    list.push({
      id: m.id,
      type: m.type,
      question: m.question ?? undefined,
      correction: m.correction ?? undefined,
      knowledgePointId: m.knowledgePointId ?? undefined,
      knowledgePointName: m.knowledgePointName ?? undefined,
    })
    target.annotation = { ...(target.annotation ?? {}), mistakes: list }
  }

  return [...byMessage.values()]
}

/* ============================================================
 * Analyze 聚合
 * ============================================================ */

export function aggregateSubjectStats(): RawSubjectStat[] {
  return getRawDb()
    .prepare(
      `SELECT s.id AS subjectId,
              s.name AS subjectName,
              s.color AS color,
              (SELECT COUNT(*) FROM conversations c WHERE c.subject_id = s.id) AS conversationCount,
              (SELECT COUNT(*) FROM messages m
                 JOIN conversations c2 ON c2.id = m.conversation_id
                WHERE c2.subject_id = s.id AND m.role <> 'system') AS messageCount,
              (SELECT COUNT(*) FROM knowledge_points kp WHERE kp.subject_id = s.id) AS knowledgePoints,
              (SELECT COUNT(*) FROM mistakes mi WHERE mi.subject_id = s.id) AS mistakes,
              (SELECT COALESCE(SUM(ss.seconds), 0) FROM study_sessions ss WHERE ss.subject_id = s.id) AS studySeconds,
              (SELECT MAX(kp3.last_studied_at) FROM knowledge_points kp3 WHERE kp3.subject_id = s.id) AS lastStudiedAt
       FROM subjects s
       ORDER BY s.sort_order ASC, s.name ASC`,
    )
    .all() as RawSubjectStat[]
}

export function sumStudySeconds(opts: { sinceDay?: string; subjectId?: string } = {}): number {
  const where: string[] = []
  const params: unknown[] = []
  if (opts.sinceDay) {
    where.push('day >= ?')
    params.push(opts.sinceDay)
  }
  if (opts.subjectId) {
    where.push('subject_id = ?')
    params.push(opts.subjectId)
  }
  const sql = `SELECT COALESCE(SUM(seconds), 0) AS total FROM study_sessions${
    where.length ? ` WHERE ${where.join(' AND ')}` : ''
  }`
  const row = getRawDb().prepare(sql).get(...params) as { total: number }
  return Number(row?.total ?? 0)
}

/** 連續學習天數（以有學習紀錄的日期往回算） */
export function streakDays(): number {
  const rows = getRawDb()
    .prepare(`SELECT DISTINCT day FROM study_sessions ORDER BY day DESC LIMIT 400`)
    .all() as Array<{ day: string }>
  if (rows.length === 0) return 0

  const days = new Set(rows.map((r) => r.day))
  const cursor = new Date()
  // 今天還沒學也不算斷：從今天或昨天起算
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  for (;;) {
    const key = localDay(cursor)
    if (!days.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function dayOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() - days)
  return localDay(d)
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ============================================================
 * 清除資料（設置 → 清除設定）
 * ============================================================ */

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

/**
 * 依分類清除本機資料（預設三學科永遠保留）。
 * 勾選項目由呼叫端決定，這裡只負責實際刪除並回傳統計。
 */
export function resetData(options: {
  chat: boolean
  analysis: boolean
  llm: boolean
  files: boolean
}): ResetSummary {
  const db = getRawDb()

  const summary: ResetSummary = {
    conversations: 0,
    messages: 0,
    annotations: 0,
    knowledgePoints: 0,
    mistakes: 0,
    studySessions: 0,
    checklistItems: 0,
    llmBindings: 0,
    settings: 0,
    customSubjects: 0,
    files: 0,
  }

  const count = (table: string): number =>
    Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number })?.n ?? 0)

  /** 刪除 Chat 自訂新增的學科（預設三學科保留），連帶清掉其統計與清單項 */
  const clearCustomSubjects = () => {
    const rows = db.prepare(`SELECT id FROM subjects WHERE is_default = 0`).all() as Array<{
      id: string
    }>
    if (rows.length === 0) return

    // 這些學科底下的資料必須先移除（外鍵為 RESTRICT / SET NULL）
    const kpIds = db
      .prepare(
        `SELECT id FROM knowledge_points WHERE subject_id IN (SELECT id FROM subjects WHERE is_default = 0)`,
      )
      .all() as Array<{ id: string }>
    const kpMarks = kpIds.map(() => '?').join(',')
    if (kpIds.length) {
      db.prepare(`DELETE FROM daily_checklist WHERE knowledge_point_id IN (${kpMarks})`).run(
        ...kpIds.map((r) => r.id),
      )
      db.prepare(`DELETE FROM message_knowledge_points WHERE knowledge_point_id IN (${kpMarks})`).run(
        ...kpIds.map((r) => r.id),
      )
      db.prepare(`DELETE FROM mistakes WHERE knowledge_point_id IN (${kpMarks})`).run(
        ...kpIds.map((r) => r.id),
      )
      db.prepare(`DELETE FROM study_sessions WHERE knowledge_point_id IN (${kpMarks})`).run(
        ...kpIds.map((r) => r.id),
      )
    }

    const subjectMarks = rows.map(() => '?').join(',')
    db.prepare(`DELETE FROM knowledge_points WHERE subject_id IN (${subjectMarks})`).run(
      ...rows.map((r) => r.id),
    )
    db.prepare(`DELETE FROM daily_checklist WHERE subject_id IN (${subjectMarks})`).run(
      ...rows.map((r) => r.id),
    )
    db.prepare(`DELETE FROM mistakes WHERE subject_id IN (${subjectMarks})`).run(
      ...rows.map((r) => r.id),
    )
    db.prepare(`DELETE FROM study_sessions WHERE subject_id IN (${subjectMarks})`).run(
      ...rows.map((r) => r.id),
    )
    db.prepare(`DELETE FROM subjects WHERE id IN (${subjectMarks})`).run(...rows.map((r) => r.id))

    summary.customSubjects += rows.length
  }

  const run = db.transaction(() => {
    /* 1. 對話與訊息（含 AI 標註、知識點關聯、由分析衍生的錯題與學習時間） */
    if (options.chat) {
      summary.annotations = count('message_annotations')
      summary.messages = count('messages')
      summary.conversations = count('conversations')

      db.prepare(`DELETE FROM message_knowledge_points`).run()
      db.prepare(`DELETE FROM message_annotations`).run()
      db.prepare(`DELETE FROM study_sessions`).run()
      db.prepare(`DELETE FROM mistakes`).run()
      db.prepare(`DELETE FROM daily_checklist`).run()
      db.prepare(`DELETE FROM messages`).run()
      db.prepare(`DELETE FROM conversations`).run()
      // 自訂學科（Chat 中新增的 Tag）也一併回到初始狀態
      clearCustomSubjects()
    }

    /* 2. 分析內容（知識點 / 錯題 / 學習時間 / 每日清單） */
    if (options.analysis) {
      summary.knowledgePoints = count('knowledge_points')
      summary.mistakes = count('mistakes')
      summary.studySessions = count('study_sessions')
      summary.checklistItems = count('daily_checklist')

      db.prepare(`DELETE FROM daily_checklist`).run()
      db.prepare(`DELETE FROM message_knowledge_points`).run()
      db.prepare(`DELETE FROM study_sessions`).run()
      db.prepare(`DELETE FROM mistakes`).run()
      db.prepare(`DELETE FROM knowledge_points`).run()
      db.prepare(`DELETE FROM message_annotations`).run()
      // 自訂學科（Chat 中新增的 Tag）也一併移除
      clearCustomSubjects()
    }

    /* 3. LLM 綁定與一般設定 */
    if (options.llm) {
      summary.llmBindings = count('llm_bindings')
      summary.settings = count('settings') + count('llm_settings')
      db.prepare(`DELETE FROM llm_bindings`).run()
      db.prepare(`DELETE FROM settings`).run()
      db.prepare(`DELETE FROM llm_settings`).run()
    }
  })

  run()
  return summary
}

/** 目前資料庫中所有被引用的附件檔名（files 表的 fileUrl 形式為 /api/uploads/<name>） */
export function referencedUploadFiles(): Set<string> {
  const rows = getRawDb().prepare(`SELECT attachments FROM messages WHERE attachments IS NOT NULL`).all() as Array<{
    attachments: string
  }>
  const names = new Set<string>()
  for (const row of rows) {
    try {
      const list = JSON.parse(row.attachments) as Array<{ fileUrl?: string }>
      for (const item of list) {
        const url = item?.fileUrl
        if (!url) continue
        const name = url.split('/').pop()
        if (name) names.add(name)
      }
    } catch {
      /* 忽略格式錯誤的列 */
    }
  }
  return names
}


/* ============================================================
 * 設置（settings）
 * ============================================================ */

export function getSetting(key: string): string | null {
  const row = getRawDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function getAllSettings(): Record<string, string> {
  const rows = getRawDb().prepare(`SELECT key, value FROM settings`).all() as Array<{
    key: string
    value: string
  }>
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setSetting(key: string, value: string): void {
  getRawDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(key, value)
}

export function deleteSetting(key: string): void {
  getRawDb().prepare(`DELETE FROM settings WHERE key = ?`).run(key)
}
