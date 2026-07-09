import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if running on Vercel (serverless - no persistent SQLite)
export const isVercel = process.env.VERCEL === '1'

// On Vercel, keep PostgreSQL URL; only override if it's a local SQLite path
if (isVercel && process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
  if (!process.env.DATABASE_URL.includes('/tmp')) {
    process.env.DATABASE_URL = 'file:/tmp/kc-cobranzas.db'
  }
}

// ============================================================
// Lazy PrismaClient - only created when actually accessed
// On Vercel, this should rarely be needed (use Supabase instead)
// ============================================================

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.DEBUG_PRISMA === 'true' ? ['query'] : [],
  })
}

// Singleton PrismaClient — cached in globalThis across all environments
export const db = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db as PrismaClient
