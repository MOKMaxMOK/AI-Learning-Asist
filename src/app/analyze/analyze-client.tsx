'use client'

/**
 * Analyze（分析板塊）
 * ============================================================
 * 導覽層級（以 ?subject= / ?kp= 查詢參數保存，可直接分享／上一頁返回）
 *
 *   /analyze                                一級：三個入口（本檔預設畫面）
 *     ├─ 1. 學科分析        圓餅圖（以學科展示佔比）
 *     │     └─ ?subject=<id>        二級：知識點熱力圖（顏色 = 知識點狀態）
 *     │           └─ ?kp=<id>       三級：錯題統計（錯題列表 + 錯題類型排行柱形圖）
 *     ├─ 2. 學習時間記錄    柱形圖，可切換 週 / 月 / 年 縮放時間線
 *     │                     點擊某天的柱子 → 當天學習 / 複習的學科與知識點明細
 *     └─ 3. 每日清單        用戶自訂清單 list + 建議複習知識點
 *
 * 目前僅完成前端 UI：資料一律來自 src/lib/api 的真實接口，
 * 未串接後端時顯示「載入失敗 + 重試」，不模擬任何資料。
 */

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Flame,
  ListChecks,
  PieChart,
  RotateCcw,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  todayKey,
  useAnalyzeOverview,
  useKnowledgePointMistakes,
  useStudyTimeDetail,
  useStudyTimeTimeline,
  useSubjectHeatmap,
  useSubjects,
} from '@/hooks/use-analyze-api'
import {
  CHART_COLORS,
  KNOWLEDGE_STATUS_META,
  KNOWLEDGE_STATUS_ORDER,
  STUDY_TYPE_META,
  TIME_GRANULARITY_META,
  chartColor,
} from '@/lib/constants'
import { cn, formatDuration, formatDurationShort } from '@/lib/utils'
import type {
  KnowledgePointStat,
  MistakeStats,
  SubjectStat,
  TimeGranularity,
} from '@/lib/types'
import { Button, Skeleton, TagChip } from '@/components/ui'
import {
  ChartCard,
  EmptyChart,
  MistakeTypeBars,
  StudyTimeBars,
  SubjectPieChart,
  type StudyTimeBar,
} from '@/components/charts'
import { DailyChecklistView } from '@/components/daily-checklist-view'

/* ============================================================
 * 共用小元件
 * ============================================================ */

/** 資料載入失敗（本機 API 或資料庫異常）：真實狀態提示 + 重試 */
function LoadError({ onRetry, label = '資料載入失敗，請稍後重試' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <span className="min-w-0">{label}</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border px-3 py-1 text-xs text-primary transition-colors hover:bg-primary-soft"
      >
        <RotateCcw className="size-3" />
        重試
      </button>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** 知識點狀態圖例 */
function KnowledgeLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', className)}>
      {KNOWLEDGE_STATUS_ORDER.map((s) => {
        const meta = KNOWLEDGE_STATUS_META[s]
        return (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title={meta.hint}>
            <span className={cn('size-2.5 rounded-sm', meta.dot)} />
            {meta.label}
          </span>
        )
      })}
    </div>
  )
}

/** 分類統計（學習型態）膠囊 */
function StudyTypeChip({ type, seconds }: { type: 'learn' | 'review' | 'practice'; seconds: number }) {
  const meta = STUDY_TYPE_META.find((t) => t.value === type)!
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
      <span className="size-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
      <span className="font-medium">{formatDuration(seconds)}</span>
    </span>
  )
}

/* ============================================================
 * 一級入口卡片
 * ============================================================ */

