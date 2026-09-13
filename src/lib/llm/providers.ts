/**
 * LLM 供應商註冊表
 * ============================================================
 * 全部走 OpenAI 相容的 /chat/completions 協議（Vercel AI SDK 的
 * createOpenAI + baseURL），因此 GPT / Claude / Gemini / DeepSeek /
 * Qwen / GLM / Kimi / Grok 都可以用同一條路徑接入，也支援自訂 Base URL。
 *
 * 模型名稱一律「跟隨官方名稱」（即官方 API 的 model id），
 * 這裡列出的清單依各廠商官方文件核對，並附上官方文件連結：
 *   DeepSeek  https://api-docs.deepseek.com/quick_start/pricing
 *   OpenAI    https://platform.openai.com/docs/models
 *   Anthropic https://docs.anthropic.com/en/docs/about-claude/models
 *   Google    https://ai.google.dev/gemini-api/docs/models
 *   Qwen      https://www.alibabacloud.com/help/en/model-studio/models
 *   GLM       https://docs.z.ai/guides/overview/pricing
 *   Kimi      https://platform.kimi.com/docs/models
 *   Grok      https://docs.x.ai/docs/models
 *
 * 使用者在介面上直接輸入官方文件中的模型 id（介面不提供快捷選擇）。
 */

export type LlmProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'glm'
  | 'kimi'
  | 'grok'
  | 'custom'

export interface LlmProviderMeta {
  id: LlmProviderId
  /** 顯示名稱 */
  label: string
  /** 預設 Base URL（OpenAI 相容端點） */
  baseUrl: string
  /** 目前官方可用的模型 id（與官方文件一致，僅作為提示） */
  models: string[]
  /** 預設模型 */
  defaultModel: string
  /** 申請 API Key 的頁面 */
  keyUrl?: string
  /** 官方模型文件（使用者要查最新名稱時看這裡） */
  docsUrl?: string
  /** 是否需要使用者自行填 Base URL */
  requiresBaseUrl?: boolean
  /** Base URL 可否修改 */
  editableBaseUrl: boolean
}

export const LLM_PROVIDERS: LlmProviderMeta[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-v4-pro',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    editableBaseUrl: true,
  },
  {
    id: 'openai',
    label: 'GPT（OpenAI）',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.6', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.5', 'gpt-5.5-pro'],
    defaultModel: 'gpt-5.6',
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs/models',
    editableBaseUrl: true,
  },
  {
    id: 'anthropic',
    label: 'Claude（Anthropic）',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-opus-5',
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
    ],
    defaultModel: 'claude-sonnet-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    editableBaseUrl: true,
  },
  {
    id: 'google',
    label: 'Gemini（Google）',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ],
    defaultModel: 'gemini-3.8-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    editableBaseUrl: true,
  },
  {
    id: 'qwen',
    label: 'Qwen（阿里雲百鍊）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.8-max', 'qwen3.8-flash', 'qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-flash'],
    defaultModel: 'qwen3.8-max',
    keyUrl: 'https://bailian.console.aliyun.com/',
    docsUrl: 'https://www.alibabacloud.com/help/en/model-studio/models',
    editableBaseUrl: true,
  },
  {
    id: 'glm',
    label: 'GLM（智譜 Z.ai）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.3', 'glm-5.3-flash', 'glm-5.2', 'glm-5.1', 'glm-5', 'glm-4.7'],
    defaultModel: 'glm-5.3',
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    docsUrl: 'https://docs.z.ai/guides/overview/pricing',
    editableBaseUrl: true,
  },
  {
    id: 'kimi',
    label: 'Kimi（Moonshot）',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6'],
    defaultModel: 'kimi-k3',
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    docsUrl: 'https://platform.kimi.com/docs/models',
    editableBaseUrl: true,
  },
  {
    id: 'grok',
    label: 'Grok（xAI）',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4.6', 'grok-4.5', 'grok-4.3'],
    defaultModel: 'grok-4.6',
    keyUrl: 'https://console.x.ai/',
    docsUrl: 'https://docs.x.ai/docs/models',
    editableBaseUrl: true,
  },
  {
    id: 'custom',
    label: '自訂（OpenAI 相容 Base URL）',
    baseUrl: '',
    models: [],
    defaultModel: '',
    requiresBaseUrl: true,
    editableBaseUrl: true,
  },
]

export function findProvider(id: string | null | undefined): LlmProviderMeta | undefined {
  if (!id) return undefined
  return LLM_PROVIDERS.find((p) => p.id === id)
}

/** 供應商清單（給前端設置頁面用，不含任何金鑰） */
export function providerCatalog() {
  return LLM_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    baseUrl: p.baseUrl,
    models: p.models,
    defaultModel: p.defaultModel,
    keyUrl: p.keyUrl ?? null,
    docsUrl: p.docsUrl ?? null,
    requiresBaseUrl: !!p.requiresBaseUrl,
    editableBaseUrl: p.editableBaseUrl,
  }))
}

export type ProviderCatalogItem = ReturnType<typeof providerCatalog>[number]
