'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Sprout,
  Tag as TagIcon,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn, formatDuration, formatFileSize } from '@/lib/utils'
import { KNOWLEDGE_STATUS_META, STUDY_TYPE_META } from '@/lib/constants'
import { useCachedMessages, useChatActions, useMessages } from '@/hooks/use-chat-api'
import { useChatStore } from '@/store/chat-store'
import type { Message, MessageAnnotation } from '@/lib/types'
import { Skeleton, toast } from '@/components/ui'
import { Markdown } from '@/components/markdown'
import { useState } from 'react'

/* ---------- AI 標註列（學科 / 知識點 / 錯題 / 學習型態） ---------- */

/**
 * AI 回覆附帶的結構化標註，主要用途是讓 Analyze 板塊統計；
 * 這裡以小膠囊呈現，讓使用者知道這則回覆被歸到哪個學科與知識點。
 */
function AnnotationBar({ annotation }: { annotation: MessageAnnotation }) {
  const kps = annotation.knowledgePoints ?? []
  const mistakes = annotation.mistakes ?? []
  const studyType = STUDY_TYPE_META.find((t) => t.value === annotation.studyType)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
      {annotation.subjectName && (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] text-primary">
          <TagIcon className="size-2.5" />
          {annotation.subjectName}
        </span>
      )}
      {kps.map((kp) => {
        const meta = kp.status ? KNOWLEDGE_STATUS_META[kp.status] : null
        return (
          <span
            key={kp.id}
            title={meta?.hint}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
              meta ? meta.cell : 'border-border bg-muted text-muted-foreground',
            )}
          >
            <BookOpen className="size-2.5" />
            {kp.name}
          </span>
        )
      })}
      {mistakes.length > 0 && (
        <span
          title={mistakes.map((m) => m.type).join('、')}
          className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
        >
          <AlertCircle className="size-2.5" />
          錯題 {mistakes.length}
        </span>
      )}
      {studyType && annotation.studySeconds ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ background: studyType.color }} />
          {studyType.label} {formatDuration(annotation.studySeconds)}
        </span>
      ) : null}
      <span className="ml-auto text-[10px] text-muted-foreground/70">已標註給分析</span>
    </div>
  )
}

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
          <Markdown content={message.content} />
        ) : (
          <>
            {/* AI 內容：Markdown 渲染 + 串流游標；等待時顯示打字動畫 */}
            {message.content ? (
              <Markdown content={message.content} streamingCursor={isStreamingThis} />
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

            {/* AI 標註：學科 / 知識點 / 錯題 / 學習型態（供 Analyze 統計） */}
            {message.annotation && <AnnotationBar annotation={message.annotation} />}

            {/* AI 工具列：完成後顯示 */}
            {message.status === 'done' && message.content && (
              <div
                className={cn(
                  'mt-2 flex items-center gap-0.5 text-muted-foreground',
                  message.annotation ? 'pt-1.5' : 'border-t border-border/60 pt-1.5',
                )}
              >
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

/* ---------- 尚未新增任何對話：模糊底板 + 明顯的「新增對話」 ---------- */

function NoConversation() {
  const { openDialog, setSidebarOpen } = useChatStore()

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6">
      {/* 模糊的示意底板（沒有實際訊息，只是視覺氛圍） */}
      <div aria-hidden className="pointer-events-none absolute inset-0 select-none blur-[6px] opacity-40">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
          <div className="ml-auto h-14 w-2/3 rounded-2xl bg-primary-soft" />
          <div className="h-24 w-3/4 rounded-2xl border bg-card" />
          <div className="ml-auto h-12 w-1/2 rounded-2xl bg-primary-soft" />
          <div className="h-20 w-2/3 rounded-2xl border bg-card" />
          <div className="ml-auto h-10 w-2/5 rounded-2xl bg-primary-soft" />
        </div>
      </div>

      {/* 前景提示 */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary-soft shadow-sm">
          <Sprout className="size-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">還沒有任何對話</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
          新增一個對話、選好學科，就可以開始問 AI 老師問題了。
        </p>

        <button
          type="button"
          onClick={() => openDialog('new-chat')}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-md transition-transform hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.99]"
        >
          <Plus className="size-5" />
          新增對話
        </button>

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="mt-3 text-xs text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          或從左側選單選擇既有對話
        </button>
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
        <NoConversation />
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
