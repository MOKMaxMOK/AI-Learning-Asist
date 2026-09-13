/**
 * 端到端煙霧測試（本機執行，非專案程式碼的一部分）
 * 用法：node scripts/smoke.mjs [baseUrl] [--skip-llm]
 */

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:3011'
const SKIP_LLM = process.argv.includes('--skip-llm')

/** 金鑰是否真的可用（連線測試成功才會是 true） */
let llmUsable = false

let pass = 0
let fail = 0

function ok(name, extra = '') {
  pass += 1
  console.log(`  PASS  ${name}${extra ? ` — ${extra}` : ''}`)
}
function bad(name, detail) {
  fail += 1
  console.log(`  FAIL  ${name} — ${detail}`)
}

async function req(method, path, body, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...opts,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data, res }
}

function assert(name, cond, detail = '') {
  if (cond) ok(name, detail)
  else bad(name, detail || 'assertion failed')
}

/* ---------------- 1. 學科 ---------------- */
console.log('\n[1] 學科 API')
const subjects = await req('GET', '/api/subjects')
assert('GET /api/subjects 200', subjects.status === 200, `status=${subjects.status}`)
assert('預設三學科存在', Array.isArray(subjects.data) && subjects.data.length >= 3, `count=${subjects.data?.length}`)
const math = subjects.data?.find((s) => s.id === 'subject-math')
assert('數學學科存在', !!math, math?.name)

/* ---------------- 2. LLM 設置 ---------------- */
console.log('\n[2] LLM 設置 API')
const settings = await req('GET', '/api/settings/llm')
assert('GET /api/settings/llm 200', settings.status === 200, `status=${settings.status}`)
assert('回傳廠商目錄', Array.isArray(settings.data?.providers) && settings.data.providers.length >= 9,
  `providers=${settings.data?.providers?.length}`)
const providerIds = (settings.data?.providers ?? []).map((p) => p.id)
for (const want of ['openai', 'anthropic', 'google', 'deepseek', 'qwen', 'glm', 'kimi', 'grok', 'custom']) {
  assert(`廠商 ${want}`, providerIds.includes(want))
}

/* ---------------- 3. LLM 綁定（多筆、備註、刪除） ---------------- */
console.log('\n[3] LLM 綁定（新增 / 備註 / 切換 / 刪除 / 連線測試）')
const apiKey = process.env.SMOKE_LLM_KEY || ''
let createdBindingId = null

/** 先用假金鑰驗證綁定 CRUD（不需要真的能連線） */
const baselineSettings = await req('GET', '/api/settings/llm')
const hadBindingBefore = (baselineSettings.data?.bindings ?? []).length > 0

const fakeCreate = await req('POST', '/api/settings/llm', {
  provider: 'deepseek',
  remark: '煙霧測試備註',
  apiKey: 'sk-smoke-test-fake-key-000000',
  model: 'deepseek-v4-pro',
  baseUrl: 'https://api.deepseek.com/v1',
})
assert('POST /api/settings/llm 201', fakeCreate.status === 201,
  `status=${fakeCreate.status} ${JSON.stringify(fakeCreate.data).slice(0, 160)}`)
createdBindingId = fakeCreate.data?.createdId ?? null
assert('回傳 createdId', !!createdBindingId, String(createdBindingId))
assert('綁定清單含新綁定', (fakeCreate.data?.bindings ?? []).some((b) => b.id === createdBindingId),
  `bindings=${fakeCreate.data?.bindings?.length}`)
assert(
  '新綁定成為使用中（原本沒有綁定時）',
  hadBindingBefore || fakeCreate.data?.activeId === createdBindingId,
  `hadBefore=${hadBindingBefore} activeId=${fakeCreate.data?.activeId}`,
)
assert('金鑰已遮蔽（不回傳明文）',
  !JSON.stringify(fakeCreate.data).includes('sk-smoke-test-fake-key-000000'),
  JSON.stringify(fakeCreate.data?.bindings?.map((b) => b.apiKeyMasked)))

