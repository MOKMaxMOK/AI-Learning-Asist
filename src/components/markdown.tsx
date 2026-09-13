'use client'

/**
 * 輕量 Markdown 渲染器
 * ============================================================
 * AI 回覆原本是純文字顯示，這裡把常見 Markdown 真的渲染出來：
 *   標題 / 粗體 / 斜體 / 刪除線 / 行內程式碼 / 程式碼區塊 /
 *   無序與有序清單 / 引用 / 分隔線 / 連結 / 自動連結 / 表格
 *
 * 設計重點：
 *   - 不引入額外依賴，輸出 React 元素（不使用 dangerouslySetInnerHTML）
 *   - 支援串流中的「游標」尾隨（streamingCursor）
 *   - 解析以行為單位，未閉合的程式碼區塊在串流中也會正確顯示
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* ============================================================
 * 行內解析
 * ============================================================ */

interface InlineRule {
  pattern: RegExp
  render: (match: RegExpExecArray, key: string) => ReactNode
}

const INLINE_RULES: InlineRule[] = [
  {
    // 行內程式碼
    pattern: /`([^`\n]+)`/,
    render: (m, key) => (
      <code
        key={key}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
      >
        {m[1]}
      </code>
    ),
  },
  {
    // 連結 [文字](url)
    pattern: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/,
    render: (m, key) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {parseInline(m[1])}
      </a>
    ),
  },
  {
    // 粗體
    pattern: /\*\*([^*\n]+)\*\*/,
    render: (m, key) => (
      <strong key={key} className="font-semibold">
        {parseInline(m[1])}
      </strong>
    ),
  },
  {
    // 斜體（*text*）
    pattern: /(?<!\*)\*([^*\n]+)\*(?!\*)/,
    render: (m, key) => <em key={key}>{parseInline(m[1])}</em>,
  },
  {
    // 斜體（_text_）
    pattern: /(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/,
    render: (m, key) => <em key={key}>{parseInline(m[1])}</em>,
  },
  {
    // 刪除線
    pattern: /~~([^~\n]+)~~/,
    render: (m, key) => (
      <span key={key} className="line-through opacity-70">
        {parseInline(m[1])}
      </span>
    ),
  },
]

const AUTOLINK = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/

/** 解析一行中的行內語法，回傳 React 節點 */
export function parseInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let seq = 0

  while (rest.length > 0) {
    let matched = false

    for (const rule of INLINE_RULES) {
      const m = rule.pattern.exec(rest)
      if (!m || m.index === undefined) continue

      if (m.index > 0) out.push(rest.slice(0, m.index))
      out.push(rule.render(m, `i${seq++}`))
      rest = rest.slice(m.index + m[0].length)
      matched = true
      break
    }

    if (matched) continue

    // 沒有其他語法時才處理裸連結
    const auto = AUTOLINK.exec(rest)
    if (auto && auto.index !== undefined) {
      if (auto.index > 0) out.push(rest.slice(0, auto.index))
      out.push(
        <a
          key={`i${seq++}`}
          href={auto[0]}
          target="_blank"
          rel="noreferrer"
          className="break-all text-primary underline underline-offset-2 hover:opacity-80"
        >
          {auto[0]}
        </a>,
      )
      rest = rest.slice(auto.index + auto[0].length)
      continue
    }

    out.push(rest)
    break
  }

  return out
}

/* ============================================================
 * 區塊解析
 * ============================================================ */

type Block =
  | { kind: 'code'; lang: string; lines: string[]; open: boolean }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'quote'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number }
  | { kind: 'table'; header: string[]; rows: string[][]; aligns: Array<'left' | 'center' | 'right'> }
  | { kind: 'hr' }
  | { kind: 'p'; text: string }

const RE = {
  heading: /^(#{1,6})\s+(.*)$/,
  fence: /^\s*```\s*([A-Za-z0-9_+-]*)\s*$/,
  hr: /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/,
  quote: /^\s*>\s?(.*)$/,
  ul: /^\s*[-*+]\s+(.*)$/,
  ol: /^\s*(\d+)[.)]\s+(.*)$/,
  tableRow: /^\s*\|(.+)\|\s*$/,
  tableSep: /^\s*\|?[\s:|-]+\|?\s*$/,
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())
}

