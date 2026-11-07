import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export function createPrismaClient(connectionString: string) {
  // PrismaPg currently expects UTC sessions for timestamptz. Preserve any URL
  // connection options while making date reads/writes independent of host time.
  const url = new URL(connectionString)
  url.searchParams.set('options', [url.searchParams.get('options'), '-c TimeZone=UTC'].filter(Boolean).join(' '))
  const adapter = new PrismaPg({ connectionString: url.toString(), max: 5, connectionTimeoutMillis: 10_000 })
  return new PrismaClient({ adapter })
}

export type Database = PrismaClient
