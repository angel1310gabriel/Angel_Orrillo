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

function mapChargeOffEntry(entry: Record<string, unknown>) {
  return {
    id: entry.id,
    loanId: entry.loan_id,
    amountWrittenOff: entry.amount_written_off,
    reason: entry.reason,
    writtenOffBy: entry.written_off_by,
    writtenOffAt: entry.written_off_at,
    recoveredAmount: entry.recovered_amount,
    recoveredAt: entry.recovered_at,
    notes: entry.notes,
    createdAt: entry.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    let query = supabase
      .from('charge_off_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (loanId) {
      query = query.eq('loan_id', loanId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ChargeOff] Supabase query error:', error.message);
      return NextResponse.json({ error: 'Error al obtener historial de castigos' }, { status: 503 });
    }

    return NextResponse.json((data || []).map(mapChargeOffEntry));
  } catch (error) {
    console.error('Error fetching charge-off history:', error);
    return NextResponse.json({ error: 'Error al obtener historial de castigos' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const body = await request.json();
    const { loanId, amountWrittenOff, reason, writtenOffBy, notes } = body;

    if (!loanId || amountWrittenOff === undefined) {
      return NextResponse.json({ error: 'loanId y amountWrittenOff son requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('charge_off_history')
      .insert({
        loan_id: loanId,
        amount_written_off: amountWrittenOff,
        reason: reason || null,
        written_off_by: writtenOffBy || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[ChargeOff] Supabase insert error:', error.message);
      return NextResponse.json({ error: 'Error al crear castigo' }, { status: 500 });
    }

    const { error: loanError } = await supabase
      .from('loans')
      .update({ status: 'charged_off' })
      .eq('id', loanId);

    if (loanError) {
      console.error('[ChargeOff] Loan status update error:', loanError.message);
    }

    return NextResponse.json(mapChargeOffEntry(data), { status: 201 });
  } catch (error) {
    console.error('Error creating charge-off:', error);
    return NextResponse.json({ error: 'Error al crear castigo' }, { status: 500 });
  }
}
