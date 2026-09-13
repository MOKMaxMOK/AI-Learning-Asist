#!/usr/bin/bash
# ============================================================
# Chat 板塊 + Analyze 框架 — 一鍵建檔腳本（第二版）
# 用法：在專案根目錄執行  bash setup.sh
# ============================================================
set -e

# ----- .env.example -----
mkdir -p "$(dirname '.env.example')"
cat > '.env.example' << 'KIMI_FILE_EOF'
# ===== 後端接入設定 =====
# 複製此檔案為 .env.local 並填入你的後端位址
# 前端所有 API 呼叫都會加上此前綴（見 src/lib/api/client.ts）
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
KIMI_FILE_EOF

# ----- README.md -----
mkdir -p "$(dirname 'README.md')"
cat > 'README.md' << 'KIMI_FILE_EOF'
# Chat 板塊 — AI 學習助手（前端）

Next.js 14（App Router）+ TypeScript + Tailwind CSS + shadcn/ui 風格元件 + Zustand + TanStack Query + React Hook Form / Zod + Framer Motion + Lucide。

## 快速開始

```bash
npm install
npm run dev
# 開啟 http://localhost:3000
```

## 後端接入

1. 複製 `.env.example` → `.env.local`，設定 `NEXT_PUBLIC_API_BASE_URL`。
2. 接口總表與資料型別對照：**`src/lib/api/index.ts`** 頂部註解。
3. SSE 串流協議（AI 回覆）：**`src/lib/api/client.ts`** 的 `streamChat()`。
4. 需要登入時修改 `src/lib/api/client.ts` 的 `authHeaders()`。

未串接後端時，各查詢會進入 error 狀態，畫面呈現錯誤提示 + 重試按鈕（真實狀態，無假資料）。

## 目錄結構

```
src/
├── app/                 # layout / page / providers / globals.css
├── components/
│   ├── ui.tsx           # Button、Dialog、DropdownMenu、Toast、Skeleton 等基礎元件
│   ├── sidebar.tsx      # 側邊抽屜（桌面固定、行動版覆疊）
│   ├── chat-header.tsx  # 標題列（重新命名 / 更改 Tag / 更多選單）
│   ├── message-list.tsx # 訊息區（用戶/AI/文件/系統 + 串流渲染）
│   ├── chat-input.tsx   # 輸入區（附件、拖拽上傳、Enter 送出、停止生成）
│   └── dialogs.tsx      # 新增對話 / 刪除 / 重新命名 / 更改Tag / 反饋 / 匯出
├── hooks/use-chat-api.ts# TanStack Query hooks + SSE 串流邏輯
├── lib/
│   ├── api/             # HTTP/SSE 客戶端 + 後端接口總表
│   ├── types.ts         # 前後端資料契約
│   └── utils.ts
└── store/chat-store.ts  # Zustand UI 狀態
```
KIMI_FILE_EOF

# ----- next.config.mjs -----
mkdir -p "$(dirname 'next.config.mjs')"
cat > 'next.config.mjs' << 'KIMI_FILE_EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
KIMI_FILE_EOF

# ----- package.json -----
mkdir -p "$(dirname 'package.json')"
cat > 'package.json' << 'KIMI_FILE_EOF'
{
  "name": "chat-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-slot": "^1.1.0",
    "@tanstack/react-query": "^5.59.16",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "framer-motion": "^11.11.10",
    "lucide-react": "^0.454.0",
    "next": "14.2.16",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.1",
    "recharts": "^2.13.3",
    "tailwind-merge": "^2.5.4",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.20",
    "eslint": "^8",
    "eslint-config-next": "14.2.16",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5"
  }
}
KIMI_FILE_EOF

# ----- postcss.config.mjs -----
mkdir -p "$(dirname 'postcss.config.mjs')"
cat > 'postcss.config.mjs' << 'KIMI_FILE_EOF'
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
KIMI_FILE_EOF

# ----- tailwind.config.ts -----
mkdir -p "$(dirname 'tailwind.config.ts')"
cat > 'tailwind.config.ts' << 'KIMI_FILE_EOF'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
        },
        destructive: 'hsl(var(--destructive))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-start infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
KIMI_FILE_EOF

# ----- tsconfig.json -----
mkdir -p "$(dirname 'tsconfig.json')"
cat > 'tsconfig.json' << 'KIMI_FILE_EOF'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
KIMI_FILE_EOF

# ----- src/app/globals.css -----
mkdir -p "$(dirname 'src/app/globals.css')"
cat > 'src/app/globals.css' << 'KIMI_FILE_EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ===== 設計語言：暖色系學習助手 ===== */
:root {
  --background: 36 33% 97%;        /* 米白 */
  --foreground: 25 14% 20%;        /* 暖深灰 */
  --card: 0 0% 100%;               /* 卡片白 */
  --muted: 33 30% 93%;             /* 暖淺底 */
  --muted-foreground: 25 8% 46%;   /* 次要文字 */
  --border: 30 20% 88%;            /* 暖邊框 */
  --primary: 28 85% 55%;           /* 暖橘 */
  --primary-foreground: 0 0% 100%;
  --primary-soft: 28 90% 94%;      /* 暖橘淺底 */
  --destructive: 0 72% 51%;
  --radius: 0.75rem;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
}

/* 訊息串流游標 */
.stream-cursor {
  @apply ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] animate-blink rounded-full bg-primary;
}

/* 細捲軸 */
.nice-scroll::-webkit-scrollbar {
  width: 6px;
}
.nice-scroll::-webkit-scrollbar-thumb {
  @apply rounded-full bg-border;
}
.nice-scroll::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground/40;
}
KIMI_FILE_EOF

# ----- src/app/layout.tsx -----
mkdir -p "$(dirname 'src/app/layout.tsx')"
cat > 'src/app/layout.tsx' << 'KIMI_FILE_EOF'
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/app-shell'

export const metadata: Metadata = {
  title: 'AI 學習助手',
  description: 'Chat 板塊 — AI 學習助手',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
KIMI_FILE_EOF

# ----- src/app/page.tsx -----
mkdir -p "$(dirname 'src/app/page.tsx')"
cat > 'src/app/page.tsx' << 'KIMI_FILE_EOF'
import { ChatHeader } from '@/components/chat-header'
import { MessageList } from '@/components/message-list'
import { ChatInput } from '@/components/chat-input'

export default function HomePage() {
  return (
    <>
      <ChatHeader />
      <MessageList />
      <ChatInput />
    </>
  )
}
KIMI_FILE_EOF

# ----- src/app/providers.tsx -----
mkdir -p "$(dirname 'src/app/providers.tsx')"
cat > 'src/app/providers.tsx' << 'KIMI_FILE_EOF'
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            // 後端未串接時，查詢會進入 error 狀態，畫面呈現錯誤提示 + 重試
          },
        },
      }),
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
KIMI_FILE_EOF

# ----- src/app/analyze/page.tsx -----
mkdir -p "$(dirname 'src/app/analyze/page.tsx')"
cat > 'src/app/analyze/page.tsx' << 'KIMI_FILE_EOF'
 'use client'

import { useState } from 'react'
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  LineChart,
  PieChart,
  RotateCcw,
} from 'lucide-react'
import { useAnalyzeOverview } from '@/hooks/use-analyze-api'
import { useTags } from '@/hooks/use-chat-api'
import { Skeleton, TagChip } from '@/components/ui'

