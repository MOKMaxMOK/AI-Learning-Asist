'use client'

/**
 * LLM 綁定區塊（設置 → LLM 綁定）
 * ============================================================
 * 所有 LLM 相關設定都整合在這裡：
 *   1. 新增綁定：廠商（GPT / Claude / Gemini / DeepSeek / Qwen / GLM /
 *      Kimi / Grok / 自訂 Base URL）+ 備註 + API Key + 模型名稱 + Base URL
 *      →「測試連線」可先測試再儲存
 *   2. 已綁定的模型：以「備註 + 模型名稱」顯示，可切換使用中、可刪除
 *
 * 模型名稱需自行輸入官方模型 id（介面不提供快捷選擇），
 * 旁邊附上該廠商官方模型文件連結方便查詢。
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Cpu,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plug,
  Plus,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createLlmBinding,
  deleteLlmBinding,
  getLlmSettings,
  setActiveLlmBinding,
  testLlmSettings,
  updateLlmBinding,
} from '@/lib/api'
import type {
  LlmBinding,
  LlmProviderId,
  LlmProviderOption,
  LlmTestResult,
} from '@/lib/types'
import { Button, Input, Skeleton, Spinner, toast } from '@/components/ui'

interface FormState {
  provider: LlmProviderId
  remark: string
  apiKey: string
  model: string
  baseUrl: string
}

const EMPTY_FORM: FormState = {
  provider: 'deepseek',
  remark: '',
  apiKey: '',
  model: '',
  baseUrl: '',
}

export function LlmBindingPanel() {
  const [providers, setProviders] = useState<LlmProviderOption[]>([])
  const [bindings, setBindings] = useState<LlmBinding[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  /** 編輯既有綁定的備註（null = 沒有在編輯） */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRemark, setEditRemark] = useState('')

  const applyPayload = (payload: {
    bindings: LlmBinding[]
    activeId: string | null
    providers: LlmProviderOption[]
  }) => {
    setBindings(payload.bindings)
    setActiveId(payload.activeId)
    setProviders(payload.providers)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLlmSettings()
      applyPayload(data)
      const first = data.providers.find((p) => p.id === 'deepseek') ?? data.providers[0]
      setForm((prev) => ({
        ...prev,
        provider: (prev.provider || first?.id || 'deepseek') as LlmProviderId,
        baseUrl: prev.baseUrl || first?.baseUrl || '',
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入綁定失敗')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = useMemo(
    () => providers.find((p) => p.id === form.provider),
    [providers, form.provider],
  )

  /** 切換廠商：帶入該廠商預設 Base URL，清空模型（模型名稱要自己輸入官方 id） */
  const onProviderChange = (id: LlmProviderId) => {
    const meta = providers.find((p) => p.id === id)
    setForm((prev) => ({ ...prev, provider: id, model: '', baseUrl: meta?.baseUrl ?? '' }))
    setTestResult(null)
  }

  /* ---------- 新增綁定 ---------- */

  const handleTest = async () => {
    if (!form.model.trim()) {
      toast({ title: '請先輸入模型名稱', variant: 'destructive' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testLlmSettings({
        provider: form.provider,
        apiKey: form.apiKey || undefined,
        model: form.model,
        baseUrl: form.baseUrl,
      })
      setTestResult(result)
      toast(
        result.ok
          ? { title: '連線成功', description: `${result.model} · ${result.latencyMs}ms` }
          : { title: '連線失敗', description: result.error, variant: 'destructive' },
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : '測試失敗'
      setTestResult({ ok: false, latencyMs: 0, error: message })
      toast({ title: '測試失敗', description: message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const handleCreate = async () => {
    if (!form.apiKey.trim()) {
      toast({ title: '請輸入 API Key', variant: 'destructive' })
      return
    }
    if (!form.model.trim()) {
      toast({ title: '請輸入模型名稱（官方模型 id）', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = await createLlmBinding({
        provider: form.provider,
        remark: form.remark,
        model: form.model,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
      })
      applyPayload(payload)
      setForm((prev) => ({ ...prev, remark: '', apiKey: '', model: '' }))
      setTestResult(null)
      toast({
        title: '已儲存綁定',
        description: form.remark.trim()
          ? `${form.remark.trim()}（${form.model.trim()}）`
          : form.model.trim(),
      })
    } catch (e) {
      toast({
        title: '儲存失敗',
        description: e instanceof Error ? e.message : '未知錯誤',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  /* ---------- 已儲存綁定操作 ---------- */

  const handleActivate = async (id: string) => {
    setBusyId(id)
    try {
      applyPayload(await setActiveLlmBinding(id))
      toast({ title: '已切換使用中的模型' })
    } catch (e) {
      toast({
        title: '切換失敗',
        description: e instanceof Error ? e.message : '未知錯誤',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (binding: LlmBinding) => {
    setBusyId(binding.id)
    try {
      applyPayload(await deleteLlmBinding(binding.id))
      toast({ title: '已刪除綁定', description: displayName(binding) })
    } catch (e) {
      toast({
        title: '刪除失敗',
        description: e instanceof Error ? e.message : '未知錯誤',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveRemark = async (id: string) => {
    setBusyId(id)
    try {
      applyPayload(await updateLlmBinding(id, { remark: editRemark }))
      setEditingId(null)
      toast({ title: '已更新備註' })
    } catch (e) {
      toast({
        title: '更新失敗',
        description: e instanceof Error ? e.message : '未知錯誤',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleTestSaved = async (id: string) => {
    setBusyId(id)
    setTestResult(null)
    try {
      const result = await testLlmSettings({ bindingId: id })
      setTestResult(result)
      toast(
        result.ok
          ? { title: '連線成功', description: `${result.model} · ${result.latencyMs}ms` }
          : { title: '連線失敗', description: result.error, variant: 'destructive' },
      )
    } catch (e) {
      toast({
        title: '測試失敗',
        description: e instanceof Error ? e.message : '未知錯誤',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const activeBinding = bindings.find((b) => b.id === activeId) ?? null

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      {/* 標題 */}
      <div className="flex items-start gap-3 border-b px-4 py-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
          <Cpu className="size-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">LLM 綁定</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI 老師使用的模型。金鑰只存在這台電腦的本地資料庫，不會上傳。
          </p>
        </div>
        {activeBinding ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#99DCBB] bg-[#E7F7EF] px-2 py-0.5 text-[10px] text-[#1F6B48]">
            <ShieldCheck className="size-3" />
            使用中：{activeBinding.model}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F6C79A] bg-[#FFF1E3] px-2 py-0.5 text-[10px] text-[#9A5518]">
            <AlertCircle className="size-3" />
            尚未綁定
          </span>
        )}
      </div>

      <div className="space-y-5 px-4 py-4">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="underline underline-offset-2">
              重試
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <>
            {/* ===== 新增綁定 ===== */}
            <div className="rounded-lg border border-dashed border-border bg-background p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <Plus className="size-3.5 text-primary" />
                <h3 className="text-xs font-semibold">新增綁定</h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* 廠商 */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium">大模型廠商</label>
                  <select
                    value={form.provider}
                    onChange={(e) => onProviderChange(e.target.value as LlmProviderId)}
                    className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {selected?.keyUrl && (
                      <a
                        href={selected.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        取得 {selected.label} API Key
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    {selected?.docsUrl && (
                      <a
                        href={selected.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        查看官方模型名稱
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* 備註 */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium">
                    備註
                    <span className="ml-1 font-normal text-muted-foreground">
                      （會顯示在已綁定的模型區塊）
                    </span>
                  </label>
                  <Input
                    value={form.remark}
                    onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))}
                    placeholder="例：主力模型 / 便宜快速 / 數學專用"
                    maxLength={60}
                  />
                </div>

                {/* API Key */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium">API Key</label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={form.apiKey}
                      onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* 模型名稱（自己輸入官方 id） */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium">模型名稱</label>
                  <Input
                    value={form.model}
                    onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                    placeholder={selected?.defaultModel || '官方模型 id'}
                    spellCheck={false}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    請輸入官方文件中的模型 id（名稱跟隨官方）。
                    {selected && selected.models.length > 0 && (
                      <>
                        {' '}
                        目前官方可用：
                        <span className="font-mono">{selected.models.join('、')}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Base URL */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium">
                    Base URL
                    {selected?.requiresBaseUrl && <span className="ml-1 text-destructive">*</span>}
                  </label>
                  <Input
                    value={form.baseUrl}
                    onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
                    placeholder="https://api.example.com/v1"
                    spellCheck={false}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    OpenAI 相容端點（結尾通常是 <span className="font-mono">/v1</span>）。
                  </p>
                </div>
              </div>

              {/* 測試結果 */}
              {testResult && <TestResultBox result={testResult} className="mt-3" />}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
                  {saving ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                  儲存綁定
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleTest()}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />}
                  測試連線
                </Button>
              </div>
            </div>

            {/* ===== 已綁定的模型 ===== */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold">
                  已綁定的模型
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    {bindings.length} 筆
                  </span>
                </h3>
                {bindings.length > 1 && (
                  <span className="text-[11px] text-muted-foreground">點星號切換使用中</span>
                )}
              </div>

              {bindings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
                  還沒有綁定任何模型，請在上方輸入 API Key 與模型名稱後儲存。
                </div>
              ) : (
                <ul className="space-y-2">
                  {bindings.map((b) => (
                    <li
                      key={b.id}
                      className={cn(
                        'rounded-lg border bg-background px-3 py-2.5 transition-colors',
                        b.isActive ? 'border-primary/50 bg-primary-soft/40' : 'border-border',
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* 使用中切換 */}
                        <button
                          type="button"
                          aria-label={b.isActive ? '目前使用中' : '設為使用中'}
                          title={b.isActive ? '目前使用中' : '設為使用中'}
                          disabled={b.isActive || busyId === b.id}
                          onClick={() => void handleActivate(b.id)}
                          className={cn(
                            'mt-0.5 shrink-0 rounded p-1 transition-colors',
                            b.isActive
                              ? 'text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-primary',
                          )}
                        >
                          {busyId === b.id && !b.isActive ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Star className={cn('size-3.5', b.isActive && 'fill-current')} />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          {editingId === b.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                autoFocus
                                value={editRemark}
                                onChange={(e) => setEditRemark(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                    e.preventDefault()
                                    void handleSaveRemark(b.id)
                                  }
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                                placeholder="輸入備註"
                                className="h-7 text-xs"
                                maxLength={60}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                disabled={busyId === b.id}
                                onClick={() => void handleSaveRemark(b.id)}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* 儲存區塊顯示：備註 + 模型名稱 */}
                              <p className="min-w-0 truncate text-sm font-medium">
                                {displayName(b)}
                              </p>
                              {b.isActive && (
                                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                                  使用中
                                </span>
                              )}
                            </div>
                          )}

                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {b.providerLabel} · <span className="font-mono">{b.apiKeyMasked}</span>
                            {b.baseUrl ? ` · ${b.baseUrl}` : ''}
                          </p>
                        </div>

                        {/* 操作 */}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="測試這筆綁定"
                            title="測試連線"
                            disabled={busyId === b.id}
                            onClick={() => void handleTestSaved(b.id)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                          >
                            <Plug className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="編輯備註"
                            title="編輯備註"
                            onClick={() => {
                              setEditingId(b.id)
                              setEditRemark(b.remark)
                            }}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="刪除綁定"
                            title="刪除"
                            disabled={busyId === b.id}
                            onClick={() => void handleDelete(b)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 測試結果（測已儲存的綁定時顯示在這裡） */}
            {testResult && bindings.length > 0 && (
              <TestResultBox result={testResult} />
            )}
          </>
        )}
      </div>
    </section>
  )
}

/** 顯示名稱：「備註 + 模型名稱」 */
function displayName(binding: LlmBinding): string {
  const remark = binding.remark?.trim()
  return remark ? `${remark} + ${binding.model}` : binding.model
}

function TestResultBox({ result, className }: { result: LlmTestResult; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-xs',
        result.ok
          ? 'border-[#99DCBB] bg-[#E7F7EF] text-[#1F6B48]'
          : 'border-destructive/40 bg-destructive/5 text-destructive',
        className,
      )}
    >
      {result.ok ? (
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 font-medium">
            <Check className="size-3.5" />
            連線成功（{result.latencyMs}ms）
          </p>
          <p>
            模型：<span className="font-mono">{result.model}</span>
          </p>
          {result.reply && <p>模型回覆：{result.reply}</p>}
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertCircle className="size-3.5" />
            連線失敗（{result.latencyMs}ms）
          </p>
          <p className="break-words">{result.error}</p>
        </div>
      )}
    </div>
  )
}
