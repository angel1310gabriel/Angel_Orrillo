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

function mapExpense(raw: Record<string, unknown>) {
  return {
    id: raw.id,
    collectorId: raw.collector_id,
    amount: raw.amount,
    category: raw.category,
    description: raw.description,
    expenseDate: raw.expense_date,
    receiptPhoto: raw.receipt_photo,
    status: raw.status,
    approvedBy: raw.approved_by,
    createdAt: raw.created_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');
    const status = searchParams.get('status');

    let query = supabase.from('collector_expenses').select('*').order('created_at', { ascending: false });

    if (collectorId) {
      query = query.eq('collector_id', collectorId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[CollectorExpenses] Supabase query error:', error.message);
      return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
    }

    const expenses = (data || []).map(mapExpense);
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching collector expenses:', error);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const body = await request.json();
    const { collectorId, amount, category, description, expenseDate, receiptPhoto } = body;

    const { data, error } = await supabase.from('collector_expenses').insert({
      collector_id: collectorId,
      amount,
      category,
      description,
      expense_date: expenseDate,
      receipt_photo: receiptPhoto,
      status: 'pending',
    }).select().single();

    if (error) {
      console.error('[CollectorExpenses] Supabase insert error:', error.message);
      return NextResponse.json({ error: 'Error al crear gasto' }, { status: 500 });
    }

    return NextResponse.json(mapExpense(data as Record<string, unknown>), { status: 201 });
  } catch (error) {
    console.error('Error creating collector expense:', error);
    return NextResponse.json({ error: 'Error al crear gasto' }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de gasto requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { status, approvedBy } = body;

    const { error } = await supabase.from('collector_expenses').update({
      status,
      approved_by: approvedBy,
    }).eq('id', id);

    if (error) {
      console.error('[CollectorExpenses] Supabase update error:', error.message);
      return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating collector expense:', error);
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 503 });
  }
}