/** 分析模組框架（圖表本身待後端資料接入後再行實作，此處僅保留版面骨架） */
const MODULES = [
  { icon: LineChart, title: '學習趨勢', desc: '各學科的對話量與學習活躍度變化' },
  { icon: PieChart, title: '知識點分布', desc: 'AI 從對話中標註的知識點統計' },
  { icon: ClipboardList, title: '錯題統計', desc: '對話中辨識出的錯題與薄弱環節' },
  { icon: BookOpen, title: '學習紀錄', desc: '上傳文件與學習內容摘要' },
] as const

export default function AnalyzePage() {
  const { data: tags } = useTags()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const { data: overview, isLoading, isError, refetch } = useAnalyzeOverview(selectedTag ?? undefined)

  return (
    <>
      {/* 標題列：標題 + 學科篩選（預留，對應後端 tagId 查詢參數） */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
        <BarChart3 className="size-5 shrink-0 text-primary" />
        <h1 className="text-sm font-semibold">學科分析</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 overflow-x-auto nice-scroll">
          {tags?.map((t) => (
            <TagChip
              key={t.id}
              active={selectedTag === t.id}
              onClick={() => setSelectedTag((prev) => (prev === t.id ? null : t.id))}
            >
              {t.name}
            </TagChip>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto nice-scroll">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <p className="mb-5 text-sm text-muted-foreground">
            資料來源：Chat 對話綁定的學科 Tag、AI 標註的知識點與錯題、上傳文件的學習紀錄，會彙整到這裡。
          </p>

          {/* 後端狀態：載入骨架 / 錯誤重試 */}
          {isLoading && (
            <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map((m) => (
                <Skeleton key={m.title} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          )}
          {isError && (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <span>分析資料載入失敗（後端接口尚未串接）</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs text-primary transition-colors hover:bg-primary-soft"
              >
                <RotateCcw className="size-3" />
                重試
              </button>
            </div>
          )}

          {/* 學科總覽列（有資料時顯示） */}
          {overview && overview.subjects.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {overview.subjects.map((s) => (
                <span
                  key={s.tagId}
                  className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"
                >
                  {s.tagName}：{s.conversationCount} 對話 · {s.knowledgePoints} 知識點 · {s.mistakes} 錯題
                </span>
              ))}
            </div>
          )}

          {/* 分析模組框架（圖表區待資料接入） */}
          <div className="grid gap-4 sm:grid-cols-2">
            {MODULES.map((m) => (
              <section key={m.title} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <m.icon className="size-4 text-primary" />
                  <h2 className="text-sm font-semibold">{m.title}</h2>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{m.desc}</p>
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-background text-xs text-muted-foreground">
                  圖表區（待後端資料接入後顯示）
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
KIMI_FILE_EOF

# ----- src/components/app-shell.tsx -----
mkdir -p "$(dirname 'src/components/app-shell.tsx')"
cat > 'src/components/app-shell.tsx' << 'KIMI_FILE_EOF'
'use client'

import { Sidebar } from '@/components/sidebar'
import { ChatDialogs } from '@/components/dialogs'
import { Toaster } from '@/components/ui'

/** 共用外殼：側邊抽屜 + 主內容區 + 對話框 + Toast（Chat / Analyze 兩個頁面共用） */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      <ChatDialogs />
      <Toaster />
    </div>
  )
}
KIMI_FILE_EOF

# ----- src/components/chat-header.tsx -----
mkdir -p "$(dirname 'src/components/chat-header.tsx')"
cat > 'src/components/chat-header.tsx' << 'KIMI_FILE_EOF'
'use client'

import { Download, Menu, MoreHorizontal, Pencil, Sprout, Tag as TagIcon, Trash2 } from 'lucide-react'
import { useConversations } from '@/hooks/use-chat-api'
import { useChatStore } from '@/store/chat-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TagChip,
} from '@/components/ui'

export function ChatHeader() {
  const { activeConversationId, setSidebarOpen, openDialog } = useChatStore()
  const { data: conversations } = useConversations()
  const conversation = conversations?.find((c) => c.id === activeConversationId)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
      {/* 行動版漢堡鈕 */}
      <button
        type="button"
        aria-label="開啟選單"
        onClick={() => setSidebarOpen(true)}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="size-5" />
      </button>

      {conversation ? (
        <>
          {/* 對話名稱（點擊重新命名） */}
          <button
            type="button"
            onClick={() => openDialog('rename', { conversation })}
            className="max-w-[40%] truncate rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-muted"
            title="點擊重新命名"
          >
            {conversation.title}
          </button>
          {/* Tag（點擊更改） */}
          {conversation.tag && (
            <TagChip active onClick={() => openDialog('change-tag', { conversation })}>
              <TagIcon className="size-3" />
              {conversation.tag.name}
            </TagChip>
          )}
        </>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sprout className="size-4 text-primary" />
          請先新增或選擇對話
        </span>
      )}

      <div className="flex-1" />

      {conversation && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="更多操作"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openDialog('rename', { conversation })}>
              <Pencil />
              重新命名
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog('change-tag', { conversation })}>
              <TagIcon />
              更改 Tag
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openDialog('export', { conversation })}>
              <Download />
              匯出對話
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => openDialog('delete', { conversation })}
            >
              <Trash2 />
              刪除對話
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
KIMI_FILE_EOF

# ----- src/components/chat-input.tsx -----
mkdir -p "$(dirname 'src/components/chat-input.tsx')"
cat > 'src/components/chat-input.tsx' << 'KIMI_FILE_EOF'
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Paperclip, SendHorizonal, Square, X } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useChatActions } from '@/hooks/use-chat-api'
import { uploadFiles } from '@/lib/api'
import { useChatStore } from '@/store/chat-store'
import type { AttachmentMeta } from '@/lib/types'
import { Button, Spinner, toast } from '@/components/ui'

/** 上傳限制（與 UI 設計文檔一致） */
const ALLOWED_EXT = ['pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 5

interface PendingFile {
  localId: string
  file: File
  meta?: AttachmentMeta
  uploading: boolean
  progress: number
  error?: string
}

export function ChatInput() {
  const { activeConversationId, draft, setDraft } = useChatStore()
  const { sendMessage, stopStreaming, isStreaming } = useChatActions()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 歡迎頁建議提問 → 帶入輸入框
  useEffect(() => {
    if (draft) {
      setText(draft)
      setDraft('')
      textareaRef.current?.focus()
    }
  }, [draft, setDraft])

  // textarea 自動撐高（1–6 行）
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  const canSend = !!activeConversationId && !isStreaming && (text.trim().length > 0 || files.length > 0)

  /* ---------- 檔案校驗 ---------- */

  const validate = useCallback((fileList: File[]): File[] => {
    const ok: File[] = []
    for (const f of fileList) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.includes(ext)) {
        toast({ title: '不支援此格式', description: f.name, variant: 'destructive' })
        continue
      }
      if (f.size > MAX_SIZE) {
        toast({ title: '檔案超過 10MB', description: f.name, variant: 'destructive' })
        continue
      }
      ok.push(f)
    }
    return ok
  }, [])

  /* ---------- 加入檔案並上傳 ---------- */

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!activeConversationId) return
      const room = MAX_FILES - files.length
      const accepted = validate(incoming).slice(0, Math.max(room, 0))
      if (incoming.length > 0 && room <= 0) {
        toast({ title: '單次最多 5 個檔案', variant: 'destructive' })
        return
      }
      const pendings: PendingFile[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        file,
        uploading: true,
        progress: 0,
      }))
      setFiles((prev) => [...prev, ...pendings])

      // 上傳（真實 XHR 進度；後端未串接會進入 error 狀態並可重試）
      pendings.forEach((p) => {
        uploadFiles([p.file], (pct) =>
          setFiles((prev) => prev.map((x) => (x.localId === p.localId ? { ...x, progress: pct } : x))),
        )
          .then(([meta]) =>
            setFiles((prev) =>
              prev.map((x) => (x.localId === p.localId ? { ...x, uploading: false, progress: 100, meta } : x)),
            ),
          )
          .catch((e) =>
            setFiles((prev) =>
              prev.map((x) =>
                x.localId === p.localId
                  ? { ...x, uploading: false, error: e instanceof Error ? e.message : '上傳失敗' }
                  : x,
              ),
            ),
          )
      })
    },
    [activeConversationId, files.length, validate],
  )

  const removeFile = (localId: string) =>
    setFiles((prev) => prev.filter((x) => x.localId !== localId))

  const retryFile = (p: PendingFile) => {
    setFiles((prev) => prev.map((x) => (x.localId === p.localId ? { ...x, uploading: true, progress: 0, error: undefined } : x)))
    uploadFiles([p.file], (pct) =>
      setFiles((prev) => prev.map((x) => (x.localId === p.localId ? { ...x, progress: pct } : x))),
    )
      .then(([meta]) =>
        setFiles((prev) => prev.map((x) => (x.localId === p.localId ? { ...x, uploading: false, progress: 100, meta } : x))),
      )
      .catch((e) =>
        setFiles((prev) =>
          prev.map((x) =>
            x.localId === p.localId ? { ...x, uploading: false, error: e instanceof Error ? e.message : '上傳失敗' } : x,
          ),
        ),
      )
  }

  /* ---------- 送出 ---------- */

  const handleSend = () => {
    if (!canSend || !activeConversationId) return
    const metas = files.map((f) => f.meta).filter((m): m is AttachmentMeta => !!m)
    const content = text.trim()
    setText('')
    setFiles([])
    void sendMessage(activeConversationId, content, metas)
    textareaRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="shrink-0 border-t bg-card px-3 pb-3 pt-2 md:px-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'mx-auto max-w-3xl rounded-2xl border bg-background p-2 transition-colors',
          dragging ? 'border-dashed border-primary bg-primary-soft/50' : 'border-border shadow-sm',
        )}
      >
        {/* 附件膠囊 */}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {files.map((f) => (
              <motion.div
                key={f.localId}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border bg-card py-1 pl-3 pr-1.5 text-xs shadow-sm',
                  f.error && 'border-destructive/50',
                )}
              >
                <Paperclip className="size-3 text-muted-foreground" />
                <span className="max-w-[140px] truncate">{f.file.name}</span>
                <span className="text-muted-foreground">{formatFileSize(f.file.size)}</span>
                {f.uploading && (
                  <span className="flex items-center gap-1 text-primary">
                    <Spinner className="size-3" />
                    {f.progress}%
                  </span>
                )}
                {f.error && (
                  <button
                    type="button"
                    onClick={() => retryFile(f)}
                    className="text-destructive underline underline-offset-2"
                  >
                    重試
                  </button>
                )}
                <button
                  type="button"
                  aria-label="移除附件"
                  onClick={() => removeFile(f.localId)}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* 附件按鈕 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="附加檔案"
            disabled={!activeConversationId}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip />
          </Button>

          {/* 文字輸入 */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!activeConversationId}
            placeholder={activeConversationId ? '輸入訊息...（Enter 送出，Shift+Enter 換行）' : '請先新增或選擇對話'}
            className="max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0"
          />

          {/* 送出 / 停止 */}
          {isStreaming ? (
            <Button type="button" variant="secondary" size="icon" aria-label="停止生成" onClick={stopStreaming}>
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              aria-label="送出"
              disabled={!canSend}
              onClick={handleSend}
            >
              <SendHorizonal />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
KIMI_FILE_EOF

# ----- src/components/dialogs.tsx -----
mkdir -p "$(dirname 'src/components/dialogs.tsx')"
cat > 'src/components/dialogs.tsx' << 'KIMI_FILE_EOF'
'use client'

/**
 * 全對話框集合：新增對話 / 重新命名 / 更改 Tag / 刪除確認 / 負向反饋 / 匯出
 * 開啟方式：useChatStore.openDialog(type, payload)
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useCachedMessages,
  useChatActions,
  useCreateConversation,
  useCreateTag,
  useDeleteConversation,
  useTags,
  useUpdateConversation,
} from '@/hooks/use-chat-api'
import { exportConversationUrl } from '@/lib/api'
import type { Conversation, Tag } from '@/lib/types'
import { useChatStore } from '@/store/chat-store'
import { Button, Dialog, DialogContent, Input, TagChip, Textarea, toast } from '@/components/ui'

function usePayload<T>(): T | null {
  return useChatStore((s) => s.dialogPayload) as T | null
}

const errorText = 'text-xs text-destructive mt-1'

/* ================= 新增對話 ================= */

const newChatSchema = z.object({
  title: z.string().trim().min(1, '請輸入對話名稱'),
  tagId: z.string().min(1, '請選擇學科 Tag'),
})
type NewChatValues = z.infer<typeof newChatSchema>

function NewChatDialog() {
  const { closeDialog } = useChatStore()
  const { data: tags, isLoading } = useTags()
  const createTag = useCreateTag()
  const createConversation = useCreateConversation()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewChatValues>({ resolver: zodResolver(newChatSchema), defaultValues: { title: '', tagId: '' } })

  const selectedTagId = watch('tagId')

  /* + 新增 Tag 內聯輸入 */
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const confirmNewTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    if (name.length > 10) {
      toast({ title: 'Tag 名稱最多 10 個字', variant: 'destructive' })
      return
    }
    if (tags?.some((t) => t.name === name)) {
      toast({ title: '此 Tag 已存在', variant: 'destructive' })
      return
    }
    try {
      const tag = await createTag.mutateAsync(name)
      setValue('tagId', tag.id, { shouldValidate: true })
      setAddingTag(false)
      setNewTagName('')
    } catch {
      toast({ title: '新增 Tag 失敗', variant: 'destructive' })
    }
  }

  const onSubmit = (values: NewChatValues) => {
    createConversation.mutate(
      { title: values.title.trim(), tagId: values.tagId },
      {
        onSuccess: () => closeDialog(),
        onError: (e) =>
          toast({ title: '建立對話失敗', description: e.message, variant: 'destructive' }),
      },
    )
  }

  return (
    <DialogContent title="新增對話">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">對話名稱</label>
          <Input placeholder="例：數學複習" {...register('title')} />
          {errors.title && <p className={errorText}>{errors.title.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">選擇學科 Tag（必選）</label>
          <div className="flex flex-wrap gap-2">
            {isLoading && <p className="text-xs text-muted-foreground">載入中…</p>}
            {tags?.map((t: Tag) => (
              <TagChip key={t.id} active={selectedTagId === t.id} onClick={() => setValue('tagId', t.id, { shouldValidate: true })}>
                {t.name}
              </TagChip>
            ))}
            {addingTag ? (
              <span className="inline-flex items-center gap-1">
                <Input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void confirmNewTag()
                    }
                    if (e.key === 'Escape') setAddingTag(false)
                  }}
                  placeholder="輸入學科名稱"
                  className="h-7 w-28 text-xs"
                  maxLength={10}
                />
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void confirmNewTag()}>
                  確認
                </Button>
              </span>
            ) : (
              <TagChip onClick={() => setAddingTag(true)}>
                <Plus className="size-3" />
                新增 Tag
              </TagChip>
            )}
          </div>
          {errors.tagId && <p className={errorText}>{errors.tagId.message}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button type="submit" disabled={createConversation.isPending}>
            {createConversation.isPending ? '建立中…' : '建立'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

/* ================= 重新命名 ================= */

const renameSchema = z.object({ title: z.string().trim().min(1, '請輸入對話名稱') })

function RenameDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const update = useUpdateConversation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ title: string }>({
    resolver: zodResolver(renameSchema),
    defaultValues: { title: payload?.conversation.title ?? '' },
  })
  if (!payload) return null

  const onSubmit = (v: { title: string }) =>
    update.mutate(
      { id: payload.conversation.id, patch: { title: v.title.trim() } },
      { onSuccess: closeDialog, onError: (e) => toast({ title: '重新命名失敗', description: e.message, variant: 'destructive' }) },
    )

  return (
    <DialogContent title="重新命名">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input autoFocus {...register('title')} />
          {errors.title && <p className={errorText}>{errors.title.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button type="submit" disabled={update.isPending}>
            儲存
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

/* ================= 更改 Tag ================= */

function ChangeTagDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const { data: tags } = useTags()
  const update = useUpdateConversation()
  const [selected, setSelected] = useState(payload?.conversation.tagId ?? '')
  if (!payload) return null

  return (
    <DialogContent title="更改學科 Tag">
      <div className="flex flex-wrap gap-2">
        {tags?.map((t) => (
          <TagChip key={t.id} active={selected === t.id} onClick={() => setSelected(t.id)}>
            {t.name}
          </TagChip>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={closeDialog}>
          取消
        </Button>
        <Button
          type="button"
          disabled={!selected || update.isPending}
          onClick={() =>
            update.mutate(
              { id: payload.conversation.id, patch: { tagId: selected } },
              { onSuccess: closeDialog, onError: (e) => toast({ title: '更改失敗', description: e.message, variant: 'destructive' }) },
            )
          }
        >
          儲存
        </Button>
      </div>
    </DialogContent>
  )
}

/* ================= 刪除確認 ================= */

function DeleteDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const del = useDeleteConversation()
  if (!payload) return null

  return (
    <DialogContent title="刪除對話">
      <p className="text-sm text-muted-foreground">
        確定刪除「<span className="font-medium text-foreground">{payload.conversation.title}</span>
        」？此操作無法復原。
      </p>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={closeDialog}>
          取消
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={del.isPending}
          onClick={() =>
            del.mutate(payload.conversation.id, {
              onSuccess: closeDialog,
              onError: (e) => toast({ title: '刪除失敗', description: e.message, variant: 'destructive' }),
            })
          }
        >
          {del.isPending ? '刪除中…' : '刪除'}
        </Button>
      </div>
    </DialogContent>
  )
}

/* ================= 負向反饋（選填原因） ================= */

const DOWN_REASONS = ['內容不正確', '不夠詳細', '格式不易閱讀', '其他']

function FeedbackDialog() {
  const payload = usePayload<{ messageId: string; conversationId: string }>()
  const { closeDialog } = useChatStore()
  const { submitFeedback } = useChatActions()
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  if (!payload) return null

  return (
    <DialogContent title="告訴我們哪裡不好">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {DOWN_REASONS.map((r) => (
            <TagChip key={r} active={reason === r} onClick={() => setReason(r)}>
              {r}
            </TagChip>
          ))}
        </div>
        <Textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="補充說明（選填）"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button
            type="button"
            onClick={() => {
              void submitFeedback(payload.messageId, 'down', reason || detail || undefined, payload.conversationId)
              toast({ title: '已收到反饋，謝謝你！' })
              closeDialog()
            }}
          >
            送出反饋
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

/* ================= 匯出對話 ================= */

function ExportDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const messages = useCachedMessages(payload?.conversation.id ?? null)
  if (!payload) return null

  /** TXT：前端直接產生下載（不需後端） */
  const exportTxt = () => {
    const conv = payload.conversation
    const lines = [`# ${conv.title}`, `學科：${conv.tag?.name ?? '未分類'}`, '']
    for (const m of messages) {
      const who = m.role === 'user' ? '我' : m.role === 'assistant' ? 'AI' : '系統'
      lines.push(`【${who}】`, m.content, '')
      for (const a of m.attachments ?? []) lines.push(`📎 ${a.fileName}`)
      if (m.attachments?.length) lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conv.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
    closeDialog()
  }

  /** PDF：走後端接口 GET /api/conversations/:id/export?format=pdf（見 lib/api/index.ts） */
  const exportPdf = () => {
    window.open(exportConversationUrl(payload.conversation.id, 'pdf'), '_blank')
    closeDialog()
  }

  return (
    <DialogContent title="匯出對話">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={exportTxt}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border border-border p-5 transition-colors',
            'hover:border-primary hover:bg-primary-soft/40',
          )}
        >
          <Download className="size-6 text-primary" />
          <span className="text-sm font-medium">TXT 純文字</span>
          <span className="text-xs text-muted-foreground">本機立即產生</span>
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border border-border p-5 transition-colors',
            'hover:border-primary hover:bg-primary-soft/40',
          )}
        >
          <Download className="size-6 text-primary" />
          <span className="text-sm font-medium">PDF 文件</span>
          <span className="text-xs text-muted-foreground">由後端產生（需串接）</span>
        </button>
      </div>
    </DialogContent>
  )
}

/* ================= 總控 ================= */

export function ChatDialogs() {
  const { dialog, closeDialog } = useChatStore()
  if (!dialog) return null
  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      {dialog === 'new-chat' && <NewChatDialog />}
      {dialog === 'rename' && <RenameDialog />}
      {dialog === 'change-tag' && <ChangeTagDialog />}
      {dialog === 'delete' && <DeleteDialog />}
      {dialog === 'feedback' && <FeedbackDialog />}
      {dialog === 'export' && <ExportDialog />}
    </Dialog>
  )
}
KIMI_FILE_EOF

# ----- src/components/message-list.tsx -----
mkdir -p "$(dirname 'src/components/message-list.tsx')"
cat > 'src/components/message-list.tsx' << 'KIMI_FILE_EOF'
'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  Copy,
  FileText,
  RefreshCw,
  RotateCcw,
  Sprout,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useCachedMessages, useChatActions, useMessages } from '@/hooks/use-chat-api'
import { useChatStore } from '@/store/chat-store'
import type { Message } from '@/lib/types'
import { Skeleton, toast } from '@/components/ui'
import { useState } from 'react'

/* ---------- 單一訊息氣泡 ---------- */

function MessageBubble({ message, conversationId }: { message: Message; conversationId: string }) {
  const { regenerateLast, submitFeedback, isStreaming } = useChatActions()
  const openDialog = useChatStore((s) => s.openDialog)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: '複製失敗', variant: 'destructive' })
    }
  }

  /* 文件訊息（附件卡片） */
  if (message.attachments?.length) {
    return (
      <div className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
        <div className="flex max-w-[85%] flex-wrap gap-2 md:max-w-[70%]">
          {message.attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm"
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="max-w-[180px] truncate font-medium">{a.fileName}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(a.fileSize)}</p>
              </div>
              {a.fileUrl && (
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary-soft"
                >
                  預覽
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* 系統訊息 */
  if (message.role === 'system') {
    return (
      <p className="text-center text-xs text-muted-foreground">
        {message.content}
      </p>
    )
  }

  const isUser = message.role === 'user'
  const isStreamingThis = message.status === 'streaming'
  const isError = message.status === 'error'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm md:max-w-[70%]',
          isUser
            ? 'rounded-tr-sm bg-primary-soft text-foreground'
            : 'rounded-tl-sm border bg-card',
          isError && 'border-destructive/50',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <>
            {/* AI 內容：串流中逐字顯示 + 游標閃爍；等待時顯示打字動畫 */}
            {message.content ? (
              <p className="whitespace-pre-wrap break-words">
                {message.content}
                {isStreamingThis && <span className="stream-cursor" aria-hidden />}
              </p>
            ) : isStreamingThis ? (
              <span className="inline-flex items-center gap-1 py-1" aria-label="AI 正在輸入">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-1.5 rounded-full bg-primary/70"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
            ) : null}

            {isError && (
              <div className="mt-1 flex items-center gap-2 text-destructive">
                <span className="text-xs">回覆中斷或失敗</span>
                <button
                  type="button"
                  onClick={() => regenerateLast(conversationId)}
                  disabled={isStreaming}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-0.5 text-xs transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <RotateCcw className="size-3" />
                  重試
                </button>
              </div>
            )}

            {/* AI 工具列：完成後顯示 */}
            {message.status === 'done' && message.content && (
              <div className="mt-2 flex items-center gap-0.5 border-t border-border/60 pt-1.5 text-muted-foreground">
                <button
                  type="button"
                  aria-label="複製"
                  onClick={handleCopy}
                  className="rounded p-1.5 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                </button>
                <button
                  type="button"
                  aria-label="重新生成"
                  disabled={isStreaming}
                  onClick={() => regenerateLast(conversationId)}
                  className="rounded p-1.5 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <RefreshCw className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="正向反饋"
                  onClick={() => void submitFeedback(message.id, 'up', undefined, conversationId)}
                  className={cn(
                    'rounded p-1.5 transition-colors hover:bg-muted',
                    message.feedback === 'up' ? 'text-primary' : 'hover:text-foreground',
                  )}
                >
                  <ThumbsUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="負向反饋"
                  onClick={() => openDialog('feedback', { messageId: message.id, conversationId })}
                  className={cn(
                    'rounded p-1.5 transition-colors hover:bg-muted',
                    message.feedback === 'down' ? 'text-destructive' : 'hover:text-foreground',
                  )}
                >
                  <ThumbsDown className="size-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ---------- 空對話歡迎語 + 建議提問 ---------- */

const SUGGESTIONS = [
  '幫我解釋什麼是三角函數',
  '出三道微積分練習題',
  '幫我檢查這篇英文作文',
  '整理牛頓三大運動定律的重點',
]

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft">
        <Sprout className="size-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">開始新的學習對話</h2>
      <p className="mt-1 text-sm text-muted-foreground">試試看下面的建議提問，或直接輸入你的問題</p>
      <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------- 訊息列表主體 ---------- */

export function MessageList() {
  const { activeConversationId, setDraft } = useChatStore()
  const { data: messages, isLoading, isError, refetch } = useMessages(activeConversationId)
  const streamingId = useChatStore((s) => s.streamingMessageId)
  const scrollRef = useRef<HTMLDivElement>(null)
  useCachedMessages(activeConversationId) // 確保快取就緒（供匯出使用）

  // 新訊息 / 串流更新時自動滾到底
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, streamingId])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto nice-scroll">
      {activeConversationId === null ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          從左側選擇一個對話，或點「新增對話」開始學習吧！
        </div>
      ) : isLoading ? (
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
          <Skeleton className="h-24 w-3/4 rounded-2xl" />
          <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>訊息載入失敗</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border px-4 py-1.5 text-primary transition-colors hover:bg-primary-soft"
          >
            重試
          </button>
        </div>
      ) : messages && messages.length === 0 ? (
        <Welcome onPick={(text) => setDraft(text)} />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          {messages?.map((m) => (
            <MessageBubble key={m.id} message={m} conversationId={activeConversationId} />
          ))}
        </div>
      )}
    </div>
  )
}
KIMI_FILE_EOF

# ----- src/components/sidebar.tsx -----
mkdir -p "$(dirname 'src/components/sidebar.tsx')"
cat > 'src/components/sidebar.tsx' << 'KIMI_FILE_EOF'
 'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  ChevronDown,
  MessageSquare,
  Plus,
  Settings,
  Sprout,
  Trash2,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConversations } from '@/hooks/use-chat-api'
import { useChatStore } from '@/store/chat-store'
import { Skeleton, TagChip } from '@/components/ui'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: conversations, isLoading, isError, refetch } = useConversations()
  const { activeConversationId, setActiveConversationId, openDialog } = useChatStore()
  const [chatOpen, setChatOpen] = useState(true)

  const go = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col">
      {/* 品牌列 */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Sprout className="size-5 text-primary" />
        <span className="font-semibold">AI 學習助手</span>
      </div>

      <div className="flex-1 overflow-y-auto nice-scroll px-3 py-3">
        {/* Chat Section（可折疊，點標題回到聊天頁） */}
        <div>
          <button
            type="button"
            onClick={() => {
              setChatOpen((v) => !v)
              go('/')
            }}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              pathname === '/' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare className="size-4" />
              Chat
            </span>
            <ChevronDown
              className={cn('size-4 transition-transform', chatOpen ? '' : '-rotate-90')}
            />
          </button>

          {chatOpen && (
            <div className="mt-1 space-y-0.5">
              {/* 新增對話 */}
              <button
                type="button"
                onClick={() => {
                  openDialog('new-chat')
                  go('/')
                }}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="size-4" />
                新增對話
              </button>

              {/* 對話列表 */}
              {isLoading && (
                <div className="space-y-1.5 px-1 pt-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              )}

              {isError && (
                <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <p>對話列表載入失敗</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-1 font-medium text-primary hover:underline"
                  >
                    重試
                  </button>
                </div>
              )}

              {conversations && conversations.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  尚無對話，點 + 新增開始學習吧！
                </p>
              )}

              {conversations?.map((c) => {
                const active = c.id === activeConversationId && pathname === '/'
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 transition-colors',
                      active ? 'bg-primary-soft' : 'hover:bg-muted',
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveConversationId(c.id)
                        go('/')
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                      <span className={cn('truncate text-sm', active ? 'font-medium text-foreground' : 'text-foreground/80')}>
                        {c.title}
                      </span>
                    </button>
                    {c.tag && (
                      <TagChip className="shrink-0 px-2 py-0 text-[10px]">
                        {c.tag.name}
                      </TagChip>
                    )}
                    <button
                      type="button"
                      aria-label="刪除對話"
                      onClick={() => openDialog('delete', { conversation: c })}
                      className="hidden shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Analyze（按鈕 → 分析頁面） */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => go('/analyze')}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              pathname === '/analyze'
                ? 'bg-primary-soft text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <BarChart3 className="size-4" />
            Analyze
            <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              框架
            </span>
          </button>
          <p className="mt-1 px-2 text-xs leading-relaxed text-muted-foreground">
            對話綁定的學科 Tag、知識點與錯題會彙整到分析頁面。
          </p>
        </div>
      </div>

      {/* 底部 */}
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
        <button type="button" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
          <Settings className="size-4" />
          設定
        </button>
        <button type="button" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
          <User className="size-4" />
          用戶
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useChatStore()

  return (
    <>
      {/* 桌面版：固定側欄 */}
      <aside className="hidden w-72 shrink-0 border-r bg-card md:block">
        <SidebarContent />
      </aside>

      {/* 行動版：全屏覆疊抽屜 */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <div
              className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute left-0 top-0 h-full w-[280px] bg-card shadow-xl"
            >
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
KIMI_FILE_EOF

# ----- src/components/ui.tsx -----
mkdir -p "$(dirname 'src/components/ui.tsx')"
cat > 'src/components/ui.tsx' << 'KIMI_FILE_EOF'
'use client'

/**
 * 基礎 UI 元件（shadcn/ui 風格，原始碼內建，無需 CLI 安裝）
 * Button / Input / Textarea / TagChip / Dialog / DropdownMenu / Skeleton / Spinner / Toast
 */

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

export { cn }

/* ---------------- Button ---------------- */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-white shadow-sm hover:bg-destructive/90',
        outline: 'border border-border bg-card shadow-sm hover:bg-muted',
        secondary: 'bg-muted text-foreground shadow-sm hover:bg-muted/70',
        ghost: 'hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

/* ---------------- Input / Textarea ---------------- */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[36px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

/* ---------------- TagChip ---------------- */

export function TagChip({
  children,
  active = false,
  onClick,
  className,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------------- Dialog ---------------- */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export function DialogContent({
  className,
  title,
  children,
}: {
  className?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="關閉"
            >
              <X className="size-4" />
            </button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/* ---------------- DropdownMenu ---------------- */

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-md border bg-card p-1 text-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4',
        destructive && 'text-destructive focus:bg-destructive/10',
        className,
      )}
      {...props}
    />
  )
}

export const DropdownMenuSeparator = () => (
  <DropdownMenuPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />
)

/* ---------------- Skeleton / Spinner ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} />
}

/* ---------------- Toast ---------------- */

interface ToastItem {
  id: number
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface ToastStore {
  toasts: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let toastSeq = 0
const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export function toast(t: Omit<ToastItem, 'id'>) {
  useToastStore.getState().push(t)
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={cn(
              'pointer-events-auto w-full rounded-lg border bg-card px-4 py-3 text-left shadow-lg',
              t.variant === 'destructive' && 'border-destructive/40',
            )}
          >
            <p className={cn('text-sm font-medium', t.variant === 'destructive' && 'text-destructive')}>
              {t.title}
            </p>
            {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
KIMI_FILE_EOF

# ----- src/hooks/use-analyze-api.ts -----
mkdir -p "$(dirname 'src/hooks/use-analyze-api.ts')"
cat > 'src/hooks/use-analyze-api.ts' << 'KIMI_FILE_EOF'
'use client'

/**
 * Analyze 板塊資料 Hooks（TanStack Query）
 * 接口實作見 src/lib/api/index.ts「Analyze · 接口預留」章節。
 * 未串接後端時查詢進入 error 狀態，頁面呈現提示 + 重試。
 */

import { useQuery } from '@tanstack/react-query'
import { getAnalyzeOverview } from '@/lib/api'

export function useAnalyzeOverview(tagId?: string) {
  return useQuery({
    queryKey: ['analyze', 'overview', tagId ?? 'all'],
    queryFn: () => getAnalyzeOverview(tagId),
  })
}
KIMI_FILE_EOF

# ----- src/hooks/use-chat-api.ts -----
mkdir -p "$(dirname 'src/hooks/use-chat-api.ts')"
cat > 'src/hooks/use-chat-api.ts' << 'KIMI_FILE_EOF'
'use client'

/**
 * 資料存取 Hooks（TanStack Query）
 * 全部透過 src/lib/api 的函數呼叫後端；未串接後端時查詢會進入
 * error 狀態，UI 呈現「錯誤提示 + 重試」，不會有假資料。
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  createConversation,
  createTag,
  deleteConversation,
  listConversations,
  listMessages,
  listTags,
  postFeedback,
  streamChat,
  updateConversation,
} from '@/lib/api'
import type { AttachmentMeta, Conversation, Message } from '@/lib/types'
import { useChatStore } from '@/store/chat-store'
import { toast } from '@/components/ui'

export const keys = {
  tags: ['tags'] as const,
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
}

const genId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

/* ---------- Tags ---------- */

export function useTags() {
  return useQuery({ queryKey: keys.tags, queryFn: listTags })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createTag(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tags }),
  })
}

/* ---------- Conversations ---------- */

export function useConversations() {
  return useQuery({ queryKey: keys.conversations, queryFn: listConversations })
}

export function useCreateConversation() {
  const qc = useQueryClient()
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId)
  return useMutation({
    mutationFn: (input: { title: string; tagId: string }) => createConversation(input),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: keys.conversations })
      setActiveConversationId(conv.id)
    },
  })
}

export function useUpdateConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; tagId?: string } }) =>
      updateConversation(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.conversations })
    },
  })
}

