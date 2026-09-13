import { Suspense } from 'react'
import { SettingsContent, SettingsHeader, SettingsSkeleton } from './settings-client'

/**
 * 設置頁（Server 入口）
 * ============================================================
 * 入口區塊「預設全部收合」，不會自動展開。
 * 只有從 Chat 以 ?entry=<key> 跳轉過來時（例如尚未綁定 LLM 的引導），
 * 才自動展開指定的那個區塊 —— 這裡在 server 端讀 searchParams 後
 * 以 initialEntry 傳給 Client 元件，SSR 輸出就是展開狀態。
 */

export const dynamic = 'force-dynamic'

type EntryKey = 'llm' | 'clear' | 'about' | 'storage'

function toEntryKey(value: string | string[] | undefined): EntryKey | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'llm' || raw === 'clear' || raw === 'about' || raw === 'storage' ? raw : null
}

interface PageProps {
  searchParams?: { entry?: string | string[] }
}

export default function SettingsPage({ searchParams }: PageProps) {
  const initialEntry = toEntryKey(searchParams?.entry)

  return (
    <>
      <SettingsHeader />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent initialEntry={initialEntry} />
      </Suspense>
    </>
  )
}
