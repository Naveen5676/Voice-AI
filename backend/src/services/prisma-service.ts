import type { Prisma } from '../generated/prisma/client'
import { Prisma as PrismaRuntime } from '../generated/prisma/client'
import type { Database } from '../db/prisma'
import type { AgentFormValues, UpdateAgentValues } from '../validator/agent.validator'

const agentSelect = {
  id: true, name: true, prompt: true, templateId: true, createdAt: true, updatedAt: true,
} satisfies Prisma.AgentSelect

type AgentRecord = Prisma.AgentGetPayload<{ select: typeof agentSelect }>
const serializeAgent = (agent: AgentRecord) => ({
  ...agent, createdAt: agent.createdAt.toISOString(), updatedAt: agent.updatedAt.toISOString(),
})

// One shared Prisma client is supplied at startup, following OpenMic's helper pattern.
// Every agent operation includes the authenticated owner in its database filter.
export function createPrismaService(prisma: Database) {
  return {
    async createAgent(ownerId: string, values: AgentFormValues) {
      return serializeAgent(await prisma.agent.create({ data: { ...values, ownerId }, select: agentSelect }))
    },
    async getAgents(ownerId: string) {
      const agents = await prisma.agent.findMany({
        where: { ownerId }, select: agentSelect,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      })
      return agents.map(serializeAgent)
    },
    async getAgent(ownerId: string, id: string) {
      const agent = await prisma.agent.findFirst({ where: { id, ownerId }, select: agentSelect })
      return agent ? serializeAgent(agent) : null
    },
    async updateAgent(ownerId: string, id: string, values: UpdateAgentValues) {
      try {
        return serializeAgent(await prisma.agent.update({ where: { id, ownerId }, data: values, select: agentSelect }))
      } catch (error) {
        if (error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2025') return null
        throw error
      }
    },
  }
}

export type PrismaService = ReturnType<typeof createPrismaService>
