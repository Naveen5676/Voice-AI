import { Router } from 'express'
import type { Auth } from '../lib/auth.js'
import { customAgentTemplate, promptTemplates } from '../config/agent-templates.js'
import { requireSession } from '../middleware/require-session.js'
import { requireTrustedOrigin } from '../middleware/require-trusted-origin.js'
import type { AgentService } from '../services/agent.service.js'
import { agentIdSchema, createAgentSchema, updateAgentSchema } from '../validator/agent.validator.js'

export function agentRoutes(auth: Auth, service: AgentService, publicUrl: string) {
  const router = Router()
  const authenticated = requireSession(auth)
  const trustedOrigin = requireTrustedOrigin(publicUrl)

  router.get('/agent-templates', authenticated, (_request, response) => {
    response.json({ templates: [customAgentTemplate, ...promptTemplates] })
  })
  router.use('/agents', authenticated)
  router.get('/agents', async (_request, response) => {
    response.json({ agents: await service.list(response.locals.user.id) })
  })
  router.post('/agents', trustedOrigin, async (request, response) => {
    const values = createAgentSchema.parse(request.body)
    const agent = await service.create(response.locals.user.id, values)
    response.location(`/api/agents/${agent.id}`).status(201).json({ agent })
  })
  router.get('/agents/:id', async (request, response) => {
    const { id } = agentIdSchema.parse(request.params)
    response.json({ agent: await service.get(response.locals.user.id, id) })
  })
  router.patch('/agents/:id', trustedOrigin, async (request, response) => {
    const { id } = agentIdSchema.parse(request.params)
    const values = updateAgentSchema.parse(request.body)
    response.json({ agent: await service.update(response.locals.user.id, id, values) })
  })
  return router
}
