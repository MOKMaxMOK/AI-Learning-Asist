'use client'

/**
 * 資料存取 Hooks（TanStack Query）
 * 全部透過 src/lib/api 的函數呼叫後端；未串接後端時查詢會進入
 * error 狀態，UI 呈現「錯誤提示 + 重試」，不會有假資料。
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
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
  ApiError,
} from '@/lib/api'
import type { AttachmentMeta, Conversation, Message, MessageAnnotation } from '@/lib/types'
import { LLM_NOT_CONFIGURED } from '@/lib/types'
import { mergeSubjects } from '@/lib/constants'
import { useChatStore } from '@/store/chat-store'
import { toast } from '@/components/ui'

export const keys = {
  tags: ['tags'] as const,
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
}

const genId = () => crypto.randomUUID()
const now = () => new Date().toISOString()

/* ---------- 學科（舊稱 Tags） ---------- */

/**
 * 學科列表：後端（本地 API）暫時失敗時回傳預設三學科（中文 / English / 數學），
 * 讓「新增對話必選學科」的流程不中斷；不產生任何假統計資料。
 * 若需要判斷後端狀態，請讀回傳值的 isError。
 */
export function useTags() {
  const query = useQuery({ queryKey: keys.tags, queryFn: listTags })
  return { ...query, data: mergeSubjects(query.data) }
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
  /** 最近一次串流失敗的錯誤碼（例如 LLM_NOT_CONFIGURED），供 Chat 顯示引導 */
  const [lastError, setLastError] = useState<string | null>(null)

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
      subjectId?: string,
    ) => {
      const userMessageId = genId()
      const userMsg: Message = {
        id: userMessageId,
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
          {
            content,
            attachmentIds: attachments.map((a) => a.id),
            regenerateOf,
            subjectId,
            userMessageId,
          },
          {
            signal: ctrl.signal,
            onDelta: (delta) =>
              setMessageCache(conversationId, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + delta } : m,
                ),
              ),
            /** AI 標註（學科 / 知識點 / 錯題）掛到該則回覆，供 Analyze 統計 */
            onAnnotation: (annotation: MessageAnnotation) =>
              setMessageCache(conversationId, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantId
                    ? { ...m, annotation: { ...m.annotation, ...annotation } }
                    : m,
                ),
              ),
            /**
             * 後端沿用前端帶入的使用者訊息 id，並回報真正落庫的 AI 訊息 id；
             * 這裡把樂觀插入的臨時 id 換成正式 id（後續重新載入就不會出現重複訊息）。
             */
            onIds: ({ assistantMessageId }) => {
              if (!assistantMessageId || assistantMessageId === assistantId) return
              setMessageCache(conversationId, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantId ? { ...m, id: assistantMessageId } : m,
                ),
              )
            },
          },
        )
        setMessageCache(conversationId, (msgs) =>
          msgs.map((m) => {
            // 使用者訊息：後端沿用同一個 id（見 userMessageId），這裡收尾即可
            if (m.id === userMessageId) return { ...m, status: 'done' }
            if (m.id !== assistantId) return m
            // 正常完成才標 done；若 abort 則保持中斷時的內容
            return ctrl.signal.aborted ? { ...m, status: 'done' } : { ...m, status: 'done' }
          }),
        )      } catch (e) {
        setLastError(e instanceof ApiError ? e.code : 'UNKNOWN')
        if (ctrl.signal.aborted) {
          setMessageCache(conversationId, (msgs) =>
            msgs.map((m) => (m.id === assistantId ? { ...m, status: 'done' } : m)),
          )
        } else {
          setMessageCache(conversationId, (msgs) =>
            msgs.map((m) => (m.id === assistantId ? { ...m, status: 'error' } : m)),
          )
          // 尚未綁定 LLM 時不在這裡 toast，改由 Chat 顯示引導橫幅（見 chat-input）
          if (!(e instanceof ApiError && e.code === LLM_NOT_CONFIGURED)) {
            toast({
              title: '回覆失敗',
              description: e instanceof Error ? e.message : '發生未知錯誤',
              variant: 'destructive',
            })
          }
        }
      } finally {
        setStreaming(null, null)
      }
    },
    // qc 經由 setMessageCache 間接使用（該 callback 已依賴 qc）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, setMessageCache, setStreaming],
  )

  /** 重新生成最後一則 AI 回覆 */
  const regenerateLast = useCallback(
    (conversationId: string) => {
      const msgs = qc.getQueryData<{ items: Message[] }>(keys.messages(conversationId))?.items ?? []
      const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
      if (!lastAssistant || !lastUser) return
      // 沿用該對話的學科，讓重新生成的回覆仍被正確標註
      const conversations = qc.getQueryData<Conversation[]>(keys.conversations) ?? []
      const subjectId = conversations.find((c) => c.id === conversationId)?.tagId
      // 移除尾端 AI 訊息後以其前的用戶訊息重新生成
      void sendMessage(conversationId, lastUser.content, lastUser.attachments ?? [], lastAssistant.id, subjectId)
    },
    // qc / sendMessage 皆被使用；sendMessage 的依賴已包含 qc
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return {
    sendMessage,
    regenerateLast,
    submitFeedback,
    stopStreaming,
    isStreaming: !!streamingMessageId,
    /** 最近一次串流失敗的錯誤碼；清除後可再觸發 */
    lastError,
    clearError: () => setLastError(null),
  }
}

/** 查詢快取中的訊息（供匯出 TXT 使用，不觸發請求） */
export function useCachedMessages(conversationId: string | null): Message[] {
  const qc = useQueryClient()
  if (!conversationId) return []
  return qc.getQueryData<{ items: Message[] }>(keys.messages(conversationId))?.items ?? []
}

export type { Conversation, Message }
