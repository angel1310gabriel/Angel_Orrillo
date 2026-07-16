import { NextRequest, NextResponse } from 'next/server';
import { findById, deleteDoc, updateDoc, createDoc, collections } from '@/lib/firestore-db';

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
            const payment = await findById(collections.payments, id);
            if (payment) {
              await deleteDoc(collections.payments, id);
              const loan = await findById(collections.loans, payment.loan_id);
              if (loan) {
                const newPaid = Math.max(0, (loan.amount_paid || 0) - payment.amount);
                const newStatus = newPaid === 0 ? 'active' : newPaid >= loan.total_amount ? 'completed' : 'active';
                await updateDoc(collections.loans, payment.loan_id, { amount_paid: newPaid, status: newStatus });
              }
            }
            break;
          }
          case 'resend_receipt': {
            await createDoc(collections.notifications, {
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
            await updateDoc(collections.dailySettlements, id, { status: 'approved' });
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
