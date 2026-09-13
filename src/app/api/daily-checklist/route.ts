import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { getDailyChecklist, getWeeklyChecklist } from '@/lib/server/analytics'
import { getRawDb } from '@/lib/db'
import { localDay } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeDate(value: string | null): string {
  if (!value) return localDay()
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : localDay()
}

/**
 * GET /api/daily-checklist?date=YYYY-MM-DD
 *   預設：單日清單 + 建議複習知識點
 *   week=1：該日期所屬那一週（週一 → 週日）的每日清單
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const date = normalizeDate(url.searchParams.get('date'))
    if (url.searchParams.get('week') === '1') {
      return json(getWeeklyChecklist(date))
    }
    return json(getDailyChecklist(date))
  } catch (e) {
    return handleRouteError(e)
  }
}

/** POST /api/daily-checklist { date?, content, knowledgePointId? } → 新增清單項 */
export async function POST(req: Request) {
  try {
    const body = await readJson<{
      date?: string
      content?: string
      knowledgePointId?: string
      subjectId?: string
    }>(req)

    const content = body.content?.trim()
    if (!content) return errorResponse(400, 'EMPTY_CONTENT', '請輸入清單內容')
    if (content.length > 200) return errorResponse(400, 'CONTENT_TOO_LONG', '清單內容最多 200 字')

    const date = normalizeDate(body.date ?? null)
    const db = getRawDb()

    const max = db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM daily_checklist WHERE date = ?`)
      .get(date) as { m: number }

    const id = `chk_${crypto.randomUUID()}`
    db.prepare(
      `INSERT INTO daily_checklist (id, date, content, done, kind, knowledge_point_id, subject_id, sort_order)
       VALUES (?, ?, ?, 0, 'manual', ?, ?, ?)`,
    ).run(
      id,
      date,
      content,
      body.knowledgePointId ?? null,
      body.subjectId ?? null,
      Number(max?.m ?? 0) + 1,
    )

    // 回傳單一清單項（前端契約）；清單整體由 GET 重新取得
    return json(
      {
        id,
        content,
        done: false,
        knowledgePointId: body.knowledgePointId ?? undefined,
        subjectId: body.subjectId ?? undefined,
        order: Number(max?.m ?? 0) + 1,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    )
  } catch (e) {
    return handleRouteError(e)
  }
}
