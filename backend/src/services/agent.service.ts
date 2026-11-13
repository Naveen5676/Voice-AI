import type { Prisma } from '../generated/prisma/client.js'
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js'
import type { Database } from '../db/prisma.js'
import { HttpError } from '../lib/http-error.js'
import type { AgentFormValues, UpdateAgentValues } from '../validator/agent.validator.js'

const agentSelect = {
  id: true, name: true, prompt: true, templateId: true, createdAt: true, updatedAt: true,
} satisfies Prisma.AgentSelect

type AgentRecord = Prisma.AgentGetPayload<{ select: typeof agentSelect }>
const serializeAgent = (agent: AgentRecord) => ({
  ...agent, createdAt: agent.createdAt.toISOString(), updatedAt: agent.updatedAt.toISOString(),
})

export function createAgentService(prisma: Database) {
  return {
    async create(ownerId: string, values: AgentFormValues) {
      return serializeAgent(await prisma.agent.create({ data: { ...values, ownerId }, select: agentSelect }))
    },
    async list(ownerId: string) {
      const agents = await prisma.agent.findMany({
        where: { ownerId }, select: agentSelect,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      })
      return agents.map(serializeAgent)
    },
    async get(ownerId: string, id: string) {
      const agent = await prisma.agent.findFirst({ where: { id, ownerId }, select: agentSelect })
      if (!agent) throw new HttpError(404, 'Agent not found.')
      return serializeAgent(agent)
    },
    async update(ownerId: string, id: string, values: UpdateAgentValues) {
      try {
        return serializeAgent(await prisma.agent.update({ where: { id, ownerId }, data: values, select: agentSelect }))
      } catch (error) {
        if (error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new HttpError(404, 'Agent not found.')
        }
        throw error
      }
    },
    async delete(ownerId: string, id: string) {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.agent.findFirst({ where: { id, ownerId } })
        if (!existing) throw new HttpError(404, 'Agent not found.')

        const activeCall = await tx.voiceCall.findFirst({
          where: { agentId: id, status: { in: ['pending', 'connecting', 'active'] } },
        })
        if (activeCall) {
          throw new HttpError(409, 'Cannot delete an agent while a voice call is active. End the call first.')
        }

        await tx.voiceCall.deleteMany({ where: { agentId: id } })
        await tx.agent.delete({ where: { id } })
        return { id }
      })
    },
  }
}

export type AgentService = ReturnType<typeof createAgentService>