export function useDeleteConversation() {
  const qc = useQueryClient()
  const { activeConversationId, setActiveConversationId } = useChatStore()
  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: keys.conversations })
      qc.removeQueries({ queryKey: keys.messages(id) })
      if (activeConversationId === id) setActiveConversationId(null)
    },
  })
}

/* ---------- Messages ---------- */

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: keys.messages(conversationId ?? ''),
    queryFn: () => listMessages(conversationId!),
    enabled: !!conversationId,
    select: (data) => data.items,
  })
}

/* ---------- 訊息操作（樂觀更新 + SSE 串流） ---------- */

export function useChatActions() {
  const qc = useQueryClient()
  const setStreaming = useChatStore((s) => s.setStreaming)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const streamingMessageId = useChatStore((s) => s.streamingMessageId)

  const setMessageCache = useCallback(
    (conversationId: string, updater: (msgs: Message[]) => Message[]) => {
      const key = keys.messages(conversationId)
      qc.setQueryData<{ items: Message[]; nextCursor: string | null }>(key, (old) => ({
        items: updater(old?.items ?? []),
        nextCursor: old?.nextCursor ?? null,
      }))
    },
    [qc],
  )

  /** 送出訊息：樂觀插入用戶訊息 + AI 佔位，接著跑 SSE 串流 */
  const sendMessage = useCallback(
    async (
      conversationId: string,
      content: string,
      attachments: AttachmentMeta[] = [],
      regenerateOf?: string,
    ) => {
      const userMsg: Message = {
        id: genId(),
        conversationId,
        role: 'user',
        content,
        attachments: attachments.length ? attachments : undefined,
        status: 'sending',
        createdAt: now(),
      }
      const assistantId = genId()
      const assistantShell: Message = {
        id: assistantId,
        conversationId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: now(),
      }

      setMessageCache(conversationId, (msgs) => {
        // 重新生成：先移除串流中/失敗的尾端 AI 訊息
        const cleaned = regenerateOf ? msgs.filter((m) => m.id !== regenerateOf) : msgs
        return [...cleaned, userMsg, assistantShell]
      })

      const ctrl = new AbortController()
      setStreaming(assistantId, ctrl)

      try {
        await streamChat(
          conversationId,
          { content, attachmentIds: attachments.map((a) => a.id), regenerateOf },
          {
            signal: ctrl.signal,
            onDelta: (delta) =>
              setMessageCache(conversationId, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m,
                ),
              ),
          },
        )
        setMessageCache(conversationId, (msgs) =>
          msgs.map((m) => {
            if (m.id !== assistantId) return m
            // 正常完成才標 done；若 abort 則保持中斷時的內容
            return ctrl.signal.aborted ? { ...m, status: 'done' } : { ...m, status: 'done' }
          }),
        )
      } catch (e) {
        if (ctrl.signal.aborted) {
          setMessageCache(conversationId, (msgs) =>
            msgs.map((m) => (m.id === assistantId ? { ...m, status: 'done' } : m)),
          )
        } else {
          setMessageCache(conversationId, (msgs) =>
            msgs.map((m) => (m.id === assistantId ? { ...m, status: 'error' } : m)),
          )
          toast({
            title: '回覆失敗',
            description: e instanceof Error ? e.message : '發生未知錯誤',
            variant: 'destructive',
          })
        }
      } finally {
        setStreaming(null, null)
      }
    },
    [qc, setMessageCache, setStreaming],
  )

  /** 重新生成最後一則 AI 回覆 */
  const regenerateLast = useCallback(
    (conversationId: string) => {
      const msgs = qc.getQueryData<{ items: Message[] }>(keys.messages(conversationId))?.items ?? []
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
      if (!lastAssistant || !lastUser) return
      // 移除尾端 AI 訊息後以其前的用戶訊息重新生成
      void sendMessage(conversationId, lastUser.content, lastUser.attachments ?? [], lastAssistant.id)
    },
    [qc, sendMessage],
  )

  /** 訊息反饋（👍 / 👎） */
  const submitFeedback = useCallback(
    async (messageId: string, feedback: 'up' | 'down', reason?: string, conversationId?: string) => {
      if (conversationId) {
        setMessageCache(conversationId, (msgs) =>
          msgs.map((m) =>
            m.id === messageId ? { ...m, feedback, feedbackReason: reason } : m,
          ),
        )
      }
      try {
        await postFeedback(messageId, { feedback, reason })
      } catch {
        toast({ title: '反饋送出失敗', variant: 'destructive' })
      }
    },
    [setMessageCache],
  )

  return { sendMessage, regenerateLast, submitFeedback, stopStreaming, isStreaming: !!streamingMessageId }
}

