import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if running on Vercel (serverless - no persistent SQLite)
export const isVercel = process.env.VERCEL === '1'

// On Vercel, ensure DATABASE_URL points to a writable location
if (isVercel && process.env.DATABASE_URL) {
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

// Use a Proxy to lazily create the PrismaClient only when methods are called
// This prevents PrismaClient from being instantiated on Vercel when it's not needed
export const db = isVercel
  ? new Proxy({} as PrismaClient, {
      get(target, prop) {
        // Allow access to non-method properties without error
        if (prop === '$connect' || prop === '$disconnect') {
          return async () => {}
        }
        // For actual model access, try to create a real client
        const realClient = globalForPrisma.prisma ?? createPrismaClient()
        if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = realClient
        return (realClient as unknown as Record<string, unknown>)[prop]
      }
    })
  : (globalForPrisma.prisma ?? createPrismaClient())

if (!isVercel && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db as PrismaClient
}
