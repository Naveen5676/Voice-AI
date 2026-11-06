import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { authApi } from '../../auth/api/auth-api'
import type { AgentDraft } from '../types'

type AgentsState = { ownerId: string | null; items: AgentDraft[] }
const initialState: AgentsState = { ownerId: null, items: [] }

const agentsSlice = createSlice({
  name: 'agents', initialState,
  reducers: {
    workspaceLoaded: (_state, action: PayloadAction<AgentsState>) => action.payload,
    agentSaved: (state, action: PayloadAction<{ ownerId: string; agent: AgentDraft }>) => {
      if (state.ownerId !== action.payload.ownerId) return
      const index = state.items.findIndex((agent) => agent.id === action.payload.agent.id)
      if (index === -1) state.items.unshift(action.payload.agent)
      else state.items[index] = action.payload.agent
    },
    workspaceCleared: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addMatcher(authApi.endpoints.getSession.matchFulfilled, (state, { payload }) => {
      if (!payload || (state.ownerId && state.ownerId !== payload.id)) return initialState
    })
  },
})

export const { workspaceLoaded, agentSaved, workspaceCleared } = agentsSlice.actions
export const agentsReducer = agentsSlice.reducer
