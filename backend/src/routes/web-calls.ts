import { Router } from 'express'
import type { Auth } from '../lib/auth.js'
import { requireSession } from '../middleware/require-session.js'
import { requireTrustedOrigin } from '../middleware/require-trusted-origin.js'
import { startCallRateLimiter } from '../middleware/rate-limiter.js'
import type { WebCallService } from '../services/web-call.service.js'
import { agentIdSchema } from '../validator/agent.validator.js'
import { callIdSchema, startCallSchema } from '../validator/web-call.validator.js'

export function webCallRoutes(auth: Auth, service: WebCallService, publicUrl: string) {
  const router = Router()
  const session = requireSession(auth)
  const origin = requireTrustedOrigin(publicUrl)
  router.post('/agents/:id/web-calls', startCallRateLimiter, session, origin, async (request, response) => {
    const { id } = agentIdSchema.parse(request.params)
    const { idempotencyKey } = startCallSchema.parse(request.body)
    response.status(201).json(await service.start(response.locals.user.id, id, idempotencyKey))
  })
  router.get('/web-calls/:callId', session, async (request, response) => {
    const { callId } = callIdSchema.parse(request.params)
    response.json(await service.status(response.locals.user.id, callId))
  })
  router.get('/usage', session, async (_request, response) => {
    response.json(await service.usage(response.locals.user.id))
  })
  router.post('/web-calls/:callId/end', session, origin, async (request, response) => {
    const { callId } = callIdSchema.parse(request.params)
    response.json(await service.end(response.locals.user.id, callId))
  })
  return router
}
