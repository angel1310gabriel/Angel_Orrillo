import { NextRequest, NextResponse } from 'next/server';
import { findMany, findById, createDoc, deleteDoc, collections } from '@/lib/firestore-db';

// GET /api/payment-links - List payment links
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const clientId = searchParams.get('clientId');

    const where: Record<string, unknown> = {};
    if (loanId) where.loanId = loanId;
    if (clientId) where.clientId = clientId;

    const paymentLinks = await findMany(collections.paymentLinks, where, { field: 'createdAt', direction: 'desc' });
    return NextResponse.json(paymentLinks);
  } catch (error) {
    console.error('[PaymentLinks] Error fetching payment links:', error);
    return NextResponse.json({ error: 'Error al obtener enlaces de pago' }, { status: 500 });
  }
}

// POST /api/payment-links - Create a payment link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, clientId, amount, linkUrl, qrCodeUrl, sentVia } = body;

    const created = await createDoc(collections.paymentLinks, {
      loanId,
      clientId,
      amount,
      linkUrl: linkUrl || null,
      qrCodeUrl: qrCodeUrl || null,
      status: 'pending',
      sentVia: sentVia || null,
      sentAt: null,
      paidAt: null,
      expiresAt: null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[PaymentLinks] Error creating payment link:', error);
    return NextResponse.json({ error: 'Error al crear enlace de pago' }, { status: 500 });
  }
}

// DELETE /api/payment-links?id=xxx - Delete a payment link
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de enlace de pago requerido' }, { status: 400 });
    }

    await deleteDoc(collections.paymentLinks, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PaymentLinks] Error deleting payment link:', error);
    return NextResponse.json({ error: 'Error al eliminar enlace de pago' }, { status: 500 });
  }
}
