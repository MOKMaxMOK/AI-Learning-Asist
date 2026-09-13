/**
 * Analyze 板塊的統計計算
 * ============================================================
 * 全部資料都來自 Chat 寫入的標註（message_annotations / knowledge_points /
 * mistakes / study_sessions / daily_checklist），不產生任何假資料。
 */

import { getRawDb } from '@/lib/db'
import {
  aggregateSubjectStats,
  dayOffset,
  localDay,
  streakDays,
  sumStudySeconds,
  type KnowledgePointRecord,
} from '@/lib/server/queries'
import {
  toChecklistItem,
  toKnowledgePointStat,
  toMistakeItem,
  toMistakeTypeCount,
  toStudyTimeBucket,
  toSubjectStat,
  toIso,
} from '@/lib/db/mappers'
import type {
  AnalyzeOverview,
  ChecklistItem,
  DailyChecklist,
  DailyChecklistDay,
  DailyChecklistWeek,
  KnowledgeStatus,
  MistakeItem,
  MistakeStats,
  StudyTimeBucket,
  StudyTimeDetail,
  StudyTimeTimeline,
  StudyType,
  SubjectHeatmap,
} from '@/lib/types'

/* ---------------- 一級：總覽 ---------------- */

export function getOverview(subjectId?: string): AnalyzeOverview {
  const all = aggregateSubjectStats()
  const stats = subjectId ? all.filter((s) => s.subjectId === subjectId) : all

  const today = localDay()
  const checklistRow = getRawDb()
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END), 0) AS done
       FROM daily_checklist WHERE date = ?`,
    )
    .get(today) as { total: number; done: number }

  return {
    subjects: stats.map(toSubjectStat),
    todayStudySeconds: sumStudySeconds({ sinceDay: today, subjectId }),
    streakDays: streakDays(),
    studySeconds30d: sumStudySeconds({ sinceDay: dayOffset(29), subjectId }),
    todayChecklist: { done: Number(checklistRow?.done ?? 0), total: Number(checklistRow?.total ?? 0) },
    generatedAt: new Date().toISOString(),
  }
}

/* ---------------- 二級：知識點熱力圖 ---------------- */

export function getHeatmap(subject: { id: string; name: string }): SubjectHeatmap {
  const rows = getRawDb()
    .prepare(
      `SELECT id, name, unit, status, use_count as useCount, mistake_count as mistakeCount,
              corrected_count as correctedCount, mastery, last_studied_at as lastStudiedAt
       FROM knowledge_points
       WHERE subject_id = ?
       ORDER BY use_count DESC, name ASC`,
    )
    .all(subject.id) as Array<KnowledgePointRecord>

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    knowledgePoints: rows.map((r) =>
      toKnowledgePointStat({
        id: r.id,
        name: r.name,
        unit: r.unit,
        status: r.status,
        useCount: Number(r.useCount),
        mistakeCount: Number(r.mistakeCount),
        mastery: Number(r.mastery),
        lastStudiedAt: r.lastStudiedAt,
      }),
    ),
    generatedAt: new Date().toISOString(),
  }
}

/* ---------------- 三級：錯題統計 ---------------- */

export function getMistakeStats(
  knowledgePoint: { id: string; name: string; subjectId: string; subjectName?: string | null },
  opts: { limit?: number } = {},
): MistakeStats {
  const db = getRawDb()

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN corrected = 1 THEN 1 ELSE 0 END), 0) AS corrected
       FROM mistakes WHERE knowledge_point_id = ?`,
    )
    .get(knowledgePoint.id) as { total: number; corrected: number }

  const ranking = db
    .prepare(
      `SELECT type, COUNT(*) AS count FROM mistakes
       WHERE knowledge_point_id = ?
       GROUP BY type ORDER BY count DESC, type ASC`,
    )
    .all(knowledgePoint.id) as Array<{ type: string; count: number }>

  const limit = Math.max(1, Math.min(200, opts.limit ?? 100))
  const items = db
    .prepare(
      `SELECT m.id, m.conversation_id AS conversationId, c.title AS conversationTitle,
              m.question, m.user_answer AS userAnswer, m.correction, m.type, m.created_at AS createdAt
       FROM mistakes m
       LEFT JOIN conversations c ON c.id = m.conversation_id
       WHERE m.knowledge_point_id = ?
       ORDER BY m.created_at DESC
       LIMIT ?`,
    )
    .all(knowledgePoint.id, limit) as Array<{
    id: string
    conversationId: string
    conversationTitle: string | null
    question: string | null
    userAnswer: string | null
    correction: string | null
    type: string
    createdAt: string
  }>

  return {
    knowledgePointId: knowledgePoint.id,
    knowledgePointName: knowledgePoint.name,
    subjectId: knowledgePoint.subjectId,
    subjectName: knowledgePoint.subjectName ?? undefined,
    total: Number(totals?.total ?? 0),
    corrected: Number(totals?.corrected ?? 0),
    typeRanking: toMistakeTypeCount(ranking),
    items: items.map(toMistakeItem) as MistakeItem[],
  }
}

