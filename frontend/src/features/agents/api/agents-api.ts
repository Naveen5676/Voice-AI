import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { AgentFormValues } from 'backend/validator/agent'
import type { SavedAgent } from '../types'
import type { PromptTemplate } from '../data/prompt-templates'

// ownerId scopes cache entries; the server derives ownership from cookies.
export const agentsApi = createApi({
  reducerPath: 'agentsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' }),
  tagTypes: ['Agents', 'Agent', 'Templates'],
  endpoints: (builder) => ({
    listAgents: builder.query<SavedAgent[], string>({
      query: () => '/agents',
      transformResponse: (body: { agents: SavedAgent[] }) => body.agents,
      providesTags: ['Agents'],
    }),
    getAgent: builder.query<SavedAgent, { ownerId: string; id: string }>({
      query: ({ id }) => `/agents/${encodeURIComponent(id)}`,
      transformResponse: (body: { agent: SavedAgent }) => body.agent,
      providesTags: (_result, _error, { id }) => [{ type: 'Agent', id }],
    }),
    saveAgent: builder.mutation<SavedAgent, { ownerId: string; id?: string; values: AgentFormValues }>({
      query: ({ id, values }) => ({ url: id ? `/agents/${encodeURIComponent(id)}` : '/agents', method: id ? 'PATCH' : 'POST', body: values }),
      transformResponse: (body: { agent: SavedAgent }) => body.agent,
      invalidatesTags: (_result, _error, { id }) => ['Agents', ...(id ? [{ type: 'Agent' as const, id }] : [])],
    }),
    templates: builder.query<PromptTemplate[], string>({
      query: () => '/agent-templates',
      transformResponse: (body: { templates: PromptTemplate[] }) => body.templates,
      providesTags: ['Templates'],
    }),
  }),
})

export const { useListAgentsQuery, useGetAgentQuery, useSaveAgentMutation, useTemplatesQuery } = agentsApi

export function agentErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message
  }
  return 'Could not save or load your agent. Check your connection and try again. Your edits have been kept. If a new save lost its response, check All agents before saving again.'
}
