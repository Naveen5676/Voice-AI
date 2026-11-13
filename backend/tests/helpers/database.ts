import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { Pool } from 'pg'
import { readEnvironment } from '../../src/config/env.js'
import { createPrismaClient } from '../../src/db/prisma.js'

export async function deployTestMigrations(connectionString: string) {
  await promisify(execFile)(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--config', 'prisma.config.ts'], {
    cwd: resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: connectionString, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    timeout: 60_000,
  })
}

export async function createTestDatabase(prefix: 'auth' | 'agents') {
  const databaseName = `voice_${prefix}_test_${randomBytes(8).toString('hex')}`
  // Administrative SQL exists only in disposable test database setup/assertions.
  const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  await admin.query(`CREATE DATABASE "${databaseName}"`)
  const url = new URL(process.env.TEST_DATABASE_URL!)
  url.pathname = `/${databaseName}`
  const pool = new Pool({ connectionString: url.toString() })
  const prisma = createPrismaClient(url.toString())
  const env = readEnvironment({
    NODE_ENV: 'test', DATABASE_URL: url.toString(),
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: 'http://localhost:5173',
  })
  const cleanup = async () => {
    await prisma.$disconnect()
    await pool.end()
    try { await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`) }
    finally { await admin.end() }
  }
  try {
    await deployTestMigrations(url.toString())
    await prisma.$connect()
    return { pool, prisma, env, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
