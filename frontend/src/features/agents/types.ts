import type { AgentFormValues } from 'backend/validator/agent'

export type SavedAgent = AgentFormValues & {
  id: string
  knowledgeBaseId?: string | null
  createdAt: string
  updatedAt: string
}

export type KnowledgeBase = {
  id: string
  name: string
  description: string
  itemCount: number
  agentCount: number
  createdAt: string
  updatedAt: string
  items?: KbItem[]
}

export type KbItem = {
  id: string
  knowledgeBaseId: string
  title: string
  content: string
  charCount: number
  status: string
  createdAt: string
}

export type ProjectUsage = {
  user: {
    usedCalls: number
    limitCalls: number
    remainingCalls: number
    usedSeconds: number
    usedMinutes: number
    percentage: number
  }
  project: {
    totalCalls: number
    limitCalls: number
    remainingCalls: number
    percentage: number
    maxCallDurationMinutes: number
  }
}
