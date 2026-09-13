# AI 教師平台（Chat + Analyze）

Next.js 14（App Router）+ TypeScript + React + Tailwind CSS + shadcn/ui 風格元件 + Radix UI +
Lucide + Framer Motion + Zustand + TanStack Query + React Hook Form / Zod +
**Vercel AI SDK**（LLM 串流）+ **Recharts**（圖表）+ **SQLite**（本地儲存）+ **Drizzle ORM**。

平台分為兩部分：

| 部分 | 路由 | 職責 |
|------|------|------|
| **Chat** | `/` | AI 對話；每則 AI 回覆附帶**學科 / 知識點 / 錯題**標註，作為 Analyze 的資料來源 |
| **Analyze** | `/analyze` | 分析學習數據；三層導覽（見下） |
| **設置** | `/settings` | **LLM 綁定**（可多筆，含備註）、**關於我們**、**資料儲存** |

## 快速開始

```bash
npm install
cp .env.example .env.local   # 不需要填任何金鑰
npm run dev                  # http://localhost:3000
```

第一次啟動會自動建立本地資料庫 `./data/app.db` 並寫入預設學科（中文 / English / 數學）。

### LLM 綁定（唯一入口：設置頁面）

**金鑰只能透過介面輸入**；程式碼、`.env.local` 與 `.env.example` 都不提供任何金鑰。

1. 開啟 `/settings` → 展開「**LLM 綁定**」。
2. 選廠商 → 填 **備註**、**API Key**、**模型名稱**（自行輸入官方模型 id）、Base URL。
3. 可先按「測試連線」確認，再按「儲存綁定」。
4. 已綁定的模型以「**備註 + 模型名稱**」顯示，可切換使用中（星號）、編輯備註、測試、**刪除**（可存多筆）。

支援廠商（皆走 OpenAI 相容 `/chat/completions`）：**DeepSeek、GPT(OpenAI)、Claude(Anthropic)、
Gemini(Google)、Qwen(阿里雲)、GLM(智譜 Z.ai)、Kimi(Moonshot)、Grok(xAI)、自訂 Base URL**。

模型名稱跟隨官方命名（介面不提供快捷選擇，請依官方文件填寫）；官方文件連結：