/** 查詢快取中的訊息（供匯出 TXT 使用，不觸發請求） */
export function useCachedMessages(conversationId: string | null): Message[] {
  const qc = useQueryClient()
  if (!conversationId) return []
  return qc.getQueryData<{ items: Message[] }>(keys.messages(conversationId))?.items ?? []
}

export type { Conversation, Message }
KIMI_FILE_EOF

# ----- src/lib/types.ts -----
mkdir -p "$(dirname 'src/lib/types.ts')"
cat > 'src/lib/types.ts' << 'KIMI_FILE_EOF'
/** ===== 與後端 API 對應的資料型別 =====
 * 這裡的型別就是前後端的資料契約，若後端欄位不同請同步調整。
 * 對照接口表見 src/lib/api/index.ts 頂部說明。
 */

export interface Tag {
  id: string
  name: string
  /** 可選：學科代表色（hex），目前 UI 統一使用暖橘 */
  color?: string
}

export interface Conversation {
  id: string
  title: string
  tagId: string
  tag?: Tag
  createdAt: string
  updatedAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface AttachmentMeta {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  /** 上傳成功後由後端回傳，可用於預覽/下載 */
  fileUrl?: string
}

export type MessageStatus = 'sending' | 'streaming' | 'done' | 'error'

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  attachments?: AttachmentMeta[]
  feedback?: 'up' | 'down'
  feedbackReason?: string
  /** 前端樂觀更新用；後端回傳的歷史訊息通常不含此欄位，視為 done */
  status?: MessageStatus
  createdAt: string
}

