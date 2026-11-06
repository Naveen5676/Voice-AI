import { useCallback, useEffect, useState } from 'react'
import type { AgentFormValues } from 'backend/validator/agent'
import { useAppDispatch, useAppSelector } from '../../../app/store'
import { useGetSessionQuery } from '../../auth/api/auth-api'
import { localAgentRepository } from '../data/local-agent-repository'
import { agentSaved, workspaceLoaded } from '../store/agents-slice'
import type { AgentDraft } from '../types'

const empty: AgentDraft[] = []

export function useAgentWorkspace() {
  const { data: user } = useGetSessionQuery()
  const ownerId = user?.id
  const workspace = useAppSelector((state) => state.agents)
  const dispatch = useAppDispatch()
  const [error, setError] = useState<string | null>(null)
  const ready = !!ownerId && workspace.ownerId === ownerId
  const agents = ready ? workspace.items : empty

  const load = useCallback(() => {
    if (!ownerId) return
    setError(null)
    try {
      dispatch(workspaceLoaded({ ownerId, items: localAgentRepository.list(ownerId) }))
    } catch {
      setError('We couldn’t read your saved agents. Check browser storage permissions and try again. Existing data has been left untouched.')
    }
  }, [dispatch, ownerId])

  useEffect(() => { if (!ready) load() }, [ready, load])

  function saveAgent(values: AgentFormValues, id?: string): AgentDraft {
    if (!ownerId || !ready) throw new Error('Your workspace is not ready. Please try again.')
    const existing = id ? agents.find((agent) => agent.id === id) : undefined
    if (id && !existing) throw new Error('This agent could not be found.')
    const now = new Date().toISOString()
    const agent: AgentDraft = { ...values, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now }
    const next = existing ? agents.map((item) => item.id === id ? agent : item) : [agent, ...agents]
    try {
      localAgentRepository.save(ownerId, next)
    } catch {
      throw new Error('Your changes could not be saved. Browser storage may be full or unavailable. Keep this page open and try again.')
    }
    dispatch(agentSaved({ ownerId, agent }))
    return agent
  }

  return { agents, ready, error, retry: load, saveAgent }
}
