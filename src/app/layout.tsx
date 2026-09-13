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