export interface SendMessagePayload {
  content: string
  attachmentIds?: string[]
  /** 重新生成時帶上被重新生成訊息的 id，供後端參考 */
  regenerateOf?: string
}


/* ---------- Analyze（分析板塊 · 接口預留型別） ---------- */

export interface SubjectStat {
  tagId: string
  tagName: string
  conversationCount: number
  messageCount: number
  /** AI 標註的知識點數量 */
  knowledgePoints: number
  /** AI 標註的錯題數量 */
  mistakes: number
}

export interface AnalyzeOverview {
  subjects: SubjectStat[]
  generatedAt: string
}
KIMI_FILE_EOF

# ----- src/lib/utils.ts -----
mkdir -p "$(dirname 'src/lib/utils.ts')"
cat > 'src/lib/utils.ts' << 'KIMI_FILE_EOF'
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
KIMI_FILE_EOF

# ----- src/lib/api/client.ts -----
mkdir -p "$(dirname 'src/lib/api/client.ts')"
cat > 'src/lib/api/client.ts' << 'KIMI_FILE_EOF'
/**
 * HTTP / SSE 客戶端 —— 【後端接入說明】
 * ============================================================
 * 1. 環境變數：複製 .env.example 為 .env.local，設定
 *      NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
 *    前端所有請求都會自動加上此前綴，程式內沒有任何 hardcode 網址
 *    （uploadFiles 因使用 XMLHttpRequest 需手動取值，見該函數）。
 *
 * 2. 身分驗證：若後端需要登入，請修改 authHeaders()，例如：
 *      return { Authorization: `Bearer ${getToken()}` }
 *    token 來源依你的登入實作（cookie / zustand persist 皆可）。
 *
 * 3. 統一錯誤格式（ApiError 會讀取 body.error）：
 *      失敗時回傳 HTTP 4xx/5xx + JSON：
 *      { "error": { "code": "CONVERSATION_NOT_FOUND", "message": "..." } }
 *
 * 4. SSE 串流協議（AI 回覆）見 streamChat() 內註解。
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? ''

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function authHeaders(): Record<string, string> {
  // TODO(後端接入): 需要登入時在此加入 Authorization header
  return {}
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let code = 'UNKNOWN'
    let message = `請求失敗（HTTP ${res.status}）`
    try {
      const body = await res.json()
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      /* body 非 JSON 時使用預設訊息 */
    }
    throw new ApiError(res.status, code, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/* ============================================================
 * SSE 串流（AI 回覆）
 * ------------------------------------------------------------
 * 【後端接口】POST /api/conversations/:id/messages
 *   Headers: Authorization（如有）、Content-Type: application/json
 *   Request Body:
 *     { "content": "用戶訊息", "attachmentIds": ["..."], "regenerateOf": "訊息id(重新生成時)" }
 *   Response: Content-Type: text/event-stream（HTTP 200）
 *     每筆事件：  data: {"delta": "片段文字"}\n\n
 *     結束信號：  data: [DONE]\n\n
 *     （若你使用標準 SSE event 欄位，請調整下方解析邏輯）
 *   錯誤：串流建立前回傳 4xx/5xx JSON（錯誤格式同上方說明）；
 *         串流中途斷線會由前端 catch，將訊息標為 error 並提供重試。
 * ============================================================ */
export interface StreamHandlers {
  /** 每收到一段文字就呼叫（前端逐字渲染 + 游標閃爍） */
  onDelta: (delta: string) => void
  /** 由 AbortController 提供，供「停止生成」使用 */
  signal?: AbortSignal
}

export async function streamChat(
  conversationId: string,
  payload: { content: string; attachmentIds?: string[]; regenerateOf?: string },
  { onDelta, signal }: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!res.ok || !res.body) {
    let message = '串流請求失敗'
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, 'STREAM_FAILED', message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const parsed = JSON.parse(data) as { delta?: string }
        if (parsed.delta) onDelta(parsed.delta)
      } catch {
        /* 忽略非 JSON 的行（例如 heartbeat） */
      }
    }
  }
}
KIMI_FILE_EOF

