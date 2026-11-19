import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../lib/http-error.js'

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: error.issues[0]?.message ?? 'Invalid request.',
      errors: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    })
    return
  }
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ message: error.message })
    return
  }
  const type = error && typeof error === 'object' && 'type' in error ? error.type : undefined
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    response.status(type === 'entity.too.large' ? 413 : 400).json({
      message: type === 'entity.too.large' ? 'Request body is too large.' : 'Request body must be valid JSON.',
    })
    return
  }
  // Do not expose SQL errors, connection strings, or request bodies to clients.
  console.error('An API request failed:', error)
  response.status(500).json({ message: 'Something went wrong. Please try again.' })
}
