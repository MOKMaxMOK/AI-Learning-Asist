import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 秒數 → 「2 小時 15 分」／「45 分鐘」／「30 秒」 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} 秒`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小時` : `${hours} 小時 ${rest} 分`
}

/** 秒數 → 「2.5h」／「45m」（圖表軸標籤用，較精簡） */
export function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const minutes = s / 60
  if (minutes < 60) return `${Math.round(minutes)}m`
  return `${(minutes / 60).toFixed(1)}h`
}

/** 0–1 → 百分比字串 */
export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

/** ISO 日期 → 「5/20」 */
export function formatMonthDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** Date → 「2024-05-20」（本地時區） */
export function formatDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
