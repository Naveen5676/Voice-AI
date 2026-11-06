import type { ErrorRequestHandler } from 'express'

export const errorHandler: ErrorRequestHandler = (_error, _request, response, _next) => {
  // Do not expose SQL errors, connection strings, or request bodies to clients.
  console.error('An API request failed.')
  response.status(500).json({ message: 'Something went wrong. Please try again.' })
}
