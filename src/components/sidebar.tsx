 'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Plus,
  Settings,
  Sprout,
  Trash2,
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
              UI
            </span>
          </button>
          <p className="mt-1 px-2 text-xs leading-relaxed text-muted-foreground">
            學科分析、學習時間與每日清單，資料來自 Chat 的學科與 AI 標註。
          </p>
        </div>
      </div>

      {/* 底部：設置（LLM 綁定） */}
      <div className="border-t px-3 py-2">
        <button
          type="button"
          onClick={() => go('/settings')}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            pathname === '/settings'
              ? 'bg-primary-soft text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Settings className="size-4" />
          設置
          <ChevronRight className="ml-auto size-4 opacity-60" />
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
