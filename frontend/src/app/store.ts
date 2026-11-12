import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { useDispatch, useSelector } from 'react-redux'
import { authApi } from '../features/auth/api/auth-api'
import { agentsApi } from '../features/agents/api/agents-api'

export const store = configureStore({
  reducer: { [authApi.reducerPath]: authApi.reducer, [agentsApi.reducerPath]: agentsApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware, agentsApi.middleware),
})
setupListeners(store.dispatch)
let activeOwner: string | undefined
store.subscribe(() => {
  const owner = authApi.endpoints.getSession.select()(store.getState()).data?.id
  if (owner === activeOwner) return
  activeOwner = owner
  for (const request of store.dispatch(agentsApi.util.getRunningQueriesThunk())) request.abort()
  for (const request of store.dispatch(agentsApi.util.getRunningMutationsThunk())) request.abort()
  store.dispatch(agentsApi.util.resetApiState())
})
export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>()
export const useAppSelector = useSelector.withTypes<ReturnType<typeof store.getState>>()
