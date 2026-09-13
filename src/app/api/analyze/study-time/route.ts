import { ApiError } from '@/lib/api/client'
import { errorResponse, handleRouteError, json } from '@/lib/server/http'
import { getStudyTimeTimeline } from '@/lib/server/analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/analyze/study-time?granularity=week|month|year → 學習時間柱形圖 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const granularity = (url.searchParams.get('granularity') ?? 'week') as string
    if (!['week', 'month', 'year'].includes(granularity)) {
      return errorResponse(400, 'INVALID_GRANULARITY', 'granularity 必須是 week / month / year')
    }
    return json(getStudyTimeTimeline(granularity as 'week' | 'month' | 'year'))
  } catch (e) {
    if (e instanceof ApiError) return handleRouteError(e)
    return handleRouteError(e)
  }
}
