/**
 * SQLite 資料庫 Schema（Drizzle ORM）
 * ============================================================
 * 所有資料都存本地 SQLite（預設 ./data/app.db），無外部服務。
 *
 * 表一覽：
 *   settings              設置（key-value）
 *   llm_bindings          LLM 綁定（可多筆：備註 + 官方模型名稱 + Base URL + 金鑰）
 *   llm_settings          LLM 相關設定（目前使用中的綁定 id）
 *   subjects              學科（中文 / English / 數學 + 自訂）
 *   conversations         對話（綁定一個學科）
 *   messages              訊息（AI 回覆可帶 annotation）
 *   message_annotations   AI 標註：學科 / 知識點 / 錯題 / 學習型態 / 學習秒數
 *   knowledge_points      知識點（隸屬學科，帶狀態與熟練度）
 *   message_knowledge_points  訊息 ↔ 知識點（多對多）
 *   mistakes              錯題（供「錯題統計」與類型排行）
 *   study_sessions        學習時間紀錄（供「學習時間記錄」）
 *   daily_checklist       每日清單（用戶自訂 + 複習知識點）
 *
 * 欄位命名：DB 用 snake_case；API 回傳時轉成前端契約的 camelCase
 * （見 src/lib/db/mappers.ts），前端型別定義在 src/lib/types.ts。
 */

import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/* ---------------- settings ---------------- */

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/* ---------------- llm_bindings（LLM 綁定，可多筆） ---------------- */

export const llmBindings = sqliteTable(
  'llm_bindings',
  {
    id: text('id').primaryKey(),
    /** deepseek | openai | anthropic | google | qwen | glm | kimi | grok | custom */
    provider: text('provider').notNull(),
    /** 使用者備註（儲存區塊以「備註 + 模型名稱」顯示） */
    remark: text('remark').notNull().default(''),
    /** 官方模型 id */
    model: text('model').notNull(),
    baseUrl: text('base_url').notNull(),
    /** API Key（只存本機；對外一律遮蔽） */
    apiKey: text('api_key').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    createdIdx: index('llm_bindings_created_idx').on(t.createdAt),
  }),
)

/* ---------------- llm_settings（目前使用中的綁定） ---------------- */

export const llmSettings = sqliteTable('llm_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

/* ---------------- subjects（學科） ---------------- */

export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** 學科代表色（hex） */
    color: text('color'),
    /** 是否為系統預設學科（中文 / English / 數學） */
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    nameUnique: uniqueIndex('subjects_name_unique').on(t.name),
  }),
)

/* ---------------- conversations ---------------- */

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    subjectIdx: index('conversations_subject_idx').on(t.subjectId),
    updatedIdx: index('conversations_updated_idx').on(t.updatedAt),
  }),
)

/* ---------------- messages ---------------- */

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** user | assistant | system */
    role: text('role').notNull(),
    content: text('content').notNull().default(''),
    /** 附件陣列（JSON 字串，型別 AttachmentMeta[]） */
    attachments: text('attachments'),
    /** up | down */
    feedback: text('feedback'),
    feedbackReason: text('feedback_reason'),
    /** 這則回覆使用的 LLM 模型（assistant 訊息） */
    model: text('model'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    conversationIdx: index('messages_conversation_idx').on(t.conversationId, t.createdAt),
  }),
)

/* ---------------- message_annotations（AI 標註） ---------------- */

export const messageAnnotations = sqliteTable(
  'message_annotations',
  {
    messageId: text('message_id')
      .primaryKey()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    /** learn | review | practice */
    studyType: text('study_type'),
    /** 這則回覆花費的學習秒數 */
    studySeconds: integer('study_seconds').notNull().default(0),
    /** 標註來源：llm | heuristic | user */
    source: text('source').notNull().default('llm'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    subjectIdx: index('message_annotations_subject_idx').on(t.subjectId),
    conversationIdx: index('message_annotations_conversation_idx').on(t.conversationId),
  }),
)

/* ---------------- knowledge_points（知識點） ---------------- */

