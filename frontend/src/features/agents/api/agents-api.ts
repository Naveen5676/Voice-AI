import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { AgentFormValues } from 'backend/validator/agent'
import type { KbItem, KnowledgeBase, SavedAgent } from '../types'
import type { PromptTemplate } from '../data/prompt-templates'

// ownerId scopes cache entries; the server derives ownership from cookies.
export const agentsApi = createApi({
  reducerPath: 'agentsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'same-origin' }),
  tagTypes: ['Agents', 'Agent', 'Templates', 'KnowledgeBases', 'KbNotes'],
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
    deleteAgent: builder.mutation<{ id: string }, { ownerId: string; id: string }>({
      query: ({ id }) => ({ url: `/agents/${encodeURIComponent(id)}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => ['Agents', { type: 'Agent', id }],
    }),
    templates: builder.query<PromptTemplate[], string>({
      query: () => '/agent-templates',
      transformResponse: (body: { templates: PromptTemplate[] }) => body.templates,
      providesTags: ['Templates'],
    }),

    // Knowledge Bases
    listKnowledgeBases: builder.query<KnowledgeBase[], string>({
      query: () => '/knowledge-bases',
      transformResponse: (body: { knowledgeBases: KnowledgeBase[] }) => body.knowledgeBases,
      providesTags: ['KnowledgeBases'],
    }),
    getKnowledgeBase: builder.query<KnowledgeBase, { ownerId: string; kbId: string }>({
      query: ({ kbId }) => `/knowledge-bases/${encodeURIComponent(kbId)}`,
      transformResponse: (body: { knowledgeBase: KnowledgeBase }) => body.knowledgeBase,
      providesTags: (_result, _error, { kbId }) => [{ type: 'KnowledgeBases', id: kbId }],
    }),
    createKnowledgeBase: builder.mutation<KnowledgeBase, { ownerId: string; name: string; description?: string }>({
      query: ({ name, description }) => ({
        url: '/knowledge-bases',
        method: 'POST',
        body: { name, description },
      }),
      transformResponse: (body: { knowledgeBase: KnowledgeBase }) => body.knowledgeBase,
      invalidatesTags: ['KnowledgeBases'],
    }),
    deleteKnowledgeBase: builder.mutation<{ ok: boolean; id: string }, { ownerId: string; kbId: string }>({
      query: ({ kbId }) => ({
        url: `/knowledge-bases/${encodeURIComponent(kbId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['KnowledgeBases', 'Agents'],
    }),

    // Knowledge Base Notes
    listKbNotes: builder.query<KbItem[], { ownerId: string; kbId: string }>({
      query: ({ kbId }) => `/knowledge-bases/${encodeURIComponent(kbId)}/items`,
      transformResponse: (body: { items: KbItem[] }) => body.items,
      providesTags: (_result, _error, { kbId }) => [{ type: 'KbNotes', id: kbId }],
    }),
    addKbNote: builder.mutation<KbItem, { ownerId: string; kbId: string; title: string; content: string }>({
      query: ({ kbId, title, content }) => ({
        url: `/knowledge-bases/${encodeURIComponent(kbId)}/items`,
        method: 'POST',
        body: { title, content },
      }),
      transformResponse: (body: { item: KbItem }) => body.item,
      invalidatesTags: (_result, _error, { kbId }) => [{ type: 'KbNotes', id: kbId }, 'KnowledgeBases'],
    }),
    deleteKbNote: builder.mutation<{ ok: boolean; id: string }, { ownerId: string; kbId: string; itemId: string }>({
      query: ({ kbId, itemId }) => ({
        url: `/knowledge-bases/${encodeURIComponent(kbId)}/items/${encodeURIComponent(itemId)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { kbId }) => [{ type: 'KbNotes', id: kbId }, 'KnowledgeBases'],
    }),
  }),
})

export const {
  useListAgentsQuery,
  useGetAgentQuery,
  useSaveAgentMutation,
  useDeleteAgentMutation,
  useTemplatesQuery,
  useListKnowledgeBasesQuery,
  useGetKnowledgeBaseQuery,
  useCreateKnowledgeBaseMutation,
  useDeleteKnowledgeBaseMutation,
  useListKbNotesQuery,
  useAddKbNoteMutation,
  useDeleteKbNoteMutation,
} = agentsApi

export function agentErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = error.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message
  }
  return 'Could not complete your request. Check your connection and try again.'
}