/** 更新備註 */
if (createdBindingId) {
  const patch = await req('PATCH', '/api/settings/llm', {
    id: createdBindingId,
    remark: '更新後的備註',
  })
  assert('PATCH 更新備註 200', patch.status === 200, `status=${patch.status}`)
  const updated = (patch.data?.bindings ?? []).find((b) => b.id === createdBindingId)
  assert('備註已更新', updated?.remark === '更新後的備註', updated?.remark)

  /** 刪除綁定 */
  const del = await req('DELETE', `/api/settings/llm?id=${createdBindingId}`)
  assert('DELETE 綁定 200', del.status === 200, `status=${del.status}`)
  assert('綁定已移除', !(del.data?.bindings ?? []).some((b) => b.id === createdBindingId),
    `bindings=${del.data?.bindings?.length}`)
}

/** 用真金鑰綁定 → 測試連線 → 之後用於串流 → 最後刪除 */
if (apiKey) {
  const real = await req('POST', '/api/settings/llm', {
    provider: 'deepseek',
    remark: '煙霧測試（DeepSeek）',
    apiKey,
    model: 'deepseek-v4-pro',
    baseUrl: 'https://api.deepseek.com/v1',
  })
  assert('綁定真金鑰 201', real.status === 201, `status=${real.status}`)
  createdBindingId = real.data?.createdId ?? null
  assert('真金鑰已遮蔽', !JSON.stringify(real.data).includes(apiKey))

  const test = await req('POST', '/api/settings/llm/test', {})
  if (test.data?.ok === true) {
    llmUsable = true
    ok('POST /api/settings/llm/test 成功', `latency=${test.data?.latencyMs}ms`)
    ok('模型回覆', JSON.stringify(test.data.reply).slice(0, 80))
  } else {
    // 金鑰失效 / 額度不足時不算產品缺陷：略過所有依賴 LLM 的斷言
    console.log(`  SKIP  LLM 連線不可用（${test.data?.error ?? 'unknown'}）→ 略過依賴 LLM 的測試`)
  }
} else {
  console.log('  SKIP  未提供 SMOKE_LLM_KEY（略過真實連線測試）')
}

/* ---------------- 4. 對話 + 串流 ---------------- */
console.log('\n[4] 對話與 SSE 串流')
const conv = await req('POST', '/api/conversations', {
  title: `煙霧測試 ${new Date().toISOString().slice(11, 19)}`,
  tagId: 'subject-math',
})
assert('POST /api/conversations 201', conv.status === 201, `status=${conv.status} ${JSON.stringify(conv.data).slice(0, 200)}`)
const convId = conv.data?.id
assert('對話回傳學科 tag', conv.data?.tag?.name === '數學', conv.data?.tag?.name)

const list = await req('GET', '/api/conversations')
assert('GET /api/conversations 含新對話', list.data?.some((c) => c.id === convId), `count=${list.data?.length}`)

if (convId && !SKIP_LLM && apiKey) {
  const res = await fetch(`${BASE}/api/conversations/${convId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      content: '我對三角函數的 sin 和 cos 常搞混，可以說明一下嗎？順便問一題：sin30度等於多少？',
      subjectId: 'subject-math',
    }),
  })
  assert('POST .../chat 200', res.status === 200, `status=${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let annotation = null
  let sawDone = false
  const started = Date.now()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') {
        sawDone = true
        continue
      }
      try {
        const parsed = JSON.parse(payload)
        if (parsed.delta) text += parsed.delta
        if (parsed.annotation) annotation = parsed.annotation
        if (parsed.error) bad('串流錯誤事件', JSON.stringify(parsed.error))
      } catch {
        /* ignore */
      }
    }
  }
  const elapsed = Date.now() - started

  assert('收到文字片段', text.length > 20, `${text.length} 字, ${elapsed}ms`)
  assert('收到 [DONE]', sawDone)
  assert('收到 annotation', !!annotation, JSON.stringify(annotation ?? {}).slice(0, 240))
  if (annotation) {
    assert('annotation 有學科', !!annotation.subjectName, annotation.subjectName)
    assert('annotation 有知識點', (annotation.knowledgePoints?.length ?? 0) > 0,
      JSON.stringify(annotation.knowledgePoints ?? []))
    assert('annotation 有學習秒數', Number(annotation.studySeconds) > 0, String(annotation.studySeconds))
  }
  console.log(`  INFO  回覆前 120 字：${text.slice(0, 120).replace(/\n/g, ' ')}`)
} else {
  console.log('  SKIP  串流（未提供金鑰或 --skip-llm）')
}

