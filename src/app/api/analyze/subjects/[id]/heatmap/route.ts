import { errorResponse, handleRouteError, json } from '@/lib/server/http'
import { getHeatmap } from '@/lib/server/analytics'
import { findSubjectById } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/** GET /api/analyze/subjects/:id/heatmap → 該學科的知識點熱力圖 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const subject = findSubjectById(params.id)
    if (!subject) return errorResponse(404, 'SUBJECT_NOT_FOUND', '找不到這個學科')
    return json(getHeatmap({ id: subject.id, name: subject.name }))
  } catch (e) {
    return handleRouteError(e)
  }
}
