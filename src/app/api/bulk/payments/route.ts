import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BulkPaymentAction {
  action: 'delete' | 'export' | 'resend_receipt' | 'approve';
  paymentIds: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkPaymentAction = await request.json();
    const { action, paymentIds } = body;

    if (!action || !paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json({ error: 'action y paymentIds[] requeridos' }, { status: 400 });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of paymentIds) {
      try {
        switch (action) {
          case 'delete': {
            const { data: payment } = await supabase.from('payments').select('loan_id, amount').eq('id', id).single();
            if (payment) {
              await supabase.from('payments').delete().eq('id', id);
              // Recalculate loan
              const { data: loan } = await supabase.from('loans').select('amount_paid').eq('id', payment.loan_id).single();
              if (loan) {
                const newPaid = Math.max(0, (loan.amount_paid || 0) - payment.amount);
                const newStatus = newPaid === 0 ? 'active' : newPaid >= (await supabase.from('loans').select('total_amount').eq('id', payment.loan_id).single()).data?.total_amount ? 'completed' : 'active';
                await supabase.from('loans').update({ amount_paid: newPaid, status: newStatus }).eq('id', payment.loan_id);
              }
            }
            break;
          }
          case 'resend_receipt': {
            await supabase.from('notifications').insert({
              payment_id: id,
              type: 'receipt',
              title: 'Recibo de pago',
              body: 'Se ha reenviado su recibo de pago.',
              reference_type: 'payment',
              reference_id: id,
            });
            break;
          }
          case 'approve': {
            await supabase.from('daily_settlements').update({ status: 'approved' }).eq('id', id);
            break;
          }
          case 'export': {
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
      processed: paymentIds.length,
      succeeded: successCount,
      failed: paymentIds.length - successCount,
      results,
    });
  } catch (error) {
    console.error('Bulk payments error:', error);
    return NextResponse.json({ error: 'Error en acción bulk' }, { status: 500 });
  }
}