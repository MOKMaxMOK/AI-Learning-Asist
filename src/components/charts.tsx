'use client'

/**
 * 分析板塊圖表元件（recharts 封裝，暖色系主題）
 * - SubjectPieChart   一級：學科分析圓餅圖（點擊扇區進入該學科）
 * - MistakeTypeBars   三級：錯題類型排行柱形圖
 * - StudyTimeBars     二級：學習時間柱形圖（週 / 月 / 年，點擊柱子看當日明細）
 *
 * 元件本身不做任何資料模擬：資料為空時顯示「尚無資料」提示。
 */

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn, formatDuration, formatDurationShort, formatPercent } from '@/lib/utils'

const AXIS_COLOR = 'hsl(25 8% 46%)'
const GRID_COLOR = 'hsl(30 20% 92%)'
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid hsl(30 20% 88%)',
  background: '#fff',
  fontSize: 12,
  boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
  padding: '8px 10px',
}/* ---------------- 通用：圖表卡片 ---------------- */

export function ChartCard({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card p-4 shadow-sm', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyChart({ height = 200, text = '尚無資料' }: { height?: number; text?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-border bg-background text-xs text-muted-foreground"
      style={{ height }}
    >
      {text}
    </div>
  )
}

/* ---------------- 一級：學科分析圓餅圖 ---------------- */

export interface SubjectSlice {
  subjectId: string
  name: string
  value: number
  color: string
}

export function SubjectPieChart({
  data,
  onSelect,
  height = 260,
  metricLabel = '學習訊息',
}: {
  data: SubjectSlice[]
  onSelect?: (subjectId: string) => void
  height?: number
  metricLabel?: string
}) {
  if (data.length === 0) return <EmptyChart height={height} text="尚無學科學習紀錄" />
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              stroke="#fff"
              strokeWidth={2}
              onClick={(_entry: unknown, index: number) => {
                const slice = data[index]
                if (slice) onSelect?.(slice.subjectId)
              }}
              className={onSelect ? 'cursor-pointer' : undefined}
            >
              {data.map((d) => (
                <Cell key={d.subjectId} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [
                `${value}（${total > 0 ? formatPercent(value / total, 1) : '0%'}）`,
                name,
              ]}
            />
            <Legend
              verticalAlign="bottom"
              height={28}
              iconType="circle"
              formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 圖例明細（含佔比，並提供可點擊的無障礙入口） */}
      <ul className="mt-3 space-y-1.5">
        {data.map((d) => (
          <li key={d.subjectId}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(d.subjectId)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs transition-colors',
                onSelect && 'hover:border-border hover:bg-muted/60',
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
              <span className="text-muted-foreground">{d.value} 則</span>
              <span className="w-12 text-right font-medium text-primary">
                {total > 0 ? formatPercent(d.value / total, 0) : '0%'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">
        佔比依「{metricLabel}」計算{onSelect ? '，點擊學科可查看知識點熱力圖' : ''}。
      </p>
    </div>
  )
}

/* ---------------- 三級：錯題類型排行柱形圖 ---------------- */

export function MistakeTypeBars({
  data,
  color = '#F0752E',
  height = 240,
}: {
  data: Array<{ type: string; count: number }>
  color?: string
  height?: number
}) {
  if (data.length === 0) return <EmptyChart height={height} text="尚無錯題類型資料" />

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="type"
            width={88}
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'hsl(33 30% 93% / 0.6)' }}
            formatter={(value: number) => [`${value} 題`, '錯題數']}
          />
          <Bar dataKey="count" fill={color} radius={[0, 6, 6, 0]} barSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------------- 二級：學習時間柱形圖 ---------------- */

/** 直接以 StudyTimeBucket 為基礎，額外攤平出堆疊用的學習型態欄位 */
export interface StudyTimeBar {
  key: string
  label: string
  startDate: string
  endDate: string
  totalSeconds: number
  learn: number
  review: number
  practice: number
}

const STUDY_TYPE_META = [
  { key: 'learn', name: '學習', color: '#F0752E' },
  { key: 'review', name: '複習', color: '#4C8DF6' },
  { key: 'practice', name: '練習', color: '#3FB984' },
] as const

export function StudyTimeBars({
  data,
  activeKey,
  onSelect,
  height = 280,
}: {
  data: StudyTimeBar[]
  activeKey?: string | null
  onSelect?: (bucket: StudyTimeBar) => void
  height?: number
}) {
  if (data.length === 0) return <EmptyChart height={height} text="尚無學習時間紀錄" />

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: -8 }}
          onClick={(state) => {
            const idx = state?.activeTooltipIndex
            if (idx !== undefined && idx !== null && data[idx]) onSelect?.(data[idx])
          }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickFormatter={(v: number) => formatDurationShort(v)}
            tick={{ fontSize: 11, fill: AXIS_COLOR }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'hsl(33 30% 93% / 0.6)' }}
            formatter={(value: number, name: string) => [formatDuration(value), name]}
            labelFormatter={(label: string) => `${label}${onSelect ? '（點擊看明細）' : ''}`}
          />
          <Legend
            verticalAlign="top"
            height={24}
            iconType="circle"
            formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
          />
          {STUDY_TYPE_META.map((t) => (
            <Bar key={t.key} dataKey={t.key} name={t.name} stackId="study" fill={t.color}>
              {data.map((d) => (
                <Cell
                  key={d.key}
                  fill={t.color}
                  opacity={activeKey && activeKey !== d.key ? 0.45 : 1}
                />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