function isTableSeparator(line: string): boolean {
  return RE.tableSep.test(line) && line.includes('-')
}

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    /* 程式碼區塊 */
    const fence = RE.fence.exec(line)
    if (fence) {
      const lang = fence[1] ?? ''
      const body: string[] = []
      i += 1
      let open = true
      while (i < lines.length) {
        if (RE.fence.test(lines[i])) {
          open = false
          i += 1
          break
        }
        body.push(lines[i])
        i += 1
      }
      blocks.push({ kind: 'code', lang, lines: body, open })
      continue
    }

    /* 分隔線 */
    if (RE.hr.test(line)) {
      blocks.push({ kind: 'hr' })
      i += 1
      continue
    }

    /* 標題 */
    const heading = RE.heading.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() })
      i += 1
      continue
    }

    /* 表格 */
    if (RE.tableRow.test(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line)
      const aligns = splitRow(lines[i + 1]).map((c) => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center' as const
        if (c.endsWith(':')) return 'right' as const
        return 'left' as const
      })
      const rows: string[][] = []
      i += 2
      while (i < lines.length && RE.tableRow.test(lines[i])) {
        rows.push(splitRow(lines[i]))
        i += 1
      }
      blocks.push({ kind: 'table', header, rows, aligns })
      continue
    }

    /* 引用 */
    if (RE.quote.test(line)) {
      const body: string[] = []
      while (i < lines.length && RE.quote.test(lines[i])) {
        body.push(RE.quote.exec(lines[i])![1])
        i += 1
      }
      blocks.push({ kind: 'quote', lines: body })
      continue
    }

    /* 無序清單 */
    if (RE.ul.test(line)) {
      const items: string[] = []
      while (i < lines.length && RE.ul.test(lines[i])) {
        items.push(RE.ul.exec(lines[i])![1])
        i += 1
      }
      blocks.push({ kind: 'ul', items })
      continue
    }

    /* 有序清單 */
    const ol = RE.ol.exec(line)
    if (ol) {
      const items: string[] = []
      const start = Number(ol[1])
      while (i < lines.length) {
        const m = RE.ol.exec(lines[i])
        if (!m) break
        items.push(m[2])
        i += 1
      }
      blocks.push({ kind: 'ol', items, start })
      continue
    }

    /* 空行 */
    if (line.trim() === '') {
      i += 1
      continue
    }

    /* 段落（連續非空行合併） */
    const para: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      const next = lines[i]
      if (
        RE.fence.test(next) ||
        RE.heading.test(next) ||
        RE.hr.test(next) ||
        RE.quote.test(next) ||
        RE.ul.test(next) ||
        RE.ol.test(next) ||
        RE.tableRow.test(next)
      ) {
        break
      }
      para.push(next)
      i += 1
    }
    blocks.push({ kind: 'p', text: para.join('\n') })
  }

  return blocks
}

/* ============================================================
 * 渲染
 * ============================================================ */

const HEADING_CLASS: Record<number, string> = {
  1: 'mt-3 mb-1.5 text-base font-semibold first:mt-0',
  2: 'mt-3 mb-1.5 text-sm font-semibold first:mt-0',
  3: 'mt-2.5 mb-1 text-sm font-semibold first:mt-0',
  4: 'mt-2 mb-1 text-xs font-semibold first:mt-0',
  5: 'mt-2 mb-1 text-xs font-semibold first:mt-0',
  6: 'mt-2 mb-1 text-xs font-semibold first:mt-0',
}

