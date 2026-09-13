/**
 * AI 回覆標註抽取
 * ============================================================
 * 一則 AI 回覆完成後，會被標上：學科 / 知識點 / 錯題 / 學習型態 / 學習秒數，
 * 這些標註就是 Analyze 板塊全部統計的資料來源。
 *
 * 兩條路徑：
 *   1) LLM 抽取（主要）：請模型回傳嚴格 JSON；解析失敗則走 2)
 *   2) 本地推估（fallback）：以對話的學科 + 回覆長度推估學習型態與秒數，
 *      知識點用中文／英文名詞短語的最小規則抽取，錯題用題目字樣偵測。
 *      → 這不是假資料，而是沒有可用模型時的降級行為，UI 會標示來源。
 */

import { generateText } from 'ai'
import {
  createLanguageModel,
  resolveLlmConfig,
  validateLlmConfig,
  type LlmConfig,
} from '@/lib/llm/client'
import type { MessageAnnotation, StudyType } from '@/lib/types'

export interface AnnotationContext {
  /** 對話所屬學科（後備值） */
  subjectId: string
  subjectName: string
  userMessage: string
  assistantMessage: string
  /** 已有知識點名稱，協助模型沿用一致命名 */
  knownKnowledgePoints: string[]
}

const SYSTEM_PROMPT = `你是一個教育資料標註器。使用者（學生）與 AI 老師的一段對話結束後，
你要輸出這段對話的結構化標註，供學習分析系統統計。只輸出 JSON，不要任何說明文字。

JSON 格式：
{
  "subjectName": "學科名稱（中文/English/數學 等，沿用候選學科）",
  "knowledgePoints": [{ "name": "知識點名稱（精簡、可重用，2-12 字）" }],
  "mistakes": [
    {
      "type": "錯題類型，從這些選：計算錯誤/觀念不清/審題錯誤/公式記錯/語法錯誤/拼寫錯誤/單字量不足/閱讀理解/表達不清/其他",
      "question": "學生答錯的題目或片段（若無則省略）",
      "correction": "正確答案或提醒（精簡）",
      "knowledgePointName": "對應的知識點名稱"
    }
  ],
  "studyType": "learn 或 review 或 practice",
  "studySeconds": 整數，這段對話估計花費的學習秒數（依內容長度合理估計，60-900）
}

規則：
- 只有在學生確實出現錯誤、答錯、或 AI 明確指出其理解有誤時才放進 mistakes；沒有就給空陣列。
- knowledgePoints 只放這段對話真正涉及的重點，1-4 個。
- 若不確定，寧可少放，不要編造。`

interface RawAnnotation {
  subjectName?: string
  knowledgePoints?: Array<{ name?: string }>
  mistakes?: Array<{
    type?: string
    question?: string
    correction?: string
    knowledgePointName?: string
  }>
  studyType?: string
  studySeconds?: number
}

export interface AnnotationResult {
  annotation: MessageAnnotation
  source: 'llm' | 'heuristic'
  /** 抽取失敗原因（僅供 log / 診斷，不外洩金鑰） */
  warning?: string
}

/** 主入口：先試 LLM，失敗則本地推估（永不 throw） */
export async function extractAnnotation(ctx: AnnotationContext): Promise<AnnotationResult> {
  const cfg = resolveLlmConfig()
  const problem = validateLlmConfig(cfg)
  if (!problem && cfg) {
    try {
      const raw = await callLlm(ctx, cfg)
      if (raw) return { annotation: normalize(raw, ctx), source: 'llm' }
      return {
        annotation: heuristicAnnotation(ctx),
        source: 'heuristic',
        warning: 'LLM 回覆無法解析為 JSON，改用本地推估',
      }
    } catch (e) {
      return {
        annotation: heuristicAnnotation(ctx),
        source: 'heuristic',
        warning: e instanceof Error ? e.message : 'LLM 標註失敗',
      }
    }
  }
  return {
    annotation: heuristicAnnotation(ctx),
    source: 'heuristic',
    warning: problem ?? '尚未綁定模型',
  }
}

async function callLlm(ctx: AnnotationContext, config: LlmConfig): Promise<RawAnnotation | null> {
  const languageModel = createLanguageModel(config)
  const known = ctx.knownKnowledgePoints.slice(0, 40)

  const { text } = await generateText({
    model: languageModel,
    system: SYSTEM_PROMPT,
    prompt: [
      `目前對話的學科：${ctx.subjectName}`,
      known.length ? `這個學科已存在的知識點（盡量沿用相同名稱）：${known.join('、')}` : '',
      '',
      '=== 學生 ===',
      ctx.userMessage,
      '',
      '=== AI 老師 ===',
      ctx.assistantMessage,
      '',
      `（模型：${config.model}）請輸出 JSON。`,
    ]
      .filter(Boolean)
      .join('\n'),
    temperature: 0,
    maxRetries: 0,
  })

  const parsed = parseJsonLoose(text)
  return parsed
}