function EntryCard({
  icon: Icon,
  title,
  desc,
  badge,
  facts,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  badge?: string
  facts: Array<{ label: string; value: string }>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <Icon className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            {badge && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{badge}</span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-3">
        {facts.map((f) => (
          <div key={f.label}>
            <p className="text-[10px] text-muted-foreground">{f.label}</p>
            <p className="truncate text-xs font-medium">{f.value}</p>
          </div>
        ))}
      </div>
    </button>
  )
}

/* ============================================================
 * 一級：分析首頁（三個入口）
 * ============================================================ */

function OverviewHome() {
  const router = useRouter()
  const { data: overview, isLoading, isError, refetch } = useAnalyzeOverview()

  const goSubjects = () => router.push('/analyze?view=subjects')
  const goStudyTime = () => router.push('/analyze?view=study-time')
  const goChecklist = () => router.push('/analyze?view=daily-checklist')

  const totals = useMemo(() => {
    const stats = overview?.subjects ?? []
    return {
      messages: stats.reduce((n, s) => n + s.messageCount, 0),
      knowledgePoints: stats.reduce((n, s) => n + s.knowledgePoints, 0),
      mistakes: stats.reduce((n, s) => n + s.mistakes, 0),
    }
  }, [overview])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {isError && (
        <div className="mb-5">
          <LoadError onRetry={() => refetch()} />
        </div>
      )}

      {/* 學習摘要 */}
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {isLoading && !overview
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px] w-full rounded-xl" />)
          : (
            <>
              <StatTile
                icon={Clock}
                label="今日學習時間"
                value={overview ? formatDuration(overview.todayStudySeconds) : '—'}
                sub="來自 Chat 的學習型態標註"
              />
              <StatTile
                icon={Flame}
                label="連續學習"
                value={overview ? `${overview.streakDays} 天` : '—'}
                sub="近 30 天"
              />
              <StatTile
                icon={Target}
                label="累計錯題"
                value={overview ? `${totals.mistakes} 題` : '—'}
                sub={overview ? `知識點 ${totals.knowledgePoints} 個` : undefined}
              />
              <StatTile
                icon={TrendingUp}
                label="近 30 天學習"
                value={overview ? formatDuration(overview.studySeconds30d) : '—'}
                sub={overview ? `共 ${totals.messages} 則學習訊息` : undefined}
              />
            </>
          )}
      </div>

      {/* 三個一級入口 */}
      <div className="grid gap-4 md:grid-cols-3">
        <EntryCard
          icon={PieChart}
          title="學科分析"
          desc="以學科檢視學習佔比；進入學科後可看知識點熱力圖，再到單一知識點的錯題統計。"
          badge="三層"
          facts={[
            { label: '學科數', value: overview ? String(overview.subjects.length) : '—' },
            { label: '知識點', value: overview ? String(totals.knowledgePoints) : '—' },
            { label: '錯題', value: overview ? String(totals.mistakes) : '—' },
          ]}
          onClick={goSubjects}
        />
        <EntryCard
          icon={CalendarClock}
          title="學習時間記錄"
          desc="每天學習時間柱形圖，可切換週 / 月 / 年縮放時間線；點擊柱子看當天學了什麼。"
          facts={[
            { label: '今日', value: overview ? formatDuration(overview.todayStudySeconds) : '—' },
            { label: '近 30 天', value: overview ? formatDurationShort(overview.studySeconds30d) : '—' },
            { label: '連續', value: overview ? `${overview.streakDays} 天` : '—' },
          ]}
          onClick={goStudyTime}
        />
        <EntryCard
          icon={ListChecks}
          title="每日清單"
          desc="自己排的今日清單加上系統建議的複習知識點，逐項勾選完成。"
          facts={[
            {
              label: '今日完成',
              value: overview ? `${overview.todayChecklist.done}/${overview.todayChecklist.total}` : '—',
            },
            { label: '複習知識點', value: '依遺忘曲線' },
            { label: '日期', value: todayKey().slice(5) },
          ]}
          onClick={goChecklist}
        />
      </div>

    </div>
  )
}

/* ============================================================
 * 1-2 級：學科分析（圓餅圖）＋ 知識點熱力圖
 * ============================================================ */