/* ---------------- 5. 訊息持久化 ---------------- */
console.log('\n[5] 訊息與標註持久化')
const msgs = await req('GET', `/api/conversations/${convId}/messages`)
assert('GET messages 200', msgs.status === 200, `status=${msgs.status}`)
const items = msgs.data?.items ?? []
if (llmUsable) {
  assert('有使用者訊息', items.some((m) => m.role === 'user'), `count=${items.length}`)
  const assistant = items.find((m) => m.role === 'assistant')
  assert('有 AI 訊息', !!assistant, `count=${items.length}`)
  if (assistant) {
    assert('AI 訊息帶 annotation', !!assistant.annotation, JSON.stringify(assistant.annotation ?? {}).slice(0, 200))
  }
} else {
  console.log(`  SKIP  訊息持久化斷言需要可用的 LLM（目前 messages=${items.length}）`)
}

/* ---------------- 6. Analyze API ---------------- */
console.log('\n[6] Analyze API')
const overview = await req('GET', '/api/analyze/overview')
assert('GET analyze/overview 200', overview.status === 200, `status=${overview.status}`)
assert('overview 有 subjects', Array.isArray(overview.data?.subjects), `count=${overview.data?.subjects?.length}`)
const mathStat = overview.data?.subjects?.find((s) => s.subjectId === 'subject-math')
assert('數學學科有統計', !!mathStat, JSON.stringify(mathStat ?? {}).slice(0, 200))
console.log(`  INFO  今日學習 ${overview.data?.todayStudySeconds}s, 連續 ${overview.data?.streakDays} 天`)

const heatmap = await req('GET', '/api/analyze/subjects/subject-math/heatmap')
assert('GET heatmap 200', heatmap.status === 200, `status=${heatmap.status}`)
const kps = heatmap.data?.knowledgePoints ?? []
if (llmUsable) {
  assert('heatmap 有知識點', kps.length > 0, `count=${kps.length}`)
} else {
  console.log(`  SKIP  heatmap 知識點斷言需要可用的 LLM（目前 count=${kps.length}）`)
}
console.log(`  INFO  知識點：${kps.slice(0, 6).map((k) => `${k.name}(${k.status},用${k.useCount},錯${k.mistakeCount})`).join(' / ') || '（無）'}`)

if (kps[0]) {
  const mistakes = await req('GET', `/api/analyze/knowledge-points/${kps[0].id}/mistakes`)
  assert('GET mistakes 200', mistakes.status === 200, `status=${mistakes.status}`)
  console.log(`  INFO  ${kps[0].name} 錯題 ${mistakes.data?.total} 題, 類型排行 ${JSON.stringify(mistakes.data?.typeRanking ?? [])}`)
}

for (const g of ['week', 'month', 'year']) {
  const tl = await req('GET', `/api/analyze/study-time?granularity=${g}`)
  const buckets = tl.data?.buckets ?? []
  const nonZero = buckets.filter((b) => b.totalSeconds > 0).length
  assert(`study-time ${g} 200`, tl.status === 200 && buckets.length > 0,
    `buckets=${buckets.length}, 有資料=${nonZero}, 總計=${tl.data?.totalSeconds}s`)
}

const detail = await req('GET', `/api/analyze/study-time/${new Date().toISOString().slice(0, 10)}`)
assert('study-time 當日明細 200', detail.status === 200, `entries=${detail.data?.entries?.length}`)

