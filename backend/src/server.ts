import { readEnvironment } from './config/env.js'
import { createPool } from './db/pool.js'
import { createAuth } from './lib/auth.js'
import { createApp } from './app.js'

const env = readEnvironment()
const pool = createPool(env.DATABASE_URL)
pool.on('error', () => console.error('An idle database connection failed.'))
try {
  await pool.query('SELECT 1')
  const server = createApp(createAuth(pool, env), env).listen(env.PORT, '0.0.0.0', () => {
    console.log(`API listening on port ${env.PORT}`)
  })
  const shutdown = () => {
    server.close(() => { void pool.end().then(() => process.exit(0)) })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
} catch {
  console.error('Server could not start. Check PostgreSQL, backend/.env, and npm run db:migrate.')
  await pool.end()
  process.exitCode = 1
}
