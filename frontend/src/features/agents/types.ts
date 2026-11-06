import type { AgentFormValues } from 'backend/validator/agent'

export type AgentDraft = AgentFormValues & {
  id: string
  createdAt: string
  updatedAt: string
}