/* ---------------- 二級：學習時間記錄 ---------------- */

const pad = (n: number) => String(n).padStart(2, '0')

interface DayAggregate {
  day: string
  total: number
  learn: number
  review: number
  practice: number
}

function queryDaily(startDay: string, endDay: string): Map<string, DayAggregate> {
  const rows = getRawDb()
    .prepare(
      `SELECT day,
              SUM(seconds) AS total,
              SUM(CASE WHEN study_type = 'learn' THEN seconds ELSE 0 END) AS learn,
              SUM(CASE WHEN study_type = 'review' THEN seconds ELSE 0 END) AS review,
              SUM(CASE WHEN study_type = 'practice' THEN seconds ELSE 0 END) AS practice
       FROM study_sessions
       WHERE day >= ? AND day <= ?
       GROUP BY day`,
    )
    .all(startDay, endDay) as DayAggregate[]
  return new Map(rows.map((r) => [r.day, r]))
}

function queryMonthly(startDay: string, endDay: string): Map<string, DayAggregate> {
  const rows = getRawDb()
    .prepare(
      `SELECT substr(day, 1, 7) AS day,
              SUM(seconds) AS total,
              SUM(CASE WHEN study_type = 'learn' THEN seconds ELSE 0 END) AS learn,
              SUM(CASE WHEN study_type = 'review' THEN seconds ELSE 0 END) AS review,
              SUM(CASE WHEN study_type = 'practice' THEN seconds ELSE 0 END) AS practice
       FROM study_sessions
       WHERE day >= ? AND day <= ?
       GROUP BY substr(day, 1, 7)`,
    )
    .all(startDay, endDay) as DayAggregate[]
  return new Map(rows.map((r) => [r.day, r]))
}

function bucketFromAggregate(key: string, label: string, startDate: string, endDate: string, agg?: DayAggregate): StudyTimeBucket {
  const byType: Partial<Record<StudyType, number>> = {}
  if (agg) {
    if (agg.learn) byType.learn = Number(agg.learn)
    if (agg.review) byType.review = Number(agg.review)
    if (agg.practice) byType.practice = Number(agg.practice)
  }
  return toStudyTimeBucket(key, label, startDate, endDate, Number(agg?.total ?? 0), byType)
}

/**
 * 學習時間時間線
 *   week  → 最近 12 週，每根柱子是一天（可看出每天的學習量）
 *   month → 最近 30 天，每根柱子是一天
 *   year  → 今年 1 月到本月，每根柱子是一個月
 */
