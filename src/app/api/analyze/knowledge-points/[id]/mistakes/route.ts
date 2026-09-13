import { errorResponse, handleRouteError, json } from '@/lib/server/http'
import { getMistakeStats } from '@/lib/server/analytics'
import { findKnowledgePointById, findSubjectById } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/** GET /api/analyze/knowledge-points/:id/mistakes?subjectId=&limit= → 錯題統計 + 類型排行 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const kp = findKnowledgePointById(params.id)
    if (!kp) return errorResponse(404, 'KNOWLEDGE_POINT_NOT_FOUND', '找不到這個知識點')

    const url = new URL(req.url)
    const limitRaw = url.searchParams.get('limit')
    const subject = findSubjectById(kp.subjectId)

    return json(
      getMistakeStats(
        {
          id: kp.id,
          name: kp.name,
          subjectId: kp.subjectId,
          subjectName: subject?.name ?? null,
        },
        { limit: limitRaw ? Number(limitRaw) : undefined },
      ),
    )
  } catch (e) {
    return handleRouteError(e)
  }
}