/** 程式碼高亮：只做最小可讀的著色，避免引入高亮套件 */
function highlightCode(code: string): ReactNode {
  const TOKEN =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(const|let|var|function|return|if|else|for|while|class|new|import|from|export|def|elif|None|True|False|null|undefined|true|false|async|await|try|catch|finally|throw|typeof|interface|type|public|private|static|void|int|float|double|string|bool|print)\b|\b(\d+(?:\.\d+)?)\b/g

  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null

  while ((m = TOKEN.exec(code)) !== null) {
    if (m.index > last) nodes.push(code.slice(last, m.index))
    const cls = m[1]
      ? 'text-muted-foreground/70 italic'
      : m[2]
        ? 'text-[#F2A93B]'
        : m[3]
          ? 'text-[#4C8DF6]'
          : 'text-[#3FB984]'
    nodes.push(
      <span key={`t${key++}`} className={cls}>
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < code.length) nodes.push(code.slice(last))
  return nodes
}

export interface MarkdownProps {
  content: string
  /** 串流中：在內容尾端顯示閃爍游標 */
  streamingCursor?: boolean
  className?: string
}

export function Markdown({ content, streamingCursor, className }: MarkdownProps) {
  const blocks = parseBlocks(content)

  return (
    <div className={cn('markdown-body text-sm leading-relaxed', className)}>
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1
        const cursor = streamingCursor && isLast

        switch (block.kind) {
          case 'code':
            return (
              <div key={index} className="my-2 overflow-hidden rounded-lg border bg-muted/50">
                {block.lang && (
                  <div className="border-b bg-muted px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                    {block.lang}
                  </div>
                )}
                <pre className="nice-scroll overflow-x-auto px-3 py-2">
                  <code className="font-mono text-xs leading-relaxed">
                    {highlightCode(block.lines.join('\n'))}
                    {cursor && <StreamCursor />}
                  </code>
                </pre>
              </div>
            )

          case 'heading':
            return (
              // 用 <p> + role=heading 保持氣泡內的字級一致，同時保留語意
              <p
                key={index}
                role="heading"
                aria-level={Math.min(6, Math.max(1, block.level))}
                className={HEADING_CLASS[block.level] ?? HEADING_CLASS[3]}
              >
                {parseInline(block.text)}
                {cursor && <StreamCursor />}
              </p>
            )

          case 'quote':
            return (
              <blockquote
                key={index}
                className="my-2 border-l-2 border-primary/40 bg-primary-soft/40 py-1.5 pl-3 pr-2 text-muted-foreground"
              >
                {parseInline(block.lines.join(' '))}
                {cursor && <StreamCursor />}
              </blockquote>
            )

          case 'ul':
            return (
              <ul key={index} className="my-2 space-y-1 pl-4">
                {block.items.map((item, j) => (
                  <li key={j} className="list-disc marker:text-primary/60">
                    {parseInline(item)}
                    {cursor && j === block.items.length - 1 && <StreamCursor />}
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol key={index} className="my-2 space-y-1 pl-5" start={block.start}>
                {block.items.map((item, j) => (
                  <li key={j} className="list-decimal marker:text-primary/60">
                    {parseInline(item)}
                    {cursor && j === block.items.length - 1 && <StreamCursor />}
                  </li>
                ))}
              </ol>
            )

          case 'table':
            return (
              <div key={index} className="my-2 overflow-x-auto nice-scroll">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {block.header.map((cell, j) => (
                        <th
                          key={j}
                          className={cn(
                            'border border-border bg-muted px-2 py-1 font-semibold',
                            alignClass(block.aligns[j]),
                          )}
                        >
                          {parseInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className={cn('border border-border px-2 py-1', alignClass(block.aligns[j]))}
                          >
                            {parseInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'hr':
            return <hr key={index} className="my-3 border-border" />

          default:
            return (
              <p key={index} className="my-1.5 whitespace-pre-wrap break-words first:mt-0 last:mb-0">
                {parseInline(block.text)}
                {cursor && <StreamCursor />}
              </p>
            )
        }
      })}

      {/* 內容為空但正在串流：仍顯示游標 */}
      {streamingCursor && blocks.length === 0 && (
        <p className="my-0">
          <StreamCursor />
        </p>
      )}
    </div>
  )
}

function alignClass(align?: 'left' | 'center' | 'right'): string {
  if (align === 'center') return 'text-center'
  if (align === 'right') return 'text-right'
  return 'text-left'
}

function StreamCursor() {
  return <span className="stream-cursor" aria-hidden />
}

export default Markdown
