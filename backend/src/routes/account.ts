import { Router } from 'express'
import type { Auth } from '../lib/auth.js'
import { requireSession } from '../middleware/require-session.js'

export function accountRoutes(auth: Auth) {
  const router = Router()
  router.get('/me', requireSession(auth), (_request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.json({ user: response.locals.user })
  })
  return router
}