# ----- src/lib/api/index.ts -----
mkdir -p "$(dirname 'src/lib/api/index.ts')"
cat > 'src/lib/api/index.ts' << 'KIMI_FILE_EOF'
/**
 * 後端 API 接口總表 —— 【接入說明】
 * ============================================================
 * 基礎網址：NEXT_PUBLIC_API_BASE_URL（.env.local）
 * 驗證方式：修改 src/lib/api/client.ts 的 authHeaders()
 * 錯誤格式：{ "error": { "code": string, "message": string } }
 *
 * | 方法   | 路徑                                          | 說明                     | 函數                       |
 * |--------|-----------------------------------------------|--------------------------|----------------------------|
 * | GET    | /api/tags                                     | 學科 Tag 列表            | listTags                   |
 * | POST   | /api/tags                                     | 新增 Tag { name }        | createTag                  |
 * | GET    | /api/conversations                            | 對話列表（含 tag）       | listConversations          |
 * | POST   | /api/conversations                            | 建立對話 { title, tagId }| createConversation         |
 * | PATCH  | /api/conversations/:id                        | 重新命名/更改 Tag        | updateConversation         |
 * | DELETE | /api/conversations/:id                        | 刪除對話                 | deleteConversation         |
 * | GET    | /api/conversations/:id/messages?cursor=&limit=| 訊息列表（分頁）         | listMessages               |
 * | POST   | /api/conversations/:id/messages               | 送訊息 → SSE 串流        | streamChat（client.ts）    |
 * | POST   | /api/messages/:id/feedback                    | 訊息反饋                 | postFeedback               |
 * | POST   | /api/uploads                                  | 檔案上傳（multipart）    | uploadFiles                |
 * | GET    | /api/conversations/:id/export?format=pdf      | 匯出 PDF（前端已預留）   | exportConversation         |
 *
 * 各函數回傳型別定義在 src/lib/types.ts，前後端欄位需保持一致。
 */

