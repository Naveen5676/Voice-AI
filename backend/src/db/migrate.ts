import { getMigrations } from 'better-auth/db/migration'
import { readEnvironment } from '../config/env.js'
import { authOptions } from '../lib/auth.js'
import { createPool } from './pool.js'

const env = readEnvironment()
const pool = createPool(env.DATABASE_URL)
try {
  const { runMigrations } = await getMigrations(authOptions(pool, env))
  await runMigrations()
  console.log('Authentication database is up to date.')
} catch {
  console.error('Migration failed. Check DATABASE_URL and database permissions.')
  process.exitCode = 1
} finally {
  await pool.end()
}