function SubjectPieView() {
  const router = useRouter()
  const { data: overview, isLoading, isError, refetch } = useAnalyzeOverview()
  const { subjects } = useSubjects()

  /** 勾選要顯示在圓餅圖中的學科（預設全部顯示） */
  const [selected, setSelected] = useState<string[] | null>(null)

  const allSubjectIds = useMemo(
    () => (overview?.subjects ?? []).map((s) => s.subjectId),
    [overview],
  )

  const toggleSubject = (id: string) => {
    setSelected((prev) => {
      const current = prev ?? allSubjectIds
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      // 全部取消時回到「不過濾」，避免圓餅圖整個消失
      return next.length === 0 ? null : next
    })
  }

  const filteredStats = useMemo(
    () =>
      (overview?.subjects ?? []).filter((s) =>
        selected === null ? true : selected.includes(s.subjectId),
      ),
    [overview, selected],
  )

  const slices = useMemo(() => {
    return [...filteredStats]
      .sort((a, b) => b.messageCount - a.messageCount)
      .map((s, i) => ({
        subjectId: s.subjectId,
        name: s.subjectName,
        value: s.messageCount,
        color: chartColor(i, s.color),
      }))
      .filter((s) => s.value > 0)
  }, [filteredStats])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {isError && (
        <div className="mb-5">
          <LoadError onRetry={() => refetch()} label="學科分析載入失敗（GET /api/analyze/overview）" />
        </div>
      )}

      <ChartCard
        title="學科分析"
        hint="點擊圓餅圖上的學科可進入二級：知識點熱力圖"
      >
        {/* 學科篩選：控制圓餅圖要顯示哪些學科 */}
        <div className="mb-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">學科篩選</span>
            <span className="text-[11px] text-muted-foreground">
              （已選 {selected === null ? allSubjectIds.length : selected.length} / {allSubjectIds.length}）
            </span>
            {selected !== null && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md px-2 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary-soft"
              >
                全選
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(overview?.subjects ?? []).map((s: SubjectStat, i) => {
              const active = selected === null || selected.includes(s.subjectId)
              return (
                <TagChip
                  key={s.subjectId}
                  active={active}
                  onClick={() => toggleSubject(s.subjectId)}
                  className={cn(!active && 'opacity-50')}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: chartColor(i, s.color) }}
                  />
                  {s.subjectName}
                </TagChip>
              )
            })}
            {subjects.length === 0 && (
              <span className="text-xs text-muted-foreground">尚無學科</span>
            )}
          </div>
        </div>

        {isLoading && !overview ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : (
          <SubjectPieChart
            data={slices}
            metricLabel="學習訊息數"
            onSelect={(id) => router.push(`/analyze?view=subjects&subject=${encodeURIComponent(id)}`)}
          />
        )}
      </ChartCard>

      {/* 學科明細列表 */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(overview?.subjects ?? []).map((s: SubjectStat, i) => (
          <button
            key={s.subjectId}
            type="button"
            onClick={() => router.push(`/analyze?view=subjects&subject=${encodeURIComponent(s.subjectId)}`)}
            className="rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: chartColor(i, s.color) }} />
              <span className="text-sm font-semibold">{s.subjectName}</span>
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </div>
            <dl className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">學習時間</dt>
              <dd className="text-right font-medium">{formatDuration(s.studySeconds)}</dd>
              <dt className="text-muted-foreground">對話 / 訊息</dt>
              <dd className="text-right font-medium">
                {s.conversationCount} / {s.messageCount}
              </dd>
              <dt className="text-muted-foreground">知識點</dt>
              <dd className="text-right font-medium">{s.knowledgePoints}</dd>
              <dt className="text-muted-foreground">錯題</dt>
              <dd className="text-right font-medium">{s.mistakes}</dd>
            </dl>
          </button>
        ))}
      </div>
    </div>
  )
}

