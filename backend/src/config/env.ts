import 'dotenv/config'
import { z } from 'zod'

const httpUrl = z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, 'Use a PostgreSQL connection URL'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: httpUrl.default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
}).superRefine((env, context) => {
  if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_URL.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['BETTER_AUTH_URL'], message: 'HTTPS is required in production' })
  }
})

export type Environment = z.infer<typeof schema>

export function readEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const result = schema.safeParse(input)
  if (!result.success) {
    // Report field names and validation messages, never environment values.
    throw new Error(`Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`)
  }
  return result.data
}
