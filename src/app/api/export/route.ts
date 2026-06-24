import { NextRequest, NextResponse } from 'next/server';

function escapeCSV(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows: Record<string, unknown>[], headers: string[], keys: string[]): string {
  const lines: string[] = [headers.map(escapeCSV).join(',')];
  for (const row of rows) {
    lines.push(keys.map((k) => escapeCSV(row[k])).join(','));
  }
  return lines.join('\r\n');
}

async function getSupabase() {
  try {
    const { isSupabaseConfigured, getSupabaseServerClient } = await import('@/lib/supabase-server');
    if (!isSupabaseConfigured()) return null;
    return getSupabaseServerClient();
  } catch {
    return null;
  }
}

interface ExportConfig {
  headers: string[];
  keys: string[];
  fetchData: (supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>) => Promise<Record<string, unknown>[]>;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

const EXPORTS: Record<string, ExportConfig> = {
  clients: {
    headers: ['ID', 'Nombre', 'Documento', 'Teléfono', 'Dirección', 'Score', 'Estado', 'Creado'],
    keys: ['id', 'name', 'dni', 'phone', 'address', 'credit_score', 'status', 'created_at'],
    fetchData: async (supabase) => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, dni, phone, address, credit_score, status, created_at');
      return (data || []) as Record<string, unknown>[];
    },
  },
  loans: {
    headers: ['ID', 'Cliente', 'Monto', 'Total', 'Pagado', 'Interés', 'Días', 'Estado', 'Creado'],
    keys: ['id', 'client_name', 'amount', 'total_amount', 'amount_paid', 'interest_rate', 'days', 'status', 'created_at'],
    fetchData: async (supabase) => {
      const { data } = await supabase
        .from('loans')
        .select('id, client:client_id(name), amount, total_amount, amount_paid, interest_rate, days, status, created_at');
      return ((data || []) as Record<string, unknown>[]).map((r) => ({
        ...r,
        client_name: (r.client as { name?: string } | null)?.name || '',
        client: undefined,
      }));
    },
  },
  payments: {
    headers: ['ID', 'Cliente', 'Préstamo', 'Monto', 'Método', 'Fecha Pago', 'Estado'],
    keys: ['id', 'client_name', 'loan_amount', 'amount', 'payment_method', 'payment_date', 'status'],
    fetchData: async (supabase) => {
      const { data } = await supabase
        .from('payments')
        .select('id, loan:loan_id(client:client_id(name), amount), amount, payment_method, payment_date, status');
      return ((data || []) as Record<string, unknown>[]).map((r) => {
        const loan = r.loan as { amount?: number; client?: { name?: string } } | null;
        return {
          ...r,
          client_name: loan?.client?.name || '',
          loan_amount: loan?.amount || 0,
          loan: undefined,
        };
      });
    },
  },
  'late-fees': {
    headers: ['ID', 'Cliente', 'Préstamo', 'Monto', 'Días Atraso', 'Estado', 'Creado'],
    keys: ['id', 'client_name', 'loan_amount', 'amount', 'days_late', 'status', 'created_at'],
    fetchData: async (supabase) => {
      const { data } = await supabase
        .from('late_fees')
        .select('id, loan:loan_id(client:client_id(name), amount), amount, days_late, status, created_at');
      return ((data || []) as Record<string, unknown>[]).map((r) => {
        const loan = r.loan as { amount?: number; client?: { name?: string } } | null;
        return {
          ...r,
          client_name: loan?.client?.name || '',
          loan_amount: loan?.amount || 0,
          loan: undefined,
        };
      });
    },
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !EXPORTS[type]) {
      return NextResponse.json({ error: 'Tipo de exportación inválido' }, { status: 400 });
    }

    const supabase = await getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
    }

    const config = EXPORTS[type];
    const rows = await config.fetchData(supabase);
    const csv = toCSV(rows, config.headers, config.keys);
    const filename = `${type}-${today()}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Error al exportar datos' }, { status: 500 });
  }
}
