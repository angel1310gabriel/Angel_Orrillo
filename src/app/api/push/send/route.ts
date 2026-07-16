import { NextRequest, NextResponse } from 'next/server';
import { findMany, deleteDoc, findFirst, collections } from '@/lib/firestore-db';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@kc-cobranzas.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  actions?: { action: string; title: string }[];
  userIds?: string[];
  role?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: PushPayload = await request.json();
    const { title, body, tag, url, actions, userIds, role } = payload;

    if (!title || !body) {
      return NextResponse.json({ error: 'title y body requeridos' }, { status: 400 });
    }

    let subscriptions: any[] = [];

    if (userIds && userIds.length > 0) {
      // Fetch subscriptions for specific users
      for (const uid of userIds) {
        const subs = await findMany(collections.pushSubscriptions, { user_id: uid });
        subscriptions.push(...subs);
      }
    } else if (role) {
      const users = await findMany(collections.profiles, { role });
      const ids = users.map((u: any) => u.id);
      if (ids.length === 0) {
        return NextResponse.json({ success: true, sent: 0 });
      }
      for (const uid of ids) {
        const subs = await findMany(collections.pushSubscriptions, { user_id: uid });
        subscriptions.push(...subs);
      }
    } else {
      subscriptions = await findMany(collections.pushSubscriptions);
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const pushPromises = subscriptions.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title, body, tag, url, actions })
        );
        return { success: true };
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Remove expired subscription
          const existing = await findFirst(collections.pushSubscriptions, { endpoint: sub.endpoint });
          if (existing) {
            await deleteDoc(collections.pushSubscriptions, existing.id);
          }
        }
        return { success: false, error: err.message };
      }
    });

    const results = await Promise.allSettled(pushPromises);
    const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

    return NextResponse.json({ success: true, sent, total: subscriptions.length });
  } catch (error) {
    console.error('Push send error:', error);
    return NextResponse.json({ error: 'Error al enviar push' }, { status: 500 });
  }
}