export const knowledgePoints = sqliteTable(
  'knowledge_points',
  {
    id: text('id').primaryKey(),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** 所屬單元 / 章節（熱力圖分組用） */
    unit: text('unit'),
    /** new | learning | frequent | weak | mastered */
    status: text('status').notNull().default('new'),
    /** 出現（使用）次數 */
    useCount: integer('use_count').notNull().default(0),
    /** 錯題數 */
    mistakeCount: integer('mistake_count').notNull().default(0),
    /** 已訂正錯題數 */
    correctedCount: integer('corrected_count').notNull().default(0),
    /** 0–100 熟練度 */
    mastery: real('mastery').notNull().default(0),
    firstStudiedAt: text('first_studied_at'),
    lastStudiedAt: text('last_studied_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    subjectNameUnique: uniqueIndex('knowledge_points_subject_name_unique').on(t.subjectId, t.name),
    subjectIdx: index('knowledge_points_subject_idx').on(t.subjectId),
  }),
)

export const messageKnowledgePoints = sqliteTable(
  'message_knowledge_points',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    knowledgePointId: text('knowledge_point_id')
      .notNull()
      .references(() => knowledgePoints.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.knowledgePointId] }),
    kpIdx: index('mkp_kp_idx').on(t.knowledgePointId),
    conversationIdx: index('mkp_conversation_idx').on(t.conversationId),
  }),
)

/* ---------------- mistakes（錯題） ---------------- */

export const mistakes = sqliteTable(
  'mistakes',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    knowledgePointId: text('knowledge_point_id').references(() => knowledgePoints.id, {
      onDelete: 'set null',
    }),
    /** 錯題類型（排行柱狀圖的維度） */
    type: text('type').notNull().default('其他'),
    question: text('question'),
    userAnswer: text('user_answer'),
    correction: text('correction'),
    corrected: integer('corrected', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    kpIdx: index('mistakes_kp_idx').on(t.knowledgePointId),
    subjectIdx: index('mistakes_subject_idx').on(t.subjectId),
    typeIdx: index('mistakes_type_idx').on(t.type),
  }),
)

/* ---------------- study_sessions（學習時間） ---------------- */

export const studySessions = sqliteTable(
  'study_sessions',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    knowledgePointId: text('knowledge_point_id').references(() => knowledgePoints.id, {
      onDelete: 'set null',
    }),
    /** learn | review | practice */
    studyType: text('study_type').notNull().default('learn'),
    seconds: integer('seconds').notNull().default(0),
    /** 當地日期 YYYY-MM-DD（統計以本地日為準） */
    day: text('day').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    dayIdx: index('study_sessions_day_idx').on(t.day),
    subjectIdx: index('study_sessions_subject_idx').on(t.subjectId, t.day),
  }),
)

/* ---------------- daily_checklist（每日清單） ---------------- */

export const dailyChecklist = sqliteTable(
  'daily_checklist',
  {
    id: text('id').primaryKey(),
    /** YYYY-MM-DD */
    date: text('date').notNull(),
    content: text('content').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    /** manual = 用戶自己輸入；review = 系統建議的複習知識點 */
    kind: text('kind').notNull().default('manual'),
    knowledgePointId: text('knowledge_point_id').references(() => knowledgePoints.id, {
      onDelete: 'set null',
    }),
    subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    dateIdx: index('daily_checklist_date_idx').on(t.date, t.sortOrder),
  }),
)

/* ---------------- relations ---------------- */

export const subjectsRelations = relations(subjects, ({ many }) => ({
  conversations: many(conversations),
  knowledgePoints: many(knowledgePoints),
}))

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  subject: one(subjects, { fields: [conversations.subjectId], references: [subjects.id] }),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  annotation: one(messageAnnotations, {
    fields: [messages.id],
    references: [messageAnnotations.messageId],
  }),
  knowledgePoints: many(messageKnowledgePoints),
}))

export const knowledgePointsRelations = relations(knowledgePoints, ({ one, many }) => ({
  subject: one(subjects, { fields: [knowledgePoints.subjectId], references: [subjects.id] }),
  messages: many(messageKnowledgePoints),
  mistakes: many(mistakes),
}))