import { apiFetch, streamChat } from './client'
import type { AnalyzeOverview, AttachmentMeta, Conversation, Message, Tag } from '@/lib/types'

export { streamChat, ApiError } from './client'

/* ---------- Tags ---------- */

/** GET /api/tags → Tag[] */
export function listTags(): Promise<Tag[]> {
  return apiFetch<Tag[]>('/api/tags')
}

/** POST /api/tags { name } → Tag；重複名稱請回傳 409 code: TAG_DUPLICATE */
export function createTag(name: string): Promise<Tag> {
  return apiFetch<Tag>('/api/tags', { method: 'POST', body: JSON.stringify({ name }) })
}

/* ---------- Conversations ---------- */

/** GET /api/conversations → Conversation[]（建議依 updatedAt 降序） */
export function listConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/conversations')
}

/** POST /api/conversations { title, tagId } → Conversation */
export function createConversation(input: { title: string; tagId: string }): Promise<Conversation> {
  return apiFetch<Conversation>('/api/conversations', { method: 'POST', body: JSON.stringify(input) })
}

/** PATCH /api/conversations/:id { title?, tagId? } → Conversation */
export function updateConversation(
  id: string,
  patch: { title?: string; tagId?: string },
): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** DELETE /api/conversations/:id → 204 */
export function deleteConversation(id: string): Promise<void> {
  return apiFetch<void>(`/api/conversations/${id}`, { method: 'DELETE' })
}