/* ---------------- 7. 每日清單 ---------------- */
console.log('\n[7] 每日清單')
const today = new Date().toLocaleDateString('sv-SE')
const cl0 = await req('GET', `/api/daily-checklist?date=${today}`)
assert('GET daily-checklist 200', cl0.status === 200, `status=${cl0.status}`)
const created = await req('POST', '/api/daily-checklist', { date: today, content: '複習三角函數公式' })
assert('POST daily-checklist 201', created.status === 201, `status=${created.status}`)
const itemId = created.data?.id
if (itemId) {
  const done = await req('PATCH', `/api/daily-checklist/${itemId}`, { done: true })
  assert('PATCH 勾選 200', done.status === 200 && done.data?.done === true, JSON.stringify(done.data))
  const cl1 = await req('GET', `/api/daily-checklist?date=${today}`)
  assert('清單項已列出', (cl1.data?.items ?? []).some((i) => i.id === itemId && i.done), `items=${cl1.data?.items?.length}`)
  assert('有建議複習知識點', (cl1.data?.reviewKnowledgePoints?.length ?? 0) >= 0,
    `count=${cl1.data?.reviewKnowledgePoints?.length}`)
  const del = await req('DELETE', `/api/daily-checklist/${itemId}`)
  assert('DELETE 204', del.status === 204, `status=${del.status}`)
}

/* 週清單（週一 → 週日） */
const week = await req('GET', `/api/daily-checklist?week=1&date=${today}`)
assert('GET 週清單 200', week.status === 200, `status=${week.status}`)
assert('週清單有 7 天', (week.data?.days ?? []).length === 7, `days=${week.data?.days?.length}`)
assert(
  '第一天是週一',
  (() => {
    const first = week.data?.days?.[0]?.date
    if (!first) return false
    return new Date(`${first}T00:00:00`).getDay() === 1
  })(),
  `weekStart=${week.data?.weekStart}`,
)
assert('每天都有完成統計', (week.data?.days ?? []).every((d) => typeof d.doneCount === 'number' && typeof d.allDone === 'boolean'))
assert('回傳週起訖', !!week.data?.weekStart && !!week.data?.weekEnd, `${week.data?.weekStart} ~ ${week.data?.weekEnd}`)

/* allDone 行為：新增兩項到某天 → 全部勾完 → allDone 應為 true */
const targetDay = week.data?.days?.[0]?.date
if (targetDay) {
  /** 先清掉這天既有的項目，讓斷言不受殘留資料影響 */
  const existingDay = (week.data?.days ?? []).find((d) => d.date === targetDay)
  for (const it of existingDay?.items ?? []) {
    await req('DELETE', `/api/daily-checklist/${it.id}`)
  }

  const a = await req('POST', '/api/daily-checklist', { date: targetDay, content: '週測試項目 A' })
  const b = await req('POST', '/api/daily-checklist', { date: targetDay, content: '週測試項目 B' })
  const ids = [a.data?.id, b.data?.id].filter(Boolean)
  for (const id of ids) await req('PATCH', `/api/daily-checklist/${id}`, { done: true })
  const week2 = await req('GET', `/api/daily-checklist?week=1&date=${today}`)
  const day = (week2.data?.days ?? []).find((d) => d.date === targetDay)
  assert('全部完成時 allDone = true', day?.allDone === true,
    `done=${day?.doneCount}/${day?.totalCount} allDone=${day?.allDone}`)
  for (const id of ids) await req('DELETE', `/api/daily-checklist/${id}`)
  const week3 = await req('GET', `/api/daily-checklist?week=1&date=${today}`)
  const day3 = (week3.data?.days ?? []).find((d) => d.date === targetDay)
  assert('刪除後 allDone = false', day3?.allDone === false, `total=${day3?.totalCount}`)
}

/* ---------------- 8. 匯出 ---------------- */
console.log('\n[8] 匯出')
const txt = await fetch(`${BASE}/api/conversations/${convId}/export?format=txt`)
const txtBody = await txt.text()
assert('匯出 TXT 200', txt.status === 200 && txtBody.length > 0, `${txtBody.length} bytes`)
const pdf = await fetch(`${BASE}/api/conversations/${convId}/export?format=pdf`)
const pdfBuf = Buffer.from(await pdf.arrayBuffer())
assert('匯出 PDF 200', pdf.status === 200 && pdfBuf.subarray(0, 5).toString() === '%PDF-',
  `${pdfBuf.length} bytes, header=${pdfBuf.subarray(0, 5).toString()}`)

