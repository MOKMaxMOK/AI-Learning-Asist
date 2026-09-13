/**
 * 學科（Subject）預設定義
 * ------------------------------------------------------------
 * Chat 建立對話時必選一個學科，該學科即為 Analyze「學科分析」的維度來源。
 * 預設提供：中文、English（英文）、數學 —— 後端尚未提供學科列表時，
 * 前端以這三筆作為可選項，確保 UI 可用（不產生任何假統計資料）。
 *
 * 【後端接入】GET /api/subjects 回傳的學科會與此清單合併去重後顯示。
 */

import type { KnowledgeStatus, StudyType, Subject, TimeGranularity } from '@/lib/types'

export interface DefaultSubject extends Subject {
  /** i18n key / 顯示用英文名 */
  latin?: string
}

export const DEFAULT_SUBJECTS: DefaultSubject[] = [
  { id: 'subject-chinese', name: '中文', latin: 'Chinese', color: '#F0752E' },
  { id: 'subject-english', name: 'English', latin: 'English', color: '#4C8DF6' },
  { id: 'subject-math', name: '數學', latin: 'Math', color: '#3FB984' },
]

/** 建立對話時若後端尚未回傳學科，直接沿用預設學科 id */
export function isDefaultSubjectId(id: string): boolean {
  return DEFAULT_SUBJECTS.some((s) => s.id === id)
}

/** 合併後端學科與預設學科（以 name 去重，後端優先） */
export function mergeSubjects(remote?: Subject[] | null): Subject[] {
  if (!remote || remote.length === 0) return DEFAULT_SUBJECTS
  const seen = new Set(remote.map((s) => s.name))
  return [...remote, ...DEFAULT_SUBJECTS.filter((s) => !seen.has(s.name))]
}

/** 通用圖表調色盤（暖橘主色調延伸） */
export const CHART_COLORS = [
  '#F0752E',
  '#F2A93B',
  '#D95C4A',
  '#3FB984',
  '#4C8DF6',
  '#8B6FE0',
  '#2FB6C4',
  '#E0699E',
]

export function chartColor(index: number, provided?: string): string {
  return provided ?? CHART_COLORS[index % CHART_COLORS.length]
}

/* ---------------- 知識點狀態（熱力圖顏色） ---------------- */

export interface KnowledgeStatusMeta {
  label: string
  /** 熱力圖色塊（背景 / 邊框 / 文字） */
  cell: string
  /** 圖例圓點 */
  dot: string
  /** 說明文字 */
  hint: string
}

export const KNOWLEDGE_STATUS_META: Record<KnowledgeStatus, KnowledgeStatusMeta> = {
  new: {
    label: '剛學習',
    cell: 'bg-[#FFF1E3] border-[#F6C79A] text-[#9A5518] hover:bg-[#FFE7D2]',
    dot: 'bg-[#F6C79A]',
    hint: '本次對話首次接觸的知識點',
  },
  learning: {
    label: '已學習',
    cell: 'bg-[#E8F1FE] border-[#A9C8F5] text-[#23508F] hover:bg-[#DAE9FD]',
    dot: 'bg-[#A9C8F5]',
    hint: '已學過，但練習次數仍少',
  },
  frequent: {
    label: '使用次數多',
    cell: 'bg-[#E7F7EF] border-[#99DCBB] text-[#1F6B48] hover:bg-[#D8F1E5]',
    dot: 'bg-[#99DCBB]',
    hint: '反覆出現、經常練習的知識點',
  },
  weak: {
    label: '熟練度低',
    cell: 'bg-[#FDEAEA] border-[#F2A9A4] text-[#99231D] hover:bg-[#FBDCDB]',
    dot: 'bg-[#F2A9A4]',
    hint: '反覆出錯，需要加強',
  },
  mastered: {
    label: '已熟練',
    cell: 'bg-[#EFEAFB] border-[#C0AEF0] text-[#4B348F] hover:bg-[#E4DCF9]',
    dot: 'bg-[#C0AEF0]',
    hint: '正確率高，已掌握',
  },
}

/** 熱力圖圖例順序 */
export const KNOWLEDGE_STATUS_ORDER: KnowledgeStatus[] = [
  'new',
  'learning',
  'frequent',
  'weak',
  'mastered',
]

/* ---------------- 學習型態 ---------------- */

export const STUDY_TYPE_META: Array<{ value: StudyType; label: string; color: string }> = [
  { value: 'learn', label: '學習', color: '#F0752E' },
  { value: 'review', label: '複習', color: '#4C8DF6' },
  { value: 'practice', label: '練習', color: '#3FB984' },
]

export const TIME_GRANULARITY_META: Array<{
  value: TimeGranularity
  label: string
  hint: string
}> = [
  { value: 'week', label: '週', hint: '最近 12 週，每一根柱子是一天' },
  { value: 'month', label: '月', hint: '最近 30 天，每一根柱子是一天' },
  { value: 'year', label: '年', hint: '最近 12 個月，每一根柱子是一個月' },
]
