import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { errorResponse, handleRouteError, json, readJson } from '@/lib/server/http'
import { referencedUploadFiles, resetData, type ResetSummary } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/reset
 * ============================================================
 * 清除本機儲存的資料（設置 → 清除設定）。
 * Body：
 *   { chat: boolean,        // 對話與訊息
 *     analysis: boolean,    // 知識點 / 錯題 / 學習時間 / 每日清單
 *     llm: boolean,         // LLM 綁定與設定
 *     files: boolean }      // 一併刪除 data/uploads 內的實體檔案
 *
 * 學科（中文 / English / 數學）為系統基礎資料，一律保留。
 * → { ok, summary }（summary 為各表實際刪除的筆數）
 */

const resetSchema = z.object({
  chat: z.boolean().optional().default(false),
  analysis: z.boolean().optional().default(false),
  llm: z.boolean().optional().default(false),
  files: z.boolean().optional().default(false),
})

export async function POST(req: Request) {
  try {
    const parsed = resetSchema.safeParse(await readJson<unknown>(req))
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '內容不合法')
    }
    const body = parsed.data
    if (!body.chat && !body.analysis && !body.llm && !body.files) {
      return errorResponse(400, 'NOTHING_SELECTED', '請至少選擇一項要清除的內容')
    }

    const summary: ResetSummary = resetData({
      chat: body.chat,
      analysis: body.analysis,
      llm: body.llm,
      files: false,
    })

    /* 刪除磁碟上的附件（只刪沒有被任何訊息引用的檔案，避免勾選項目互相影響） */
    if (body.files) {
      summary.files = deleteUnreferencedUploads()
    }

    return json({ ok: true, summary })
  } catch (e) {
    return handleRouteError(e)
  }
}

/** 刪除 data/uploads 內沒有被任何訊息引用的檔案 */
function deleteUnreferencedUploads(): number {
  const dir = path.join(process.cwd(), 'data', 'uploads')
  if (!fs.existsSync(dir)) return 0

  const referenced = referencedUploadFiles()
  let removed = 0

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (referenced.has(entry.name)) continue
    try {
      fs.unlinkSync(path.join(dir, entry.name))
      removed += 1
    } catch {
      /* 檔案被鎖定時略過，不影響其他檔案 */
    }
  }
  return removed
}