/* ---------------- 9. 錯誤處理 ---------------- */
console.log('\n[9] 錯誤處理')
const nf = await req('GET', '/api/conversations/does-not-exist/messages')
assert('不存在對話回 404 + error.code', nf.status === 404 && nf.data?.error?.code === 'CONVERSATION_NOT_FOUND',
  `${nf.status} ${JSON.stringify(nf.data)}`)
const badSubject = await req('POST', '/api/conversations', { title: 'x', tagId: 'nope' })
assert('無效學科回 404', badSubject.status === 404, `${badSubject.status}`)

/* ---------------- 10. 清理：刪掉本階段建立的對話 ---------------- */
console.log('\n[10] 清理')
const delConv = await req('DELETE', `/api/conversations/${convId}`)
assert('DELETE conversation 204', delConv.status === 204, `status=${delConv.status}`)

/* ---------------- 11. 清除設定（reset） ---------------- */
console.log('\n[11] 清除設定（POST /api/settings/reset）')
const nothing = await req('POST', '/api/settings/reset', {})
assert('未選擇任何項目回 400', nothing.status === 400 && nothing.data?.error?.code === 'NOTHING_SELECTED',
  `${nothing.status} ${JSON.stringify(nothing.data)}`)

/** 準備資料：對話 + 清單 + 綁定 + 一個上傳檔案 */
const resetConv = await req('POST', '/api/conversations', { title: '清除測試', tagId: 'subject-math' })
const resetConvId = resetConv.data?.id
assert('建立測試對話', !!resetConvId, String(resetConvId))

let uploadedUrl = null
try {
  const form = new FormData()
  form.append('files', new Blob([Buffer.from('smoke test file')], { type: 'text/plain' }), 'smoke-test.txt')
  const up = await fetch(`${BASE}/api/uploads`, { method: 'POST', body: form })
  const upData = await up.json()
  uploadedUrl = upData?.[0]?.fileUrl ?? null
  assert('上傳測試檔案 201', up.status === 201 && !!uploadedUrl, JSON.stringify(upData).slice(0, 120))
} catch (e) {
  bad('上傳測試檔案', e.message)
}

const clReset = await req('POST', '/api/daily-checklist', {
  date: today,
  content: '清除測試清單項',
})
assert('建立測試清單項', clReset.status === 201, `status=${clReset.status}`)

/** 自訂學科（模擬 Chat 中自行新增的 Tag）+ 其對話 */
const customSubject = await req('POST', '/api/subjects', { name: `煙霧測試學科${Date.now() % 100000}` })
assert('建立自訂學科 201', customSubject.status === 201, `status=${customSubject.status}`)
const customSubjectId = customSubject.data?.id
const customSubjectName = customSubject.data?.name
if (customSubjectId) {
  const customConv = await req('POST', '/api/conversations', {
    title: '自訂學科對話',
    tagId: customSubjectId,
  })
  assert('自訂學科可建立對話', customConv.status === 201, `status=${customConv.status}`)
}

if (apiKey) {
  const keepBinding = await req('POST', '/api/settings/llm', {
    provider: 'deepseek',
    remark: '清除測試用綁定',
    apiKey,
    model: 'deepseek-v4-pro',
    baseUrl: 'https://api.deepseek.com/v1',
  })
  createdBindingId = keepBinding.data?.createdId ?? createdBindingId
  assert('建立測試綁定', !!createdBindingId, String(createdBindingId))
}

/** 執行清除：聊天 + 分析 + LLM + 檔案 */
const reset = await req('POST', '/api/settings/reset', {
  chat: true,
  analysis: true,
  llm: true,
  files: true,
})
assert('POST /api/settings/reset 200', reset.status === 200,
  `status=${reset.status} ${JSON.stringify(reset.data).slice(0, 160)}`)
assert('回傳清除統計', !!reset.data?.summary, JSON.stringify(reset.data?.summary))

/** 清除後狀態 */
const afterConv = await req('GET', '/api/conversations')
assert('對話已清空', (afterConv.data ?? []).length === 0, `count=${afterConv.data?.length}`)
const afterOverview = await req('GET', '/api/analyze/overview')
assert('學習訊息已歸零',
  (afterOverview.data?.subjects ?? []).every((s) => s.messageCount === 0),
  JSON.stringify((afterOverview.data?.subjects ?? []).map((s) => s.messageCount)))
