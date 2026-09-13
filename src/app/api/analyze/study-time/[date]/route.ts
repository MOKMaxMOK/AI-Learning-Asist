import { errorResponse, handleRouteError, json } from '@/lib/server/http'
import { getStudyTimeDetail } from '@/lib/server/analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { date: string } }

/** GET /api/analyze/study-time/:date（YYYY-MM-DD 或 YYYY-MM）→ 當日明細 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const date = decodeURIComponent(params.date)
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date)) {
      return errorResponse(400, 'INVALID_DATE', '日期格式必須是 YYYY-MM-DD 或 YYYY-MM')
    }
    return json(getStudyTimeDetail(date))
  } catch (e) {
    return handleRouteError(e)
  }
}
