import type { RequestHandler } from 'express'
import { HttpError } from '../lib/http-error.js'

export function requireTrustedOrigin(publicUrl: string): RequestHandler {
  const trustedOrigin = new URL(publicUrl).origin
  return (request, _response, next) => {
    if (request.get('origin') !== trustedOrigin) {
      next(new HttpError(403, 'This request must come from your Voice Studio app.'))
      return
    }
    next()
  }
}
