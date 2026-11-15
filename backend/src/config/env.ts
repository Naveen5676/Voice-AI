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
  LIVEKIT_URL: z.preprocess((value) => value === '' ? undefined : value, z.url().refine((value) => ['ws:', 'wss:'].includes(new URL(value).protocol), 'Use a ws:// or wss:// URL').optional()),
  LIVEKIT_API_KEY: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
  LIVEKIT_API_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  AGENT_SERVICE_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(32).optional()),
  LIVEKIT_AGENT_NAME: z.string().min(1).default('my-agent'),
  LIVEKIT_AGENT_DEPLOYMENT: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'Use a lowercase deployment name').optional(),
  WEB_CALL_MAX_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  WEB_CALL_JOIN_SECONDS: z.coerce.number().int().min(10).max(120).default(45),
  WEB_CALL_READY_SECONDS: z.coerce.number().int().min(10).max(120).default(30),
  VECTOR_SERVICE_URL: httpUrl.default('http://127.0.0.1:8010'),
}).superRefine((env, context) => {
  if (env.NODE_ENV === 'production' && !env.BETTER_AUTH_URL.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['BETTER_AUTH_URL'], message: 'HTTPS is required in production' })
  }
  const voice = [env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, env.AGENT_SERVICE_SECRET]
  if (voice.some(Boolean) && !voice.every(Boolean)) context.addIssue({ code: 'custom', path: ['LIVEKIT_URL'], message: 'Set all LiveKit credentials and AGENT_SERVICE_SECRET, or leave all unset' })
  if (env.NODE_ENV === 'production' && env.LIVEKIT_URL?.startsWith('ws://')) context.addIssue({ code: 'custom', path: ['LIVEKIT_URL'], message: 'Production LiveKit requires wss://' })
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