/** 模型有時會加上 ```json 或前後說明，這裡做寬鬆解析 */
function parseJsonLoose(text: string): RawAnnotation | null {
  if (!text) return null
  const cleaned = text.replace(/```json/gi, '```').trim()
  const fenced = cleaned.match(/```([\s\S]*?)```/)
  const candidates = [fenced?.[1], cleaned]
  for (const candidate of candidates) {
    if (!candidate) continue
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) continue
    try {
      return JSON.parse(candidate.slice(start, end + 1)) as RawAnnotation
    } catch {
      /* 換下一個候選 */
    }
  }
  return null
}

function normalize(raw: RawAnnotation, ctx: AnnotationContext): MessageAnnotation {
  const studyType: StudyType =
    raw.studyType === 'review' || raw.studyType === 'practice' || raw.studyType === 'learn'
      ? raw.studyType
      : 'learn'

  const kps = (raw.knowledgePoints ?? [])
    .map((k) => sanitizeName(k.name))
    .filter((n): n is string => !!n)
    .slice(0, 6)
    .map((name) => ({ id: `tmp_${name}`, name }))

  const mistakes = (raw.mistakes ?? [])
    .map((m, i) => ({
      id: `tmp_mis_${i}`,
      type: (m.type ?? '其他').trim() || '其他',
      question: m.question?.trim() || undefined,
      correction: m.correction?.trim() || undefined,
      knowledgePointName: sanitizeName(m.knowledgePointName) ?? undefined,
    }))
    .slice(0, 8)

  const seconds = clampSeconds(raw.studySeconds ?? estimateSeconds(ctx))

  return {
    subjectId: ctx.subjectId,
    subjectName: sanitizeName(raw.subjectName) ?? ctx.subjectName,
    knowledgePoints: kps.length ? kps : undefined,
    mistakes: mistakes.length ? mistakes : undefined,
    studyType,
    studySeconds: seconds,
  }
}

/* ============================================================
 * 本地推估（fallback，無 LLM 時仍可運作）
 * ============================================================ */

function estimateSeconds(ctx: AnnotationContext): number {
  // 以字數推估：學生訊息 3 字 ≈ 1 秒；AI 回覆 12 字 ≈ 1 秒
  const userPart = ctx.userMessage.length / 3
  const aiPart = ctx.assistantMessage.length / 12
  const total = Math.round(userPart + aiPart)
  return Math.max(30, Math.min(900, total))
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 60
  return Math.max(15, Math.min(3600, Math.round(value)))
}

/** 抽取「」（引號）或 中英名詞短語 作為知識點候選 */
function heuristicKnowledgePoints(text: string): string[] {
  const found = new Set<string>()
  // 1) 明確被引號或書名號標出的名詞
  for (const m of text.matchAll(/[「《【]([^」》】\n]{2,16})[」》】]/g)) {
    const name = sanitizeName(m[1])
    if (name) found.add(name)
  }
  // 2) 常見「XX 的 YY」/「YY 定理/公式/文法/單字」等學科專有名詞尾綴
  for (const m of text.matchAll(
    /([\u4e00-\u9fa5A-Za-z0-9]{2,12}(?:定理|公式|文法|句型|單字|詞彙|方程式|函數|定律|規則|概念|題型))/g,
  )) {
    const name = sanitizeName(m[1])
    if (name) found.add(name)
  }
  return [...found].slice(0, 4)
}

function heuristicMistakes(text: string): MessageAnnotation['mistakes'] {
  const markers = ['答錯', '錯了', '不正確', '有誤', '誤解', '算錯', '拼錯', '寫錯', '再想想', '不對']
  if (!markers.some((m) => text.includes(m))) return undefined
  return [
    {
      id: 'tmp_heuristic_0',
      type: '觀念不清',
      question: undefined,
      correction: undefined,
    },
  ]
}

function heuristicAnnotation(ctx: AnnotationContext): MessageAnnotation {
  const kps = heuristicKnowledgePoints(`${ctx.userMessage}\n${ctx.assistantMessage}`)
  return {
    subjectId: ctx.subjectId,
    subjectName: ctx.subjectName,
    knowledgePoints: kps.length ? kps.map((name) => ({ id: `tmp_${name}`, name })) : undefined,
    mistakes: heuristicMistakes(ctx.assistantMessage),
    studyType: /複習|review/i.test(ctx.userMessage) ? 'review' : /練習|題|exercise/i.test(ctx.userMessage) ? 'practice' : 'learn',
    studySeconds: estimateSeconds(ctx),
  }
}

function sanitizeName(value: string | undefined | null): string | null {
  if (!value) return null
  const name = value.trim().replace(/^[\s\-–—・、,，。.]+|[\s\-–—・、,，。.]+$/g, '')
  if (name.length < 2 || name.length > 24) return null
  return name
}
