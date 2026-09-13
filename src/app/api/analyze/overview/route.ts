import { handleRouteError, json } from '@/lib/server/http'
import { getOverview } from '@/lib/server/analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/analyze/overview?subjectId= → 學科分析總覽（圓餅圖 + 首頁摘要） */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const subjectId = url.searchParams.get('subjectId') ?? url.searchParams.get('tagId') ?? undefined
    return json(getOverview(subjectId ?? undefined))
  } catch (e) {
    return handleRouteError(e)
  }
}
