import { APIError, createAuthMiddleware } from 'better-auth/api'
import { loginRequestSchema, signupSchema } from '../validator/auth.validator.js'

export const validateAuth = createAuthMiddleware(async (context) => {
  const schema = context.path === '/sign-up/email' ? signupSchema
    : context.path === '/sign-in/email' ? loginRequestSchema : null
  if (!schema) return

  const result = schema.safeParse(context.body)
  if (!result.success) {
    throw new APIError('BAD_REQUEST', {
      message: result.error.issues[0]?.message ?? 'Invalid authentication details.',
    })
  }
  return { context: { ...context, body: { ...context.body, ...result.data } } }
})
