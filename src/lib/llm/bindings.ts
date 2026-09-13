/**
 * LLM 綁定儲存（可多筆）
 * ============================================================
 * 使用者在「設置 → LLM 綁定」介面輸入的每一組設定都會存成一筆綁定：
 *   備註 + 官方模型名稱 + 廠商 + Base URL + API Key
 * 儲存區塊以「備註 + 模型名稱」顯示，可刪除、可切換使用中。
 *
 * 金鑰只存在本地 SQLite，對外一律遮蔽（maskApiKey）。
 * 沒有任何環境變數或硬編碼金鑰。
 */

import { getRawDb } from '@/lib/db'
import { findProvider, type LlmProviderId } from './providers'

/* ---------------- 型別 ---------------- */

export interface LlmBindingRecord {
  id: string
  provider: LlmProviderId
  remark: string
  model: string
  baseUrl: string
  apiKey: string
  createdAt: string
  updatedAt: string
}

/** 對外（前端）可見的綁定，金鑰已遮蔽 */
export interface LlmBindingPublic {
  id: string
  provider: LlmProviderId
  providerLabel: string
  remark: string
  model: string
  baseUrl: string
  apiKeyMasked: string
  createdAt: string
  updatedAt: string
  /** 是否為目前使用中的綁定 */
  isActive: boolean
}

const ACTIVE_KEY = 'llm.activeBindingId'

/* ---------------- 讀取 ---------------- */

interface BindingRow {
  id: string
  provider: string
  remark: string
  model: string
  baseUrl: string
  apiKey: string
  createdAt: string
  updatedAt: string
}

function rowToRecord(row: BindingRow): LlmBindingRecord {
  return {
    id: row.id,
    provider: row.provider as LlmProviderId,
    remark: row.remark ?? '',
    model: row.model,
    baseUrl: row.baseUrl,
    apiKey: row.apiKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listBindingRecords(): LlmBindingRecord[] {
  const rows = getRawDb()
    .prepare(
      `SELECT id, provider, remark, model, base_url AS baseUrl, api_key AS apiKey,
              created_at AS createdAt, updated_at AS updatedAt
       FROM llm_bindings ORDER BY created_at ASC`,
    )
    .all() as BindingRow[]
  return rows.map(rowToRecord)
}

export function findBindingRecord(id: string): LlmBindingRecord | undefined {
  const row = getRawDb()
    .prepare(
      `SELECT id, provider, remark, model, base_url AS baseUrl, api_key AS apiKey,
              created_at AS createdAt, updated_at AS updatedAt
       FROM llm_bindings WHERE id = ?`,
    )
    .get(id) as BindingRow | undefined
  return row ? rowToRecord(row) : undefined
}

/** 目前使用中的綁定 id（沒有綁定或指向已刪除的綁定時，自動回退到第一筆） */
export function getActiveBindingId(): string | null {
  const stored = getRawDb()
    .prepare(`SELECT value FROM llm_settings WHERE key = ?`)
    .get(ACTIVE_KEY) as { value: string } | undefined

  const all = listBindingRecords()
  if (all.length === 0) return null
  if (stored?.value && all.some((b) => b.id === stored.value)) return stored.value
  return all[0].id
}

export function setActiveBindingId(id: string | null): void {
  if (id === null) {
    getRawDb().prepare(`DELETE FROM llm_settings WHERE key = ?`).run(ACTIVE_KEY)
    return
  }
  getRawDb()
    .prepare(
      `INSERT INTO llm_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .run(ACTIVE_KEY, id)
}

/** 目前使用中的綁定（完整資料，含金鑰；只在伺服器端使用） */
export function getActiveBinding(): LlmBindingRecord | null {
  const id = getActiveBindingId()
  if (!id) return null
  return findBindingRecord(id) ?? null
}

/* ---------------- 寫入 ---------------- */

export function createBinding(input: {
  provider: LlmProviderId
  remark: string
  model: string
  baseUrl: string
  apiKey: string
}): LlmBindingRecord {
  const id = `llm_${crypto.randomUUID()}`
  getRawDb()
    .prepare(
      `INSERT INTO llm_bindings (id, provider, remark, model, base_url, api_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.provider,
      input.remark.trim(),
      input.model.trim(),
      input.baseUrl.trim().replace(/\/+$/, ''),
      input.apiKey.trim(),
    )

  // 第一筆綁定自動設為使用中；否則保持原本的使用中綁定
  const active = getRawDb()
    .prepare(`SELECT value FROM llm_settings WHERE key = ?`)
    .get(ACTIVE_KEY) as { value: string } | undefined
  if (!active?.value) setActiveBindingId(id)

  return findBindingRecord(id)!
}

export function updateBinding(
  id: string,
  patch: { remark?: string; model?: string; baseUrl?: string; apiKey?: string },
): LlmBindingRecord | undefined {
  const existing = findBindingRecord(id)
  if (!existing) return undefined

  getRawDb()
    .prepare(
      `UPDATE llm_bindings
       SET remark = ?, model = ?, base_url = ?, api_key = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      patch.remark !== undefined ? patch.remark.trim() : existing.remark,
      patch.model !== undefined && patch.model.trim() ? patch.model.trim() : existing.model,
      patch.baseUrl !== undefined ? patch.baseUrl.trim().replace(/\/+$/, '') : existing.baseUrl,
      patch.apiKey !== undefined && patch.apiKey.trim() ? patch.apiKey.trim() : existing.apiKey,
      id,
    )
  return findBindingRecord(id)
}

export function deleteBinding(id: string): boolean {
  const existing = findBindingRecord(id)
  if (!existing) return false

  getRawDb().prepare(`DELETE FROM llm_bindings WHERE id = ?`).run(id)

  if (getActiveBindingIdRaw() === id) {
    const remaining = listBindingRecords()
    setActiveBindingId(remaining[0]?.id ?? null)
  }
  return true
}

function getActiveBindingIdRaw(): string | null {
  const row = getRawDb()
    .prepare(`SELECT value FROM llm_settings WHERE key = ?`)
    .get(ACTIVE_KEY) as { value: string } | undefined
  return row?.value ?? null
}

/* ---------------- 對外呈現 ---------------- */

export function maskApiKey(key: string | null | undefined): string | null {
  if (!key) return null
  if (key.length <= 10) return `${key.slice(0, 2)}****`
  return `${key.slice(0, 6)}****${key.slice(-4)}`
}

export function toPublicBinding(record: LlmBindingRecord, activeId: string | null): LlmBindingPublic {
  const meta = findProvider(record.provider)
  return {
    id: record.id,
    provider: record.provider,
    providerLabel: meta?.label ?? record.provider,
    remark: record.remark,
    model: record.model,
    baseUrl: record.baseUrl,
    apiKeyMasked: maskApiKey(record.apiKey) ?? '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isActive: record.id === activeId,
  }
}

export function listBindingsPublic(): LlmBindingPublic[] {
  const activeId = getActiveBindingId()
  return listBindingRecords().map((r) => toPublicBinding(r, activeId))
}
