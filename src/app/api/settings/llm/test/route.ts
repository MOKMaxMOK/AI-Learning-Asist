import { generateText } from 'ai'
import { errorResponse, json, readJson } from '@/lib/server/http'
import { createLanguageModel, resolveLlmConfig, validateLlmConfig, type LlmConfig } from '@/lib/llm/client'
import { findBindingRecord } from '@/lib/llm/bindings'
import { findProvider, type LlmProviderId } from '@/lib/llm/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** LLM 呼叫可能較久 */
export const maxDuration = 60

/**
 * POST /api/settings/llm/test
 * Body（全部可選）：
 *   { bindingId }                        → 測試已儲存的某筆綁定
 *   { provider, apiKey, model, baseUrl } → 測試尚未儲存的設定（先測試再儲存）
 * 未帶參數時測試「目前使用中」的綁定。
 * → { ok, latencyMs, provider, model, reply?, error? }
 */
export async function POST(req: Request) {
  const started = Date.now()
  try {
    const body = await readJson<{
      bindingId?: string
      provider?: LlmProviderId
      apiKey?: string
      model?: string
      baseUrl?: string
    }>(req).catch(() => ({}) as Record<string, never>)

    let config: LlmConfig | null = null

    if (body.bindingId) {
      const record = findBindingRecord(body.bindingId)
      if (!record) return errorResponse(404, 'BINDING_NOT_FOUND', '找不到這筆綁定')
      const meta = findProvider(record.provider)
      config = {
        provider: record.provider,
        apiKey: record.apiKey,
        model: record.model,
        baseUrl: record.baseUrl || meta?.baseUrl || '',
        label: record.model,
        bindingId: record.id,
      }
    } else if (body.provider || body.model || body.apiKey) {
      // 先測試再儲存：未提供的欄位從使用中的綁定補齊
      const active = resolveLlmConfig()
      const provider = body.provider ?? active?.provider ?? 'custom'
      const meta = findProvider(provider)
      config = {
        provider,
        apiKey: body.apiKey?.trim() || active?.apiKey || '',
        model: (body.model?.trim() || active?.model || meta?.defaultModel || '').trim(),
        baseUrl: (body.baseUrl?.trim() || meta?.baseUrl || '').replace(/\/+$/, ''),
        label: body.model ?? '',
        bindingId: active?.bindingId ?? '',
      }
    } else {
      config = resolveLlmConfig()
    }

    const problem = validateLlmConfig(config)
    if (problem || !config) {
      return json({ ok: false, latencyMs: Date.now() - started, error: problem }, { status: 200 })
    }

    const model = createLanguageModel(config)
    const { text, usage } = await generateText({
      model,
      prompt: '請只回覆兩個字：正常',
      temperature: 0,
      maxRetries: 0,
      maxOutputTokens: 512,
    })

    const reply = (text ?? '').trim()
    if (!reply) {
      return json({
        ok: false,
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - started,
        reply: '',
        error: '模型沒有回傳文字內容（可能只回傳 reasoning，或模型名稱不正確）',
        usage,
      })
    }

    return json({
      ok: true,
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      latencyMs: Date.now() - started,
      reply: reply.slice(0, 200),
      usage,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : '連線測試失敗'
    return json({ ok: false, latencyMs: Date.now() - started, error: message }, { status: 200 })
  }
}
