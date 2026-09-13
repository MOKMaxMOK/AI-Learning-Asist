'use client'

/**
 * 設置頁內容（Client 元件）
 * ============================================================
 * 入口式版面，所有設定整合在這裡：
 *   - LLM 綁定     → 綁定 / 檢視 / 刪除模型（可多筆）
 *   - 清除設定     → 清除歷史聊天 / 分析內容 / LLM 綁定 / 上傳檔案
 *   - 關於我們     → 專案與聯絡資訊
 *   - 資料儲存     → 本地存放位置說明
 *
 * 預設「全部收合」，不會自動展開任何區塊；
 * 只有從 Chat 以 ?entry=<key> 跳轉過來時，才自動展開指定的那一個
 * （由 server 端讀取 searchParams 後以 initialEntry 傳入，SSR 就正確）。
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  Cpu,
  Database,
  Info,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLlmSettings } from '@/lib/api'
import type { LlmSettingsPayload } from '@/lib/types'
import { Button } from '@/components/ui'
import { LlmBindingPanel } from '@/components/llm-binding-panel'
import { ClearDataSection } from '@/components/clear-data-button'

type EntryKey = 'llm' | 'clear' | 'about' | 'storage'

/** 設置入口列表（依顯示順序；「清除設定」獨立於 LLM 綁定之外） */
const ENTRIES: Array<{
  key: EntryKey
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}> = [
  {
    key: 'llm',
    icon: Cpu,
    title: 'LLM 綁定',
    desc: '選擇大模型廠商、輸入 API Key 與官方模型名稱；可綁定多筆並切換使用中。',
  },
  {
    key: 'clear',
    icon: Trash2,
    title: '清除設定',
    desc: '清除歷史聊天、分析內容、LLM 儲存內容與已上傳檔案，回到初始狀態。',
  },
  {
    key: 'about',
    icon: Info,
    title: '關於我們',
    desc: '專案作者、開源位址與聯絡方式。',
  },
  {
    key: 'storage',
    icon: Database,
    title: '資料儲存',
    desc: '所有資料的本地存放位置與隱私說明。',
  },
]

export function isEntryKey(value: string | null | undefined): value is EntryKey {
  return value === 'llm' || value === 'clear' || value === 'about' || value === 'storage'
}