| 廠商 | 目前官方模型 id（範例） | 官方文件 |
|------|------------------------|----------|
| DeepSeek | `deepseek-v4-pro`、`deepseek-flash` | [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing) |
| OpenAI | `gpt-5.6`、`gpt-5.6-sol`、`gpt-5.5` | [Models](https://platform.openai.com/docs/models) |
| Anthropic | `claude-opus-5`、`claude-sonnet-5` | [Models overview](https://docs.anthropic.com/en/docs/about-claude/models) |
| Google | `gemini-3.8-flash`、`gemini-3.7-flash` | [Gemini models](https://ai.google.dev/gemini-api/docs/models) |
| Qwen | `qwen3.8-max`、`qwen3.8-flash` | [Model Studio](https://www.alibabacloud.com/help/en/model-studio/models) |
| GLM | `glm-5.3`、`glm-5.3-flash` | [Z.ai docs](https://docs.z.ai/guides/overview/pricing) |
| Kimi | `kimi-k3`、`kimi-k2.7-code` | [Kimi 模型列表](https://platform.kimi.com/docs/models) |
| Grok | `grok-4.6`、`grok-4.5` | [xAI models](https://docs.x.ai/docs/models) |

> 廠商更新模型後，直接在介面輸入新的官方 id 即可，不需要改程式碼。

### 設置頁面（/settings）

入口式版面，**預設全部收合**，不會自動展開任何區塊：

| 入口 | 內容 |
|------|------|
| **LLM 綁定** | 綁定 / 檢視 / 刪除模型（可多筆、可切換使用中） |
| **清除設定** | 獨立區塊（不在 LLM 綁定內）：勾選要清除的歷史聊天 / 分析內容 / LLM 儲存內容 / 上傳檔案，確認後清除本機資料庫與磁碟檔案 |
| **關於我們** | 作者、GitHub 開源位址、Gmail 聯絡按鈕 |
| **資料儲存** | 本地存放位置與隱私說明 |

**只有**從 Chat 以 `?entry=<llm|clear|about|storage>` 跳轉過來時，才會自動展開指定的那個區塊
（例如尚未綁定 LLM 時，Chat 的提示按鈕會帶 `?entry=llm`）。

### Chat 的 Markdown、空狀態與未綁定引導

- AI 與使用者的訊息都會**渲染 Markdown**（標題、粗體、斜體、清單、程式碼區塊含語法著色、引用、表格、連結）；
  串流中的游標仍會正確黏在最後一段。
- **尚未新增任何對話時**：畫面為模糊底板 + 放大的「還沒有任何對話」提示與「**新增對話**」按鈕，
  且**不顯示輸入框**（沒有對話就沒有可送出的地方）。
- **尚未綁定 LLM 時**送出訊息：後端串流回 `LLM_NOT_CONFIGURED`，輸入框上方會出現提示橫幅，
  並提供「**前往綁定 LLM**」按鈕直接跳到 `/settings?entry=llm`（該區塊會自動展開）。

### 清除設定的範圍

| 勾選項目 | 清除內容 |
|----------|----------|
| 歷史聊天 | 對話、訊息、AI 標註、知識點關聯、學習時間、錯題、每日清單，以及 **Chat 中自訂新增的學科（Tag）** |
| 分析內容 | 知識點、錯題、學習時間、每日清單，以及 **Chat 中自訂新增的學科** |
| LLM 儲存內容 | 已綁定的廠商、API Key、模型與其他設定 |
| 已上傳的檔案 | `data/uploads/` 內的實體檔案 |

預設三學科（中文 / English / 數學）為系統基礎資料，**永遠保留**。

## Analyze 導覽層級

| 層級 | 畫面 | 內容 | 查詢參數 |
|------|------|------|----------|
| 一級 | 分析首頁 | 三個入口：**學科分析**、**學習時間記錄**、**每日清單**（含學習摘要；不含學科篩選與佔比預覽） | `/analyze` |
| 1-2 | 學科分析 | 圓餅圖 + **學科篩選**（勾選要顯示的學科，控制圓餅圖內容）；點擊學科 → 二級 | `?view=subjects` |
| 1-2-2 | 知識點熱力圖 | 該學科的知識點，以顏色代表狀態（剛學習 / 已學習 / 使用次數多 / 熟練度低 / 已熟練）；點擊知識點 → 三級 | `?view=subjects&subject=<id>` |
| 1-2-3 | 錯題統計 | 該知識點的錯題統計（彙整 Chat 中的錯題）＋ 錯題類型排行柱形圖 | `?view=subjects&subject=<id>&kp=<id>` |
| 2-2 | 學習時間記錄 | 每天學習時間柱形圖，可切換 **週 / 月 / 年** 縮放時間線；點擊某天的柱子 → 當天學習 / 複習的學科與知識點明細 | `?view=study-time` |
| 3-2 | 每日清單 | **週一到週日**的清單；上方切換「編輯清單 / 查看清單」，下方是當日內容。查看模式點項目會先確認再打勾，**當日全部完成顯示「當日任務全部完成」**；下方另有建議複習知識點 | `?view=daily-checklist` |

導覽狀態存在 URL 查詢參數，可用瀏覽器上一頁返回、可直接分享連結。

### 每日清單操作

| 模式 | 可以做的事 |
|------|-----------|
| **編輯清單** | 新增項目（Enter 送出）、刪除項目；可編輯過去與未來日期 |
| **查看清單** | 點擊未完成項目 → 跳出確認 → 確認後打勾；已完成的可以取消完成 |

上方一排是週一到週日，每格顯示完成進度（`2/5`）或 ✅（當日全部完成）；可切換上/下一週與回到本週。

## 資料流（Chat → Analyze）

```
建立對話（必選學科）
  └─ 送出訊息 → POST /api/conversations/:id/chat（SSE）
       ├─ data: {"delta": "..."}          逐字顯示 AI 回覆
       ├─ data: {"ids": {...}}            校正前端樂觀插入的訊息 id
       ├─ data: {"annotation": {...}}     學科 / 知識點 / 錯題 / 學習型態 / 學習秒數
       └─ data: [DONE]

標註寫入 SQLite
  ├─ message_annotations   這則回覆的學科、學習型態、學習秒數
  ├─ knowledge_points      知識點（次數、錯題數、熟練度、狀態自動推估）
  ├─ mistakes              錯題（題目、正確解、類型）
  └─ study_sessions        學習時間（依當地日期分桶）
        ↓
Analyze API 聚合 → 圓餅圖 / 熱力圖 / 錯題排行 / 學習時間柱形圖 / 每日清單
```

標註由 LLM 抽取（嚴格 JSON）；若模型無法回覆或回傳格式錯誤，改用**本地規則推估**
（學習型態、學習秒數、名詞短語抽取、錯題字樣偵測），這是降級行為、不是假資料。

## 技術棧對照

| 分類 | 選用 | 說明 |
|------|------|------|
| 框架 / 語言 / UI | Next.js 14 App Router、TypeScript、React 18 | — |
| 樣式 / 元件 / 圖示 / 動效 | Tailwind CSS、shadcn/ui 風格自建元件 + Radix UI、Lucide、Framer Motion | 元件原始碼在 `src/components/ui.tsx`，無需 CLI |
| 狀態 / 伺服器資料 / 表單 | Zustand、TanStack Query、React Hook Form + Zod | Zod 同時用於 API 輸入驗證 |
| LLM 串流 | **Vercel AI SDK**（`ai` + `@ai-sdk/openai`） | 以 `createOpenAI({ baseURL })` 接入所有 OpenAI 相容廠商 || 圖表 | **Recharts** | 圓餅圖、柱形圖（橫向排行、堆疊時間軸） |
| 資料庫 | **SQLite**（`better-sqlite3` 13） | 全部資料本地儲存，檔案 `./data/app.db`（WAL 模式） |
| ORM | **Drizzle ORM**（+ drizzle-kit） | `src/lib/db/schema.ts` 為型別化 schema；migration 由 `src/lib/db/index.ts` 的 DDL 自動套用 |

> 說明：`better-sqlite3` 是同步 API，對這種單機本地應用最直接；`node:sqlite` 需要 Node 22+ 且當時仍是實驗性，
> 因此沒有採用。schema 仍以 Drizzle 表達（型別安全），DDL 與 schema 保持同步。

## 目錄結構

```
src/
├── app/
│   ├── page.tsx                   # Chat 頁
│   ├── settings/page.tsx          # 設置入口：LLM 綁定 / 關於我們 / 資料儲存
│   ├── analyze/
│   │   ├── page.tsx               # Server 入口（Suspense 邊界）
│   │   └── analyze-client.tsx     # 分析頁三層導覽與各層畫面
│   └── api/                       # 本地後端（Next.js Route Handlers）
│       ├── subjects, tags         # 學科（/api/tags 為相容路徑）
│       ├── conversations/[id]     # 對話 CRUD、訊息、SSE 串流、匯出
│       ├── messages/[id]/feedback # 訊息反饋
│       ├── analyze/...            # overview / heatmap / mistakes / study-time
│       ├── daily-checklist        # 每日清單（?week=1 取得週一到週日）
│       ├── uploads                # 附件上傳與讀回
│       ├── settings/llm, .../test # LLM 綁定（多筆）與連線測試
│       └── settings/reset         # 清除本機資料（含磁碟附件）
├── components/
│   ├── ui.tsx / charts.tsx        # 基礎元件 / Recharts 圖表封裝
│   ├── markdown.tsx               # 輕量 Markdown 渲染（無額外依賴）
│   ├── llm-binding-panel.tsx      # LLM 綁定面板（新增 / 已綁定 / 刪除）
│   ├── clear-data-button.tsx      # 清除設定：獨立區塊 + 確認彈窗
│   ├── daily-checklist-view.tsx   # 每日清單（週一到週日，編輯 / 查看）
│   └── sidebar / chat-* / dialogs
├── hooks/                         # use-chat-api（含 SSE）/ use-analyze-api
├── lib/
│   ├── api/                       # 前端 HTTP/SSE 客戶端 + 接口總表
│   ├── db/                        # SQLite：schema.ts / index.ts（DDL+連線）/ mappers.ts
│   ├── llm/                       # providers.ts（廠商目錄）/ bindings.ts（多筆綁定）/ client.ts / annotate.ts
│   ├── server/                    # queries.ts / analytics.ts / chat-stream.ts / sse.ts / http.ts
│   ├── constants.ts               # 預設學科、圖表調色盤、知識點狀態
│   └── types.ts                   # 前後端資料契約
└── store/chat-store.ts            # Zustand UI 狀態

scripts/
├── smoke.mjs                      # 端到端 API/串流煙霧測試（npm run smoke）
└── db-maintenance.mjs             # 本地資料庫巡檢 / 清理（npm run db:check）
```

## 常用指令

```bash
npm run dev        # 開發伺服器
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint
npm run smoke      # 端到端煙霧測試（需先啟動伺服器；可帶 SMOKE_LLM_KEY 測 LLM 串流）
npm run db:check   # 資料庫統計
npm run db:studio  # Drizzle Studio（可視化檢視 SQLite）
```

## 安全性說明

- **不提供任何預設金鑰**：`.env.example` / `.env.local` 沒有 LLM 設定，程式碼也沒有硬編碼金鑰；
  API Key 只能由使用者在「設置 → LLM 綁定」輸入。
- API Key 存在本地 SQLite（`llm_bindings` 表），介面只回傳遮蔽值（例：`sk-aa21****5a76`），
  `GET /api/settings/llm` 不會回傳明文。
- 本機應用沒有登入機制，任何能連到這個服務的人都能改設定；部署到公開網路前請自行加上驗證
  （`src/lib/api/client.ts` 的 `authHeaders()` 與 Route Handler 的檢查）。
- 附件上傳限制：pdf / docx / txt / png / jpg / jpeg，單檔 10MB，單次最多 5 個。
#   A I - L e a r n i n g - A s i s t  
 