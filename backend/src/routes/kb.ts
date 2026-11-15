import { Router } from 'express'
import type { Auth } from '../lib/auth.js'
import { requireSession } from '../middleware/require-session.js'
import { requireTrustedOrigin } from '../middleware/require-trusted-origin.js'
import type { KbService } from '../services/kb.service.js'
import {
  createKbNoteSchema,
  createKnowledgeBaseSchema,
  kbIdParamSchema,
  kbItemIdParamSchema,
} from '../validator/kb.validator.js'

export function kbRoutes(auth: Auth, service: KbService, publicUrl: string) {
  const router = Router()
  const authenticated = requireSession(auth)
  const trustedOrigin = requireTrustedOrigin(publicUrl)

  router.use('/knowledge-bases', authenticated)

  router.get('/knowledge-bases', async (_request, response) => {
    const kbs = await service.listKbs(response.locals.user.id)
    response.json({ knowledgeBases: kbs })
  })

  router.post('/knowledge-bases', trustedOrigin, async (request, response) => {
    const values = createKnowledgeBaseSchema.parse(request.body)
    const kb = await service.createKb(response.locals.user.id, values)
    response.status(201).json({ knowledgeBase: kb })
  })

  router.get('/knowledge-bases/:kbId', async (request, response) => {
    const { kbId } = kbIdParamSchema.parse(request.params)
    const kb = await service.getKb(response.locals.user.id, kbId)
    response.json({ knowledgeBase: kb })
  })

  router.delete('/knowledge-bases/:kbId', trustedOrigin, async (request, response) => {
    const { kbId } = kbIdParamSchema.parse(request.params)
    const result = await service.deleteKb(response.locals.user.id, kbId)
    response.json(result)
  })

  router.get('/knowledge-bases/:kbId/items', async (request, response) => {
    const { kbId } = kbIdParamSchema.parse(request.params)
    const items = await service.listNotes(response.locals.user.id, kbId)
    response.json({ items })
  })

  router.post('/knowledge-bases/:kbId/items', trustedOrigin, async (request, response) => {
    const { kbId } = kbIdParamSchema.parse(request.params)
    const values = createKbNoteSchema.parse(request.body)
    const item = await service.createNote(response.locals.user.id, kbId, values)
    response.status(201).json({ item })
  })

  router.delete('/knowledge-bases/:kbId/items/:itemId', trustedOrigin, async (request, response) => {
    const { kbId, itemId } = kbItemIdParamSchema.parse(request.params)
    const result = await service.deleteNote(response.locals.user.id, kbId, itemId)
    response.json(result)
  })

  return router
}
