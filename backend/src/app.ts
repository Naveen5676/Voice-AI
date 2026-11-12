import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import helmet from 'helmet'
import { toNodeHandler } from 'better-auth/node'
import type { Environment } from './config/env.js'
import type { Auth } from './lib/auth.js'
import type { Database } from './db/prisma'
import { accountRoutes } from './routes/account.js'
import { errorHandler } from './middleware/error-handler.js'
import { agentRoutes } from './routes/agents.js'
import { createPrismaService } from './services/prisma-service'
import { createAgentService } from './services/agent.service.js'
import { createLivekitService, type VoiceTransport } from './services/livekit.service.js'
import { createWebCallService } from './services/web-call.service.js'
import { webCallRoutes } from './routes/web-calls.js'
import { internalWebCallRoutes } from './routes/internal-web-calls.js'

export function createApp(auth: Auth, env: Environment, database: Database, voiceTransport?: VoiceTransport) {
  const app = express()
  const calls = createWebCallService(database, env, voiceTransport ?? createLivekitService(env))
  app.locals.webCalls = calls
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY_HOPS)
  app.use(helmet({ strictTransportSecurity: env.NODE_ENV === 'production' ? undefined : false }))
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
  app.use('/api', (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store')
    // Overwrite any client-supplied value using Express's trusted proxy rules.
    request.headers['x-voice-client-ip'] = request.ip || request.socket.remoteAddress || '127.0.0.1'
    next()
  })
  // Better Auth must read the raw request stream before any JSON body parser.
  app.all('/api/auth/*splat', toNodeHandler(auth))
  // A 12,000-character prompt can exceed 16 KB when JSON escaped or Unicode.
  app.use(express.json({ limit: '96kb' }))
  app.use('/api', accountRoutes(auth))
  app.use('/api', agentRoutes(auth, createAgentService(createPrismaService(database)), env.BETTER_AUTH_URL))
  app.use('/api', webCallRoutes(auth, calls, env.BETTER_AUTH_URL))
  app.use('/api/internal/web-calls', internalWebCallRoutes(calls, env.AGENT_SERVICE_SECRET))
  app.use('/api', (_request, response) => response.status(404).json({ message: 'API endpoint not found.' }))

  if (env.NODE_ENV === 'production') {
    const frontend = resolve(__dirname, '../../frontend/dist')
    if (!existsSync(`${frontend}/index.html`)) throw new Error('Frontend build is missing. Run npm run build first.')
    app.use(express.static(frontend, { index: false }))
    app.get('/{*path}', (_request, response) => {
      response.setHeader('Cache-Control', 'no-cache')
      response.sendFile('index.html', { root: frontend })
    })
  }
  app.use(errorHandler)
  return app
}
