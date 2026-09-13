/**
 * SSE 串流輸出工具
 * ============================================================
 * 前端（src/lib/api/client.ts 的 streamChat）解析的事件格式：
 *   data: {"delta": "文字片段"}\n\n
 *   data: {"annotation": {...}}\n\n
 *   data: [DONE]\n\n
 */

const encoder = new TextEncoder()

export class SseStream {
  private controller!: ReadableStreamDefaultController<Uint8Array>
  private closed = false

  readonly stream: ReadableStream<Uint8Array>
  /** 是否已被客戶端中止（停止生成） */
  aborted = false

  constructor(private onAbort?: () => void) {
    this.stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller
      },
      cancel: () => {
        this.aborted = true
        this.closed = true
        this.onAbort?.()
      },
    })
  }

  private write(chunk: string) {
    if (this.closed) return
    try {
      this.controller.enqueue(encoder.encode(chunk))
    } catch {
      this.closed = true
      this.aborted = true
    }
  }

  /** data: {"delta": "..."} */
  sendDelta(delta: string) {
    if (!delta) return
    this.write(`data: ${JSON.stringify({ delta })}\n\n`)
  }

  /** data: {"annotation": {...}} */
  sendAnnotation(annotation: unknown) {
    this.write(`data: ${JSON.stringify({ annotation })}\n\n`)
  }

  /** 告知前端真正落庫的訊息 id（用來校正樂觀插入的臨時 id） */
  sendIds(ids: { userMessageId?: string; assistantMessageId?: string }) {
    this.write(`data: ${JSON.stringify({ ids: ids })}\n\n`)
  }

  /** data: {"error": {...}}（串流中途的錯誤，前端會顯示為該訊息的錯誤狀態） */
  sendError(message: string, code = 'STREAM_ERROR') {
    this.write(`data: ${JSON.stringify({ error: { code, message } })}\n\n`)
  }

  /** data: [DONE] */
  done() {
    if (this.closed) return
    this.write('data: [DONE]\n\n')
    this.closed = true
    try {
      this.controller.close()
    } catch {
      /* 已關閉 */
    }
  }
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const
