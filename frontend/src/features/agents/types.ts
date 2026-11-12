import type { AgentFormValues } from 'backend/validator/agent'

export type SavedAgent = AgentFormValues & {
  id: string
  createdAt: string
  updatedAt: string
}
