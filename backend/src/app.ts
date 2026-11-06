import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import { toNodeHandler } from 'better-auth/node'
import type { Environment } from './config/env.js'
import type { Auth } from './lib/auth.js'
import { accountRoutes } from './routes/account.js'
import { errorHandler } from './middleware/error-handler.js'

export function createApp(auth: Auth, env: Environment) {
  const app = express()
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
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', accountRoutes(auth))
  app.use('/api', (_request, response) => response.status(404).json({ message: 'API endpoint not found.' }))

  if (env.NODE_ENV === 'production') {
    const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
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