/* ---------- Messages ---------- */

/** GET /api/conversations/:id/messages?cursor=&limit= → { items: Message[], nextCursor: string | null }
 *  若後端直接回傳 Message[] 也可，請把 listMessages 的回傳型別改成 Message[]。 */
export function listMessages(
  conversationId: string,
  cursor?: string,
): Promise<{ items: Message[]; nextCursor: string | null }> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return apiFetch<{ items: Message[]; nextCursor: string | null }>(
    `/api/conversations/${conversationId}/messages${qs}`,
  )
}

/** POST /api/messages/:id/feedback { feedback: 'up' | 'down', reason? } → 204 */
export function postFeedback(
  messageId: string,
  input: { feedback: 'up' | 'down'; reason?: string },
): Promise<void> {
  return apiFetch<void>(`/api/messages/${messageId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/* ---------- Uploads ---------- */

export interface UploadResult extends AttachmentMeta {
  /** 前端暫存用：上傳進度 0-100 */
  progress?: number
}

/**
 * POST /api/uploads —— multipart/form-data，欄位名「files」（可多檔）
 * 回傳 AttachmentMeta[]，順序與上傳檔案一致。
 * 使用 XMLHttpRequest 以取得真實上傳進度事件。
 */
export function uploadFiles(
  files: File[],
  onProgress: (percent: number) => void,
): Promise<AttachmentMeta[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    files.forEach((f) => form.append('files', f))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api/uploads`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as AttachmentMeta[])
        } catch {
          reject(new Error('上傳回應格式錯誤'))
        }
      } else {
        let message = `上傳失敗（HTTP ${xhr.status}）`
        try {
          message = (JSON.parse(xhr.responseText) as { error?: { message?: string } })?.error?.message ?? message
        } catch {
          /* ignore */
        }
        reject(new Error(message))
      }
    }
    xhr.onerror = () => reject(new Error('網路錯誤，上傳失敗'))
    xhr.send(form)
  })
}

/* ---------- Export ---------- */

/** GET /api/conversations/:id/export?format=pdf → 二進位檔案（Content-Disposition: attachment）
 *  前端使用方式見 components/dialogs.tsx 的 ExportDialog（動態 import 避免 SSR 問題）。 */
export function exportConversationUrl(conversationId: string, format: 'pdf'): string {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api/conversations/${conversationId}/export?format=${format}`
}


/* ---------- Analyze（分析板塊 · 接口預留） ----------
 * 【後端接入】分析圖表資料由 Chat 板塊非同步產生（對話內容標註知識點/錯題、
 * 文件學習紀錄等），此處先預留查詢接口，規格可依實際需求調整：
 *
 * | 方法 | 路徑                              | 說明                       | 函數              |
 * |------|-----------------------------------|----------------------------|-------------------|
 * | GET  | /api/analyze/overview?tagId=      | 各學科統計總覽             | getAnalyzeOverview|
 */

/** GET /api/analyze/overview?tagId= → AnalyzeOverview */
export function getAnalyzeOverview(tagId?: string): Promise<AnalyzeOverview> {
  const qs = tagId ? `?tagId=${encodeURIComponent(tagId)}` : ''
  return apiFetch<AnalyzeOverview>(`/api/analyze/overview${qs}`)
}
KIMI_FILE_EOF

# ----- src/store/chat-store.ts -----
mkdir -p "$(dirname 'src/store/chat-store.ts')"
cat > 'src/store/chat-store.ts' << 'KIMI_FILE_EOF'
'use client'

import { create } from 'zustand'

/** 全局面對話框類型 */
export type DialogType =
  | 'new-chat'
  | 'rename'
  | 'change-tag'
  | 'delete'
  | 'feedback'
  | 'export'
  | null

interface ChatUIState {
  /** 目前選中的對話 id */
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void

  /** 行動版側邊抽屜 */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  /** 對話框控制（payload 依 type 而定，見各 Dialog 實作） */
  dialog: DialogType
  dialogPayload: Record<string, unknown> | null
  openDialog: (type: Exclude<DialogType, null>, payload?: Record<string, unknown>) => void
  closeDialog: () => void

  /** AI 串流狀態（停止生成用） */
  streamingMessageId: string | null
  abortController: AbortController | null
  setStreaming: (messageId: string | null, ctrl: AbortController | null) => void
  stopStreaming: () => void

  /** 歡迎頁建議提問 → 帶入輸入框 */
  draft: string
  setDraft: (text: string) => void
}

export const useChatStore = create<ChatUIState>()((set, get) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  dialog: null,
  dialogPayload: null,
  openDialog: (type, payload) => set({ dialog: type, dialogPayload: payload ?? null }),
  closeDialog: () => set({ dialog: null, dialogPayload: null }),

  streamingMessageId: null,
  abortController: null,
  setStreaming: (messageId, ctrl) => set({ streamingMessageId: messageId, abortController: ctrl }),
  stopStreaming: () => {
    get().abortController?.abort()
    set({ streamingMessageId: null, abortController: null })
  },

  draft: '',
  setDraft: (text) => set({ draft: text }),
}))
KIMI_FILE_EOF


echo "✅ 已建立 26 個檔案。接下來："
echo "   npm install"
echo "   npm run dev"