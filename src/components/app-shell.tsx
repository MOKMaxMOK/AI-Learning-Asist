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