function KnowledgeHeatmapView({ subjectId }: { subjectId: string }) {
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useSubjectHeatmap(subjectId)
  const subjectName = data?.subjectName ?? subjectId

  /** 依狀態分組（可切換檢視方式） */
  const [groupBy, setGroupBy] = useState<'unit' | 'status'>('unit')

  const groups = useMemo(() => {
    const points: KnowledgePointStat[] = data?.knowledgePoints ?? []
    const map = new Map<string, KnowledgePointStat[]>()
    for (const p of points) {
      const key =
        groupBy === 'status' ? KNOWLEDGE_STATUS_META[p.status].label : p.unit ?? '未分類單元'
      const bucket = map.get(key)
      if (bucket) bucket.push(p)
      else map.set(key, [p])
    }
    return Array.from(map.entries())
  }, [data, groupBy])

  const counts = useMemo(() => {
    const points = data?.knowledgePoints ?? []
    return KNOWLEDGE_STATUS_ORDER.map((status) => ({
      status,
      count: points.filter((p) => p.status === status).length,
    }))
  }, [data])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {isError && (
        <div className="mb-5">
          <LoadError onRetry={() => refetch()} label={`知識點熱力圖載入失敗（GET /api/analyze/subjects/${subjectId}/heatmap）`} />
        </div>
      )}

      {/* 狀態統計 */}
      <div className="mb-5 flex flex-wrap gap-2">
        {counts.map(({ status, count }) => {
          const meta = KNOWLEDGE_STATUS_META[status]
          return (
            <span
              key={status}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', meta.cell)}
              title={meta.hint}
            >
              <span className={cn('size-2 rounded-full', meta.dot)} />
              {meta.label}
              <span className="font-semibold">{count}</span>
            </span>
          )
        })}
      </div>

      <ChartCard
        title={`${subjectName} · 知識點熱力圖`}
        hint="顏色代表知識點狀態，點擊知識點進入三級：錯題統計"
        action={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            {(['unit', 'status'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs transition-colors',
                  groupBy === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g === 'unit' ? '依單元' : '依狀態'}
              </button>
            ))}
          </div>
        }
      >
        <KnowledgeLegend className="mb-4" />

        {isLoading && !data ? (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (data?.knowledgePoints.length ?? 0) === 0 ? (
          <EmptyChart height={220} text="這個學科還沒有知識點紀錄" />
        ) : (
          <div className="space-y-5">
            {groups.map(([groupName, points]) => (
              <div key={groupName}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{groupName}</p>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {points.map((p) => {
                    const meta = KNOWLEDGE_STATUS_META[p.status]
                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={`${meta.label} · 出現 ${p.useCount} 次 · 錯題 ${p.mistakeCount} 題`}
                        onClick={() =>
                          router.push(
                            `/analyze?view=subjects&subject=${encodeURIComponent(subjectId)}&kp=${encodeURIComponent(p.id)}`,
                          )
                        }
                        className={cn(
                          'rounded-lg border px-3 py-2.5 text-left transition-colors',
                          meta.cell,
                        )}
                      >
                        <p className="truncate text-xs font-medium">{p.name}</p>
                        <p className="mt-1 flex items-center gap-2 text-[10px] opacity-80">
                          <span>用 {p.useCount}</span>
                          <span>錯 {p.mistakeCount}</span>
                          {typeof p.mastery === 'number' && <span>熟練 {p.mastery}%</span>}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  )
}

/* ============================================================
 * 1-3 級：錯題統計
 * ============================================================ */

function MistakeDetailView({ knowledgePointId, subjectId }: { knowledgePointId: string; subjectId: string }) {
  const { data, isLoading, isError, refetch } = useKnowledgePointMistakes(knowledgePointId, subjectId)
  const [openId, setOpenId] = useState<string | null>(null)

  const kpName = data?.knowledgePointName ?? knowledgePointId
  const subjectColor = useMemo(() => {
    const idx = (subjectId.charCodeAt(0) ?? 0) % CHART_COLORS.length
    return CHART_COLORS[idx]
  }, [subjectId])

  const stats: MistakeStats | undefined = data

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {isError && (
        <div className="mb-5">
          <LoadError
            onRetry={() => refetch()}
            label={`錯題統計載入失敗（GET /api/analyze/knowledge-points/${knowledgePointId}/mistakes）`}
          />
        </div>
      )}

      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Target} label="錯題總數" value={stats ? `${stats.total} 題` : '—'} sub={kpName} />
        <StatTile
          icon={Check}
          label="已訂正"
          value={stats ? `${stats.corrected} 題` : '—'}
          sub={stats && stats.total > 0 ? `完成度 ${Math.round((stats.corrected / stats.total) * 100)}%` : undefined}
        />
        <StatTile icon={BarChart3} label="錯題類型" value={stats ? `${stats.typeRanking.length} 類` : '—'} />
        <StatTile
          icon={BookOpenCheck}
          label="所屬學科"
          value={stats?.subjectName ?? subjectId}
          sub={stats?.knowledgePointName ?? kpName}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 錯題類型排行（柱形圖） */}
        <ChartCard title="錯題類型排行" hint="依錯題類型統計題數">
          {isLoading && !data ? (
            <Skeleton className="h-[240px] w-full rounded-lg" />
          ) : (
            <MistakeTypeBars data={stats?.typeRanking ?? []} color={subjectColor} />
          )}
        </ChartCard>

        {/* 錯題列表 */}
        <ChartCard title="錯題紀錄" hint="點擊項目展開題目與 AI 提醒">
          {isLoading && !data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (stats?.items.length ?? 0) === 0 ? (
            <EmptyChart height={240} text="這個知識點尚無錯題紀錄" />
          ) : (
            <ul className="space-y-2">
              {stats!.items.map((m) => {
                const open = openId === m.id
                return (
                  <li key={m.id} className="rounded-lg border bg-background">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : m.id)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left"
                    >
                      <span className="mt-0.5 shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                        {m.mistakeType}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs">{m.question}</span>
                      <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
                    </button>
                    {open && (
                      <div className="space-y-1.5 border-t px-3 py-2 text-xs">
                        {m.userAnswer && (
                          <p>
                            <span className="text-muted-foreground">我的答案：</span>
                            {m.userAnswer}
                          </p>
                        )}
                        {m.correction && (
                          <p>
                            <span className="text-muted-foreground">正確 / 提醒：</span>
                            {m.correction}
                          </p>
                        )}
                        {m.conversationTitle && (
                          <p className="text-muted-foreground">出處：{m.conversationTitle}</p>
                        )}
                      </div>
                    )}
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

/* ============================================================
 * 2 級：學習時間記錄
 * ============================================================ */

function StudyTimeView() {
  const [granularity, setGranularity] = useState<TimeGranularity>('week')
  const [selected, setSelected] = useState<StudyTimeBar | null>(null)

  const { data, isLoading, isError, refetch } = useStudyTimeTimeline(granularity)
  const detailDate = selected?.startDate ?? null
  const detail = useStudyTimeDetail(detailDate)

  const bars: StudyTimeBar[] = useMemo(
    () =>
      (data?.buckets ?? []).map((b) => ({
        key: b.key,
        label: b.label,
        startDate: b.startDate,
        endDate: b.endDate,
        totalSeconds: b.totalSeconds,
        learn: b.byType.learn ?? 0,
        review: b.byType.review ?? 0,
        practice: b.byType.practice ?? 0,
      })),
    [data],
  )

  /** 期間總計（依學習型態） */
  const totals = useMemo(() => {
    const buckets = data?.buckets ?? []
    return {
      learn: buckets.reduce((n, b) => n + (b.byType.learn ?? 0), 0),
      review: buckets.reduce((n, b) => n + (b.byType.review ?? 0), 0),
      practice: buckets.reduce((n, b) => n + (b.byType.practice ?? 0), 0),
    }
  }, [data])

  const activeMeta = TIME_GRANULARITY_META.find((g) => g.value === granularity)!

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {isError && (
        <div className="mb-5">
          <LoadError onRetry={() => refetch()} label="學習時間載入失敗（GET /api/analyze/study-time）" />
        </div>
      )}

      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Clock}
          label="期間總計"
          value={data ? formatDuration(data.totalSeconds) : '—'}
          sub={activeMeta.hint}
        />
        {STUDY_TYPE_META.map((t) => (
          <StatTile
            key={t.value}
            icon={t.value === 'review' ? RotateCcw : t.value === 'practice' ? Target : BookOpenCheck}
            label={`${t.label}時間`}
            value={formatDuration(totals[t.value])}
          />
        ))}
      </div>

      <ChartCard
        title="學習時間記錄"
        hint="可切換週 / 月 / 年縮放時間線；點擊任一根柱子查看當天學習 / 複習的學科與知識點"
        action={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            {TIME_GRANULARITY_META.map((g) => (
              <button
                key={g.value}
                type="button"
                title={g.hint}
                onClick={() => {
                  setGranularity(g.value)
                  setSelected(null)
                }}
                className={cn(
                  'rounded-md px-3 py-1 text-xs transition-colors',
                  granularity === g.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        }
      >
        {isLoading && !data ? (
          <Skeleton className="h-[280px] w-full rounded-lg" />
        ) : (
          <StudyTimeBars data={bars} activeKey={selected?.key ?? null} onSelect={(b) => setSelected(b)} />
        )}
      </ChartCard>

      {/* 點擊柱子後的當日明細 */}
      {selected && (
        <div className="mt-5">
          <ChartCard
            title={`${selected.label} 學習明細`}
            hint={selected.startDate === selected.endDate ? selected.startDate : `${selected.startDate} ~ ${selected.endDate}`}
            action={
              <button
                type="button"
                aria-label="關閉明細"
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                <Clock className="size-3 text-muted-foreground" />
                當日總計
                <span className="font-semibold">{formatDuration(selected.totalSeconds)}</span>
              </span>
              {STUDY_TYPE_META.map((t) => {
                const secs = selected[t.value]
                return secs > 0 ? <StudyTypeChip key={t.value} type={t.value} seconds={secs} /> : null
              })}
            </div>

            {detail.isError ? (
              <LoadError
                onRetry={() => detail.refetch()}
                label={`當日明細載入失敗（GET /api/analyze/study-time/${selected.startDate}）`}
              />
            ) : detail.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
              </div>
            ) : (detail.data?.entries.length ?? 0) === 0 ? (
              <EmptyChart height={140} text="這天沒有學習紀錄明細" />
            ) : (
              <ul className="divide-y rounded-lg border bg-background">
                {detail.data!.entries.map((e) => {
                  const meta = STUDY_TYPE_META.find((t) => t.value === e.studyType)
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ background: meta?.color ?? '#999' }}
                      >
                        {meta?.label ?? e.studyType}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {e.knowledgePointName ?? e.conversationTitle ?? '未標註知識點'}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {e.subjectName ?? '未分類學科'}
                          {e.conversationTitle ? ` · ${e.conversationTitle}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(e.seconds)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * 3 級：每日清單（週一 → 週日，編輯 / 查看）
 * 實作見 src/components/daily-checklist-view.tsx
 * ============================================================ */

/* ============================================================
 * 頁面外殼：標題列 + 麵包屑
 * ============================================================ */

const VIEW_TITLE: Record<string, string> = {
  overview: '分析總覽',
  subjects: '學科分析',
  'study-time': '學習時間記錄',
  'daily-checklist': '每日清單',
}

/**
 * Analyze 分析頁（Client 元件）
 * 由 app/analyze/page.tsx 以 <Suspense> 包住掛載 —— useSearchParams()
 * 需要 Suspense 邊界，否則 production build 的靜態預渲染會失敗。
 */
export function AnalyzeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const view = searchParams.get('view') ?? 'overview'
  const subjectId = searchParams.get('subject')
  const kpId = searchParams.get('kp')

  const { data: heatmap } = useSubjectHeatmap(view === 'subjects' && !!kpId ? subjectId : null)
  const kpName = heatmap?.knowledgePoints.find((p) => p.id === kpId)?.name
  const { subjects } = useSubjects()
  const subjectName = subjects.find((s) => s.id === subjectId)?.name

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const qs = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(next)) {
        if (v === null) qs.delete(k)
        else qs.set(k, v)
      }
      const q = qs.toString()
      router.push(q ? `/analyze?${q}` : '/analyze')
    },
    [router, searchParams],
  )

  /** 麵包屑（一級 → 二級 → 三級） */
  const crumbs = useMemo(() => {
    const list: Array<{ label: string; onClick?: () => void }> = [
      { label: '分析總覽', onClick: () => router.push('/analyze') },
    ]
    if (view === 'subjects') {
      list.push({
        label: '學科分析',
        onClick: kpId ? () => setParams({ view: 'subjects', kp: null }) : undefined,
      })
      if (subjectId) {
        list.push({
          label: subjectName ?? subjectId,
          onClick: kpId ? () => setParams({ subject: null, kp: null }) : undefined,
        })
      }
      if (kpId) list.push({ label: kpName ?? '知識點' })
    } else if (view === 'study-time') {
      list.push({ label: '學習時間記錄' })
    } else if (view === 'daily-checklist') {
      list.push({ label: '每日清單' })
    }
    return list
  }, [view, subjectId, kpId, subjectName, kpName, router, setParams])

  /** 麵包屑「上一層」 */
  const goBack = () => {
    if (kpId) setParams({ kp: null })
    else if (view !== 'overview') router.push('/analyze')
    else router.push('/')
  }

  const title = kpId ? `錯題統計${kpName ? ` · ${kpName}` : ''}` : VIEW_TITLE[view] ?? '分析'

  return (
    <>
      {/* 標題列 */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
        <button
          type="button"
          aria-label="返回上一層"
          onClick={goBack}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <BarChart3 className="size-5 shrink-0 text-primary" />
        <h1 className="min-w-0 truncate text-sm font-semibold">{title}</h1>

        {/* 麵包屑 */}
        <nav aria-label="層級導覽" className="ml-2 hidden min-w-0 items-center gap-1 text-xs text-muted-foreground md:flex">
          {crumbs.map((c, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" />}
              {c.onClick ? (
                <button
                  type="button"
                  onClick={c.onClick}
                  className="max-w-[140px] truncate rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {c.label}
                </button>
              ) : (
                <span className="max-w-[180px] truncate px-1 font-medium text-foreground">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex-1" />

        {view !== 'overview' && (
          <Button variant="outline" size="sm" onClick={() => router.push('/analyze')}>
            <ClipboardList className="size-3.5" />
            分析總覽
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto nice-scroll">
        {view === 'overview' && <OverviewHome />}

        {view === 'subjects' &&
          (subjectId ? (
            kpId ? (
              <MistakeDetailView knowledgePointId={kpId} subjectId={subjectId} />
            ) : (
              <KnowledgeHeatmapView subjectId={subjectId} />
            )
          ) : (
            <SubjectPieView />
          ))}

        {view === 'study-time' && <StudyTimeView />}
        {view === 'daily-checklist' && <DailyChecklistView />}
      </div>
    </>
  )
}
