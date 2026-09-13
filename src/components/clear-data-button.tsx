'use client'

/**
 * 清除設定（設置頁中「LLM 綁定」下方的獨立區塊）
 * ============================================================
 * 點擊後彈出確認視窗，勾選要清除的內容：
 *   - 歷史聊天（對話與訊息）
 *   - 分析內容（知識點 / 錯題 / 學習時間 / 每日清單）
 *   - LLM 儲存內容（綁定的廠商、金鑰、模型）
 *   - 一併刪除已上傳的附件檔案（磁碟上的 data/uploads）
 *
 * 確認後清除本地 SQLite 資料與檔案，回到「尚未使用」的初始狀態；
 * 學科（中文 / English / 數學）為系統基礎資料，一律保留。
 */

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Database,
  FileWarning,
  MessagesSquare,
  PieChart,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { resetAppData } from '@/lib/api'
import type { ResetOptions, ResetSummary } from '@/lib/types'
import { Button, Dialog, DialogContent, Spinner, toast } from '@/components/ui'

interface OptionMeta {
  key: Exclude<keyof ResetOptions, 'files'>
  icon: React.ComponentType<{ className?: string }>
  label: string
  desc: string
}

const OPTIONS: OptionMeta[] = [
  {
    key: 'chat',
    icon: MessagesSquare,
    label: '歷史聊天',
    desc: '所有對話與訊息（含 AI 標註、自訂新增的學科 Tag）',
  },
  {
    key: 'analysis',
    icon: PieChart,
    label: '分析內容',
    desc: '知識點、錯題、學習時間、每日清單（含自訂學科）',
  },
  {
    key: 'llm',
    icon: Database,
    label: 'LLM 儲存內容',
    desc: '已綁定的廠商、API Key、模型與其他設定',
  },
]

const ALL_ON: ResetOptions = { chat: true, analysis: true, llm: true, files: true }

/**
 * 獨立區塊版本：設置頁中「LLM 綁定」下方的一個自己的入口。
 * 標題列點擊即可展開，內容為說明 + 清除按鈕。
 */
export function ClearDataSection({
  onCleared,
  defaultOpen = false,
}: {
  onCleared?: () => void
  /** 由 ?entry=clear 進入時可預設展開 */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
          <Trash2 className="size-4 text-destructive" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">清除設定</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            清除歷史聊天、分析內容、LLM 儲存內容與已上傳檔案，回到初始狀態。
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-background/40 px-4 py-4">
          <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
            此操作無法復原，會刪除本機資料庫與磁碟上的對應內容。
          </p>
          <ClearDataButton onCleared={onCleared} />
        </div>
      )}
    </section>
  )
}

export function ClearDataButton({ onCleared }: { onCleared?: () => void }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ResetOptions>(ALL_ON)
  const [clearing, setClearing] = useState(false)

  const anySelected = options.chat || options.analysis || options.llm || options.files

  const run = async () => {
    setClearing(true)
    try {
      const { summary } = await resetAppData(options)
      toast({ title: '已清除完成', description: describe(summary) })
      setOpen(false)
      onCleared?.()
      // 清單 / 分析頁的資料都已改變，重新載入最乾淨
      setTimeout(() => window.location.reload(), 600)
    } catch (e) {
      toast({
        title: '清除失敗',
        description: e instanceof Error ? e.message : '請稍後重試',
        variant: 'destructive',
      })
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
        onClick={() => {
          setOptions(ALL_ON)
          setOpen(true)
        }}
      >
        <Trash2 className="size-3.5" />
        清除設定
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && !clearing && setOpen(false)}>
        <DialogContent title="清除設定" className="max-w-lg">
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="leading-relaxed">
                此操作無法復原。清除後會刪除本機資料庫中的內容，
                並回到尚未使用這些資料的初始狀態。
              </p>
            </div>

            {/* 勾選要清除的內容 */}
            <div className="space-y-2">
              {OPTIONS.map((opt) => {
                const checked = options[opt.key]
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      checked ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        checked ? 'border-destructive bg-destructive text-white' : 'border-border',
                      )}
                    >
                      {checked && <Check className="size-3" />}
                    </span>
                    <opt.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{opt.desc}</span>
                    </span>
                  </button>
                )
              })}

              {/* 檔案（獨立，因為會刪到磁碟） */}
              <button
                type="button"
                onClick={() => setOptions((prev) => ({ ...prev, files: !prev.files }))}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                  options.files ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    options.files ? 'border-destructive bg-destructive text-white' : 'border-border',
                  )}
                >
                  {options.files && <Check className="size-3" />}
                </span>
                <FileWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">已上傳的檔案</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    刪除磁碟上的 <span className="font-mono">data/uploads/</span> 實體檔案
                  </span>
                </span>
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              學科（中文 / English / 數學）屬於系統基礎資料，不會被清除。
            </p>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={clearing} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!anySelected || clearing}
                onClick={() => void run()}
              >
                {clearing ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                確認清除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function describe(summary: ResetSummary): string {
  const parts: string[] = []
  if (summary.conversations) parts.push(`${summary.conversations} 個對話`)
  if (summary.messages) parts.push(`${summary.messages} 則訊息`)
  if (summary.customSubjects) parts.push(`${summary.customSubjects} 個自訂學科`)
  if (summary.knowledgePoints) parts.push(`${summary.knowledgePoints} 個知識點`)
  if (summary.mistakes) parts.push(`${summary.mistakes} 題錯題`)
  if (summary.studySessions) parts.push(`${summary.studySessions} 筆學習紀錄`)
  if (summary.checklistItems) parts.push(`${summary.checklistItems} 筆清單`)
  if (summary.llmBindings) parts.push(`${summary.llmBindings} 筆 LLM 綁定`)
  if (summary.files) parts.push(`${summary.files} 個檔案`)
  return parts.length ? `已刪除 ${parts.join('、')}` : '沒有需要清除的資料'
}
