import { errorResponse, handleRouteError } from '@/lib/server/http'
import { findConversation, loadConversationMessages } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

/**
 * GET /api/conversations/:id/export?format=pdf|txt
 * 本地匯出：TXT 直接產生；PDF 以最小可用 PDF（純文字內容）產生，不需外部服務。
 * （前端偏好 PDF 時會 window.open 這個網址）
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const conversation = findConversation(params.id)
    if (!conversation) return errorResponse(404, 'CONVERSATION_NOT_FOUND', '找不到這個對話')

    const url = new URL(req.url)
    const format = (url.searchParams.get('format') ?? 'txt').toLowerCase()
    const messages = loadConversationMessages(params.id)

    const lines: string[] = [
      conversation.title,
      `學科：${conversation.subjectName ?? '未分類'}`,
      `匯出時間：${new Date().toLocaleString('zh-TW')}`,
      '',
    ]
    for (const m of messages) {
      const who = m.role === 'user' ? '我' : m.role === 'assistant' ? 'AI 老師' : '系統'
      lines.push(`【${who}】`)
      lines.push(m.content)
      for (const a of parseAttachments(m.attachments)) lines.push(`📎 ${a.fileName}`)
      const kps = m.annotation?.knowledgePoints?.map((k) => k.name).join('、')
      if (kps) lines.push(`知識點：${kps}`)
      lines.push('')
    }

    const safeName = conversation.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'conversation'

    if (format === 'pdf') {
      const pdf = buildSimplePdf(lines)
      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.pdf"`,
        },
      })
    }

    return new Response('\uFEFF' + lines.join('\n'), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}.txt"`,
      },
    })
  } catch (e) {
    return handleRouteError(e)
  }
}

function parseAttachments(raw: string | null): Array<{ fileName: string }> {
  if (!raw) return []
  try {
    return JSON.parse(raw) as Array<{ fileName: string }>
  } catch {
    return []
  }
}

/**
 * 最小可用 PDF 產生器（純文字、無外部依賴）
 * 直接組 PDF 結構：1 頁、單一內建字型（Helvetica 為 Latin-1，中文會被略過）。
 */
function buildSimplePdf(lines: string[]): Buffer {
  const toLatin = (s: string) => s.replace(/[^\x20-\x7E]/g, '')
  const yStart = 800
  const lineHeight = 14
  const maxLines = 52

  const escaped = lines
    .slice(0, maxLines)
    .map((l) => toLatin(l).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'))

  const content = [
    'BT',
    '/F1 10 Tf',
    `${lineHeight} TL`,
    `1 0 0 1 40 ${yStart} Tm`,
    ...escaped.map((line, i) => (i === 0 ? `(${line}) Tj` : `T* (${line}) Tj`)),
    'ET',
  ].join('\n')

  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objects.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  )
  objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}
