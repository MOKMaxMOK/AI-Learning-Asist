import { z } from 'zod'
import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { providerCatalog } from '@/lib/llm/providers'
import {
  createBinding,
  deleteBinding,
  getActiveBindingId,
  listBindingsPublic,
  setActiveBindingId,
  updateBinding,
} from '@/lib/llm/bindings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * LLM 綁定（可多筆）
 * ============================================================
 * GET    /api/settings/llm            目前使用中的綁定 + 全部綁定 + 廠商目錄
 * POST   /api/settings/llm            新增綁定（備註 / 廠商 / 模型 / Base URL / API Key）
 * PATCH  /api/settings/llm            切換使用中的綁定 { activeId }
 *                                     或更新綁定 { id, remark?, model?, baseUrl?, apiKey? }
 * DELETE /api/settings/llm?id=xxx     刪除綁定（未帶 id 時刪除使用中的綁定）
 *
 * 金鑰一律遮蔽後回傳，不回傳明文。
 */

const createSchema = z.object({
  provider: z.enum([
    'openai',
    'anthropic',
    'google',
    'deepseek',
    'qwen',
    'glm',
    'kimi',
    'grok',
    'custom',
  ]),
  remark: z.string().trim().max(60, '備註最多 60 個字').optional().default(''),
  model: z.string().trim().min(1, '請輸入模型名稱（官方模型 id）').max(120),
  baseUrl: z.string().trim().max(400).optional().default(''),
  apiKey: z.string().trim().min(1, '請輸入 API Key').max(400),
})

const patchSchema = z.object({
  id: z.string().trim().optional(),
  activeId: z.string().trim().optional(),
  remark: z.string().trim().max(60, '備註最多 60 個字').optional(),
  model: z.string().trim().max(120).optional(),
  baseUrl: z.string().trim().max(400).optional(),
  apiKey: z.string().trim().max(400).optional(),
})

function payload() {
  const activeId = getActiveBindingId()
  const bindings = listBindingsPublic()
  return {
    activeId,
    /** 目前使用中的那筆（沒有綁定時為 null） */
    active: bindings.find((b) => b.id === activeId) ?? null,
    bindings,
    providers: providerCatalog(),
  }
}

/** GET /api/settings/llm */
export async function GET() {
  try {
    return json(payload())
  } catch (e) {
    return handleRouteError(e)
  }
}

/** POST /api/settings/llm → 新增綁定 */
export async function POST(req: Request) {
  try {
    const parsed = createSchema.safeParse(await readJson<unknown>(req))
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '綁定內容不合法')
    }
    const body = parsed.data

    const meta = providerCatalog().find((p) => p.id === body.provider)
    const baseUrl = (body.baseUrl || meta?.baseUrl || '').trim()
    if (!baseUrl) return errorResponse(400, 'MISSING_BASE_URL', '請輸入 Base URL（自訂廠商必填）')

    const created = createBinding({
      provider: body.provider,
      remark: body.remark ?? '',
      model: body.model,
      baseUrl,
      apiKey: body.apiKey,
    })

    return json({ createdId: created.id, ...payload() }, { status: 201 })
  } catch (e) {
    return handleRouteError(e)
  }
}

/** PATCH /api/settings/llm → 切換使用中 / 更新綁定內容 */
export async function PATCH(req: Request) {
  try {
    const parsed = patchSchema.safeParse(await readJson<unknown>(req))
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '內容不合法')
    }
    const body = parsed.data

    // 只切換使用中的綁定
    if (body.activeId && !body.id) {
      const exists = listBindingsPublic().some((b) => b.id === body.activeId)
      if (!exists) return errorResponse(404, 'BINDING_NOT_FOUND', '找不到這筆綁定')
      setActiveBindingId(body.activeId)
      return json(payload())
    }

    if (!body.id) return errorResponse(400, 'MISSING_ID', '請提供要更新的綁定 id')

    const updated = updateBinding(body.id, {
      remark: body.remark,
      model: body.model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    })
    if (!updated) return errorResponse(404, 'BINDING_NOT_FOUND', '找不到這筆綁定')
    return json(payload())
  } catch (e) {
    return handleRouteError(e)
  }
}

/** DELETE /api/settings/llm?id=xxx → 刪除綁定（未帶 id 時刪除使用中的綁定） */
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = url.searchParams.get('id') ?? getActiveBindingId()
    if (!id) return errorResponse(404, 'BINDING_NOT_FOUND', '目前沒有可刪除的綁定')

    const removed = deleteBinding(id)
    if (!removed) return errorResponse(404, 'BINDING_NOT_FOUND', '找不到這筆綁定')
    return json(payload())
  } catch (e) {
    return handleRouteError(e)
  }
}