export function getStudyTimeTimeline(granularity: 'week' | 'month' | 'year'): StudyTimeTimeline {
  const today = new Date()
  const todayKey = localDay(today)

  if (granularity === 'year') {
    const year = today.getFullYear()
    const from = `${year}-01-01`
    const daily = queryMonthly(from, todayKey)
    const buckets: StudyTimeBucket[] = []
    for (let m = 0; m <= today.getMonth(); m += 1) {
      const key = `${year}-${pad(m + 1)}`
      const lastDay = new Date(year, m + 1, 0).getDate()
      buckets.push(
        bucketFromAggregate(key, `${m + 1} 月`, `${key}-01`, `${key}-${pad(lastDay)}`, daily.get(key)),
      )
    }
    return {
      granularity,
      buckets,
      totalSeconds: buckets.reduce((n, b) => n + b.totalSeconds, 0),
    }
  }

  const days = granularity === 'week' ? 83 : 29 // 12 週 ≈ 84 天
  const from = dayOffset(days)
  const daily = queryDaily(from, todayKey)

  const buckets: StudyTimeBucket[] = []
  for (let i = days; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = localDay(d)
    buckets.push(
      bucketFromAggregate(key, `${d.getMonth() + 1}/${d.getDate()}`, key, key, daily.get(key)),
    )
  }

  return {
    granularity,
    buckets,
    totalSeconds: buckets.reduce((n, b) => n + b.totalSeconds, 0),
  }
}

/** 點擊某一天（或某月）後的明細 */
export function getStudyTimeDetail(dateKey: string): StudyTimeDetail {
  const isMonth = /^\d{4}-\d{2}$/.test(dateKey)
  const db = getRawDb()

  const where = isMonth ? `substr(ss.day, 1, 7) = ?` : `ss.day = ?`
  const rows = db
    .prepare(
      `SELECT ss.id, ss.subject_id AS subjectId, s.name AS subjectName,
              ss.knowledge_point_id AS knowledgePointId, kp.name AS knowledgePointName,
              ss.study_type AS studyType, ss.seconds,
              ss.conversation_id AS conversationId, c.title AS conversationTitle
       FROM study_sessions ss
       LEFT JOIN subjects s ON s.id = ss.subject_id
       LEFT JOIN knowledge_points kp ON kp.id = ss.knowledge_point_id
       LEFT JOIN conversations c ON c.id = ss.conversation_id
       WHERE ${where}
       ORDER BY ss.created_at DESC`,
    )
    .all(dateKey) as Array<{
    id: string
    subjectId: string | null
    subjectName: string | null
    knowledgePointId: string | null
    knowledgePointName: string | null
    studyType: string
    seconds: number
    conversationId: string | null
    conversationTitle: string | null
  }>

  return {
    date: dateKey,
    totalSeconds: rows.reduce((n, r) => n + Number(r.seconds ?? 0), 0),
    entries: rows.map((r) => ({
      id: r.id,
      subjectId: r.subjectId ?? undefined,
      subjectName: r.subjectName ?? undefined,
      knowledgePointName: r.knowledgePointName ?? undefined,
      studyType: (r.studyType as StudyType) ?? 'learn',
      seconds: Number(r.seconds ?? 0),
      conversationId: r.conversationId ?? undefined,
      conversationTitle: r.conversationTitle ?? undefined,
    })),
  }
}

/* ---------------- 二級：每日清單 ---------------- */

/** 單日清單項目（內部共用） */
function queryChecklistItems(date: string): ChecklistItem[] {
  const rows = getRawDb()
    .prepare(
      `SELECT d.id, d.content, d.done, d.knowledge_point_id AS knowledgePointId,
              kp.name AS knowledgePointName, d.subject_id AS subjectId, s.name AS subjectName,
              d.sort_order AS sortOrder, d.created_at AS createdAt
       FROM daily_checklist d
       LEFT JOIN knowledge_points kp ON kp.id = d.knowledge_point_id
       LEFT JOIN subjects s ON s.id = d.subject_id
       WHERE d.date = ? AND d.kind = 'manual'
       ORDER BY d.sort_order ASC, d.created_at ASC`,
    )
    .all(date) as Array<Parameters<typeof toChecklistItem>[0]>
  return rows.map(toChecklistItem) as ChecklistItem[]
}

