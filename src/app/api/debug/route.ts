import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/route-guard';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const isVercel = process.env.VERCEL === '1';

  const config = {
    platform: isVercel ? 'vercel' : 'local',
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'cobranzas-kc',
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    },
    nodeEnv: process.env.NODE_ENV,
  };

  let firestoreTest = 'not_tested';
  try {
    const { findManyProfiles } = await import('@/lib/firestore-db');
    const profiles = await findManyProfiles();
    firestoreTest = `OK - ${profiles.length} profiles found`;
  } catch (err) {
    firestoreTest = `Error: ${String(err)}`;
  }

  return NextResponse.json({
    success: true,
    config,
    firestoreTest,
    timestamp: new Date().toISOString(),
  });
}
