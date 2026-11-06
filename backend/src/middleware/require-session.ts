import { fromNodeHeaders } from 'better-auth/node'
import type { RequestHandler } from 'express'
import type { Auth } from '../lib/auth.js'

export function requireSession(auth: Auth): RequestHandler {
  return async (request, response, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
      if (!session) {
        response.status(401).json({ message: 'Please sign in to continue.' })
        return
      }
      // Pass only the public user fields to application routes.
      response.locals.user = { id: session.user.id, name: session.user.name, email: session.user.email }
      next()
    } catch (error) {
      next(error)
    }
  }
}
