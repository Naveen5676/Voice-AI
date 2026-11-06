import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { Pool } from 'pg'

const root = fileURLToPath(new URL('../', import.meta.url))
const local = path.join(root, '.local')
const envFile = path.join(root, 'backend', '.env')
const pgBin = process.env.PG_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '')
const binary = (name) => pgBin ? path.join(pgBin, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name
const data = path.join(local, 'postgres')
const run = (name, args, allowFailure = false) => {
  // A background postgres process can inherit captured pipes on Windows and
  // keep spawnSync waiting indefinitely. No child pipes are needed here.
  const result = spawnSync(binary(name), args, { stdio: 'ignore', windowsHide: true })
  if (!allowFailure && (result.error || result.status !== 0)) throw new Error(`${name} failed. Check PG_BIN, PostgreSQL installation, and .local/postgres.log. ${result.error?.message || ''}`)
  return result.status === 0
}

try {
  mkdirSync(local, { recursive: true })
  if (!existsSync(path.join(data, 'PG_VERSION'))) {
    if (existsSync(envFile)) throw new Error('backend/.env already exists. Configure its database manually, or move it aside before local setup.')
    const password = randomBytes(24).toString('base64url')
    const passwordFile = path.join(local, 'postgres-password.tmp')
    writeFileSync(passwordFile, password, { mode: 0o600 })
    try {
      run('initdb', ['-D', data, '-U', 'voice_app', '--pwfile', passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C'])
    } finally {
      unlinkSync(passwordFile)
    }
    writeFileSync(envFile, [
      'NODE_ENV=development', 'PORT=3001',
      `DATABASE_URL=postgresql://voice_app:${password}@127.0.0.1:55439/voice_studio`,
      `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64url')}`,
      'BETTER_AUTH_URL=http://localhost:5173', 'TRUST_PROXY_HOPS=0', '',
    ].join('\n'), { mode: 0o600 })
  }
  if (!existsSync(envFile)) throw new Error('Local database exists but backend/.env is missing. Restore its credentials before continuing.')
  if (!run('pg_ctl', ['-D', data, 'status'], true)) {
    run('pg_ctl', ['-D', data, '-l', path.join(local, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55439', '-w', 'start'])
  }
  const connection = readFileSync(envFile, 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim()
  if (!connection) throw new Error('DATABASE_URL is missing in backend/.env.')
  const url = new URL(connection)
  if (url.hostname !== '127.0.0.1' || url.port !== '55439' || url.pathname !== '/voice_studio') throw new Error('Local setup only manages its own loopback database. Use your configured database manually.')
  url.pathname = '/postgres'
  const pool = new Pool({ connectionString: url.toString() })
  try {
    if (!(await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', ['voice_studio'])).rowCount) await pool.query('CREATE DATABASE voice_studio')
  } finally {
    await pool.end()
  }
  console.log('Local PostgreSQL is ready on port 55439. Credentials are in ignored backend/.env. Next: npm run db:migrate, then npm run dev.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
