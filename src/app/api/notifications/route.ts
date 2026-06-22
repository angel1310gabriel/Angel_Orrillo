import { NextRequest, NextResponse } from 'next/server';
import { isVercel } from '@/lib/db';

async function getSupabase() {
  try {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const envKey = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(envUrl, envKey);
    }
  } catch {
    // Not configured
  }
  return null;
}

// GET /api/notifications - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    const { isSupabaseConfigured } = await import('@/lib/supabase-server');
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (collectorId) {
      query = query.eq('user_id', collectorId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Notifications] Supabase query error:', error.message);
      return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
    }

    const notifications = (data || []).map((n: Record<string, unknown>) => ({
      id: n.id,
      userId: n.user_id,
      sentById: n.sent_by_id,
      title: n.title,
      body: n.body,
      type: n.type,
      referenceType: n.reference_type,
      referenceId: n.reference_id,
      isRead: n.is_read,
      createdAt: n.created_at,
    }));

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}

// PUT /api/notifications - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de ids' }, { status: 400 });
    }

    const { isSupabaseConfigured } = await import('@/lib/supabase-server');
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (error) {
      console.error('[Notifications] Supabase update error:', error.message);
      return NextResponse.json({ error: 'Error al actualizar notificaciones' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json({ error: 'Error al actualizar notificaciones' }, { status: 500 });
  }
}

// DELETE /api/notifications - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 });
    }

    const { isSupabaseConfigured } = await import('@/lib/supabase-server');
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Notifications] Supabase delete error:', error.message);
      return NextResponse.json({ error: 'Error al eliminar notificación' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Error al eliminar notificación' }, { status: 500 });
  }
}
