import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { useDispatch, useSelector } from 'react-redux'
import { authApi } from '../features/auth/api/auth-api'
import { agentsReducer } from '../features/agents/store/agents-slice'

export const store = configureStore({
  reducer: { [authApi.reducerPath]: authApi.reducer, agents: agentsReducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware),
})
setupListeners(store.dispatch)
export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>()
export const useAppSelector = useSelector.withTypes<ReturnType<typeof store.getState>>()
