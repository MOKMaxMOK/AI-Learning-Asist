/**
 * API Route 共用工具
 * ============================================================
 * 統一錯誤格式（前端 src/lib/api/client.ts 會讀 body.error）：
 *   { "error": { "code": "XXX", "message": "..." } }
 */

import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/client'

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

export function errorResponse(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** 把 throw 出來的錯誤統一轉成 API 錯誤回應 */
export function handleRouteError(e: unknown, fallbackCode = 'INTERNAL_ERROR'): NextResponse {
  if (e instanceof ApiError) {
    return errorResponse(e.status, e.code, e.message)
  }
  const message = e instanceof Error ? e.message : '伺服器發生未知錯誤'
  console.error('[api]', e)
  return errorResponse(500, fallbackCode, message)
}

export function requireParam(value: string | undefined | null, name: string): string {
  if (!value || !value.trim()) {
    throw new ApiError(400, 'MISSING_PARAM', `缺少必要參數：${name}`)
  }
  return value.trim()
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ApiError(400, 'INVALID_JSON', '請求內容不是合法的 JSON')
  }
}
