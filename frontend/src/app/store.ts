import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { useDispatch } from 'react-redux'
import { authApi } from '../features/auth/api/auth-api'

export const store = configureStore({
  reducer: { [authApi.reducerPath]: authApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware),
})
setupListeners(store.dispatch)
export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>()
