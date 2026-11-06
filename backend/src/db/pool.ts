import { Pool } from 'pg'

export function createPool(connectionString: string) {
  // PostgreSQL URL options control TLS, including sslmode=require for Neon.
  return new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000 })
}
