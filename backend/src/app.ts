import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { toNodeHandler } from 'better-auth/node'
import type { Environment } from './config/env.js'
import type { Auth } from './lib/auth.js'
import type { Database } from './db/prisma.js'
import { accountRoutes } from './routes/account.js'
import { errorHandler } from './middleware/error-handler.js'
import { agentRoutes } from './routes/agents.js'
import { createAgentService } from './services/agent.service.js'
import { createKbService } from './services/kb.service.js'
import { kbRoutes } from './routes/kb.js'
import { createLivekitService, type VoiceTransport } from './services/livekit.service.js'
import { createWebCallService } from './services/web-call.service.js'
import { webCallRoutes } from './routes/web-calls.js'
import { internalWebCallRoutes } from './routes/internal-web-calls.js'
import { apiRateLimiter } from './middleware/rate-limiter.js'

export function createApp(auth: Auth, env: Environment, database: Database, voiceTransport?: VoiceTransport) {
  const app = express()
  const calls = createWebCallService(database, env, voiceTransport ?? createLivekitService(env))
  app.locals.webCalls = calls
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY_HOPS)

  const livekitHosts = ['https://*.livekit.cloud', 'wss://*.livekit.cloud']
  if (env.LIVEKIT_URL) {
    try {
      const parsedLk = new URL(env.LIVEKIT_URL)
      livekitHosts.push(parsedLk.origin)
      livekitHosts.push(parsedLk.origin.replace(/^http/, 'ws'))
    } catch {
      // ignore parse failure
    }
  }

  app.use(
    helmet({
      strictTransportSecurity: env.NODE_ENV === 'production' ? undefined : false,
      contentSecurityPolicy: env.NODE_ENV === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", ...livekitHosts],
          mediaSrc: ["'self'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      } : false,
    })
  )

  const authOrigin = new URL(env.BETTER_AUTH_URL).origin

  app.use(
    cors({
      origin: authOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  )

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
  app.get('/api/agent-worker/status', async (_request, response) => {
    if (!env.LIVEKIT_AGENT_URL) return response.json({ ready: true, configured: false })
    try {
      const res = await fetch(env.LIVEKIT_AGENT_URL, { signal: AbortSignal.timeout(4000) })
      response.json({ ready: res.ok, configured: true })
    } catch {
      response.json({ ready: false, configured: true })
    }
  })

  app.use('/api', apiRateLimiter)
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
  app.use('/api', agentRoutes(auth, createAgentService(database), env.BETTER_AUTH_URL))
  app.use('/api', kbRoutes(auth, createKbService(database, env.VECTOR_SERVICE_URL, env.VECTOR_SERVICE_SECRET ?? env.AGENT_SERVICE_SECRET), env.BETTER_AUTH_URL))
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