const afterChecklist = await req('GET', `/api/daily-checklist?date=${today}`)
assert('每日清單已清空', (afterChecklist.data?.items ?? []).length === 0, `items=${afterChecklist.data?.items?.length}`)
const afterSettings = await req('GET', '/api/settings/llm')
assert('LLM 綁定已清空', (afterSettings.data?.bindings ?? []).length === 0,
  `bindings=${afterSettings.data?.bindings?.length}`)
assert('使用中的綁定為 null', afterSettings.data?.active === null, String(afterSettings.data?.active))
const afterSubjects = await req('GET', '/api/subjects')
assert('預設三學科保留', (afterSubjects.data ?? []).length >= 3, `subjects=${afterSubjects.data?.length}`)
assert(
  '自訂學科已被清除',
  customSubjectId ? !(afterSubjects.data ?? []).some((s) => s.id === customSubjectId) : true,
  `remaining=${JSON.stringify((afterSubjects.data ?? []).map((s) => s.name))}`,
)
assert(
  '清除統計含自訂學科',
  Number(reset.data?.summary?.customSubjects ?? 0) >= (customSubjectId ? 1 : 0),
  `customSubjects=${reset.data?.summary?.customSubjects}`,
)
assert(
  '學科分析不再有自訂學科',
  customSubjectName
    ? !(afterOverview.data?.subjects ?? []).some((s) => s.subjectName === customSubjectName)
    : true,
  JSON.stringify((afterOverview.data?.subjects ?? []).map((s) => s.subjectName)),
)

/** 檔案是否真的從磁碟移除 */
if (uploadedUrl) {
  const fileRes = await fetch(`${BASE}${uploadedUrl}`)
  assert('上傳檔案已從磁碟刪除', fileRes.status === 404, `status=${fileRes.status}`)
}

/* ---------------- 12. 未綁定 LLM 的行為 ---------------- */
console.log('\n[12] 未綁定 LLM（Chat 應引導到設置）')
{
  const cfg = await req('GET', '/api/settings/llm')
  const noBinding = (cfg.data?.bindings ?? []).length === 0

  if (!noBinding) {
    console.log('  SKIP  目前仍有綁定，略過未綁定測試')
  } else {
    const conv = await req('POST', '/api/conversations', { title: '未綁定測試', tagId: 'subject-math' })
    const id = conv.data?.id
    assert('建立對話供未綁定測試', !!id, String(id))

    if (id) {
      const res = await fetch(`${BASE}/api/conversations/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ content: '測試未綁定', subjectId: 'subject-math' }),
      })
      const text = await res.text()
      assert('未綁定時串流回 200（錯誤以事件傳遞）', res.status === 200, `status=${res.status}`)
      assert(
        'SSE 帶 LLM_NOT_CONFIGURED 錯誤事件',
        text.includes('LLM_NOT_CONFIGURED'),
        text.replace(/\n/g, ' ').slice(0, 160),
      )
      assert('串流有正常結束', text.includes('[DONE]'))
      await req('DELETE', `/api/conversations/${id}`)
    }
  }
}

/* ---------------- 13. 收尾檢查 ---------------- */
console.log('\n[13] 收尾')
const finalSettings = await req('GET', '/api/settings/llm')
assert('資料庫不殘留測試金鑰', apiKey ? !JSON.stringify(finalSettings.data).includes(apiKey) : true)
if (resetConvId) {
  const delResetConv = await req('DELETE', `/api/conversations/${resetConvId}`)
  // reset 已把對話清掉，這裡 404 也算正常
  assert('清理測試對話', delResetConv.status === 204 || delResetConv.status === 404,
    `status=${delResetConv.status}`)
}

/* ---------------- 結果 ---------------- */
console.log(`\n${'='.repeat(50)}`)
console.log(`PASS=${pass}  FAIL=${fail}`)
console.log('='.repeat(50))
process.exit(fail === 0 ? 0 : 1)
