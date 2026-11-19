import { randomUUID } from 'node:crypto'
import type { Environment } from '../config/env.js'
import type { Database } from '../db/prisma.js'
import { HttpError } from '../lib/http-error.js'
import type { VoiceTransport } from './livekit.service.js'

const live = ['pending', 'connecting', 'active']
const terminal = ['ended', 'failed', 'expired']

export function createWebCallService(prisma: Database, env: Environment, transport?: VoiceTransport) {
  const enabled = () => {
    if (!transport) throw new HttpError(503, 'Voice calling is not configured. Ask the workspace administrator to configure the worker.')
    return transport
  }
  async function owned(ownerId: string, id: string) {
    const call = await prisma.voiceCall.findFirst({ where: { id, ownerId } })
    if (!call) throw new HttpError(404, 'Call not found.')
    return call
  }
  async function cleanup(id: string) {
    if (!transport) return
    const now = new Date()
    const claim = await prisma.voiceCall.updateMany({
      where: { id, cleanupPending: true, status: { in: terminal }, OR: [{ cleanupLeaseUntil: null }, { cleanupLeaseUntil: { lt: now } }] },
      data: { cleanupLeaseUntil: new Date(now.getTime() + 60_000) },
    })
    if (!claim.count) return
    const call = await prisma.voiceCall.findUniqueOrThrow({ where: { id } })
    try {
      await transport.cleanup(call.roomName)
      await prisma.voiceCall.update({ where: { id }, data: { cleanupPending: false, cleanupLeaseUntil: null } })
    } catch {
      await prisma.voiceCall.update({ where: { id }, data: { cleanupLeaseUntil: null } })
      console.error('Voice call cleanup will be retried.', { callId: id })
    }
  }
  async function finish(id: string, status: 'ended' | 'failed' | 'expired', failureCode?: string) {
    await prisma.voiceCall.updateMany({ where: { id, status: { in: live } }, data: { status, endedAt: new Date(), failureCode, cleanupPending: true } })
    await cleanup(id)
  }
  const publicStatus = (call: Awaited<ReturnType<typeof owned>>) => ({
    callId: call.id, status: call.status, failureCode: call.failureCode,
    expiresAt: call.expiresAt.toISOString(), cleanupPending: call.cleanupPending,
  })
  return {
    async start(ownerId: string, agentId: string, idempotencyKey: string) {
      const rtc = enabled()
      const now = new Date()
      const { call, created } = await prisma.$transaction(async (tx) => {
        // Serialize this owner's starts across server processes, not just this process.
        await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${ownerId} FOR UPDATE`
        const previous = await tx.voiceCall.findUnique({ where: { ownerId_idempotencyKey: { ownerId, idempotencyKey } } })
        if (previous) {
          if (previous.agentId !== agentId) throw new HttpError(409, 'This start key belongs to a different agent.')
          if (!live.includes(previous.status) || previous.expiresAt <= now || previous.joinDeadline <= now) throw new HttpError(409, 'This call has ended or expired. Start a new call.')
          if (previous.status === 'pending') throw new HttpError(409, 'This call is still being prepared. Please wait before retrying.')
          return { call: previous, created: false }
        }
        const agent = await tx.agent.findFirst({ where: { id: agentId, ownerId } })
        if (!agent) throw new HttpError(404, 'Agent not found.')

        // Automatically expire abandoned calls whose joinDeadline or expiresAt has passed
        await tx.voiceCall.updateMany({
          where: {
            ownerId,
            status: { in: live },
            OR: [
              { expiresAt: { lte: now } },
              { joinDeadline: { lte: now }, status: { in: ['pending', 'connecting'] } },
            ],
          },
          data: { status: 'expired', endedAt: now, cleanupPending: true },
        })

        if (await tx.voiceCall.count({ where: { ownerId, createdAt: { gt: new Date(now.getTime() - 60_000) } } }) >= 5) throw new HttpError(429, 'Too many call attempts. Wait a minute before trying again.')
        if (await tx.voiceCall.count({ where: { ownerId, status: { in: live } } })) throw new HttpError(409, 'End your current call before starting another.')
        const call = await tx.voiceCall.create({ data: {
          ownerId, agentId, knowledgeBaseId: agent.knowledgeBaseId, idempotencyKey,
          roomName: `voice-${randomUUID()}`, participantIdentity: randomUUID(),
          agentName: agent.name, prompt: agent.prompt, agentUpdatedAt: agent.updatedAt,
          joinDeadline: new Date(now.getTime() + env.WEB_CALL_JOIN_SECONDS * 1000),
          readyDeadline: new Date(now.getTime() + (env.WEB_CALL_JOIN_SECONDS + env.WEB_CALL_READY_SECONDS) * 1000),
          expiresAt: new Date(now.getTime() + env.WEB_CALL_MAX_SECONDS * 1000),
        } })
        return { call, created: true }
      })
      try {
        if (created) {
          const dispatchId = await rtc.dispatch(call)
          await prisma.voiceCall.updateMany({ where: { id: call.id, status: { in: live } }, data: { dispatchId } })
          await prisma.voiceCall.updateMany({ where: { id: call.id, status: 'pending' }, data: { status: 'connecting' } })
        }
        const current = await owned(ownerId, call.id)
        if (!live.includes(current.status) || current.expiresAt <= new Date()) throw new Error('Call cancelled during setup')
        return { callId: call.id, serverUrl: env.LIVEKIT_URL!, participantToken: await rtc.token(current), expiresAt: call.expiresAt.toISOString() }
      } catch {
        await finish(call.id, 'failed', 'setup_failed')
        // A cancellation may have cleaned up while dispatch was still in flight.
        await prisma.voiceCall.update({ where: { id: call.id }, data: { cleanupPending: true } })
        await cleanup(call.id)
        throw new HttpError(503, 'The voice call could not start. Please try again.')
      }
    },
    async status(ownerId: string, id: string) { return publicStatus(await owned(ownerId, id)) },
    async end(ownerId: string, id: string) {
      await owned(ownerId, id)
      await finish(id, 'ended')
      return publicStatus(await owned(ownerId, id))
    },
    async endActive(ownerId: string) {
      const activeCalls = await prisma.voiceCall.findMany({
        where: { ownerId, status: { in: live } },
      })
      for (const call of activeCalls) {
        await finish(call.id, 'ended')
      }
      return { endedCount: activeCalls.length }
    },
    async context(id: string, roomName: string) {
      enabled()
      const call = await prisma.voiceCall.findFirst({ where: { id, roomName, status: { in: live }, expiresAt: { gt: new Date() }, readyDeadline: { gt: new Date() } } })
      if (!call) throw new HttpError(404, 'Call context is unavailable.')
      return {
        callId: call.id, roomName: call.roomName, participantIdentity: call.participantIdentity,
        agentId: call.agentId, knowledgeBaseId: call.knowledgeBaseId, agentName: call.agentName, prompt: call.prompt,
        joinDeadline: call.joinDeadline.toISOString(), expiresAt: call.expiresAt.toISOString(),
        readyTimeoutSeconds: env.WEB_CALL_READY_SECONDS,
      }
    },
    async event(id: string, roomName: string, eventId: string, type: 'ready' | 'active' | 'ended' | 'failed') {
      enabled()
      await prisma.$transaction(async (tx) => {
        const call = await tx.voiceCall.findFirst({ where: { id, roomName } })
        if (!call) throw new HttpError(404, 'Call not found.')
        const inserted = await tx.voiceCallEvent.createMany({ data: [{ callId: id, eventId, type }], skipDuplicates: true })
        if (!inserted.count || !live.includes(call.status)) return
        const expired = call.expiresAt <= new Date()
        if (expired || type === 'ended' || type === 'failed') {
          await tx.voiceCall.updateMany({ where: { id, status: { in: live } }, data: {
            status: expired ? 'expired' : type, endedAt: new Date(), cleanupPending: true,
            failureCode: expired ? 'deadline_exceeded' : type === 'failed' ? 'worker_failed' : null,
          } })
        } else if (type === 'active') {
          await tx.voiceCall.updateMany({ where: { id, status: { in: ['pending', 'connecting'] } }, data: { status: 'active', startedAt: new Date() } })
        }
      })
      // Cleanup is performed by end() or the reconciler, never inside a worker callback.
      // Otherwise deleting the room can deadlock the worker's own shutdown callback.
    },
    async reconcile() {
      if (!transport) return
      const now = new Date()
      await prisma.voiceCall.updateMany({ where: { status: { in: live }, OR: [{ expiresAt: { lte: now } }, { status: { in: ['pending', 'connecting'] }, readyDeadline: { lte: now } }] }, data: { status: 'expired', failureCode: 'deadline_exceeded', endedAt: now, cleanupPending: true } })
      const calls = await prisma.voiceCall.findMany({ where: { cleanupPending: true, status: { in: terminal } }, select: { id: true }, take: 100, orderBy: { createdAt: 'asc' } })
      for (const call of calls) await cleanup(call.id)
    },
    async usage(ownerId: string) {
      const userCallsCount = await prisma.voiceCall.count({ where: { ownerId } })
      const totalProjectCalls = await prisma.voiceCall.count()

      const userCalls = await prisma.voiceCall.findMany({
        where: { ownerId, startedAt: { not: null }, endedAt: { not: null } },
        select: { startedAt: true, endedAt: true },
      })
      const userSeconds = userCalls.reduce((acc, c) => {
        if (c.startedAt && c.endedAt) {
          return acc + Math.max(0, Math.floor((c.endedAt.getTime() - c.startedAt.getTime()) / 1000))
        }
        return acc
      }, 0)

      const totalProjectLimit = 100
      const userLimit = 50
      const projectPercentage = Math.min(100, Math.round((totalProjectCalls / totalProjectLimit) * 100))
      const userPercentage = Math.min(100, Math.round((userCallsCount / userLimit) * 100))

      return {
        user: {
          usedCalls: userCallsCount,
          limitCalls: userLimit,
          remainingCalls: Math.max(0, userLimit - userCallsCount),
          usedSeconds: userSeconds,
          usedMinutes: Math.ceil(userSeconds / 60),
          percentage: userPercentage,
        },
        project: {
          totalCalls: totalProjectCalls,
          limitCalls: totalProjectLimit,
          remainingCalls: Math.max(0, totalProjectLimit - totalProjectCalls),
          percentage: projectPercentage,
          maxCallDurationMinutes: Math.round(env.WEB_CALL_MAX_SECONDS / 60),
        },
      }
    },
  }
}

export type WebCallService = ReturnType<typeof createWebCallService>
