/**
 * SQLite 連線 + Migration（Drizzle ORM + better-sqlite3）
 * ============================================================
 * - 資料庫檔案：process.env.DATABASE_PATH（預設 ./data/app.db）
 * - 第一次使用時自動建立檔案、建立所有資料表、寫入預設學科
 * - dev 模式下 HMR 會重複載入模組，因此用 globalThis 快取連線
 *
 * 這個檔案只能在伺服器端（API Routes / Server Components）import。
 */

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type DB = BetterSQLite3Database<typeof schema>

/** 資料表 DDL（與 schema.ts 對應；新增欄位時請同步更新） */
const DDL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS llm_bindings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS llm_bindings_created_idx ON llm_bindings (created_at);

CREATE TABLE IF NOT EXISTS llm_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_unique ON subjects (name);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS conversations_subject_idx ON conversations (subject_id);
CREATE INDEX IF NOT EXISTS conversations_updated_idx ON conversations (updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  attachments TEXT,
  feedback TEXT,
  feedback_reason TEXT,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS message_annotations (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  study_type TEXT,
  study_seconds INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'llm',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS message_annotations_subject_idx ON message_annotations (subject_id);
CREATE INDEX IF NOT EXISTS message_annotations_conversation_idx ON message_annotations (conversation_id);

CREATE TABLE IF NOT EXISTS knowledge_points (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  use_count INTEGER NOT NULL DEFAULT 0,
  mistake_count INTEGER NOT NULL DEFAULT 0,
  corrected_count INTEGER NOT NULL DEFAULT 0,
  mastery REAL NOT NULL DEFAULT 0,
  first_studied_at TEXT,
  last_studied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_points_subject_name_unique ON knowledge_points (subject_id, name);
CREATE INDEX IF NOT EXISTS knowledge_points_subject_idx ON knowledge_points (subject_id);

CREATE TABLE IF NOT EXISTS message_knowledge_points (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  knowledge_point_id TEXT NOT NULL REFERENCES knowledge_points(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (message_id, knowledge_point_id)
);
CREATE INDEX IF NOT EXISTS mkp_kp_idx ON message_knowledge_points (knowledge_point_id);
CREATE INDEX IF NOT EXISTS mkp_conversation_idx ON message_knowledge_points (conversation_id);

CREATE TABLE IF NOT EXISTS mistakes (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT '其他',
  question TEXT,
  user_answer TEXT,
  correction TEXT,
  corrected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS mistakes_kp_idx ON mistakes (knowledge_point_id);
CREATE INDEX IF NOT EXISTS mistakes_subject_idx ON mistakes (subject_id);
CREATE INDEX IF NOT EXISTS mistakes_type_idx ON mistakes (type);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  study_type TEXT NOT NULL DEFAULT 'learn',
  seconds INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS study_sessions_day_idx ON study_sessions (day);
CREATE INDEX IF NOT EXISTS study_sessions_subject_idx ON study_sessions (subject_id, day);

CREATE TABLE IF NOT EXISTS daily_checklist (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'manual',
  knowledge_point_id TEXT REFERENCES knowledge_points(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS daily_checklist_date_idx ON daily_checklist (date, sort_order);
`

/** 預設學科：中文 / English / 數學 */
export const DEFAULT_SUBJECTS_SEED = [
  { id: 'subject-chinese', name: '中文', color: '#F0752E', sortOrder: 1 },
  { id: 'subject-english', name: 'English', color: '#4C8DF6', sortOrder: 2 },
  { id: 'subject-math', name: '數學', color: '#3FB984', sortOrder: 3 },
]

interface DbCache {
  sqlite: Database.Database
  db: DB
}

const globalForDb = globalThis as unknown as { __dshChatAppDb?: DbCache }

function resolveDbPath(): string {
  const raw = process.env.DATABASE_PATH || './data/app.db'
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw)
}

function createDb(): DbCache {
  const file = resolveDbPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })

  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(DDL)

  // 預設學科（idempotent）
  const insertSubject = sqlite.prepare(
    `INSERT INTO subjects (id, name, color, is_default, sort_order)
     VALUES (@id, @name, @color, 1, @sortOrder)
     ON CONFLICT(id) DO NOTHING`,
  )
  const seedAll = sqlite.transaction(() => {
    for (const s of DEFAULT_SUBJECTS_SEED) insertSubject.run(s)
  })
  seedAll()

  const db = drizzle(sqlite, { schema })
  return { sqlite, db }
}

/** 取得（必要時建立）資料庫連線 */
export function getDb(): DB {
  if (!globalForDb.__dshChatAppDb) {
    globalForDb.__dshChatAppDb = createDb()
  }
  return globalForDb.__dshChatAppDb.db
}

/** 取得底層 better-sqlite3 連線（需要執行原生 SQL 時使用，例如聚合統計） */
export function getRawDb(): Database.Database {
  getDb()
  return globalForDb.__dshChatAppDb!.sqlite
}

export { schema }
export const DB_FILE = resolveDbPath
