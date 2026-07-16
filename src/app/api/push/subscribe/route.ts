import { NextRequest, NextResponse } from 'next/server';
import { findFirst, createDoc, updateDoc, collections } from '@/lib/firestore-db';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription || !userId) {
      return NextResponse.json({ error: 'subscription y userId requeridos' }, { status: 400 });
    }

    // Find existing subscription for this user+endpoint
    const existing = await findFirst(collections.pushSubscriptions, {
      user_id: userId,
      endpoint: subscription.endpoint,
    });

    if (existing) {
      await updateDoc(collections.pushSubscriptions, existing.id, {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || '',
      });
    } else {
      await createDoc(collections.pushSubscriptions, {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || '',
      });
    }

    return NextResponse.json({ success: true, vapidPublicKey: VAPID_PUBLIC_KEY });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Error al suscribir' }, { status: 500 });
  }
}
