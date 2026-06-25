import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription || !userId) {
      return NextResponse.json({ error: 'subscription y userId requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;

    return NextResponse.json({ success: true, vapidPublicKey: VAPID_PUBLIC_KEY });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Error al suscribir' }, { status: 500 });
  }
}