export function getDailyChecklist(date: string): DailyChecklist {
  return {
    date,
    items: queryChecklistItems(date),
    reviewKnowledgePoints: recommendReviewKnowledgePoints(date),
  }
}

/** 該日期所在那一週的「週一」 */
export function mondayOf(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`)
  const day = d.getDay() // 0 = 週日
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return localDay(d)
}

export function addDaysToKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localDay(d)
}

/**
 * 週清單（週一 → 週日）
 * 一次回傳七天，前端切換「編輯清單 / 查看清單」時不需再打 API。
 */
export function getWeeklyChecklist(anchorDate: string, today = localDay()): DailyChecklistWeek {
  const monday = mondayOf(anchorDate)
  const days: DailyChecklistDay[] = []

  for (let i = 0; i < 7; i += 1) {
    const date = addDaysToKey(monday, i)
    const items = queryChecklistItems(date)
    const done = items.filter((it) => it.done).length
    days.push({
      date,
      // 0 = 週一 … 6 = 週日
      weekday: i,
      isToday: date === today,
      isFuture: date > today,
      items,
      doneCount: done,
      totalCount: items.length,
      allDone: items.length > 0 && done === items.length,
    })
  }

  const totalCount = days.reduce((n, d) => n + d.totalCount, 0)
  const doneCount = days.reduce((n, d) => n + d.doneCount, 0)

  return {
    weekStart: monday,
    weekEnd: addDaysToKey(monday, 6),
    days,
    totalCount,
    doneCount,
    allDone: totalCount > 0 && doneCount === totalCount,
    reviewKnowledgePoints: recommendReviewKnowledgePoints(anchorDate),
  }
}

/**
 * 建議複習的知識點：依「最後學習時間越久 + 熟練度低 + 錯題多」排序。
 * 只從今天之前有紀錄的知識點中挑選（不會建議今天才剛學的）。
 */
export function recommendReviewKnowledgePoints(date: string, limit = 6): DailyChecklist['reviewKnowledgePoints'] {
  const rows = getRawDb()
    .prepare(
      `SELECT kp.id, kp.name, kp.subject_id AS subjectId, s.name AS subjectName, kp.status,
              kp.mastery, kp.mistake_count AS mistakeCount, kp.last_studied_at AS lastStudiedAt,
              CAST(julianday(?) - julianday(date(kp.last_studied_at)) AS INTEGER) AS daysSince
       FROM knowledge_points kp
       LEFT JOIN subjects s ON s.id = kp.subject_id
       WHERE kp.last_studied_at IS NOT NULL
         AND date(kp.last_studied_at) < ?
       ORDER BY (kp.mistake_count * 2) DESC,
                CASE kp.status WHEN 'weak' THEN 0 WHEN 'new' THEN 1 WHEN 'learning' THEN 2 ELSE 3 END ASC,
                daysSince DESC
       LIMIT ?`,
    )
    .all(date, date, limit) as Array<{
    id: string
    name: string
    subjectId: string | null
    subjectName: string | null
    status: string
    mastery: number
    mistakeCount: number
    lastStudiedAt: string | null
    daysSince: number | null
  }>

  return rows.map((r) => {
    const days = Number(r.daysSince ?? 0)
    const reason = Number(r.mistakeCount) > 0
      ? `有 ${r.mistakeCount} 題錯題待加強`
      : days > 0
        ? `已 ${days} 天未複習`
        : '建議鞏固'
    return {
      id: r.id,
      name: r.name,
      subjectId: r.subjectId ?? undefined,
      subjectName: r.subjectName ?? undefined,
      status: r.status as KnowledgeStatus,
      reason,
      lastStudiedAt: r.lastStudiedAt ? toIso(r.lastStudiedAt) : undefined,
    }
  })
}
