import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BulkLoanAction {
  action: 'remind' | 'reschedule' | 'cancel' | 'export' | 'reassign' | 'send_link';
  loanIds: string[];
  params?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkLoanAction = await request.json();
    const { action, loanIds, params } = body;

    if (!action || !loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'action y loanIds[] requeridos' }, { status: 400 });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of loanIds) {
      try {
        switch (action) {
          case 'remind': {
            await supabase.from('notifications').insert({
              loan_id: id,
              type: 'reminder',
              title: 'Recordatorio de pago',
              body: params?.message || 'Recuerde su pago programado para hoy.',
              reference_type: 'loan',
              reference_id: id,
            });
            break;
          }
          case 'send_link': {
            const { data: loan } = await supabase.from('loans').select('client_id').eq('id', id).single();
            if (loan?.client_id) {
              await supabase.from('payment_links').insert({
                loan_id: id,
                client_id: loan.client_id,
                amount: params?.amount,
                method: params?.method || 'plin',
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              });
            }
            break;
          }
          case 'reschedule': {
            const { days, reason } = params || {};
            if (days) {
              await supabase.from('loans').update({
                end_date: new Date(Date.now() + days * 86400000).toISOString(),
                notes: `${loanId} | Refinanciado: ${reason || 'Bulk action'}`,
              }).eq('id', id);
            }
            break;
          }
          case 'cancel': {
            await supabase.from('loans').update({
              status: 'cancelled',
              notes: `${loanId} | Cancelado en bulk: ${params?.reason || 'Bulk action'}`,
            }).eq('id', id);
            break;
          }
          case 'reassign': {
            const { collectorId } = params || {};
            if (collectorId) {
              await supabase.from('loans').update({ collector_id: collectorId }).eq('id', id);
            }
            break;
          }
          case 'export': {
            // Handled client-side
            break;
          }
          default:
            throw new Error(`Acción no soportada: ${action}`);
        }
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      processed: loanIds.length,
      succeeded: successCount,
      failed: loanIds.length - successCount,
      results,
    });
  } catch (error) {
    console.error('Bulk loans error:', error);
    return NextResponse.json({ error: 'Error en acción bulk' }, { status: 500 });
  }
}