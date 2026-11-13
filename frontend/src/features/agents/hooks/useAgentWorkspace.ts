import { useEffect, useRef } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import type { AgentFormValues } from 'backend/validator/agent'
import { useGetSessionQuery } from '../../auth/api/auth-api'
import { agentErrorMessage, useDeleteAgentMutation, useGetAgentQuery, useListAgentsQuery, useSaveAgentMutation, useTemplatesQuery } from '../api/agents-api'

export function useAgentWorkspace(agentId?: string) {
  const { data: user } = useGetSessionQuery()
  const ownerId = user?.id
  const owner = useRef(ownerId)
  useEffect(() => {
    owner.current = ownerId
    return () => { owner.current = undefined }
  }, [ownerId])
  const list = useListAgentsQuery(ownerId && !agentId ? ownerId : skipToken)
  const detail = useGetAgentQuery(ownerId && agentId ? { ownerId, id: agentId } : skipToken)
  const templates = useTemplatesQuery(ownerId ?? skipToken)
  const [save] = useSaveAgentMutation()
  const [remove] = useDeleteAgentMutation()
  const query = agentId ? detail : list

  async function saveAgent(values: AgentFormValues, id?: string) {
    if (!ownerId) throw new Error('Please sign in before saving.')
    try {
      const agent = await save({ ownerId, id, values }).unwrap()
      if (owner.current !== ownerId) throw new Error('Your account changed. Open the current workspace before saving again.')
      return agent
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error(agentErrorMessage(error))
    }
  }

  async function deleteAgent(id: string) {
    if (!ownerId) throw new Error('Please sign in before deleting.')
    try {
      const result = await remove({ ownerId, id }).unwrap()
      if (owner.current !== ownerId) throw new Error('Your account changed. Open the current workspace before deleting again.')
      return result
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error(agentErrorMessage(error))
    }
  }

  const error = query.error ?? templates.error
  return {
    ownerId,
    agents: list.currentData ?? [],
    agent: detail.currentData,
    templates: templates.currentData ?? [],
    ready: !!ownerId && !!query.currentData && !!templates.currentData,
    notFound: !!detail.error && 'status' in detail.error && detail.error.status === 404,
    error: error ? agentErrorMessage(error) : null,
    retry: () => { void query.refetch(); void templates.refetch() },
    saveAgent,
    deleteAgent,
  }
}
