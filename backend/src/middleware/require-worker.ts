import { createHash, timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import { HttpError } from '../lib/http-error.js'

export function requireWorker(secret?: string): RequestHandler {
  return (request, _response, next) => {
    if (!secret) return next(new HttpError(503, 'Voice calling is not configured.'))
    const candidate = request.get('authorization') ?? ''
    const digest = (value: string) => createHash('sha256').update(value).digest()
    if (!timingSafeEqual(digest(candidate), digest(`Bearer ${secret}`))) return next(new HttpError(401, 'Worker authentication required.'))
    next()
  }
}
