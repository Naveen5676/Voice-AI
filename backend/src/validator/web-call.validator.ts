import { z } from 'zod'

export const callIdSchema = z.object({ callId: z.uuid() })
export const startCallSchema = z.object({ idempotencyKey: z.uuid() }).strict()
export const workerContextSchema = z.object({ roomName: z.string().min(1).max(200) }).strict()
export const workerEventSchema = z.object({
  eventId: z.uuid(),
  roomName: z.string().min(1).max(200),
  type: z.enum(['ready', 'active', 'ended', 'failed']),
}).strict()
