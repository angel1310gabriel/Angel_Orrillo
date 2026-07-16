import { NextRequest, NextResponse } from 'next/server';
import { findMany, deleteDoc, collections } from '@/lib/firestore-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, userId } = body;

    if (!endpoint || !userId) {
      return NextResponse.json({ error: 'endpoint y userId requeridos' }, { status: 400 });
    }

    // Find matching subscription documents
    const matches = await findMany(collections.pushSubscriptions, {
      user_id: userId,
      endpoint: endpoint,
    });

    for (const doc of matches) {
      await deleteDoc(collections.pushSubscriptions, doc.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Error al desuscribir' }, { status: 500 });
  }
}
