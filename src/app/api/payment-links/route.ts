import { NextRequest, NextResponse } from 'next/server';

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

// GET /api/payment-links - List payment links
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const clientId = searchParams.get('clientId');

    let query = supabase.from('payment_links').select('*').order('created_at', { ascending: false });

    if (loanId) {
      query = query.eq('loan_id', loanId);
    }
    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[PaymentLinks] Supabase query error:', error.message);
      return NextResponse.json({ error: 'Error al obtener enlaces de pago' }, { status: 503 });
    }

    const paymentLinks = (data || []).map((item: Record<string, unknown>) => ({
      id: item.id,
      loanId: item.loan_id,
      clientId: item.client_id,
      amount: item.amount,
      linkUrl: item.link_url,
      qrCodeUrl: item.qr_code_url,
      status: item.status,
      sentVia: item.sent_via,
      sentAt: item.sent_at,
      paidAt: item.paid_at,
      expiresAt: item.expires_at,
      createdAt: item.created_at,
    }));

    return NextResponse.json(paymentLinks);
  } catch (error) {
    console.error('[PaymentLinks] Error fetching payment links:', error);
    return NextResponse.json({ error: 'Error al obtener enlaces de pago' }, { status: 503 });
  }
}

// POST /api/payment-links - Create a payment link
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const body = await request.json();
    const { loanId, clientId, amount, linkUrl, qrCodeUrl, sentVia } = body;

    const { data, error } = await supabase
      .from('payment_links')
      .insert({
        loan_id: loanId,
        client_id: clientId,
        amount,
        link_url: linkUrl,
        qr_code_url: qrCodeUrl,
        sent_via: sentVia,
      })
      .select()
      .single();

    if (error) {
      console.error('[PaymentLinks] Supabase insert error:', error.message);
      return NextResponse.json({ error: 'Error al crear enlace de pago' }, { status: 500 });
    }

    const created = {
      id: data.id,
      loanId: data.loan_id,
      clientId: data.client_id,
      amount: data.amount,
      linkUrl: data.link_url,
      qrCodeUrl: data.qr_code_url,
      status: data.status,
      sentVia: data.sent_via,
      sentAt: data.sent_at,
      paidAt: data.paid_at,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
    };

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[PaymentLinks] Error creating payment link:', error);
    return NextResponse.json({ error: 'Error al crear enlace de pago' }, { status: 500 });
  }
}

// DELETE /api/payment-links?id=xxx - Delete a payment link
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de enlace de pago requerido' }, { status: 400 });
    }

    const { error } = await supabase.from('payment_links').delete().eq('id', id);

    if (error) {
      console.error('[PaymentLinks] Supabase delete error:', error.message);
      return NextResponse.json({ error: 'Error al eliminar enlace de pago' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PaymentLinks] Error deleting payment link:', error);
    return NextResponse.json({ error: 'Error al eliminar enlace de pago' }, { status: 500 });
  }
}
