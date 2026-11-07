import { HttpError } from '../lib/http-error.js'
import type { PrismaService } from './prisma-service'
import type { AgentFormValues, UpdateAgentValues } from '../validator/agent.validator.js'

export function createAgentService(database: PrismaService) {
  return {
    create: (ownerId: string, values: AgentFormValues) => database.createAgent(ownerId, values),
    list: (ownerId: string) => database.getAgents(ownerId),
    async get(ownerId: string, id: string) {
      const agent = await database.getAgent(ownerId, id)
      if (!agent) throw new HttpError(404, 'Agent not found.')
      return agent
    },
    async update(ownerId: string, id: string, values: UpdateAgentValues) {
      const agent = await database.updateAgent(ownerId, id, values)
      if (!agent) throw new HttpError(404, 'Agent not found.')
      return agent
    },
  }
}

export type AgentService = ReturnType<typeof createAgentService>
