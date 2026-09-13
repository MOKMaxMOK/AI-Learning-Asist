/**
 * LLM 綁定設定的讀寫與模型建立
 * ============================================================
 * 金鑰來源「只有一個」：使用者在「設置 → LLM 綁定」介面輸入，
 * 存進本地 SQLite（llm_bindings 表）。這裡不讀取任何環境變數、
 * 也沒有任何硬編碼金鑰。
 *
 * API Key 不會回傳給前端明文，只回傳遮蔽值（例：sk-aa21****5a76）。
 */

import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { findProvider, type LlmProviderId } from './providers'
import { getActiveBinding, maskApiKey, type LlmBindingRecord } from './bindings'

export interface LlmConfig {
  provider: LlmProviderId
  apiKey: string
  model: string
  baseUrl: string
  /** 綁定的顯示名稱：備註 + 模型名稱 */
  label: string
  bindingId: string
}

/** 沒有綁定任何模型時的錯誤訊息 */
export const NO_BINDING_MESSAGE =
  '尚未綁定任何模型，請先到「設置 → LLM 綁定」輸入 API Key 與模型名稱。'

/**
 * 取得目前使用中的 LLM 設定。
 * 沒有任何綁定時回傳 null（呼叫端需處理，不要偽造預設值）。
 */
export function resolveLlmConfig(): LlmConfig | null {
  const binding = getActiveBinding()
  if (!binding) return null
  return bindingToConfig(binding)
}

export function bindingToConfig(binding: LlmBindingRecord): LlmConfig {
  const meta = findProvider(binding.provider)
  return {
    provider: binding.provider,
    apiKey: binding.apiKey,
    model: binding.model,
    baseUrl: binding.baseUrl || meta?.baseUrl || '',
    label: bindingLabel(binding.remark, binding.model),
    bindingId: binding.id,
  }
}

/** 顯示名稱：有備註時「備註 + 模型名稱」，沒有備註時只顯示模型名稱 */
export function bindingLabel(remark: string, model: string): string {
  const trimmed = (remark ?? '').trim()
  return trimmed ? `${trimmed}（${model}）` : model
}

/** 目前綁定狀態（給前端顯示；金鑰遮蔽） */
export interface LlmActiveBindingPublic {
  id: string
  provider: LlmProviderId
  providerLabel: string
  remark: string
  model: string
  baseUrl: string
  apiKeyMasked: string
  /** 備註 + 模型名稱 */
  label: string
}

/**
 * 檢查設定是否可用，回傳錯誤訊息或 null。
 * config 為 null 代表尚未綁定。
 */
export function validateLlmConfig(config: LlmConfig | null): string | null {
  if (!config) return NO_BINDING_MESSAGE
  if (!config.apiKey) return '這筆綁定沒有 API Key，請重新輸入。'
  if (!config.model) return '這筆綁定沒有模型名稱，請輸入官方模型 id。'
  if (!config.baseUrl) return '這筆綁定沒有 Base URL（自訂廠商必填）。'
  return null
}

/** 依綁定建立 Vercel AI SDK 的語言模型 */
export function createLanguageModel(config?: LlmConfig | null): LanguageModel {
  const resolved = config === undefined ? resolveLlmConfig() : config
  const problem = validateLlmConfig(resolved ?? null)
  if (problem || !resolved) throw new Error(problem ?? NO_BINDING_MESSAGE)

  const client = createOpenAI({
    apiKey: resolved.apiKey,
    baseURL: resolved.baseUrl,
  })
  // 一律走 /chat/completions，這是各廠商 OpenAI 相容端點的共同子集
  return client.chat(resolved.model)
}

export { maskApiKey }
