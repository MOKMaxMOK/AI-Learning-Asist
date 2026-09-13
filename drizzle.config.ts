import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle Kit 設定（只用於產生 migration / studio）
 * 實際連線與 migration 執行見 src/lib/db/index.ts
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? './data/app.db',
  },
})
