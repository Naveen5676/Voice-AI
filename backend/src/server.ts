import { readEnvironment } from './config/env.js'
import { createPrismaClient } from './db/prisma.js'
import { createAuth } from './lib/auth.js'
import { createApp } from './app.js'

async function main() {
  const env = readEnvironment()
  const prisma = createPrismaClient(env.DATABASE_URL)
  try {
    await prisma.$connect()
    const app = createApp(createAuth(prisma, env), env, prisma)
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`API listening on port ${env.PORT}`)
    })
    const shutdown = () => {
      server.close(() => { void prisma.$disconnect().then(() => process.exit(0)) })
      setTimeout(() => process.exit(1), 10_000).unref()
    }
    server.on('error', () => {
      console.error('Server could not listen. Check that its port is available.')
      void prisma.$disconnect().finally(() => { process.exitCode = 1 })
    })
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  } catch {
    console.error('Server could not start. Check PostgreSQL, backend/.env, and npm run db:migrate.')
    await prisma.$disconnect()
    process.exitCode = 1
  }
}

void main().catch(() => {
  console.error('Server configuration is invalid. Check backend/.env.')
  process.exitCode = 1
})
