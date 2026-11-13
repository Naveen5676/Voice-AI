import { betterAuth } from 'better-auth'
import type { BetterAuthOptions } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import type { Database } from '../db/prisma.js'
import type { Environment } from '../config/env.js'
import { validateAuth } from '../middleware/validate-auth.js'

export function authOptions(database: Database, env: Environment) {
  return {
    appName: 'Voice Studio',
    database: prismaAdapter(database, { provider: 'postgresql', transaction: true }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    hooks: { before: validateAuth },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true, storage: 'database', window: 60, max: 100,
      customRules: {
        '/sign-up/email': { window: 60, max: 5 },
        '/sign-in/email': { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === 'production',
      ipAddress: { ipAddressHeaders: ['x-voice-client-ip'] },
    },
  } satisfies BetterAuthOptions
}

export function createAuth(database: Database, env: Environment) {
  return betterAuth(authOptions(database, env))
}

export type Auth = ReturnType<typeof createAuth>
