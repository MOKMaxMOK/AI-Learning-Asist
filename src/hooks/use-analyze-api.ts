'use client'

/**
 * Analyze 板塊資料 Hooks（TanStack Query）
 * 接口實作見 src/lib/api/index.ts「Analyze（分析板塊）」章節。
 *
 * 未串接後端時查詢會進入 error 狀態，頁面呈現「錯誤提示 + 重試」，
 * 不會有假資料；UI 骨架與導覽層級仍可完整操作。
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createChecklistItem,
  deleteChecklistItem,
  getAnalyzeOverview,
  getDailyChecklist,
  getKnowledgePointMistakes,
  getStudyTimeDetail,
  getStudyTimeTimeline,
  getSubjectHeatmap,
  getWeeklyChecklist,
  listSubjects,
  updateChecklistItem,
} from '@/lib/api'
import { mergeSubjects } from '@/lib/constants'
import type { TimeGranularity } from '@/lib/types'

export const analyzeKeys = {
  overview: (subjectId?: string) => ['analyze', 'overview', subjectId ?? 'all'] as const,
  subjects: ['analyze', 'subjects'] as const,
  heatmap: (subjectId: string) => ['analyze', 'heatmap', subjectId] as const,
  mistakes: (knowledgePointId: string, subjectId?: string) =>
    ['analyze', 'mistakes', knowledgePointId, subjectId ?? 'all'] as const,
  studyTime: (granularity: TimeGranularity) => ['analyze', 'study-time', granularity] as const,
  studyTimeDetail: (date: string) => ['analyze', 'study-time', 'detail', date] as const,
  checklist: (date: string) => ['analyze', 'daily-checklist', date] as const,
  checklistWeek: (anchorDate: string) =>
    ['analyze', 'daily-checklist', 'week', anchorDate] as const,
}

/** 今天（本地時區）YYYY-MM-DD */
export function todayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ---------- 學科列表（供 Chat 選擇與 Analyze 篩選共用） ---------- */

/**
 * 學科列表：遠端失敗時回傳預設三學科（中文 / English / 數學），
 * 讓「新增對話必選學科」的流程在 API 暫時失敗時依然可用。
 */
export function useSubjects() {
  const query = useQuery({ queryKey: analyzeKeys.subjects, queryFn: listSubjects })
  return { ...query, subjects: mergeSubjects(query.data) }
}

/* ---------- 一級：學科分析（圓餅圖） ---------- */

export function useAnalyzeOverview(subjectId?: string) {
  return useQuery({
    queryKey: analyzeKeys.overview(subjectId),
    queryFn: () => getAnalyzeOverview(subjectId),
  })
}

/* ---------- 二級：知識點熱力圖 ---------- */

export function useSubjectHeatmap(subjectId: string | null) {
  return useQuery({
    queryKey: analyzeKeys.heatmap(subjectId ?? ''),
    queryFn: () => getSubjectHeatmap(subjectId!),
    enabled: !!subjectId,
  })
}

/* ---------- 三級：錯題統計 ---------- */

export function useKnowledgePointMistakes(
  knowledgePointId: string | null,
  subjectId?: string,
) {
  return useQuery({
    queryKey: analyzeKeys.mistakes(knowledgePointId ?? '', subjectId),
    queryFn: () => getKnowledgePointMistakes(knowledgePointId!, { subjectId }),
    enabled: !!knowledgePointId,
  })
}

/* ---------- 二級：學習時間記錄 ---------- */

export function useStudyTimeTimeline(granularity: TimeGranularity) {
  return useQuery({
    queryKey: analyzeKeys.studyTime(granularity),
    queryFn: () => getStudyTimeTimeline(granularity),
  })
}

/** 點擊某天的柱子後載入當日明細（date 為 null 時不查詢） */
export function useStudyTimeDetail(date: string | null) {
  return useQuery({
    queryKey: analyzeKeys.studyTimeDetail(date ?? ''),
    queryFn: () => getStudyTimeDetail(date!),
    enabled: !!date,
  })
}

/* ---------- 二級：每日清單（週一 → 週日） ---------- */

export function useDailyChecklist(date: string) {
  return useQuery({
    queryKey: analyzeKeys.checklist(date),
    queryFn: () => getDailyChecklist(date),
  })
}

/** 週清單：一次取得該週七天的清單（編輯 / 查看共用同一份快取） */
export function useWeeklyChecklist(anchorDate: string) {
  return useQuery({
    queryKey: analyzeKeys.checklistWeek(anchorDate),
    queryFn: () => getWeeklyChecklist(anchorDate),
  })
}

/**
 * 清單操作：新增 / 勾選 / 刪除
 * 每次變更都讓「週清單」與「單日清單」快取失效，確保兩邊同步。
 */
export function useChecklistMutations(date: string) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['analyze', 'daily-checklist'] })
  }

  const addItem = useMutation({
    mutationFn: (content: string) => createChecklistItem({ date, content }),
    onSuccess: invalidate,
  })

  const toggleItem = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      updateChecklistItem(id, { done }),
    onSuccess: invalidate,
  })

  const removeItem = useMutation({
    mutationFn: (id: string) => deleteChecklistItem(id),
    onSuccess: invalidate,
  })

  return { addItem, toggleItem, removeItem }
}
