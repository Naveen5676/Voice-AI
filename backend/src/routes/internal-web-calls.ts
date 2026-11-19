import { Router } from 'express'
import { requireWorker } from '../middleware/require-worker.js'
import type { WebCallService } from '../services/web-call.service.js'
import { callIdSchema, workerContextSchema, workerEventSchema } from '../validator/web-call.validator.js'

export function internalWebCallRoutes(service: WebCallService, secret?: string) {
  const router = Router()
  router.use(requireWorker(secret))
  router.get('/:callId/context', async (request, response) => {
    const { callId } = callIdSchema.parse(request.params)
    const { roomName } = workerContextSchema.parse(request.query)
    console.log(`[Worker] Retrieving context for call ${callId} (room: ${roomName})`)
    response.json(await service.context(callId, roomName))
  })
  router.post('/:callId/events', async (request, response) => {
    const { callId } = callIdSchema.parse(request.params)
    const { roomName, eventId, type } = workerEventSchema.parse(request.body)
    console.log(`[Worker] Event for call ${callId} (room: ${roomName}): ${type}`)
    await service.event(callId, roomName, eventId, type)
    response.sendStatus(204)
  })
  return router
}
