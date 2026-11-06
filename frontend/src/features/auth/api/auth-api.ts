import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { authClient } from '../../../lib/auth-client'
import type { AuthFormValues } from 'backend/validator/auth'

type AuthError = { message: string; status?: number }
type AuthUser = { id: string; name: string; email: string }

async function request<T>(action: () => Promise<{ data: T | null; error: { message?: string; status?: number } | null }>) {
  try {
    const result = await action()
    if (result.error) return { error: { message: result.error.message || 'Unable to complete your request.', status: result.error.status } }
    return { data: result.data }
  } catch {
    return { error: { message: 'Could not connect. Please check your connection and try again.' } }
  }
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fakeBaseQuery<AuthError>(),
  tagTypes: ['Session'],
  endpoints: (builder) => ({
    getSession: builder.query<AuthUser | null, void>({
      async queryFn() {
        const result = await request(() => authClient.getSession({ query: { disableCookieCache: true } }))
        if ('error' in result) return { error: result.error! }
        const user = result.data?.user
        // Keep only public user data in Redux, never session tokens or passwords.
        return { data: user ? { id: user.id, name: user.name, email: user.email } : null }
      },
      providesTags: ['Session'],
    }),
  }),
})

export const { useGetSessionQuery } = authApi

// Credential submissions stay outside Redux actions and DevTools history.
// Only the shared, public session state is cached in Redux.
export async function submitAuth(mode: 'login' | 'signup', { name, email, password }: AuthFormValues) {
  const result = await request(() => mode === 'signup'
    ? authClient.signUp.email({ name, email, password })
    : authClient.signIn.email({ email, password }))
  if ('error' in result) throw result.error
}

export async function signOut() {
  const result = await request(() => authClient.signOut())
  if ('error' in result) throw result.error
}

export function authErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return 'Something went wrong. Please try again.'
}
