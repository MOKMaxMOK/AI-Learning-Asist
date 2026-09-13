import { Suspense } from 'react'
import { BarChart3 } from 'lucide-react'
import { AnalyzeClient } from './analyze-client'

/**
 * Analyze 板塊（Server 入口）
 *
 * 實際 UI 在 analyze-client.tsx；這裡只負責提供 Suspense 邊界 ——
 * Client 元件使用了 useSearchParams()（保存一級 / 二級 / 三級導覽狀態），
 * 沒有 Suspense 邊界時 production build 的靜態預渲染會直接失敗。
 */
export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:px-4">
            <BarChart3 className="size-5 shrink-0 text-primary" />
            <h1 className="text-sm font-semibold">分析</h1>
          </header>
          <div className="flex-1 overflow-y-auto nice-scroll">
            <div className="mx-auto max-w-5xl px-4 py-6">
              <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[86px] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            </div>
          </div>
        </>
      }
    >
      <AnalyzeClient />
    </Suspense>
  )
}
