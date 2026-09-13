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
          {/* 學科（點擊更改） */}
          {conversation.tag && (
            <TagChip active onClick={() => openDialog('change-subject', { conversation })}>
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
            <DropdownMenuItem onClick={() => openDialog('change-subject', { conversation })}>
              <TagIcon />
              更改學科
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
