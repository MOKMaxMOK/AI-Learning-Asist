'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, Paperclip, SendHorizonal, Square, X } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { useChatActions, useConversations } from '@/hooks/use-chat-api'
import { uploadFiles } from '@/lib/api'
import { useChatStore } from '@/store/chat-store'
import { LLM_NOT_CONFIGURED, type AttachmentMeta } from '@/lib/types'
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
  const { sendMessage, stopStreaming, isStreaming, lastError, clearError } = useChatActions()
  const { data: conversations } = useConversations()
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

      // 上傳（真實 XHR 進度；失敗會進入 error 狀態並可重試）
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
    // 帶上對話的學科，AI 回覆會附帶學科／知識點／錯題標註給 Analyze 使用
    const subjectId = conversations?.find((c) => c.id === activeConversationId)?.tagId
    setText('')
    setFiles([])
    void sendMessage(activeConversationId, content, metas, undefined, subjectId)
    textareaRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  /* 尚未新增 / 選擇對話：不顯示輸入框（畫面由 MessageList 的「新增對話」引導） */
  if (!activeConversationId) return null

  return (
    <div className="shrink-0 border-t bg-card px-3 pb-3 pt-2 md:px-4">
      {/*
        尚未綁定 LLM：在輸入框上方顯示引導橫幅，可直接跳到「設置 → LLM 綁定」
        （後端串流會回 LLM_NOT_CONFIGURED，這裡據此提示）
      */}
      {lastError === LLM_NOT_CONFIGURED && (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-[#F6C79A] bg-[#FFF1E3] px-3 py-2 text-xs text-[#9A5518]">
          <AlertCircle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            還沒綁定 LLM，AI 老師無法回覆。請先到「設置 → LLM 綁定」輸入 API Key 與模型名稱。
          </span>
          <button
            type="button"
            onClick={clearError}
            aria-label="關閉提示"
            className="shrink-0 rounded p-1 transition-colors hover:bg-[#F6C79A]/30"
          >
            <X className="size-3.5" />
          </button>
          <Link
            href="/settings?entry=llm"
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            前往綁定 LLM
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

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
