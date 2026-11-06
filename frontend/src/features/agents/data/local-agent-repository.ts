import { z } from 'zod'
import { agentFormSchema } from 'backend/validator/agent'
import type { AgentDraft } from '../types'

const savedAgentsSchema = z.array(agentFormSchema.extend({
  id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}))
const key = (ownerId: string) => `voice-studio.agents.v1.${ownerId}`

// UI-phase persistence only. Account APIs will replace this adapter later.
export const localAgentRepository = {
  list(ownerId: string): AgentDraft[] {
    const raw = localStorage.getItem(key(ownerId))
    if (!raw) return []
    const result = savedAgentsSchema.safeParse(JSON.parse(raw))
    if (!result.success) throw new Error('The saved agents in this browser could not be read. Your existing data has been left untouched.')
    return result.data
  },
  save(ownerId: string, agents: AgentDraft[]) {
    localStorage.setItem(key(ownerId), JSON.stringify(savedAgentsSchema.parse(agents)))
  },
}
