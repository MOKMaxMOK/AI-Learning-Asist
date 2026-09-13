'use client'

import { create } from 'zustand'

/** 全局面對話框類型 */
export type DialogType =
  | 'new-chat'
  | 'rename'
  | 'change-subject'
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
