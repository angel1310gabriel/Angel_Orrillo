import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    let query = supabase.from('push_subscriptions').select('*');

    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    } else if (role) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', role);
      const ids = users?.map(u => u.id) || [];
      if (ids.length === 0) {
        return NextResponse.json({ success: true, sent: 0 });
      }
      query = query.in('user_id', ids);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const pushPromises = subscriptions.map(async (sub) => {
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
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
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