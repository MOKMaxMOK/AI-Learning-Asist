/**
 * 資料庫維護腳本（保留開源工具的必要部分：本地 SQLite 巡檢 / 清理）
 * 用法：
 *   node scripts/db-maintenance.mjs            # 只顯示統計
 *   node scripts/db-maintenance.mjs --clean    # 清掉沒有訊息引用的孤兒知識點
 */

import Database from 'better-sqlite3'

const dbPath = process.env.DATABASE_PATH || './data/app.db'
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const TABLES = [
  'subjects',
  'conversations',
  'messages',
  'message_annotations',
  'knowledge_points',
  'message_knowledge_points',
  'mistakes',
  'study_sessions',
  'daily_checklist',
  'settings',
]

console.log(`資料庫：${dbPath}\n`)
for (const t of TABLES) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get()
  console.log(`  ${t.padEnd(26)} ${n}`)
}

console.log('\n知識點：')
const kps = db
  .prepare(
    `SELECT kp.name, kp.status, kp.use_count, kp.mistake_count, s.name AS subject,
            (SELECT COUNT(*) FROM message_knowledge_points m WHERE m.knowledge_point_id = kp.id) AS linked
       FROM knowledge_points kp LEFT JOIN subjects s ON s.id = kp.subject_id
      ORDER BY kp.use_count DESC`,
  )
  .all()
if (kps.length === 0) console.log('  （無）')
for (const k of kps) {
  console.log(
    `  ${String(k.subject ?? '-').padEnd(8)} ${k.name.padEnd(20)} ${k.status.padEnd(9)} 用${k.use_count} 錯${k.mistake_count} 連結${k.linked}`,
  )
}

if (process.argv.includes('--clean')) {
  const info = db
    .prepare(
      `DELETE FROM knowledge_points
        WHERE id NOT IN (SELECT DISTINCT knowledge_point_id FROM message_knowledge_points)`,
    )
    .run()
  console.log(`\n已清除孤兒知識點：${info.changes} 筆`)
}

db.close()
