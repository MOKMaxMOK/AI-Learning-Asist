'use client'

/**
 * 每日清單（週一 → 週日）
 * ============================================================
 * 版面：
 *   上方：檢視切換（編輯清單 / 查看清單）+ 週次切換
 *   下方：當日清單內容
 *
 * 編輯清單：可新增 / 刪除項目（含過去與未來的日期）
 * 查看清單：點擊未完成項目會先跳出確認，確認後才打勾；
 *           該日全部完成時顯示「當日任務全部完成」。
 *
 * 一週七天的清單一次載入（GET /api/daily-checklist?week=1），
 * 切換日期不用重新打 API。
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ListChecks,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { cn, formatDateKey } from '@/lib/utils'
import { useChecklistMutations, useWeeklyChecklist } from '@/hooks/use-analyze-api'
import { KNOWLEDGE_STATUS_META } from '@/lib/constants'
import type { DailyChecklistDay } from '@/lib/types'
import { Button, Skeleton, Spinner, TagChip, toast } from '@/components/ui'
import { ChartCard, EmptyChart } from '@/components/charts'

/** 週一 = 0 … 週日 = 6 */
const WEEKDAY_LABELS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

type ChecklistMode = 'edit' | 'view'

export function DailyChecklistView() {
  const today = formatDateKey()
  const [mode, setMode] = useState<ChecklistMode>('view')
  /** 目前選取的日期（預設今天） */
  const [selectedDate, setSelectedDate] = useState(today)
  /** 週次位移：0 = 本週，-1 = 上週… */
  const [weekOffset, setWeekOffset] = useState(0)

  const anchorDate = useMemo(() => {
    const d = new Date(`${today}T00:00:00`)
    d.setDate(d.getDate() + weekOffset * 7)
    return formatDateKey(d)
  }, [today, weekOffset])

  const { data, isLoading, isError, refetch } = useWeeklyChecklist(anchorDate)
  const { addItem, toggleItem, removeItem } = useChecklistMutations(selectedDate)
  const [draft, setDraft] = useState('')

  /** 切換週次時，若目前選取的日期不在該週，自動選到今天（本週）或該週第一天 */
  useEffect(() => {
    if (!data) return
    const inWeek = data.days.some((d) => d.date === selectedDate)
    if (!inWeek) {
      const target = data.days.find((d) => d.isToday) ?? data.days[0]
      setSelectedDate(target.date)
    }
  }, [data, selectedDate])

  const days = data?.days ?? []
  const selectedDay: DailyChecklistDay | undefined =
    days.find((d) => d.date === selectedDate) ?? days.find((d) => d.isToday) ?? days[0]
  const selectedItems = selectedDay?.items ?? []

  const weekLabel = data
    ? `${data.weekStart.slice(5).replace('-', '/')} - ${data.weekEnd.slice(5).replace('-', '/')}`
    : ''

  const submit = () => {
    const content = draft.trim()
    if (!content) return
    addItem.mutate(content, {
      onSuccess: () => setDraft(''),
      onError: (e) =>
        toast({
          title: '新增清單失敗',
          description: e instanceof Error ? e.message : '請稍後重試',
          variant: 'destructive',
        }),
    })
  }

  /** 查看模式：點擊項目 → 確認 → 打勾 */
  const confirmDone = (id: string, content: string) => {
    const ok = window.confirm(`確認完成「${content}」？`)
    if (!ok) return
    toggleItem.mutate(
      { id, done: true },
      {
        onSuccess: () => {
          const willAllDone =
            selectedItems.length > 0 && selectedItems.every((it) => it.id === id || it.done)
          toast({
            title: willAllDone ? '當日任務全部完成！' : '已完成',
            description: willAllDone ? `「${selectedDay?.date}」的項目都完成了 🎉` : content,
          })
        },
        onError: (e) =>
          toast({
            title: '更新失敗',
            description: e instanceof Error ? e.message : '請稍後重試',
            variant: 'destructive',
          }),
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {isError && (
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="min-w-0">
              每日清單載入失敗（GET /api/daily-checklist?week=1）
            </span>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1 text-xs text-primary transition-colors hover:bg-primary-soft"
            >
              <RotateCcw className="size-3" />
              重試
            </button>
          </div>
        </div>
      )}

      <ChartCard
        title="每日清單"
        hint="週一到週日；上方可切換編輯 / 查看清單"
        action={
          /* 檢視切換：編輯清單 / 查看清單 */
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            {(
              [
                { key: 'edit', label: '編輯清單' },
                { key: 'view', label: '查看清單' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs transition-colors',
                  mode === m.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        {/* 週次切換 */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="上一週"
              onClick={() => setWeekOffset((v) => v - 1)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[104px] text-center text-xs font-medium">
              {weekLabel || '—'}
              {weekOffset === 0 && <span className="ml-1 text-muted-foreground">（本週）</span>}
            </span>
            <button
              type="button"
              aria-label="下一週"
              onClick={() => setWeekOffset((v) => v + 1)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="ml-1 rounded-md px-2 py-1 text-xs text-primary transition-colors hover:bg-primary-soft"
              >
                回到本週
              </button>
            )}
          </div>

          <span className="shrink-0 text-xs text-muted-foreground">
            本週完成{' '}
            <span className="font-semibold text-primary">{data?.doneCount ?? 0}</span> /{' '}
            {data?.totalCount ?? 0}
          </span>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* 週一到週日 */}
            <div className="mb-4 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isSelected = day.date === selectedDate
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-background hover:border-primary/40',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[10px]',
                        day.isToday ? 'font-semibold text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {WEEKDAY_LABELS[day.weekday]}
                    </span>
                    <span className="text-xs font-medium">{day.date.slice(8)}</span>
                    {/* 完成狀態 */}
                    {day.allDone ? (
                      <CheckCircle2 className="size-3.5 text-[#1F6B48]" />
                    ) : day.totalCount > 0 ? (
                      <span className="text-[10px] text-muted-foreground">
                        {day.doneCount}/{day.totalCount}
                      </span>
                    ) : (
                      <Circle className="size-3 text-border" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* 當日清單內容 */}
            <div className="rounded-lg border bg-background">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold">
                    {WEEKDAY_LABELS[selectedDay?.weekday ?? 0]} · {selectedDay?.date ?? selectedDate}
                  </span>
                  {selectedDay?.isToday && (
                    <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] text-primary">
                      今天
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {mode === 'edit' ? '編輯中' : '完成'}{' '}
                  <span className="font-semibold text-primary">{selectedDay?.doneCount ?? 0}</span> /{' '}
                  {selectedDay?.totalCount ?? 0}
                </span>
              </div>

              {/* 編輯模式：新增項目 */}
              {mode === 'edit' && (
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        submit()
                      }
                    }}
                    placeholder="輸入這天想完成的項目…（Enter 新增）"
                    className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!draft.trim() || addItem.isPending}
                    onClick={submit}
                  >
                    {addItem.isPending ? <Spinner className="size-3.5" /> : <Plus className="size-3.5" />}
                    新增
                  </Button>
                </div>
              )}

              {selectedItems.length === 0 ? (
                <div className="p-3">
                  <EmptyChart
                    height={140}
                    text={
                      mode === 'edit'
                        ? '這天的清單還是空的，新增第一項吧'
                        : '這天還沒有清單項目，切到「編輯清單」新增'
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y">
                  {selectedItems.map((it) => (
                    <li key={it.id} className="group flex items-center gap-2.5 px-3 py-2">
                      {mode === 'edit' ? (
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            it.done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border',
                          )}
                        >
                          {it.done && <Check className="size-3" />}
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={it.done ? '已完成' : '點擊確認完成'}
                          disabled={it.done || toggleItem.isPending}
                          onClick={() => confirmDone(it.id, it.content)}
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                            it.done
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary',
                          )}
                        >
                          {it.done && <Check className="size-3" />}
                        </button>
                      )}

                      <span
                        className={cn(
                          'min-w-0 flex-1 text-sm',
                          it.done && 'text-muted-foreground line-through',
                        )}
                      >
                        {it.content}
                      </span>

                      {it.subjectName && (
                        <TagChip className="shrink-0 px-2 py-0 text-[10px]">{it.subjectName}</TagChip>
                      )}

                      {mode === 'edit' ? (
                        <button
                          type="button"
                          aria-label="刪除清單項"
                          onClick={() =>
                            removeItem.mutate(it.id, {
                              onSuccess: () => toast({ title: '已刪除', description: it.content }),
                              onError: (e) =>
                                toast({
                                  title: '刪除失敗',
                                  description: e instanceof Error ? e.message : '請稍後重試',
                                  variant: 'destructive',
                                }),
                            })
                          }
                          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : (
                        it.done && (
                          <button
                            type="button"
                            aria-label="取消完成"
                            title="取消完成"
                            onClick={() => toggleItem.mutate({ id: it.id, done: false })}
                            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>
                        )
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* 當日全部完成 */}
              {selectedDay?.allDone && (
                <div className="flex items-center gap-2 border-t border-[#99DCBB] bg-[#E7F7EF] px-3 py-2.5 text-xs text-[#1F6B48]">
                  <CheckCircle2 className="size-4" />
                  <span className="font-semibold">當日任務全部完成</span>
                  <span className="opacity-80">
                    （{selectedDay.doneCount}/{selectedDay.totalCount}）
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </ChartCard>

      {/* 複習知識點（系統建議） */}
      <div className="mt-5">
        <ChartCard title="複習知識點" hint="系統依遺忘曲線排定，建議今天複習的知識點">
          {isLoading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (data?.reviewKnowledgePoints.length ?? 0) === 0 ? (
            <EmptyChart height={140} text="目前沒有建議複習的知識點" />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data!.reviewKnowledgePoints.map((k) => {
                const meta = KNOWLEDGE_STATUS_META[k.status]
                return (
                  <li
                    key={k.id}
                    className={cn('rounded-lg border px-3 py-2.5', meta.cell)}
                    title={meta.hint}
                  >
                    <p className="truncate text-xs font-medium">{k.name}</p>
                    <p className="mt-0.5 truncate text-[11px] opacity-80">
                      {[k.subjectName, meta.label, k.reason].filter(Boolean).join(' · ')}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