export function SettingsContent({ initialEntry }: { initialEntry?: EntryKey | null }) {
  /** 預設不展開任何區塊；只有指定 entry 時才自動展開那一個 */
  const [open, setOpen] = useState<EntryKey | null>(initialEntry ?? null)
  /** 綁定摘要（顯示在 LLM 綁定入口右側） */
  const [llmSummary, setLlmSummary] = useState<LlmSettingsPayload | null>(null)

  useEffect(() => {
    void getLlmSettings()
      .then(setLlmSummary)
      .catch(() => setLlmSummary(null))
  }, [open])

  const activeCount = llmSummary?.bindings.length ?? 0
  const activeModel = llmSummary?.active?.model ?? null

  return (
    <div className="flex-1 overflow-y-auto nice-scroll">
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {ENTRIES.map((entry) => {
          const isOpen = open === entry.key

          /* 「清除設定」是獨立區塊（標題點擊展開，內容為說明 + 清除按鈕） */
          if (entry.key === 'clear') {
            return (
              <ClearDataSection
                key={entry.key}
                defaultOpen={isOpen}
                onCleared={() => setLlmSummary(null)}
              />
            )
          }

          return (
            <section key={entry.key} className="overflow-hidden rounded-xl border bg-card shadow-sm">
              {/* 入口標題列（點擊展開 / 收合） */}
              <button
                type="button"
                onClick={() => setOpen((prev) => (prev === entry.key ? null : entry.key))}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                  <entry.icon className="size-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{entry.title}</span>
                    {entry.key === 'llm' && activeModel && (
                      <span className="truncate rounded-full bg-[#E7F7EF] px-1.5 py-0.5 text-[10px] text-[#1F6B48]">
                        使用中：{activeModel}
                      </span>
                    )}
                    {entry.key === 'llm' && !activeModel && (
                      <span className="rounded-full bg-[#FFF1E3] px-1.5 py-0.5 text-[10px] text-[#9A5518]">
                        尚未綁定
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {entry.desc}
                  </span>
                </span>
                {entry.key === 'llm' && activeCount > 0 && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">{activeCount} 筆</span>
                )}
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* 展開內容 */}
              {isOpen && (
                <div className="border-t bg-background/40">
                  {entry.key === 'llm' && (
                    <div className="p-3">
                      <LlmBindingPanel />
                    </div>
                  )}
                  {entry.key === 'about' && <AboutSection />}
                  {entry.key === 'storage' && <StorageSection />}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================
 * 標題列（由 app/settings/page.tsx 的 Server Component 使用）
 * ============================================================ */

/**
 * 設置頁的固定標題列
 */
export function SettingsHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
      <Link
        href="/"
        aria-label="返回"
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
      </Link>
      <SettingsIcon className="size-5 shrink-0 text-primary" />
      <h1 className="text-sm font-semibold">設置</h1>
      <span className="ml-2 hidden rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground sm:inline">
        本地儲存 · SQLite
      </span>
    </header>
  )
}

/** 載入中的骨架（Suspense fallback 用） */
export function SettingsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto nice-scroll">
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

/* ---------------- 關於我們 ---------------- */

function AboutSection() {
  return (
    <div className="space-y-3.5 px-4 py-4">
      <div className="space-y-1.5 text-sm leading-relaxed">
        <p>
          本項目由 <span className="font-semibold">MaxMOK</span> 開發。
        </p>
        <p className="text-muted-foreground">
          GitHub 開源地址：
          <a
            href="https://github.com/MOKMaxMOK/AI-Learning-Asist"
            target="_blank"
            rel="noreferrer"
            className="ml-1 break-all text-primary hover:underline"
          >
            https://github.com/MOKMaxMOK/AI-Learning-Asist
          </a>
        </p>
        <p className="text-muted-foreground">
          任何咨詢歡迎聯絡 gmail：
          <a href="mailto:ss1701114@gmail.com" className="ml-1 text-primary hover:underline">
            ss1701114@gmail.com
          </a>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=ss1701114@gmail.com"
            target="_blank"
            rel="noreferrer"
          >
            <MailIcon />
            用 Gmail 聯絡我們
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://github.com/MOKMaxMOK/AI-Learning-Asist" target="_blank" rel="noreferrer">
            <GithubIcon />
            GitHub 開源專案
          </a>
        </Button>
      </div>
    </div>
  )
}

/* ---------------- 資料儲存 ---------------- */

function StorageSection() {
  const items: Array<[string, string]> = [
    ['資料庫', './data/app.db'],
    ['上傳附件', './data/uploads/'],
    ['LLM 綁定', 'SQLite（llm_bindings 表，金鑰僅存本機、介面只顯示遮蔽值）'],
  ]
  return (
    <div className="space-y-3 px-4 py-4">
      <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <li>
          • 所有資料（學科、對話、訊息、AI 標註、知識點、錯題、學習時間、每日清單、設置）都存在本機
          SQLite，不上傳任何伺服器。
        </li>
        <li>• 只有 AI 對話會把內容送到你綁定的模型廠商 API；其餘運算全部在本機完成。</li>
        <li>• 圖表資料（學科分析 / 知識點熱力圖 / 錯題統計 / 學習時間）由 Chat 的 AI 標註彙整而來。</li>
      </ul>
      <dl className="grid gap-1.5 text-xs">
        {items.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="break-all font-mono">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ---------------- 圖示（inline，避免額外依賴） ---------------- */

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.9 9.9 0 0 1 5.01 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.06 10.06 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}
