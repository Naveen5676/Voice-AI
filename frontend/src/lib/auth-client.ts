import { createAuthClient } from 'better-auth/client'

// Same-origin in production; Vite proxies /api in development.
export const authClient = createAuthClient()
