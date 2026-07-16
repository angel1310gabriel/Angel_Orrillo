import { NextRequest, NextResponse } from 'next/server';
import { findMany, collections } from '@/lib/firestore-db';

// ============================================================
// /api/supabase-sync - Firestore health check
// GET:  Health check - returns Firestore connection status
// POST: No-op (legacy endpoint kept for compatibility)
// ============================================================

export async function GET() {
  try {
    // Quick health check by reading a single doc from settings
    const settings = await findMany(collections.settings, undefined, undefined, 1);

    return NextResponse.json({
      status: 'healthy',
      source: 'firestore',
      message: 'Firestore is connected and operational',
      timestamp: new Date().toISOString(),
      settingsCount: settings.length,
    });
  } catch (error) {
    console.error('Firestore health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        source: 'firestore',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json({
    status: 'ok',
    message: 'Sync endpoint is deprecated. Firestore is the sole database.',
    timestamp: new Date().toISOString(),
  });
}
