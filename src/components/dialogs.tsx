'use client'

/**
 * 全對話框集合：新增對話 / 重新命名 / 更改學科 / 刪除確認 / 負向反饋 / 匯出
 * 開啟方式：useChatStore.openDialog(type, payload)
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Download, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useCachedMessages,
  useChatActions,
  useCreateConversation,
  useCreateTag,
  useDeleteConversation,
  useTags,
  useUpdateConversation,
} from '@/hooks/use-chat-api'
import { exportConversationUrl } from '@/lib/api'
import type { Conversation, Tag } from '@/lib/types'
import { useChatStore } from '@/store/chat-store'
import { Button, Dialog, DialogContent, Input, TagChip, Textarea, toast } from '@/components/ui'

function usePayload<T>(): T | null {
  return useChatStore((s) => s.dialogPayload) as T | null
}

const errorText = 'text-xs text-destructive mt-1'

/* ================= 新增對話 ================= */

const newChatSchema = z.object({
  title: z.string().trim().min(1, '請輸入對話名稱'),
  tagId: z.string().min(1, '請選擇學科'),
})
type NewChatValues = z.infer<typeof newChatSchema>

function NewChatDialog() {
  const { closeDialog } = useChatStore()
  const { data: tags, isLoading } = useTags()
  const createTag = useCreateTag()
  const createConversation = useCreateConversation()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewChatValues>({ resolver: zodResolver(newChatSchema), defaultValues: { title: '', tagId: '' } })

  const selectedTagId = watch('tagId')

  /* + 新增學科內聯輸入 */
  const [addingTag, setAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')

  const confirmNewTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    if (name.length > 10) {
      toast({ title: '學科名稱最多 10 個字', variant: 'destructive' })
      return
    }
    if (tags?.some((t) => t.name === name)) {
      toast({ title: '此學科已存在', variant: 'destructive' })
      return
    }
    try {
      const tag = await createTag.mutateAsync(name)
      setValue('tagId', tag.id, { shouldValidate: true })
      setAddingTag(false)
      setNewTagName('')
    } catch {
      toast({ title: '新增學科失敗', variant: 'destructive' })
    }
  }

  const onSubmit = (values: NewChatValues) => {
    createConversation.mutate(
      { title: values.title.trim(), tagId: values.tagId },
      {
        onSuccess: () => closeDialog(),
        onError: (e) =>
          toast({ title: '建立對話失敗', description: e.message, variant: 'destructive' }),
      },
    )
  }

  return (
    <DialogContent title="新增對話">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">對話名稱</label>
          <Input placeholder="例：數學複習" {...register('title')} />
          {errors.title && <p className={errorText}>{errors.title.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">選擇學科（必選）</label>
          <p className="mb-2 text-xs text-muted-foreground">
            學科會成為分析板塊「學科分析」的統計維度；預設提供中文、English、數學。
          </p>
          <div className="flex flex-wrap gap-2">
            {isLoading && <p className="text-xs text-muted-foreground">載入中…</p>}
            {tags?.map((t: Tag) => (
              <TagChip key={t.id} active={selectedTagId === t.id} onClick={() => setValue('tagId', t.id, { shouldValidate: true })}>
                {t.name}
              </TagChip>
            ))}
            {addingTag ? (
              <span className="inline-flex items-center gap-1">
                <Input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void confirmNewTag()
                    }
                    if (e.key === 'Escape') setAddingTag(false)
                  }}
                  placeholder="輸入學科名稱"
                  className="h-7 w-28 text-xs"
                  maxLength={10}
                />
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void confirmNewTag()}>
                  確認
                </Button>
              </span>
            ) : (
              <TagChip onClick={() => setAddingTag(true)}>
                <Plus className="size-3" />
                新增學科
              </TagChip>
            )}
          </div>
          {errors.tagId && <p className={errorText}>{errors.tagId.message}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button type="submit" disabled={createConversation.isPending}>
            {createConversation.isPending ? '建立中…' : '建立'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

/* ================= 重新命名 ================= */

const renameSchema = z.object({ title: z.string().trim().min(1, '請輸入對話名稱') })

function RenameDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const update = useUpdateConversation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ title: string }>({
    resolver: zodResolver(renameSchema),
    defaultValues: { title: payload?.conversation.title ?? '' },
  })
  if (!payload) return null

  const onSubmit = (v: { title: string }) =>
    update.mutate(
      { id: payload.conversation.id, patch: { title: v.title.trim() } },
      { onSuccess: closeDialog, onError: (e) => toast({ title: '重新命名失敗', description: e.message, variant: 'destructive' }) },
    )

  return (
    <DialogContent title="重新命名">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input autoFocus {...register('title')} />
          {errors.title && <p className={errorText}>{errors.title.message}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button type="submit" disabled={update.isPending}>
            儲存
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

/* ================= 更改學科 ================= */

function ChangeSubjectDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const { data: tags } = useTags()
  const update = useUpdateConversation()
  const [selected, setSelected] = useState(payload?.conversation.tagId ?? '')
  if (!payload) return null

  return (
    <DialogContent title="更改學科">
      <p className="mb-3 text-xs text-muted-foreground">
        更改後，這個對話在「學科分析」中的統計歸屬也會跟著改變。
      </p>
      <div className="flex flex-wrap gap-2">
        {tags?.map((t) => (
          <TagChip key={t.id} active={selected === t.id} onClick={() => setSelected(t.id)}>
            {t.name}
          </TagChip>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={closeDialog}>
          取消
        </Button>
        <Button
          type="button"
          disabled={!selected || update.isPending}
          onClick={() =>
            update.mutate(
              { id: payload.conversation.id, patch: { tagId: selected } },
              { onSuccess: closeDialog, onError: (e) => toast({ title: '更改失敗', description: e.message, variant: 'destructive' }) },
            )
          }
        >
          儲存
        </Button>
      </div>
    </DialogContent>
  )
}

/* ================= 刪除確認 ================= */

function DeleteDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const del = useDeleteConversation()
  if (!payload) return null

  return (
    <DialogContent title="刪除對話">
      <p className="text-sm text-muted-foreground">
        確定刪除「<span className="font-medium text-foreground">{payload.conversation.title}</span>
        」？此操作無法復原。
      </p>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={closeDialog}>
          取消
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={del.isPending}
          onClick={() =>
            del.mutate(payload.conversation.id, {
              onSuccess: closeDialog,
              onError: (e) => toast({ title: '刪除失敗', description: e.message, variant: 'destructive' }),
            })
          }
        >
          {del.isPending ? '刪除中…' : '刪除'}
        </Button>
      </div>
    </DialogContent>
  )
}

/* ================= 負向反饋（選填原因） ================= */

const DOWN_REASONS = ['內容不正確', '不夠詳細', '格式不易閱讀', '其他']

function FeedbackDialog() {
  const payload = usePayload<{ messageId: string; conversationId: string }>()
  const { closeDialog } = useChatStore()
  const { submitFeedback } = useChatActions()
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  if (!payload) return null

  return (
    <DialogContent title="告訴我們哪裡不好">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {DOWN_REASONS.map((r) => (
            <TagChip key={r} active={reason === r} onClick={() => setReason(r)}>
              {r}
            </TagChip>
          ))}
        </div>
        <Textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="補充說明（選填）"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={closeDialog}>
            取消
          </Button>
          <Button
            type="button"
            onClick={() => {
              void submitFeedback(payload.messageId, 'down', reason || detail || undefined, payload.conversationId)
              toast({ title: '已收到反饋，謝謝你！' })
              closeDialog()
            }}
          >
            送出反饋
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

/* ================= 匯出對話 ================= */

function ExportDialog() {
  const payload = usePayload<{ conversation: Conversation }>()
  const { closeDialog } = useChatStore()
  const messages = useCachedMessages(payload?.conversation.id ?? null)
  if (!payload) return null

  /** TXT：前端直接產生下載（不需後端） */
  const exportTxt = () => {
    const conv = payload.conversation
    const lines = [`# ${conv.title}`, `學科：${conv.tag?.name ?? '未分類'}`, '']
    for (const m of messages) {
      const who = m.role === 'user' ? '我' : m.role === 'assistant' ? 'AI' : '系統'
      lines.push(`【${who}】`, m.content, '')
      for (const a of m.attachments ?? []) lines.push(`📎 ${a.fileName}`)
      if (m.attachments?.length) lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conv.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
    closeDialog()
  }

  /** PDF：走後端接口 GET /api/conversations/:id/export?format=pdf（見 lib/api/index.ts） */
  const exportPdf = () => {
    window.open(exportConversationUrl(payload.conversation.id, 'pdf'), '_blank')
    closeDialog()
  }

  return (
    <DialogContent title="匯出對話">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={exportTxt}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border border-border p-5 transition-colors',
            'hover:border-primary hover:bg-primary-soft/40',
          )}
        >
          <Download className="size-6 text-primary" />
          <span className="text-sm font-medium">TXT 純文字</span>
          <span className="text-xs text-muted-foreground">本機立即產生</span>
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border border-border p-5 transition-colors',
            'hover:border-primary hover:bg-primary-soft/40',
          )}
        >
          <Download className="size-6 text-primary" />
          <span className="text-sm font-medium">PDF 文件</span>
          <span className="text-xs text-muted-foreground">由本機 API 產生</span>
        </button>
      </div>
    </DialogContent>
  )
}

/* ================= 總控 ================= */

export function ChatDialogs() {
  const { dialog, closeDialog } = useChatStore()
  if (!dialog) return null
  return (
    <Dialog open onOpenChange={(open) => !open && closeDialog()}>
      {dialog === 'new-chat' && <NewChatDialog />}
      {dialog === 'rename' && <RenameDialog />}
      {dialog === 'change-subject' && <ChangeSubjectDialog />}
      {dialog === 'delete' && <DeleteDialog />}
      {dialog === 'feedback' && <FeedbackDialog />}
      {dialog === 'export' && <ExportDialog />}
    </Dialog>
  )
}
